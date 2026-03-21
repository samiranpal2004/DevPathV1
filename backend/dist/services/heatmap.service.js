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
     * Writes a contribution event row.
     * The database trigger is responsible for updating the aggregated contributions table.
     */
    async logContributionEvent(payload) {
        const insertPayload = {
            user_id: payload.userId,
            event_type: payload.eventType,
            delta: payload.delta,
        };
        insertPayload.date = payload.date ?? this.getTodayIso();
        try {
            const { error } = await supabase_1.supabaseAdmin.from('contribution_events').insert(insertPayload);
            if (error) {
                throw new AppError('Failed to insert contribution event.', {
                    statusCode: 500,
                    code: 'CONTRIBUTION_EVENT_INSERT_FAILED',
                    cause: error,
                });
            }
        }
        catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError('Failed to log contribution event.', {
                statusCode: 500,
                code: 'CONTRIBUTION_EVENT_LOG_FAILED',
                cause: error,
            });
        }
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
        return this.toIsoDate(date);
    }
    getTodayIso() {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        return this.toIsoDate(date);
    }
    offsetIsoDate(startIso, offset) {
        const date = new Date(`${startIso}T00:00:00.000Z`);
        date.setUTCDate(date.getUTCDate() + offset);
        return this.toIsoDate(date);
    }
    normalizeToIsoDate(value) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return value;
        }
        return this.toIsoDate(new Date(value));
    }
    toIsoDate(date) {
        return date.toISOString().slice(0, 10);
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
