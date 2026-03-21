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
exports.XpService = void 0;
const supabase_1 = require("../lib/supabase");
const xp_config_1 = require("../config/xp.config");
/**
 * XpService manages all XP awards and user progression.
 *
 * CRITICAL RULE: XP is NEVER a mutable counter. Every award is an INSERT into xp_events.
 * The materialized view `user_xp_totals` is refreshed automatically by DB trigger.
 */
class XpService {
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
        // Before insert: get current level for comparison
        const oldProfile = await this.getUserXpProfile(userId);
        const oldLevel = oldProfile.level;
        // Insert into xp_events (immutable write)
        await supabase_1.supabaseAdmin
            .from('xp_events')
            .insert({
            user_id: userId,
            xp_amount: amount,
            reason: reason,
            task_id: taskId || null,
            room_id: roomId || null,
            created_at: new Date().toISOString(),
        });
        // Query materialized view to get the new total
        const { data: newXpData, error: xpError } = await supabase_1.supabaseAdmin
            .from('user_xp_totals')
            .select('total_xp')
            .eq('user_id', userId)
            .single();
        if (xpError || !newXpData) {
            // User may have no XP yet; treat as level 1
            return null;
        }
        const newTotalXp = newXpData.total_xp;
        const newLevel = (0, xp_config_1.getLevelFromXp)(newTotalXp);
        if (newLevel > oldLevel) {
            return {
                userId,
                oldLevel,
                newLevel,
                newRank: xp_config_1.LEVEL_RANKS[newLevel],
                xpAtLevelUp: newTotalXp,
            };
        }
        return null;
    }
    /**
     * Get the full XP profile for a user including level, rank, and progress.
     * If user has no XP history, returns a level 1 profile with zeros.
     */
    async getUserXpProfile(userId) {
        const { data, error } = await supabase_1.supabaseAdmin
            .from('user_xp_totals')
            .select('total_xp, weekly_xp')
            .eq('user_id', userId)
            .single();
        // No row in view means user has no XP yet
        if (error || !data) {
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
        const totalXp = data.total_xp || 0;
        const weeklyXp = data.weekly_xp || 0;
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
        const streakMilestones = {
            7: 'week_warrior',
            30: 'on_fire',
            100: 'legend',
        };
        if (currentStreak in streakMilestones) {
            // Award milestone XP
            await this.awardXp({
                userId,
                amount: 50,
                reason: 'streak_milestone',
            });
            // Award corresponding badge via BadgeService
            // (imported separately to avoid circular dependency)
            const { BadgeService } = await Promise.resolve().then(() => __importStar(require('./badge.service')));
            const badgeService = new BadgeService();
            const badgeKey = streakMilestones[currentStreak];
            await badgeService.awardBadge(userId, badgeKey);
        }
    }
}
exports.XpService = XpService;
