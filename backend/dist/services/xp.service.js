"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.XpService = exports.XP = void 0;
exports.awardXp = awardXp;
exports.getUserXp = getUserXp;
const supabase_1 = require("../lib/supabase");
const xp_config_1 = require("../config/xp.config");
// ─── Functional exports used by mission.service.ts ───────────────────────────
exports.XP = {
    TASK_COMPLETE: 20,
    PRACTICE_SOLVED: 30,
    FULL_DAY_COMPLETE: 25,
    STREAK_BONUS: 10,
    NO_HINT_BONUS: 15,
    BUSY_DAY: 5,
};
/** Simple functional XP insert — used by mission.service.ts */
async function awardXp(userId, amount, reason, opts = {}) {
    const { error } = await supabase_1.supabaseAdmin.from('xp_events').insert({
        user_id: userId,
        amount,
        reason,
        room_id: opts.roomId || null,
    });
    if (error)
        throw new Error(`XP insert failed: ${error.message}`);
}
/** Get XP totals from the materialized view */
async function getUserXp(userId) {
    const { data } = await supabase_1.supabaseAdmin
        .from('user_xp_totals')
        .select('total_xp, weekly_xp, level')
        .eq('user_id', userId)
        .single();
    return data || null;
}
/**
 * XpService manages all XP awards and user progression.
 *
 * CRITICAL RULE: XP is NEVER a mutable counter. Every award is an INSERT into xp_events.
 * The materialized view `user_xp_totals` is refreshed automatically by DB trigger.
 */
class XpService {
    // Verify trigger:
    // SELECT trigger_name FROM information_schema.triggers
    // WHERE trigger_name = 'trg_refresh_xp';
    async logContribution(userId, eventType, delta, date) {
        await supabase_1.supabaseAdmin.from('contribution_events').insert({
            user_id: userId,
            date: date ?? new Date().toISOString().split('T')[0],
            event_type: eventType,
            delta,
        });
    }
    /**
     * Award XP to a user and detect level-ups.
     *
     * This is the SINGLE entry point for all XP awards in the system.
     * - Inserts immutably into xp_events
     * - Queries user_xp_totals to fetch the new total
     * - Compares old vs new level
     * - Returns LevelUpEvent if level changed, null otherwise
     */
    async awardXp(payload) {
        const { userId, amount, reason, taskId, roomId } = payload;
        // FIX: Compare before/after XP profile to emit full level-up payload.
        const before = await this.getUserXpProfile(userId);
        const oldLevel = before?.level ?? 1;
        const oldXp = before?.totalXp ?? 0;
        // Insert into xp_events (immutable write)
        // task_id is UUID in DB — only pass valid UUIDs, skip string identifiers like "day_5_task1"
        const isValidUuid = taskId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId);
        const { error: insertError } = await supabase_1.supabaseAdmin
            .from('xp_events')
            .insert({
            user_id: userId,
            amount,
            reason: reason,
            task_id: isValidUuid ? taskId : null,
            room_id: roomId || null,
            created_at: new Date().toISOString(),
        });
        if (insertError) {
            console.error('[XP] Insert failed:', insertError.message);
            throw new Error(`XP insert failed: ${insertError.message}`);
        }
        console.log(`[XP] Awarded ${amount} XP to user ${userId} for "${reason}"`);
        const after = await this.getUserXpProfile(userId);
        console.log(`[XP] User ${userId} now has ${after.totalXp} total XP (level ${after.level})`);
        const newLevel = after.level;
        if (newLevel > oldLevel) {
            return {
                userId,
                oldLevel,
                newLevel,
                newRank: xp_config_1.LEVEL_RANKS[newLevel],
                xpAtLevelUp: after.totalXp,
            };
        }
        if (newLevel === oldLevel && after.totalXp < oldXp) {
            return null;
        }
        return null;
    }
    /**
     * Get the full XP profile for a user including level, rank, and progress.
     * Tries the materialized view first (fast), then falls back to a direct
     * SUM on xp_events if the view has no row (trigger may not have fired yet).
     */
    async getUserXpProfile(userId) {
        // Try materialized view first
        const { data } = await supabase_1.supabaseAdmin
            .from('user_xp_totals')
            .select('total_xp, weekly_xp')
            .eq('user_id', userId)
            .single();
        let totalXp = 0;
        let weeklyXp = 0;
        if (data && data.total_xp > 0) {
            totalXp = data.total_xp || 0;
            weeklyXp = data.weekly_xp || 0;
        }
        else {
            // Fallback: query xp_events directly (materialized view may not have refreshed)
            const { data: sumData } = await supabase_1.supabaseAdmin
                .from('xp_events')
                .select('amount')
                .eq('user_id', userId);
            if (sumData && sumData.length > 0) {
                const now = new Date();
                const weekStart = new Date(now);
                weekStart.setDate(now.getDate() - now.getDay());
                weekStart.setHours(0, 0, 0, 0);
                totalXp = sumData.reduce((sum, row) => sum + (row.amount || 0), 0);
                // For weekly, we'd need created_at — just use total for now
                weeklyXp = totalXp;
            }
        }
        if (totalXp === 0) {
            return {
                userId,
                totalXp: 0,
                weeklyXp: 0,
                level: 1,
                rank: 'Rookie',
                xpToNextLevel: (0, xp_config_1.getXpToNextLevel)(0),
                progressPercent: (0, xp_config_1.getProgressPercent)(0),
            };
        }
        const level = (0, xp_config_1.getLevelFromXp)(totalXp);
        return {
            userId,
            totalXp,
            weeklyXp,
            level,
            rank: xp_config_1.LEVEL_RANKS[level],
            xpToNextLevel: (0, xp_config_1.getXpToNextLevel)(totalXp),
            progressPercent: (0, xp_config_1.getProgressPercent)(totalXp),
        };
    }
    /**
     * Get the streak profile for a user.
     * Queries user_preferences for streak, freeze, and last active date.
     */
    async getStreak(userId) {
        const { data, error } = await supabase_1.supabaseAdmin
            .from('user_preferences')
            .select('streak_count, longest_streak, freeze_count, last_active_date')
            .eq('user_id', userId)
            .single();
        if (error || !data) {
            return {
                currentStreak: 0,
                longestStreak: 0,
                freezeCount: 0,
                lastActiveDate: null,
            };
        }
        return {
            currentStreak: data.streak_count || 0,
            longestStreak: data.longest_streak || 0,
            freezeCount: data.freeze_count || 0,
            lastActiveDate: data.last_active_date || null,
        };
    }
    /**
     * Check streak milestone and award bonus XP + badges if applicable.
     * Called after any task completion that increments the streak.
     *
     * Milestones: 7→'week_warrior', 30→'on_fire', 100→'legend'
     */
    async checkAndAwardStreakBonus(userId, currentStreak) {
        const milestones = {
            7: 'week_warrior',
            14: null,
            30: 'on_fire',
            100: 'legend',
        };
        if (!(currentStreak in milestones))
            return;
        // FIX: Award streak milestone XP + optional badge + contribution marker.
        await this.awardXp({
            userId,
            amount: 50,
            reason: 'streak_milestone',
        });
        const badgeKey = milestones[currentStreak];
        if (badgeKey) {
            const { BadgeService } = await Promise.resolve().then(() => __importStar(require('./badge.service')));
            const badgeService = new BadgeService();
            await badgeService.awardBadge(userId, badgeKey);
        }
        await this.logContribution(userId, 'streak_milestone', 0);
    }
}
exports.XpService = XpService;
