import { supabaseAdmin } from '../lib/supabase';
import { getLevelFromXp } from '../config/xp.config';

export type LeaderboardFilter = 'weekly' | 'alltime' | 'today';

export interface LeaderboardEntry {
  position: number;
  user_id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  xp: number;
  level: number;
  rank_name: string;
}

export interface MyRank {
  user_id: string;
  xp: number;
  level: number;
  rank_name: string;
  position: number;
}

export interface GlobalLeaderboardResponse {
  entries: LeaderboardEntry[];
  me: MyRank;
  filter: LeaderboardFilter;
  resets_at: string | null;
}

export interface RoomLeaderboardEntry {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  tasks_done: number;
  xp_earned: number;
  finish_position: number | null;
  completed_at: string | null;
  level: number;
  rank_name: string;
  is_me: boolean;
}

const FILTER_TO_COLUMN: Record<LeaderboardFilter, string> = {
  weekly: 'weekly_xp',
  alltime: 'total_xp',
  today: 'today_xp',
};

const RANK_NAMES: Record<number, string> = {
  1: 'Rookie',
  2: 'Coder',
  3: 'Builder',
  4: 'Hacker',
  5: 'Architect',
};

function getNextMondayUTC(): string {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sun, 1=Mon, ...
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const next = new Date(now);
  next.setUTCDate(now.getUTCDate() + daysUntilMonday);
  next.setUTCHours(0, 0, 0, 0);
  return next.toISOString();
}

export class LeaderboardService {
  /**
   * Fetch the global leaderboard with pagination.
   * Tries the leaderboard_stats materialized view first.
   * Falls back to a direct JOIN on users + xp_events if the view doesn't exist.
   */
  async getGlobal(
    userId: string,
    filter: LeaderboardFilter = 'weekly',
    page: number = 1,
    limit: number = 100,
  ): Promise<GlobalLeaderboardResponse> {
    const xpCol = FILTER_TO_COLUMN[filter];
    const offset = (page - 1) * limit;

    let entries: LeaderboardEntry[] = [];
    let me: MyRank;

    try {
      // Try materialized view first
      entries = await this.queryFromView(xpCol, limit, offset);
      me = await this.getMyRankFromView(userId, xpCol);
    } catch {
      // Fallback: direct query (view may not exist yet)
      entries = await this.queryDirect(filter, limit, offset);
      me = await this.getMyRankDirect(userId, filter);
    }

    return {
      entries,
      me,
      filter,
      resets_at: filter === 'weekly' ? getNextMondayUTC() : null,
    };
  }

  private async queryFromView(
    xpCol: string,
    limit: number,
    offset: number,
  ): Promise<LeaderboardEntry[]> {
    const { data, error } = await supabaseAdmin.rpc('get_leaderboard', {
      xp_column: xpCol,
      row_limit: limit,
      row_offset: offset,
    });

    if (error) {
      // If RPC doesn't exist, fall through to direct query
      throw error;
    }

    return (data as Array<{
      user_id: string;
      display_name: string;
      username: string | null;
      avatar_url: string | null;
      xp: number;
      level: number;
      rank_name: string;
      position: number;
    }>) || [];
  }

  private async getMyRankFromView(userId: string, xpCol: string): Promise<MyRank> {
    const { data, error } = await supabaseAdmin.rpc('get_my_leaderboard_rank', {
      target_user_id: userId,
      xp_column: xpCol,
    });

    if (error) throw error;

    if (data && Array.isArray(data) && data.length > 0) {
      const row = data[0] as { xp: number; level: number; rank_name: string; position: number };
      return {
        user_id: userId,
        xp: row.xp,
        level: row.level,
        rank_name: row.rank_name,
        position: row.position,
      };
    }

    return { user_id: userId, xp: 0, level: 1, rank_name: 'Rookie', position: 0 };
  }

