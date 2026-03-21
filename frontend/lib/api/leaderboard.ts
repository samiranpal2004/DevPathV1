import { api } from './client';

export type LeaderboardFilter = 'weekly' | 'alltime' | 'today';

export interface LeaderboardEntry {
  position: number;
  user_id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  xp: number;
  level: number;
  rank_name: string;
}

export interface MyRank {
  user_id: string;
  xp: number;
  level: number;
  rank_name: string;
  position: number;
}

export interface GlobalLeaderboardResponse {
  entries: LeaderboardEntry[];
  me: MyRank;
  filter: LeaderboardFilter;
  resets_at: string | null;
}

export interface RoomLeaderboardEntry {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  tasks_done: number;
  xp_earned: number;
  finish_position: number | null;
  completed_at: string | null;
  level: number;
  rank_name: string;
  is_me: boolean;
}

export async function getGlobalLeaderboard(
  filter: LeaderboardFilter = 'weekly',
  page = 1,
): Promise<{ success: true; data: GlobalLeaderboardResponse }> {
  const res = await api.get('/api/leaderboard/global', {
    params: { filter, page },
  });
  return res.data;
}

export async function getRoomLeaderboard(
  roomId: string,
): Promise<{ success: true; data: { room_id: string; entries: RoomLeaderboardEntry[] } }> {
  const res = await api.get(`/api/leaderboard/room/${roomId}`);
  return res.data;
}
