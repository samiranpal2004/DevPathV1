"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.heatmapService = exports.HeatmapService = exports.AppError = void 0;
const supabase_1 = require("../lib/supabase");
class AppError extends Error {
    constructor(message, options = {}) {
        super(message);
        this.name = 'AppError';
        this.statusCode = options.statusCode ?? 500;
        this.code = options.code ?? 'INTERNAL_ERROR';
        this.cause = options.cause;
    }
}
exports.AppError = AppError;
/**
 * Service responsible for reading and writing heatmap-related data.
 */
class HeatmapService {
    /**
     * Builds a normalized 365-day heatmap payload for a user.
     * Missing days are backfilled with zero-value entries.
     */
    async getHeatmap(userId) {
        const startDate = this.getStartDateIso();
        try {
            const [userResult, contributionsResult, preferencesResult] = await Promise.all([
                supabase_1.supabaseAdmin.from('users').select('id').eq('id', userId).maybeSingle(),
                supabase_1.supabaseAdmin
                    .from('contributions')
                    .select('date, count, intensity, types')
                    .eq('user_id', userId)
                    .gte('date', startDate)
                    .order('date', { ascending: true }),
                supabase_1.supabaseAdmin
                    .from('user_preferences')
                    .select('streak_count, longest_streak')
                    .eq('user_id', userId)
                    .maybeSingle(),
            ]);
            if (userResult.error) {
                throw new AppError('Failed to verify user existence.', {
                    statusCode: 500,
                    code: 'USER_LOOKUP_FAILED',
                    cause: userResult.error,
                });
            }
            if (!userResult.data) {
                throw new AppError('User not found.', {
                    statusCode: 404,
                    code: 'USER_NOT_FOUND',
                });
            }
            if (contributionsResult.error) {
                throw new AppError('Failed to fetch user contributions for heatmap.', {
                    statusCode: 500,
                    code: 'HEATMAP_CONTRIBUTIONS_QUERY_FAILED',
                    cause: {
                        query: HeatmapService.CONTRIBUTIONS_SQL,
                        error: contributionsResult.error,
                    },
                });
            }
            if (preferencesResult.error) {
                throw new AppError('Failed to fetch user streak preferences.', {
                    statusCode: 500,
                    code: 'HEATMAP_PREFERENCES_QUERY_FAILED',
                    cause: preferencesResult.error,
                });
            }
            const contributionsRows = (contributionsResult.data ?? []);
            const preferences = preferencesResult.data ?? null;
            const byDate = new Map();
            for (const row of contributionsRows) {
                const date = this.normalizeToIsoDate(row.date);
                byDate.set(date, {
                    date,
                    count: this.toNumber(row.count),
                    intensity: this.toIntensity(row.intensity),
                    types: this.parseTypes(row.types),
                });
            }
            const days = [];
            let totalContributions = 0;
            let activeDays = 0;
            let soloBreakdown = 0;
            let roomBreakdown = 0;
            let questsBreakdown = 0;
            for (let offset = 0; offset < HeatmapService.DAYS_WINDOW; offset += 1) {
                const date = this.offsetIsoDate(startDate, offset);
                const day = byDate.get(date) ?? this.createZeroDay(date);
                days.push(day);
                totalContributions += day.count;
                if (day.count > 0) {
                    activeDays += 1;
                }
                soloBreakdown += day.types.solo;
                roomBreakdown += day.types.room;
                questsBreakdown += day.types.quests;
            }
            return {
                userId,
                days,
                stats: {
                    totalContributions,
                    currentStreak: preferences?.streak_count ?? 0,
                    longestStreak: preferences?.longest_streak ?? 0,
                    activeDays,
                },
                breakdown: {
                    solo: soloBreakdown,
                    room: roomBreakdown,
                    quests: questsBreakdown,
                },
            };
        }
        catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError('Failed to build heatmap payload.', {
                statusCode: 500,
                code: 'HEATMAP_BUILD_FAILED',
                cause: error,
            });
        }
    }
    /**
     * Writes a contribution event row AND directly upserts the aggregated
     * contributions table.  The DB trigger *may* also fire, but this method
     * no longer depends on it — the application-level upsert is the
     * authoritative write path.
     */
    async logContributionEvent(payload) {
        const date = payload.date ?? this.getTodayIso();
        const insertPayload = {
            user_id: payload.userId,
            event_type: payload.eventType,
            delta: payload.delta,
            date,
        };
        try {
            // 1. Insert the immutable event row
            const { error: eventError } = await supabase_1.supabaseAdmin
                .from('contribution_events')
                .insert(insertPayload);
            if (eventError) {
                // The trigger may have caused the failure — log but continue to
                // the direct upsert so the heatmap still gets data.
                console.error('contribution_events insert failed (trigger may have errored):', eventError);
            }
            // 2. Directly upsert the aggregated contributions row
            const soloDelta = payload.eventType === 'solo_task' || payload.eventType === 'practice_solved' ? payload.delta : 0;
            const roomDelta = payload.eventType === 'room_win' ? payload.delta : 0;
            const questsDelta = payload.eventType === 'quest_complete' ? payload.delta : 0;
            // Try to fetch existing row first
            const { data: existing } = await supabase_1.supabaseAdmin
                .from('contributions')
                .select('count, types')
                .eq('user_id', payload.userId)
                .eq('date', date)
                .maybeSingle();
            if (existing) {
                const newCount = Number(existing.count ?? 0) + payload.delta;
                const oldTypes = (existing.types ?? { solo: 0, room: 0, quests: 0 });
                const { error: updateError } = await supabase_1.supabaseAdmin
                    .from('contributions')
                    .update({
                    count: newCount,
                    intensity: this.computeIntensity(newCount),
                    types: {
                        solo: Number(oldTypes.solo ?? 0) + soloDelta,
                        room: Number(oldTypes.room ?? 0) + roomDelta,
                        quests: Number(oldTypes.quests ?? 0) + questsDelta,
                    },
                })
                    .eq('user_id', payload.userId)
                    .eq('date', date);
                if (updateError) {
                    console.error('contributions update failed:', updateError);
                }
            }
            else {
                const newCount = payload.delta;
                const { error: insertError } = await supabase_1.supabaseAdmin
                    .from('contributions')
                    .insert({
                    user_id: payload.userId,
                    date,
                    count: newCount,
                    intensity: this.computeIntensity(newCount),
                    types: { solo: soloDelta, room: roomDelta, quests: questsDelta },
                });
                if (insertError) {
                    console.error('contributions insert failed:', insertError);
                }
            }
        }
        catch (error) {
            // Log but don't throw — heatmap data is non-critical and should
            // never block task completion from succeeding.
            console.error('logContributionEvent failed:', error);
        }
    }
    computeIntensity(count) {
        if (count <= 0)
            return 0;
        if (count <= 2)
            return 1;
        if (count <= 4)
            return 2;
        if (count <= 7)
            return 3;
        if (count <= 9)
            return 4;
        return 5;
    }
    createZeroDay(date) {
        return {
            date,
            count: 0,
            intensity: 0,
            types: {
                solo: 0,
                room: 0,
                quests: 0,
            },
        };
    }
    getStartDateIso() {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() - 364);
        return this.toLocalIsoDate(date);
    }
    getTodayIso() {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        return this.toLocalIsoDate(date);
    }
    offsetIsoDate(startIso, offset) {
        const date = new Date(`${startIso}T00:00:00`);
        date.setDate(date.getDate() + offset);
        return this.toLocalIsoDate(date);
    }
    normalizeToIsoDate(value) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return value;
        }
        return this.toLocalIsoDate(new Date(value));
    }
    toLocalIsoDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    toNumber(value) {
        const parsed = typeof value === 'number' ? value : Number(value ?? 0);
        return Number.isFinite(parsed) ? Math.round(parsed * 10) / 10 : 0;
    }
    toIntensity(value) {
        if (!Number.isFinite(value)) {
            return 0;
        }
        const rounded = Math.trunc(value);
        if (rounded < 0) {
            return 0;
        }
        if (rounded > 5) {
            return 5;
        }
        return rounded;
    }
    parseTypes(value) {
        const fallback = { solo: 0, room: 0, quests: 0 };
        if (value === null || value === undefined) {
            return fallback;
        }
        const normalized = typeof value === 'string' ? this.safeJsonParse(value) : value;
        if (!normalized || typeof normalized !== 'object') {
            return fallback;
        }
        const typed = normalized;
        return {
            solo: this.toNumber(typed.solo),
            room: this.toNumber(typed.room),
            quests: this.toNumber(typed.quests),
        };
    }
    safeJsonParse(value) {
        try {
            return JSON.parse(value);
        }
        catch {
            return null;
        }
    }
}
exports.HeatmapService = HeatmapService;
HeatmapService.DAYS_WINDOW = 365;
HeatmapService.CONTRIBUTIONS_SQL = `
SELECT date, count, intensity, types
FROM contributions
WHERE user_id = $1
  AND date >= CURRENT_DATE - INTERVAL '364 days'
ORDER BY date ASC
`;
exports.heatmapService = new HeatmapService();
