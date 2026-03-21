import { api } from './client';

export type Rank = 'Rookie' | 'Coder' | 'Builder' | 'Hacker' | 'Architect';

export interface XpProfile {
  gamificationOn: true;
  totalXp: number;
  weeklyXp: number;
  level: 1 | 2 | 3 | 4 | 5;
  rank: Rank;
  xpToNextLevel: number;
  progressPercent: number;
}

export interface XpProfileMinimal {
  gamificationOn: false;
  streakDays: number;
  activeDays: number;
}

export interface StreakProfile {
  currentStreak: number;
  longestStreak: number;
  freezeCount: number;
  lastActiveDate: string | null;
}

export interface Badge {
  id: string;
  badge_key: string;
  awarded_at: string;
}

export interface LevelInfo {
  gamificationOn: true;
  level: 1 | 2 | 3 | 4 | 5;
  rank: Rank;
  xpToNextLevel: number;
  progressPercent: number;
}

/** Full XP profile — respects gamification toggle. */
export async function getXpProfile(): Promise<{ success: true; data: XpProfile | XpProfileMinimal }> {
  const res = await api.get('/api/me/xp');
  return res.data;
}

/** Current and longest streak, plus freeze count. */
export async function getStreak(): Promise<{ success: true; data: StreakProfile }> {
  const res = await api.get('/api/me/streak');
  return res.data;
}

/** All badges earned by the current user. */
export async function getBadges(): Promise<{ success: true; data: Badge[] }> {
  const res = await api.get('/api/me/badges');
  return res.data;
}

/** Level, rank, and XP progress — respects gamification toggle. */
export async function getLevelInfo(): Promise<{ success: true; data: LevelInfo }> {
  const res = await api.get('/api/me/level');
  return res.data;
}

/** Toggle gamification UI on or off. */
export async function setGamificationToggle(enabled: boolean): Promise<{ success: true; data: { gamificationOn: boolean } }> {
  const res = await api.patch('/api/me/gamification-toggle', { enabled });
  return res.data;
}
