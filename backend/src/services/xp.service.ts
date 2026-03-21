import type {
  XpAwardPayload,
  UserXpProfile,
  StreakProfile,
  LevelUpEvent,
  BadgeKey,
  ContributionEventType,
} from '../types/gamification.types';
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
  // Verify trigger:
  // SELECT trigger_name FROM information_schema.triggers
  // WHERE trigger_name = 'trg_refresh_xp';

  private async logContribution(
    userId: string,
    eventType: ContributionEventType,
    delta: number,
    date?: string
  ): Promise<void> {
    await supabaseAdmin.from('contribution_events').insert({
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
  async awardXp(payload: XpAwardPayload): Promise<LevelUpEvent | null> {
    const { userId, amount, reason, taskId, roomId } = payload;

    // FIX: Compare before/after XP profile to emit full level-up payload.
    const before = await this.getUserXpProfile(userId);
    const oldLevel = before?.level ?? 1;
    const oldXp = before?.totalXp ?? 0;

    // Insert into xp_events (immutable write)
    // task_id is UUID in DB — only pass valid UUIDs, skip string identifiers like "day_5_task1"
    const isValidUuid = taskId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId);
    const { error: insertError } = await supabaseAdmin
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
        newRank: LEVEL_RANKS[newLevel],
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
  async getUserXpProfile(userId: string): Promise<UserXpProfile> {
    // Try materialized view first
    const { data } = await supabaseAdmin
      .from('user_xp_totals')
      .select('total_xp, weekly_xp')
      .eq('user_id', userId)
      .single();

    let totalXp = 0;
    let weeklyXp = 0;

    if (data && (data.total_xp as number) > 0) {
      totalXp = (data.total_xp as number) || 0;
      weeklyXp = (data.weekly_xp as number) || 0;
    } else {
      // Fallback: query xp_events directly (materialized view may not have refreshed)
      const { data: sumData } = await supabaseAdmin
        .from('xp_events')
        .select('amount')
        .eq('user_id', userId);

      if (sumData && sumData.length > 0) {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);

        totalXp = sumData.reduce((sum: number, row: { amount: number }) => sum + (row.amount || 0), 0);
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
        xpToNextLevel: getXpToNextLevel(0),
        progressPercent: getProgressPercent(0),
      };
    }

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
    const milestones: Record<number, BadgeKey | null> = {
      7: 'week_warrior',
      14: null,
      30: 'on_fire',
      100: 'legend',
    };

    if (!(currentStreak in milestones)) return;

    // FIX: Award streak milestone XP + optional badge + contribution marker.
    await this.awardXp({
      userId,
      amount: 50,
      reason: 'streak_milestone',
    });

    const badgeKey = milestones[currentStreak];
    if (badgeKey) {
      const { BadgeService } = await import('./badge.service');
      const badgeService = new BadgeService();
      await badgeService.awardBadge(userId, badgeKey);
    }

    await this.logContribution(userId, 'streak_milestone', 0);
  }
}
