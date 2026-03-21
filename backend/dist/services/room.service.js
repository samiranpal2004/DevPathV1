"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roomService = exports.RoomService = exports.RoomServiceError = void 0;
const supabase_1 = require("../lib/supabase");
const roomCode_1 = require("../utils/roomCode");
const xp_service_1 = require("./xp.service");
class RoomServiceError extends Error {
    constructor(message, options = {}) {
        super(message);
        this.name = 'RoomServiceError';
        this.statusCode = options.statusCode ?? 500;
        this.code = options.code ?? 'INTERNAL_ERROR';
        this.cause = options.cause;
    }
}
exports.RoomServiceError = RoomServiceError;
class RoomService {
    constructor() {
        this.xpService = new xp_service_1.XpService();
    }
    // FIX: Added idempotent first-finish marker for room daily race bonuses.
    async checkAndSetFirstFinish(roomId, userId) {
        const today = new Date().toISOString().split('T')[0];
        const { data: existing } = await supabase_1.supabaseAdmin
            .from('room_daily_log')
            .select('finish_position')
            .eq('room_id', roomId)
            .eq('date', today)
            .not('finish_position', 'is', null)
            .limit(1);
        if (existing && existing.length > 0)
            return false;
        await supabase_1.supabaseAdmin
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
    async checkAndAwardAllComplete(roomId) {
        const today = new Date().toISOString().split('T')[0];
        const { data: alreadyFired } = await supabase_1.supabaseAdmin
            .from('room_events')
            .select('id')
            .eq('room_id', roomId)
            .eq('event_type', 'room_all_complete')
            .gte('created_at', `${today}T00:00:00.000Z`)
            .limit(1);
        if (alreadyFired && alreadyFired.length > 0)
            return;
        const { count: memberCount } = await supabase_1.supabaseAdmin
            .from('room_members')
            .select('*', { count: 'exact', head: true })
            .eq('room_id', roomId);
        const { count: completedCount } = await supabase_1.supabaseAdmin
            .from('room_daily_log')
            .select('*', { count: 'exact', head: true })
            .eq('room_id', roomId)
            .eq('date', today)
            .eq('tasks_done', 3);
        if (!memberCount || completedCount !== memberCount)
            return;
        const { data: members } = await supabase_1.supabaseAdmin
            .from('room_members')
            .select('user_id')
            .eq('room_id', roomId);
        if (!members)
            return;
        await Promise.all(members.map((member) => this.xpService.awardXp({
            userId: member.user_id,
            amount: 20,
            reason: 'room_all_complete',
            roomId,
        })));
        await supabase_1.supabaseAdmin.from('room_events').insert({
            room_id: roomId,
            user_id: null,
            event_type: 'room_all_complete',
            metadata: { xp_awarded_each: 20, member_count: memberCount },
        });
    }
    /**
     * Creates a new room, marks it active, and adds the owner as the first member.
     */
    async createRoom(payload) {
        const code = await this.generateUniqueRoomCode();
        const insertPayload = {
            code,
            name: payload.name.trim(),
            type: payload.type,
            owner_id: payload.ownerId,
            topic: payload.topic?.trim() ?? null,
            max_members: payload.maxMembers ?? 10,
            status: 'active',
            is_private: payload.isPrivate ?? true,
        };
        const { data: roomData, error: roomInsertError } = await supabase_1.supabaseAdmin
            .from('rooms')
            .insert(insertPayload)
            .select('*')
            .single();
        if (roomInsertError || !roomData) {
            throw new RoomServiceError('Failed to create room.', {
                statusCode: 500,
                code: 'ROOM_CREATE_FAILED',
                cause: roomInsertError,
            });
        }
        const { error: memberInsertError } = await supabase_1.supabaseAdmin.from('room_members').insert({
            room_id: roomData.id,
            user_id: payload.ownerId,
        });
        if (memberInsertError) {
            await supabase_1.supabaseAdmin.from('rooms').delete().eq('id', roomData.id);
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
    async joinRoom(payload) {
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
        const { error: memberInsertError } = await supabase_1.supabaseAdmin.from('room_members').insert({
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
        const { error: eventInsertError } = await supabase_1.supabaseAdmin.from('room_events').insert({
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
    async getLeaderboard(roomId) {
        const todayIso = this.getTodayIsoDate();
        const { data: memberData, error: memberError } = await supabase_1.supabaseAdmin
            .from('room_members')
            .select(`
        room_id,
        user_id,
        users!inner(display_name, avatar_url)
      `)
            .eq('room_id', roomId)
            .order('joined_at', { ascending: true });
        if (memberError) {
            throw new RoomServiceError('Failed to fetch room leaderboard.', {
                statusCode: 500,
                code: 'ROOM_LEADERBOARD_QUERY_FAILED',
                cause: memberError,
            });
        }
        const { data: dailyLogData, error: dailyLogError } = await supabase_1.supabaseAdmin
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
        const rows = (memberData ?? []);
        const logRows = (dailyLogData ?? []);
        const logsByUserId = new Map();
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
            };
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
    async getRoomFeed(roomId) {
        const { data, error } = await supabase_1.supabaseAdmin
            .from('room_events')
            .select(`
        id,
        room_id,
        user_id,
        event_type,
        metadata,
        created_at,
        users(display_name, avatar_url)
      `)
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
        const rows = (data ?? []);
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
            };
        });
    }
    /**
     * Sends a nudge event from one room member to another with a 6-hour cooldown.
     */
    async nudgeMember(roomId, nudgerId, targetUserId) {
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
        const { data: recentNudgeRows, error: recentNudgeError } = await supabase_1.supabaseAdmin
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
            const metadata = row.metadata;
            if (!metadata || typeof metadata !== 'object') {
                return false;
            }
            const typedMetadata = metadata;
            return String(typedMetadata.targetUserId ?? '') === targetUserId;
        });
        if (hasRecentNudgeForTarget) {
            throw new RoomServiceError('You can only nudge this member once every 6 hours', {
                statusCode: 429,
                code: 'NUDGE_COOLDOWN_ACTIVE',
            });
        }
        const { error: insertError } = await supabase_1.supabaseAdmin.from('room_events').insert({
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
    async generateUniqueRoomCode() {
        for (let attempt = 0; attempt < RoomService.ROOM_CODE_RETRIES; attempt += 1) {
            const code = (0, roomCode_1.generateRoomCode)();
            const { data, error } = await supabase_1.supabaseAdmin.from('rooms').select('id').eq('code', code).maybeSingle();
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
    async getRoomByCode(code) {
        const normalizedCode = code.trim().toUpperCase();
        const { data, error } = await supabase_1.supabaseAdmin
            .from('rooms')
            .select('*')
            .eq('code', normalizedCode)
            .maybeSingle();
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
    async getRoomMemberCount(roomId) {
        const { count, error } = await supabase_1.supabaseAdmin
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
    async getMembership(roomId, userId) {
        const { data, error } = await supabase_1.supabaseAdmin
            .from('room_members')
            .select('room_id, user_id, joined_at, elo_rating, total_room_xp')
            .eq('room_id', roomId)
            .eq('user_id', userId)
            .maybeSingle();
        if (error) {
            throw new RoomServiceError('Failed to verify room membership.', {
                statusCode: 500,
                code: 'ROOM_MEMBERSHIP_CHECK_FAILED',
                cause: error,
            });
        }
        return data ?? null;
    }
    async isRoomMember(roomId, userId) {
        const membership = await this.getMembership(roomId, userId);
        return Boolean(membership);
    }
    async getRoomMembers(roomId) {
        const { data, error } = await supabase_1.supabaseAdmin
            .from('room_members')
            .select(`
        room_id,
        user_id,
        joined_at,
        elo_rating,
        total_room_xp,
        users!inner(display_name, avatar_url)
      `)
            .eq('room_id', roomId)
            .order('joined_at', { ascending: true });
        if (error) {
            throw new RoomServiceError('Failed to fetch room members.', {
                statusCode: 500,
                code: 'ROOM_MEMBERS_QUERY_FAILED',
                cause: error,
            });
        }
        const rows = (data ?? []);
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
            };
        });
    }
    async buildRoomPreview(room) {
        const [members, todayStandings] = await Promise.all([this.getRoomMembers(room.id), this.getLeaderboard(room.id)]);
        return {
            room,
            members,
            todayStandings,
        };
    }
    toRoom(row) {
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
    getTodayIsoDate() {
        const now = new Date();
        const yyyy = now.getUTCFullYear();
        const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(now.getUTCDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }
    getSingleUser(value) {
        if (!value) {
            return null;
        }
        if (Array.isArray(value)) {
            return value[0] ?? null;
        }
        return value;
    }
}
exports.RoomService = RoomService;
RoomService.ROOM_CODE_RETRIES = 3;
exports.roomService = new RoomService();
