import { api } from './client';

export interface HeatmapDay {
  date: string;           // ISO date string, e.g. "2026-03-21"
  count: number;
  intensity: 0 | 1 | 2 | 3 | 4 | 5;
  types: {
    solo: number;
    room: number;
    quests: number;
  };
}

export interface HeatmapStats {
  totalContributions: number;
  currentStreak: number;
  longestStreak: number;
  activeDays: number;
}

export interface HeatmapPayload {
  userId: string;
  days: HeatmapDay[];
  stats: HeatmapStats;
  breakdown: {
    solo: number;
    room: number;
    quests: number;
  };
}

export type FilterMode = 'all' | 'solo' | 'room' | 'quests';

/** Get 365-day contribution data for the authenticated user. */
export async function getMyHeatmap(): Promise<HeatmapPayload> {
  const res = await api.get('/api/heatmap/me');
  return res.data;
}

/** Get 365-day contribution data for any user by ID. */
export async function getHeatmap(userId: string): Promise<HeatmapPayload> {
  const res = await api.get(`/api/heatmap/${userId}`);
  return res.data;
}

/**
 * Compute display intensity for a single day given the active filter.
 * Runs entirely on the client — no refetch needed when switching filters.
 */
export function getFilteredIntensity(day: HeatmapDay, filter: FilterMode): 0 | 1 | 2 | 3 | 4 {
  const val =
    filter === 'solo'   ? day.types.solo   :
    filter === 'room'   ? day.types.room   :
    filter === 'quests' ? day.types.quests :
    day.count;

  if (val <= 0) return 0;
  if (val <= 2) return 1;
  if (val <= 4) return 2;
  if (val <= 7) return 3;
  return 4;
}