  /**
   * Fallback: query users + xp_events directly without the materialized view.
   */
  private async queryDirect(
    filter: LeaderboardFilter,
    limit: number,
    offset: number,
  ): Promise<LeaderboardEntry[]> {
    // Use user_xp_totals view which already exists
    const orderCol = filter === 'alltime' ? 'total_xp' : 'weekly_xp';

    const { data } = await supabaseAdmin
      .from('user_xp_totals')
      .select('user_id, total_xp, weekly_xp, level')
      .gt(orderCol, 0)
      .order(orderCol, { ascending: false })
      .range(offset, offset + limit - 1);

    if (!data || data.length === 0) return [];

    // Fetch user details for these user_ids
    const userIds = data.map((r: { user_id: string }) => r.user_id);
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id, display_name, username, avatar_url')
      .in('id', userIds);

    const userMap = new Map(
      (users || []).map((u: { id: string; display_name: string; username: string | null; avatar_url: string | null }) => [u.id, u]),
    );

    return data.map((row: { user_id: string; total_xp: number; weekly_xp: number; level: number }, idx: number) => {
      const user = userMap.get(row.user_id);
      const xp = filter === 'alltime' ? row.total_xp : row.weekly_xp;
      const level = getLevelFromXp(row.total_xp);
      return {
        position: offset + idx + 1,
        user_id: row.user_id,
        display_name: user?.display_name ?? 'Unknown',
        username: user?.username ?? null,
        avatar_url: user?.avatar_url ?? null,
        xp,
        level,
        rank_name: RANK_NAMES[level] || 'Rookie',
      };
    });
  }

  private async getMyRankDirect(userId: string, filter: LeaderboardFilter): Promise<MyRank> {
    const orderCol = filter === 'alltime' ? 'total_xp' : 'weekly_xp';

    const { data: myData } = await supabaseAdmin
      .from('user_xp_totals')
      .select('total_xp, weekly_xp, level')
      .eq('user_id', userId)
      .single();

    if (!myData) {
      return { user_id: userId, xp: 0, level: 1, rank_name: 'Rookie', position: 0 };
    }

    const myXp = filter === 'alltime' ? (myData.total_xp as number) : (myData.weekly_xp as number);
    const level = getLevelFromXp(myData.total_xp as number);

    // Count how many users have more XP
    const { count } = await supabaseAdmin
      .from('user_xp_totals')
      .select('user_id', { count: 'exact', head: true })
      .gt(orderCol, myXp);

    return {
      user_id: userId,
      xp: myXp,
      level,
      rank_name: RANK_NAMES[level] || 'Rookie',
      position: (count ?? 0) + 1,
    };
  }

  /**
   * Get room leaderboard for today.
   */
  async getRoomLeaderboard(roomId: string, userId: string): Promise<RoomLeaderboardEntry[]> {
    const { data, error } = await supabaseAdmin
      .from('room_daily_log')
      .select(`
        user_id,
        tasks_done,
        xp_earned,
        finish_position,
        completed_at
      `)
      .eq('room_id', roomId)
      .eq('date', new Date().toISOString().split('T')[0]);

    if (error || !data) return [];

    const userIds = data.map((r: { user_id: string }) => r.user_id);
    if (userIds.length === 0) return [];

    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id, display_name, avatar_url')
      .in('id', userIds);

    const { data: xpData } = await supabaseAdmin
      .from('user_xp_totals')
      .select('user_id, total_xp, level')
      .in('user_id', userIds);

    const userMap = new Map(
      (users || []).map((u: { id: string; display_name: string; avatar_url: string | null }) => [u.id, u]),
    );
    const xpMap = new Map(
      (xpData || []).map((x: { user_id: string; total_xp: number; level: number }) => [x.user_id, x]),
    );

    const entries: RoomLeaderboardEntry[] = data.map(
      (row: { user_id: string; tasks_done: number; xp_earned: number; finish_position: number | null; completed_at: string | null }) => {
        const user = userMap.get(row.user_id);
        const xp = xpMap.get(row.user_id);
        const level = xp ? getLevelFromXp(xp.total_xp as number) : 1;
        return {
          user_id: row.user_id,
          display_name: user?.display_name ?? 'Unknown',
          avatar_url: user?.avatar_url ?? null,
          tasks_done: row.tasks_done,
          xp_earned: row.xp_earned,
          finish_position: row.finish_position,
          completed_at: row.completed_at,
          level,
          rank_name: RANK_NAMES[level] || 'Rookie',
          is_me: row.user_id === userId,
        };
      },
    );

    // Sort: finish_position ASC NULLS LAST, tasks_done DESC, xp_earned DESC
    entries.sort((a, b) => {
      if (a.finish_position !== null && b.finish_position !== null) {
        return a.finish_position - b.finish_position;
      }
      if (a.finish_position !== null) return -1;
      if (b.finish_position !== null) return 1;
      if (b.tasks_done !== a.tasks_done) return b.tasks_done - a.tasks_done;
      return b.xp_earned - a.xp_earned;
    });

    return entries;
  }
}

export const leaderboardService = new LeaderboardService();
