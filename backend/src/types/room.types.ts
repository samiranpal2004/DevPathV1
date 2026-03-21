export type RoomType =
  | 'daily_sprint'
  | 'speed_duel'
  | '30_day_challenge'
  | 'topic_battle'
  | 'cohort'
  | 'ranked_arena';

export type RoomStatus = 'pending' | 'active' | 'completed' | 'archived';

export interface Room {
  id: string;
  code: string;
  name: string;
  type: RoomType;
  ownerId: string;
  topic: string | null;
  planId: string | null;
  maxMembers: number;
  status: RoomStatus;
  isPrivate: boolean;
  createdAt: string;
  endsAt: string | null;
}

export interface RoomMember {
  roomId: string;
  userId: string;
  joinedAt: string;
  eloRating: number;
  totalRoomXp: number;
  displayName: string;
  avatarUrl: string | null;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  tasksDone: number;
  xpEarned: number;
  finishPosition: number | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface RoomFeedEvent {
  id: string;
  roomId: string;
  userId: string;
  displayName: string;
  eventType: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CreateRoomPayload {
  name: string;
  type: RoomType;
  topic?: string;
  maxMembers?: number;
  isPrivate?: boolean;
  ownerId: string;
}

export interface JoinRoomPayload {
  code: string;
  userId: string;
}

export interface RoomPreview {
  room: Room;
  members: RoomMember[];
  todayStandings: LeaderboardEntry[];
}