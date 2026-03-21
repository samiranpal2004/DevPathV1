import { api } from './client';

export type RoomType =
  | 'daily_sprint'
  | 'speed_duel'
  | '30_day_challenge'
  | 'topic_battle'
  | 'cohort'
  | 'ranked_arena';

export interface Room {
  id: string;
  code: string;
  name: string;
  type: RoomType;
  owner_id: string;
  max_members: number;
  status: 'pending' | 'active' | 'completed' | 'archived';
  is_private: boolean;
  created_at: string;
  ends_at: string | null;
}

export interface LeaderboardEntry {
  display_name: string;
  tasks_done: number;
  xp_earned: number;
  finish_position: number | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface RoomFeedEvent {
  id: string;
  user_id: string;
  event_type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/** Create a new room. ownerId is the current user's UUID. */
export async function createRoom(payload: {
  ownerId: string;
  name: string;
  type: RoomType;
  topic?: string;
  maxMembers?: number;
  isPrivate?: boolean;
}): Promise<{ success: true; data: Room }> {
  const res = await api.post('/api/rooms/create', payload);
  return res.data;
}

/** Join a room by 6-char code. */
export async function joinRoom(payload: {
  userId: string;
  code: string;
}): Promise<{ success: true; data: Room }> {
  const res = await api.post('/api/rooms/join', payload);
  return res.data;
}

/** Get today's leaderboard for a room. */
export async function getRoomLeaderboard(
  roomId: string
): Promise<{ success: true; data: LeaderboardEntry[] }> {
  const res = await api.get(`/api/rooms/${roomId}/leaderboard`);
  return res.data;
}

/** Get the room activity feed (last 10 events). */
export async function getRoomFeed(
  roomId: string
): Promise<{ success: true; data: RoomFeedEvent[] }> {
  const res = await api.get(`/api/rooms/${roomId}/feed`);
  return res.data;
}

/** Send a nudge to a dormant member. */
export async function nudgeMember(
  roomId: string,
  targetUserId: string,
  nudgerId: string
): Promise<{ success: true; data: { message: string } }> {
  const res = await api.post(`/api/rooms/${roomId}/nudge/${targetUserId}`, { nudgerId });
  return res.data;
}
