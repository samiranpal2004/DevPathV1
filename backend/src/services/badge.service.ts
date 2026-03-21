import type { BadgeKey, Badge, BadgeTrigger } from '../types/gamification.types';
import { supabaseAdmin } from '../lib/supabase';

/**
 * BadgeService manages badge awards and retrieval.
 * 
 * CRITICAL RULE: BadgeService.awardBadge is the ONLY place that writes to badges.
 * Unique constraint on (user_id, badge_key) makes awards idempotent.
 */
export class BadgeService {
  /**
   * Award a badge to a user.
   * Uses ON CONFLICT DO NOTHING for idempotent, duplicate-safe inserts.
   * 
   * Returns the Badge object if newly inserted, null if it already existed.
   * Never throws on duplicate — the DB constraint is the safety net.
   */
  async awardBadge(userId: string, badgeKey: BadgeKey): Promise<Badge | null> {
    const { data, error } = await supabaseAdmin
      .from('badges')
      .insert({
        user_id: userId,
        badge_key: badgeKey,
        awarded_at: new Date().toISOString(),
      })
      .select()
      .single();

    // If no data returned, it means the constraint blocked the insert (already exists)
    if (error || !data) {
      return null;
    }

    return {
      id: data.id as string,
      userId: data.user_id as string,
      badgeKey: data.badge_key as BadgeKey,
      awardedAt: data.awarded_at as string,
    };
  }

  /**
   * Get all badges for a user, ordered by most recently awarded.
   */
  async getUserBadges(userId: string): Promise<Badge[]> {
    const { data, error } = await supabaseAdmin
      .from('badges')
      .select('id, user_id, badge_key, awarded_at')
      .eq('user_id', userId)
      .order('awarded_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map((row) => ({
      id: row.id as string,
      userId: row.user_id as string,
      badgeKey: row.badge_key as BadgeKey,
      awardedAt: row.awarded_at as string,
    }));
  }

  /**
   * Check and award badges based on a trigger event.
   * 
   * Badge mapping:
   * - first_task → 'first_step'
   * - first_practice_solved → 'problem_solver'
   * - first_url_parsed → 'course_linked'
   * - solve_no_hint → 'pure_instinct'
   * - practice_count >= 25 → 'pattern_hunter'
   * - room_sprint_win_count >= 3 → 'room_champion'
   * - speed_duel_win_count >= 5 → 'speed_demon'
   * - busy_day_count >= 5 → 'real_life_learner'
   * - returned_after_gap → 'comeback_kid'
   * 
   * Returns array of newly awarded badges (empty if none).
   */
  async checkAndAwardActionBadges(userId: string, trigger: BadgeTrigger): Promise<Badge[]> {
    const newBadges: Badge[] = [];

    // Handle single-trigger badges
    let badgeToAward: BadgeKey | null = null;

    switch (trigger.event) {
      case 'first_task':
        badgeToAward = 'first_step';
        break;
      case 'first_practice_solved':
        badgeToAward = 'problem_solver';
        break;
      case 'first_url_parsed':
        badgeToAward = 'course_linked';
        break;
      case 'solve_no_hint':
        badgeToAward = 'pure_instinct';
        break;
      case 'practice_count':
        if (trigger.count && trigger.count >= 25) {
          badgeToAward = 'pattern_hunter';
        }
        break;
      case 'room_sprint_win_count':
        if (trigger.count && trigger.count >= 3) {
          badgeToAward = 'room_champion';
        }
        break;
      case 'speed_duel_win_count':
        if (trigger.count && trigger.count >= 5) {
          badgeToAward = 'speed_demon';
        }
        break;
      case 'busy_day_count':
        if (trigger.count && trigger.count >= 5) {
          badgeToAward = 'real_life_learner';
        }
        break;
      case 'returned_after_gap':
        badgeToAward = 'comeback_kid';
        break;
    }

    if (badgeToAward) {
      const badge = await this.awardBadge(userId, badgeToAward);
      if (badge) newBadges.push(badge);
    }

    return newBadges;
  }
}
