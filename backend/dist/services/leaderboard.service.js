"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.leaderboardService = exports.LeaderboardService = void 0;
const supabase_1 = require("../lib/supabase");
const xp_config_1 = require("../config/xp.config");
const FILTER_TO_COLUMN = {
    weekly: 'weekly_xp',
    alltime: 'total_xp',
    today: 'today_xp',
};
const RANK_NAMES = {
    1: 'Rookie',
    2: 'Coder',
    3: 'Builder',
    4: 'Hacker',
    5: 'Architect',
};
function getNextMondayUTC() {
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0=Sun, 1=Mon, ...
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    const next = new Date(now);
    next.setUTCDate(now.getUTCDate() + daysUntilMonday);
    next.setUTCHours(0, 0, 0, 0);
    return next.toISOString();
}
class LeaderboardService {
    /**
     * Fetch the global leaderboard with pagination.
     * Tries the leaderboard_stats materialized view first.
     * Falls back to a direct JOIN on users + xp_events if the view doesn't exist.
     */
    async getGlobal(userId, filter = 'weekly', page = 1, limit = 100) {
        const xpCol = FILTER_TO_COLUMN[filter];
        const offset = (page - 1) * limit;
        let entries = [];
        let me;
        try {
            // Try materialized view first
            entries = await this.queryFromView(xpCol, limit, offset);
            me = await this.getMyRankFromView(userId, xpCol);
        }
        catch {
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
    async queryFromView(xpCol, limit, offset) {
        const { data, error } = await supabase_1.supabaseAdmin.rpc('get_leaderboard', {
            xp_column: xpCol,
            row_limit: limit,
            row_offset: offset,
        });
        if (error) {
            // If RPC doesn't exist, fall through to direct query
            throw error;
        }
        return data || [];
    }
    async getMyRankFromView(userId, xpCol) {
        const { data, error } = await supabase_1.supabaseAdmin.rpc('get_my_leaderboard_rank', {
            target_user_id: userId,
            xp_column: xpCol,
        });
        if (error)
            throw error;
        if (data && Array.isArray(data) && data.length > 0) {
            const row = data[0];
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
    async queryDirect(filter, limit, offset) {
        // Use user_xp_totals view which already exists
        const orderCol = filter === 'alltime' ? 'total_xp' : 'weekly_xp';
        const { data } = await supabase_1.supabaseAdmin
            .from('user_xp_totals')
            .select('user_id, total_xp, weekly_xp, level')
            .gt(orderCol, 0)
            .order(orderCol, { ascending: false })
            .range(offset, offset + limit - 1);
        if (!data || data.length === 0)
            return [];
        // Fetch user details for these user_ids
        const userIds = data.map((r) => r.user_id);
        const { data: users } = await supabase_1.supabaseAdmin
            .from('users')
            .select('id, display_name, username, avatar_url')
            .in('id', userIds);
        const userMap = new Map((users || []).map((u) => [u.id, u]));
        return data.map((row, idx) => {
            const user = userMap.get(row.user_id);
            const xp = filter === 'alltime' ? row.total_xp : row.weekly_xp;
            const level = (0, xp_config_1.getLevelFromXp)(row.total_xp);
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
    async getMyRankDirect(userId, filter) {
        const orderCol = filter === 'alltime' ? 'total_xp' : 'weekly_xp';
        const { data: myData } = await supabase_1.supabaseAdmin
            .from('user_xp_totals')
            .select('total_xp, weekly_xp, level')
            .eq('user_id', userId)
            .single();
        if (!myData) {
            return { user_id: userId, xp: 0, level: 1, rank_name: 'Rookie', position: 0 };
        }
        const myXp = filter === 'alltime' ? myData.total_xp : myData.weekly_xp;
        const level = (0, xp_config_1.getLevelFromXp)(myData.total_xp);
        // Count how many users have more XP
        const { count } = await supabase_1.supabaseAdmin
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
    async getRoomLeaderboard(roomId, userId) {
        const { data, error } = await supabase_1.supabaseAdmin
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
        if (error || !data)
            return [];
        const userIds = data.map((r) => r.user_id);
        if (userIds.length === 0)
            return [];
        const { data: users } = await supabase_1.supabaseAdmin
            .from('users')
            .select('id, display_name, avatar_url')
            .in('id', userIds);
        const { data: xpData } = await supabase_1.supabaseAdmin
            .from('user_xp_totals')
            .select('user_id, total_xp, level')
            .in('user_id', userIds);
        const userMap = new Map((users || []).map((u) => [u.id, u]));
        const xpMap = new Map((xpData || []).map((x) => [x.user_id, x]));
        const entries = data.map((row) => {
            const user = userMap.get(row.user_id);
            const xp = xpMap.get(row.user_id);
            const level = xp ? (0, xp_config_1.getLevelFromXp)(xp.total_xp) : 1;
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
        });
        // Sort: finish_position ASC NULLS LAST, tasks_done DESC, xp_earned DESC
        entries.sort((a, b) => {
            if (a.finish_position !== null && b.finish_position !== null) {
                return a.finish_position - b.finish_position;
            }
            if (a.finish_position !== null)
                return -1;
            if (b.finish_position !== null)
                return 1;
            if (b.tasks_done !== a.tasks_done)
                return b.tasks_done - a.tasks_done;
            return b.xp_earned - a.xp_earned;
        });
        return entries;
    }
}
exports.LeaderboardService = LeaderboardService;
exports.leaderboardService = new LeaderboardService();
