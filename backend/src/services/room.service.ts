import { supabaseAdmin } from '../lib/supabase';
import {
  CreateRoomPayload,
  JoinRoomPayload,
  LeaderboardEntry,
  Room,
  RoomFeedEvent,
  RoomMember,
  RoomPreview,
  RoomStatus,
  RoomType,
} from '../types/room.types';
import { generateRoomCode } from '../utils/roomCode';
import { XpService } from './xp.service';

interface AppErrorOptions {
  statusCode?: number;
  code?: string;
  cause?: unknown;
}

export class RoomServiceError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly cause?: unknown;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message);
    this.name = 'RoomServiceError';
    this.statusCode = options.statusCode ?? 500;
    this.code = options.code ?? 'INTERNAL_ERROR';
    this.cause = options.cause;
  }
}

interface RoomRow {
  id: string;
  code: string;
  name: string;
  type: RoomType;
  owner_id: string;
  topic: string | null;
  plan_id: string | null;
  max_members: number;
  status: RoomStatus;
  is_private: boolean;
  created_at: string;
  ends_at: string | null;
}

interface UserPublicRow {
  id?: string;
  display_name: string;
  avatar_url: string | null;
}

interface RoomMemberRow {
  room_id: string;
  user_id: string;
  joined_at: string;
  elo_rating: number;
  total_room_xp: number;
  users: UserPublicRow | UserPublicRow[] | null;
  room_daily_log?: RoomDailyLogRow[];
}

interface RoomDailyLogRow {
  tasks_done: number | null;
  xp_earned: number | null;
  finish_position: number | null;
  started_at: string | null;
  completed_at: string | null;
}

interface RoomEventRow {
  id: string;
  room_id: string;
  user_id: string;
  event_type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  users: UserPublicRow | UserPublicRow[] | null;
}

interface RoomIdRow {
  id: string;
}

export class RoomService {
  private static readonly ROOM_CODE_RETRIES = 3;
  private readonly xpService = new XpService();

