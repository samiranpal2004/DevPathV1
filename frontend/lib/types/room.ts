export interface Room {
  id: string;
  code: string;
  name: string;
  type: string;
  ownerId: string;
  maxMembers: number;
  status: string;
  isPrivate: boolean;
  createdAt: string;
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

export interface RoomPreview {
  room: Room;
  members: RoomMember[];
  todayStandings: LeaderboardEntry[];
}

export interface RoomMember {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  joinedAt: string;
}