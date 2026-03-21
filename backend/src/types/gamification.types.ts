export type BadgeKey =
  | 'first_step'
  | 'problem_solver'
  | 'course_linked'
  | 'week_warrior'
  | 'on_fire'
  | 'legend'
  | 'life_happens'
  | 'comeback_kid'
  | 'real_life_learner'
  | 'pure_instinct'
  | 'pattern_hunter'
  | 'room_champion'
  | 'speed_demon';

export type XpReason =
  | 'task1_complete'
  | 'task2_complete'
  | 'task_complete'
  | 'practice_solved'
  | 'full_day_complete'
  | 'streak_bonus'
  | 'no_hint_bonus'
  | 'busy_day_task'
  | 'weak_topic_revisit'
  | 'quest_complete'
  | 'room_first_finish'
  | 'room_all_complete'
  | 'streak_milestone'
  | 'speed_duel_win'
  | 'nudge_assist';

export interface XpAwardPayload {
  userId: string;
  amount: number;
  reason: XpReason;
  taskId?: string;
  roomId?: string;
}

export interface UserXpProfile {
  userId: string;
  totalXp: number;
  weeklyXp: number;
  level: number;
  rank: RankName;
  xpToNextLevel: number;
  progressPercent: number;
}

export type RankName = 'Rookie' | 'Coder' | 'Builder' | 'Hacker' | 'Architect';

export interface Badge {
  id: string;
  userId: string;
  badgeKey: BadgeKey;
  awardedAt: string;
}

export interface StreakProfile {
  currentStreak: number;
  longestStreak: number;
  freezeCount: number;
  lastActiveDate: string | null;
}

export interface LevelUpEvent {
  userId: string;
  oldLevel: number;
  newLevel: number;
  newRank: RankName;
  xpAtLevelUp: number;
}

export interface BadgeTrigger {
  event:
    | 'first_task'
    | 'first_practice_solved'
    | 'first_url_parsed'
    | 'solve_no_hint'
    | 'practice_count'
    | 'room_sprint_win_count'
    | 'speed_duel_win_count'
    | 'busy_day_count'
    | 'returned_after_gap';
  count?: number;
}

export type ContributionEventType =
  | 'solo_task'
  | 'practice_solved'
  | 'quest_complete'
  | 'room_win'
  | 'perfect_day'
  | 'streak_milestone'
  | 'level_up';