  // FIX: Added idempotent first-finish marker for room daily race bonuses.
  public async checkAndSetFirstFinish(roomId: string, userId: string): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0];

    const { data: existing } = await supabaseAdmin
      .from('room_daily_log')
      .select('finish_position')
      .eq('room_id', roomId)
      .eq('date', today)
      .not('finish_position', 'is', null)
      .limit(1);

    if (existing && existing.length > 0) return false;

    await supabaseAdmin
      .from('room_daily_log')
      .update({
        finish_position: 1,
        completed_at: new Date().toISOString(),
      })
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .eq('date', today);

    return true;
  }

  // FIX: Added idempotent all-members-complete room XP award flow.
  public async checkAndAwardAllComplete(roomId: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    const { data: alreadyFired } = await supabaseAdmin
      .from('room_events')
      .select('id')
      .eq('room_id', roomId)
      .eq('event_type', 'room_all_complete')
      .gte('created_at', `${today}T00:00:00.000Z`)
      .limit(1);

    if (alreadyFired && alreadyFired.length > 0) return;

    const { count: memberCount } = await supabaseAdmin
      .from('room_members')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId);

    const { count: completedCount } = await supabaseAdmin
      .from('room_daily_log')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId)
      .eq('date', today)
      .eq('tasks_done', 3);

    if (!memberCount || completedCount !== memberCount) return;

    const { data: members } = await supabaseAdmin
      .from('room_members')
      .select('user_id')
      .eq('room_id', roomId);

    if (!members) return;

    await Promise.all(
      members.map((member) =>
        this.xpService.awardXp({
          userId: member.user_id as string,
          amount: 20,
          reason: 'room_all_complete',
          roomId,
        })
      )
    );

    await supabaseAdmin.from('room_events').insert({
      room_id: roomId,
      user_id: null,
      event_type: 'room_all_complete',
      metadata: { xp_awarded_each: 20, member_count: memberCount },
    });
  }

  /**
   * Creates a new room, marks it active, and adds the owner as the first member.
   */
  public async createRoom(payload: CreateRoomPayload): Promise<Room> {
    const code = await this.generateUniqueRoomCode();

    const insertPayload = {
      code,
      name: payload.name.trim(),
      type: payload.type,
      owner_id: payload.ownerId,
      topic: payload.topic?.trim() ?? null,
      max_members: payload.maxMembers ?? 10,
      status: 'active' as const,
      is_private: payload.isPrivate ?? true,
    };

    const { data: roomData, error: roomInsertError } = await supabaseAdmin
      .from('rooms')
      .insert(insertPayload)
      .select('*')
      .single<RoomRow>();

    if (roomInsertError || !roomData) {
      throw new RoomServiceError('Failed to create room.', {
        statusCode: 500,
        code: 'ROOM_CREATE_FAILED',
        cause: roomInsertError,
      });
    }

    const { error: memberInsertError } = await supabaseAdmin.from('room_members').insert({
      room_id: roomData.id,
      user_id: payload.ownerId,
    });

    if (memberInsertError) {
      await supabaseAdmin.from('rooms').delete().eq('id', roomData.id);
      throw new RoomServiceError('Room created but failed to add owner as first member.', {
        statusCode: 500,
        code: 'ROOM_OWNER_MEMBER_INSERT_FAILED',
        cause: memberInsertError,
      });
    }

    return this.toRoom(roomData);
  }

  /**
   * Joins a user into an active room and returns the live room preview payload.
   */
  public async joinRoom(payload: JoinRoomPayload): Promise<RoomPreview> {
    const room = await this.getRoomByCode(payload.code);
    if (!room) {
      throw new RoomServiceError('Room not found.', {
        statusCode: 404,
        code: 'ROOM_NOT_FOUND',
      });
    }

    if (room.status !== 'active') {
      throw new RoomServiceError('Room is not active.', {
        statusCode: 400,
        code: 'ROOM_NOT_ACTIVE',
      });
    }

    const existingMembership = await this.getMembership(room.id, payload.userId);
    if (existingMembership) {
      return this.buildRoomPreview(room);
    }

    const memberCount = await this.getRoomMemberCount(room.id);
    if (memberCount >= room.maxMembers) {
      throw new RoomServiceError('Room is already full.', {
        statusCode: 409,
        code: 'ROOM_FULL',
      });
    }

    const { error: memberInsertError } = await supabaseAdmin.from('room_members').insert({
      room_id: room.id,
      user_id: payload.userId,
    });

    if (memberInsertError) {
      throw new RoomServiceError('Failed to join room.', {
        statusCode: 500,
        code: 'ROOM_JOIN_FAILED',
        cause: memberInsertError,
      });
    }

    const { error: eventInsertError } = await supabaseAdmin.from('room_events').insert({
      room_id: room.id,
      user_id: payload.userId,
      event_type: 'member_joined',
      metadata: { userId: payload.userId },
    });

    if (eventInsertError) {
      throw new RoomServiceError('Joined room but failed to write join event.', {
        statusCode: 500,
        code: 'ROOM_JOIN_EVENT_FAILED',
        cause: eventInsertError,
      });
    }

    return this.buildRoomPreview(room);
  }

  /**
   * Returns today's room leaderboard including members with no activity yet.
   */
  public async getLeaderboard(roomId: string): Promise<LeaderboardEntry[]> {
    const todayIso = this.getTodayIsoDate();

    const { data: memberData, error: memberError } = await supabaseAdmin
      .from('room_members')
      .select(
        `
        room_id,
        user_id,
        users!inner(display_name, avatar_url)
      `,
      )
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true });

    if (memberError) {
      throw new RoomServiceError('Failed to fetch room leaderboard.', {
        statusCode: 500,
        code: 'ROOM_LEADERBOARD_QUERY_FAILED',
        cause: memberError,
      });
    }

    const { data: dailyLogData, error: dailyLogError } = await supabaseAdmin
      .from('room_daily_log')
      .select('user_id, tasks_done, xp_earned, finish_position, started_at, completed_at')
      .eq('room_id', roomId)
      .eq('date', todayIso);

    if (dailyLogError) {
      throw new RoomServiceError('Failed to fetch room leaderboard.', {
        statusCode: 500,
        code: 'ROOM_LEADERBOARD_QUERY_FAILED',
        cause: dailyLogError,
      });
    }

    const rows = (memberData ?? []) as RoomMemberRow[];
    const logRows = (dailyLogData ?? []) as Array<RoomDailyLogRow & { user_id: string }>;
    const logsByUserId = new Map<string, RoomDailyLogRow>();

    for (const row of logRows) {
      logsByUserId.set(row.user_id, row);
    }

    const entries = rows.map((row) => {
      const user = this.getSingleUser(row.users);
      const todayLog = logsByUserId.get(row.user_id) ?? null;

      return {
        userId: row.user_id,
        displayName: user?.display_name ?? 'Unknown',
        avatarUrl: user?.avatar_url ?? null,
        tasksDone: todayLog?.tasks_done ?? 0,
        xpEarned: todayLog?.xp_earned ?? 0,
        finishPosition: todayLog?.finish_position ?? null,
        startedAt: todayLog?.started_at ?? null,
        completedAt: todayLog?.completed_at ?? null,
      } satisfies LeaderboardEntry;
    });

    return entries.sort((left, right) => {
      if (left.finishPosition !== null && right.finishPosition !== null && left.finishPosition !== right.finishPosition) {
        return left.finishPosition - right.finishPosition;
      }

      if (left.finishPosition === null && right.finishPosition !== null) {
        return 1;
      }

      if (left.finishPosition !== null && right.finishPosition === null) {
        return -1;
      }

      if (left.tasksDone !== right.tasksDone) {
        return right.tasksDone - left.tasksDone;
      }

      if (left.startedAt && right.startedAt) {
        return left.startedAt.localeCompare(right.startedAt);
      }

      if (!left.startedAt && right.startedAt) {
        return 1;
      }

      if (left.startedAt && !right.startedAt) {
        return -1;
      }

      return left.displayName.localeCompare(right.displayName);
    });
  }

  /**
   * Returns the latest 10 room feed events with user display metadata.
   */
  public async getRoomFeed(roomId: string): Promise<RoomFeedEvent[]> {
    const { data, error } = await supabaseAdmin
      .from('room_events')
      .select(
        `
        id,
        room_id,
        user_id,
        event_type,
        metadata,
        created_at,
        users(display_name, avatar_url)
      `,
      )
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      throw new RoomServiceError('Failed to fetch room feed.', {
        statusCode: 500,
        code: 'ROOM_FEED_QUERY_FAILED',
        cause: error,
      });
    }

    const rows = (data ?? []) as RoomEventRow[];

    return rows.map((row) => {
      const user = this.getSingleUser(row.users);
      return {
        id: row.id,
        roomId: row.room_id,
        userId: row.user_id,
        displayName: user?.display_name ?? 'Unknown',
        eventType: row.event_type,
        metadata: row.metadata ?? {},
        createdAt: row.created_at,
      } satisfies RoomFeedEvent;
    });
  }

  /**
   * Sends a nudge event from one room member to another with a 6-hour cooldown.
   */
  public async nudgeMember(roomId: string, nudgerId: string, targetUserId: string): Promise<void> {
    const isNudgerMember = await this.isRoomMember(roomId, nudgerId);
    if (!isNudgerMember) {
      throw new RoomServiceError('Only room members can send nudges.', {
        statusCode: 403,
        code: 'NUDGER_NOT_MEMBER',
      });
    }

    const isTargetMember = await this.isRoomMember(roomId, targetUserId);
    if (!isTargetMember) {
      throw new RoomServiceError('Target user is not a room member.', {
        statusCode: 400,
        code: 'TARGET_NOT_MEMBER',
      });
    }

    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

    const { data: recentNudgeRows, error: recentNudgeError } = await supabaseAdmin
      .from('room_events')
      .select('metadata')
      .eq('room_id', roomId)
      .eq('user_id', nudgerId)
      .eq('event_type', 'nudge_sent')
      .gte('created_at', sixHoursAgo)
      .order('created_at', { ascending: false });

    if (recentNudgeError) {
      throw new RoomServiceError('Failed to validate nudge cooldown.', {
        statusCode: 500,
        code: 'NUDGE_COOLDOWN_CHECK_FAILED',
        cause: recentNudgeError,
      });
    }

    const hasRecentNudgeForTarget = (recentNudgeRows ?? []).some((row) => {
      const metadata = (row as { metadata: unknown }).metadata;
      if (!metadata || typeof metadata !== 'object') {
        return false;
      }

      const typedMetadata = metadata as Record<string, unknown>;
      return String(typedMetadata.targetUserId ?? '') === targetUserId;
    });

    if (hasRecentNudgeForTarget) {
      throw new RoomServiceError('You can only nudge this member once every 6 hours', {
        statusCode: 429,
        code: 'NUDGE_COOLDOWN_ACTIVE',
      });
    }

    const { error: insertError } = await supabaseAdmin.from('room_events').insert({
      room_id: roomId,
      user_id: nudgerId,
      event_type: 'nudge_sent',
      metadata: {
        nudgerId,
        targetUserId,
      },
    });

    if (insertError) {
      throw new RoomServiceError('Failed to send nudge.', {
        statusCode: 500,
        code: 'NUDGE_INSERT_FAILED',
        cause: insertError,
      });
    }
  }

  private async generateUniqueRoomCode(): Promise<string> {
    for (let attempt = 0; attempt < RoomService.ROOM_CODE_RETRIES; attempt += 1) {
      const code = generateRoomCode();

      const { data, error } = await supabaseAdmin.from('rooms').select('id').eq('code', code).maybeSingle<RoomIdRow>();

      if (error) {
        throw new RoomServiceError('Failed to validate room code uniqueness.', {
          statusCode: 500,
          code: 'ROOM_CODE_UNIQUENESS_CHECK_FAILED',
          cause: error,
        });
      }

      if (!data) {
        return code;
      }
    }

    throw new RoomServiceError('Failed to generate a unique room code after 3 attempts.', {
      statusCode: 500,
      code: 'ROOM_CODE_GENERATION_FAILED',
    });
  }

  private async getRoomByCode(code: string): Promise<Room | null> {
    const normalizedCode = code.trim().toUpperCase();
    const { data, error } = await supabaseAdmin
      .from('rooms')
      .select('*')
      .eq('code', normalizedCode)
      .maybeSingle<RoomRow>();

    if (error) {
      throw new RoomServiceError('Failed to find room by code.', {
        statusCode: 500,
        code: 'ROOM_LOOKUP_BY_CODE_FAILED',
        cause: error,
      });
    }

    if (!data) {
      return null;
    }

    return this.toRoom(data);
  }

  private async getRoomMemberCount(roomId: string): Promise<number> {
    const { count, error } = await supabaseAdmin
      .from('room_members')
      .select('room_id', { count: 'exact', head: true })
      .eq('room_id', roomId);

    if (error) {
      throw new RoomServiceError('Failed to count room members.', {
        statusCode: 500,
        code: 'ROOM_MEMBER_COUNT_FAILED',
        cause: error,
      });
    }

    return count ?? 0;
  }

  private async getMembership(roomId: string, userId: string): Promise<RoomMemberRow | null> {
    const { data, error } = await supabaseAdmin
      .from('room_members')
      .select('room_id, user_id, joined_at, elo_rating, total_room_xp')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle<RoomMemberRow>();

    if (error) {
      throw new RoomServiceError('Failed to verify room membership.', {
        statusCode: 500,
        code: 'ROOM_MEMBERSHIP_CHECK_FAILED',
        cause: error,
      });
    }

    return data ?? null;
  }

  private async isRoomMember(roomId: string, userId: string): Promise<boolean> {
    const membership = await this.getMembership(roomId, userId);
    return Boolean(membership);
  }

  private async getRoomMembers(roomId: string): Promise<RoomMember[]> {
    const { data, error } = await supabaseAdmin
      .from('room_members')
      .select(
        `
        room_id,
        user_id,
        joined_at,
        elo_rating,
        total_room_xp,
        users!inner(display_name, avatar_url)
      `,
      )
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true });

    if (error) {
      throw new RoomServiceError('Failed to fetch room members.', {
        statusCode: 500,
        code: 'ROOM_MEMBERS_QUERY_FAILED',
        cause: error,
      });
    }

    const rows = (data ?? []) as RoomMemberRow[];

    return rows.map((row) => {
      const user = this.getSingleUser(row.users);
      return {
        roomId: row.room_id,
        userId: row.user_id,
        joinedAt: row.joined_at,
        eloRating: row.elo_rating,
        totalRoomXp: row.total_room_xp,
        displayName: user?.display_name ?? 'Unknown',
        avatarUrl: user?.avatar_url ?? null,
      } satisfies RoomMember;
    });
  }

  private async buildRoomPreview(room: Room): Promise<RoomPreview> {
    const [members, todayStandings] = await Promise.all([this.getRoomMembers(room.id), this.getLeaderboard(room.id)]);

    return {
      room,
      members,
      todayStandings,
    };
  }

  private toRoom(row: RoomRow): Room {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      type: row.type,
      ownerId: row.owner_id,
      topic: row.topic,
      planId: row.plan_id,
      maxMembers: row.max_members,
      status: row.status,
      isPrivate: row.is_private,
      createdAt: row.created_at,
      endsAt: row.ends_at,
    };
  }

  private getTodayIsoDate(): string {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private getSingleUser(value: UserPublicRow | UserPublicRow[] | null): UserPublicRow | null {
    if (!value) {
      return null;
    }

    if (Array.isArray(value)) {
      return value[0] ?? null;
    }

    return value;
  }

}

export const roomService = new RoomService();
