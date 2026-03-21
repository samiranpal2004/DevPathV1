import type { XpAwardPayload, UserXpProfile, StreakProfile, LevelUpEvent } from '../types/gamification.types';
import { supabaseAdmin } from '../lib/supabase';
import { getLevelFromXp, getXpToNextLevel, getProgressPercent, LEVEL_RANKS } from '../config/xp.config';

// ─── Functional exports used by mission.service.ts ───────────────────────────

export const XP = {
    TASK_COMPLETE: 20,
    PRACTICE_SOLVED: 30,
    FULL_DAY_COMPLETE: 25,
    STREAK_BONUS: 10,
    NO_HINT_BONUS: 15,
    BUSY_DAY: 5,
} as const;

/** Simple functional XP insert — used by mission.service.ts */
export async function awardXp(userId: string, amount: number, reason: string, opts: { roomId?: string } = {}): Promise<void> {
    const { error } = await supabaseAdmin.from('xp_events').insert({
        user_id: userId,
        amount,
        reason,
        room_id: opts.roomId || null,
    });
    if (error) throw new Error(`XP insert failed: ${error.message}`);
}

/** Get XP totals from the materialized view */
export async function getUserXp(userId: string): Promise<{ total_xp: number; weekly_xp: number; level: number } | null> {
    const { data } = await supabaseAdmin
        .from('user_xp_totals')
        .select('total_xp, weekly_xp, level')
        .eq('user_id', userId)
        .single();
    return (data as { total_xp: number; weekly_xp: number; level: number }) || null;
}

/**
 * XpService manages all XP awards and user progression.
 * 
 * CRITICAL RULE: XP is NEVER a mutable counter. Every award is an INSERT into xp_events.
 * The materialized view `user_xp_totals` is refreshed automatically by DB trigger.
 */
export class XpService {
  /**
   * Award XP to a user and detect level-ups.
   * 
   * This is the SINGLE entry point for all XP awards in the system.
   * - Inserts immutably into xp_events
   * - Queries user_xp_totals to fetch the new total
   * - Compares old vs new level
   * - Returns LevelUpEvent if level changed, null otherwise
   */
  async awardXp(payload: XpAwardPayload): Promise<LevelUpEvent | null> {
    const { userId, amount, reason, taskId, roomId } = payload;

    // Before insert: get current level for comparison
    const oldProfile = await this.getUserXpProfile(userId);
    const oldLevel = oldProfile.level;

    // Insert into xp_events (immutable write)
    await supabaseAdmin
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
    const { data: newXpData, error: xpError } = await supabaseAdmin
      .from('user_xp_totals')
      .select('total_xp')
      .eq('user_id', userId)
      .single();

    if (xpError || !newXpData) {
      // User may have no XP yet; treat as level 1
      return null;
    }

    const newTotalXp = newXpData.total_xp as number;
    const newLevel = getLevelFromXp(newTotalXp);

    if (newLevel > oldLevel) {
      return {
        userId,
        oldLevel,
        newLevel,
        newRank: LEVEL_RANKS[newLevel],
        xpAtLevelUp: newTotalXp,
      };
    }

    return null;
  }

  /**
   * Get the full XP profile for a user including level, rank, and progress.
   * If user has no XP history, returns a level 1 profile with zeros.
   */
  async getUserXpProfile(userId: string): Promise<UserXpProfile> {
    const { data, error } = await supabaseAdmin
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
        xpToNextLevel: getXpToNextLevel(0),
        progressPercent: getProgressPercent(0),
      };
    }

    const totalXp = (data.total_xp as number) || 0;
    const weeklyXp = (data.weekly_xp as number) || 0;
    const level = getLevelFromXp(totalXp);

    return {
      userId,
      totalXp,
      weeklyXp,
      level,
      rank: LEVEL_RANKS[level],
      xpToNextLevel: getXpToNextLevel(totalXp),
      progressPercent: getProgressPercent(totalXp),
    };
  }

  /**
   * Get the streak profile for a user.
   * Queries user_preferences for streak, freeze, and last active date.
   */
  async getStreak(userId: string): Promise<StreakProfile> {
    const { data, error } = await supabaseAdmin
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
      currentStreak: (data.streak_count as number) || 0,
      longestStreak: (data.longest_streak as number) || 0,
      freezeCount: (data.freeze_count as number) || 0,
      lastActiveDate: (data.last_active_date as string | null) || null,
    };
  }

  /**
   * Check streak milestone and award bonus XP + badges if applicable.
   * Called after any task completion that increments the streak.
   * 
   * Milestones: 7→'week_warrior', 30→'on_fire', 100→'legend'
   */
  async checkAndAwardStreakBonus(userId: string, currentStreak: number): Promise<void> {
    const streakMilestones: Record<number, string> = {
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
      const { BadgeService } = await import('./badge.service');
      const badgeService = new BadgeService();
      const badgeKey = streakMilestones[currentStreak];
      await badgeService.awardBadge(userId, badgeKey as any);
    }
  }
}
