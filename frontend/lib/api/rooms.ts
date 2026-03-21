import { api } from './client';
import type { LeaderboardEntry, Room, RoomFeedEvent, RoomPreview } from '../types/room';

export type RoomType =
  | 'daily_sprint'
  | 'speed_duel'
  | '30_day_challenge'
  | 'topic_battle'
  | 'cohort'
  | 'ranked_arena';

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

export async function getRoomById(
  roomId: string,
  token: string
): Promise<Room> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/rooms/${roomId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message ?? 'Failed to fetch room');
  }
  const data = await res.json();
  return data.data as Room;
}

export async function getRoomPreview(
  code: string
): Promise<RoomPreview> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/rooms/preview/${code}`
  );
  if (res.status === 404) {
    throw Object.assign(
      new Error('Room not found'),
      { code: 'NOT_FOUND' }
    );
  }
  if (!res.ok) {
    throw new Error('Failed to fetch room preview');
  }
  const data = await res.json();
  return data.data as RoomPreview;
}
