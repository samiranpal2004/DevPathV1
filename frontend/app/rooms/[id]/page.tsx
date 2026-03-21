'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';
import type { LeaderboardEntry, RoomFeedEvent } from '@/lib/types/room';

function getSupabaseRealtime() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function getEventDot(eventType: string): string {
  const map: Record<string, string> = {
    first_finish: 'bg-yellow-400',
    task_complete: 'bg-green-500',
    practice_solved: 'bg-blue-500',
    nudge_sent: 'bg-orange-400',
    member_joined: 'bg-purple-400',
  };
  return map[eventType] ?? 'bg-gray-500';
}

function formatEventText(event: RoomFeedEvent): string {
  const meta = event.metadata as Record<string, unknown>;

  switch (event.eventType) {
    case 'first_finish':
      return `${event.displayName} finished first! +${meta.xp_awarded ?? 25} XP`;
    case 'task_complete':
      return `${event.displayName} completed Task ${meta.task_num ?? ''} · +${meta.xp_awarded ?? 20} XP`;
    case 'practice_solved':
      return `${event.displayName} solved the practice problem`;
    case 'nudge_sent':
      return `${event.displayName} sent a nudge 👋`;
    case 'member_joined':
      return `${event.displayName} joined the room`;
    default:
      return `${event.displayName} did something`;
  }
}

export default function RoomPage() {
  const params = useParams();
  const roomId = params.id as string;
  const router = useRouter();
  const { getToken, userId } = useAuth();

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [feed, setFeed] = useState<RoomFeedEvent[]>([]);
  const [roomName, setRoomName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [nudgedUsers, setNudgedUsers] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async (): Promise<LeaderboardEntry[] | null> => {
    try {
      const token = await getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/rooms/${roomId}/leaderboard`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return null;
      const data = await res.json();
      const nextLeaderboard = (data.data ?? []) as LeaderboardEntry[];
      setLeaderboard(nextLeaderboard);
      return nextLeaderboard;
    } catch (err) {
      console.error('Leaderboard fetch failed:', err);
      return null;
    }
  }, [roomId, getToken]);

  const fetchFeed = useCallback(async (): Promise<RoomFeedEvent[] | null> => {
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/rooms/${roomId}/feed`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      const nextFeed = (data.data ?? []) as RoomFeedEvent[];
      setFeed(nextFeed);
      return nextFeed;
    } catch (err) {
      console.error('Feed fetch failed:', err);
      return null;
    }
  }, [roomId, getToken]);

  const fetchRoomInfo = useCallback(async (): Promise<'ok' | 'not_found' | 'error'> => {
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/rooms/${roomId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 404) {
        return 'not_found';
      }
      if (!res.ok) {
        setPageError('Failed to load room. Please try again.');
        return 'error';
      }
      const data = await res.json();
      setRoomName(data.data?.name ?? '');
      setRoomCode(data.data?.code ?? '');
      setPageError(null);
      return 'ok';
    } catch {
      setPageError('Could not connect to room.');
      return 'error';
    }
  }, [roomId, getToken]);

  useEffect(() => {
    async function init() {
      const [roomInfoState, leaderboardData, feedData] = await Promise.all([
        fetchRoomInfo(),
        fetchLeaderboard(),
        fetchFeed(),
      ]);

      if (roomInfoState === 'not_found') {
        const hasRoomActivity = (leaderboardData?.length ?? 0) > 0 || (feedData?.length ?? 0) > 0;

        if (hasRoomActivity) {
          setPageError(null);
          if (!roomName) {
            setRoomName('Room');
          }
        } else {
          setPageError('This room does not exist or has ended.');
        }
      }

      setIsLoading(false);
    }

    void init();
  }, [fetchRoomInfo, fetchLeaderboard, fetchFeed, roomName]);

  useEffect(() => {
    const supabase = getSupabaseRealtime();

    const channel = supabase
      ? supabase
          .channel(`room-${roomId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'room_daily_log',
              filter: `room_id=eq.${roomId}`,
            },
            () => {
              fetchLeaderboard();
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'room_events',
              filter: `room_id=eq.${roomId}`,
            },
            () => {
              fetchFeed();
            }
          )
          .subscribe((status: string) => {
            setIsLive(status === 'SUBSCRIBED');
            console.log('[Realtime] Status:', status);
          })
      : null;

    const pollInterval = setInterval(() => {
      if (!isLive) {
        fetchLeaderboard();
        fetchFeed();
      }
    }, 10000);

    return () => {
      if (supabase && channel) supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [roomId, isLive, fetchLeaderboard, fetchFeed]);

  async function handleNudge(targetUserId: string) {
    try {
      const token = await getToken();
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/rooms/${roomId}/nudge/${targetUserId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNudgedUsers((prev) => new Set([...prev, targetUserId]));
    } catch (err) {
      console.error('Nudge failed:', err);
    }
  }

  function positionBadge(entry: LeaderboardEntry, index: number): string {
    if (entry.tasksDone === 3) {
      if (entry.finishPosition === 1) return '🥇';
      if (entry.finishPosition === 2) return '🥈';
      if (entry.finishPosition === 3) return '🥉';
    }
    if (entry.tasksDone > 0) return `${index + 1}`;
    return '—';
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Loading room...</p>
        </div>
      </main>
    );
  }

  if (pageError) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-5xl mb-4">⚠️</p>
          <h1 className="text-white font-bold text-xl mb-2">Room unavailable</h1>
          <p className="text-gray-400 text-sm mb-6">{pageError}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-semibold transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white font-bold text-xl">{roomName}</h1>
          <p className="text-gray-400 text-sm">Daily Sprint · {leaderboard.length} members</p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-gray-400 font-mono text-sm bg-gray-800 px-3 py-1 rounded-lg">{roomCode}</span>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
            <span className={`text-xs ${isLive ? 'text-green-400' : 'text-gray-500'}`}>{isLive ? 'Live' : 'Polling'}</span>
          </div>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-4">
        <p className="text-gray-500 text-xs uppercase tracking-widest mb-4">Live Leaderboard</p>

        <div className="flex flex-col gap-3">
          {leaderboard.map((entry, i) => (
            <div
              key={entry.userId}
              className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                entry.userId === userId ? 'bg-green-500/10 border border-green-500/20' : 'bg-gray-800/50'
              }`}
            >
              <span className="text-lg w-8 text-center shrink-0">{positionBadge(entry, i)}</span>

              <span className="text-white text-sm flex-1 truncate">
                {entry.displayName}
                {entry.userId === userId && <span className="text-green-400 text-xs ml-1">(you)</span>}
              </span>

              <div className="flex gap-1 shrink-0">
                {[1, 2, 3].map((t) => (
                  <div
                    key={t}
                    className={`w-3 h-3 rounded-sm transition-colors ${entry.tasksDone >= t ? 'bg-green-500' : 'bg-gray-700'}`}
                  />
                ))}
              </div>

              <span className="text-gray-400 text-xs w-14 text-right shrink-0">{entry.xpEarned} XP</span>

              {entry.userId !== userId && entry.tasksDone === 0 && (
                <button
                  onClick={() => handleNudge(entry.userId)}
                  disabled={nudgedUsers.has(entry.userId)}
                  title={nudgedUsers.has(entry.userId) ? 'Nudged!' : 'Nudge to get started'}
                  className={`text-sm shrink-0 transition-all ${
                    nudgedUsers.has(entry.userId) ? 'opacity-40 cursor-default' : 'hover:scale-110 cursor-pointer'
                  }`}
                >
                  👋
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <p className="text-gray-500 text-xs uppercase tracking-widest mb-4">Activity</p>

        {feed.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-4">No activity yet — be the first to complete a task!</p>
        ) : (
          <div className="flex flex-col gap-3">
            {feed.map((event) => (
              <div key={event.id} className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full shrink-0 ${getEventDot(event.eventType)}`} />
                <p className="text-gray-300 text-sm">{formatEventText(event)}</p>
                <span className="text-gray-600 text-xs ml-auto shrink-0">
                  {new Date(event.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
