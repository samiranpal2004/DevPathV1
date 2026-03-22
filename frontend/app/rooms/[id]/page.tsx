'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import type { LeaderboardEntry, RoomFeedEvent } from '@/lib/types/room';

function getSupabaseRealtime() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function getEventDot(eventType: string): string {
  const map: Record<string, string> = {
    first_finish: 'bg-tertiary-container',
    task_complete: 'bg-primary',
    practice_solved: 'bg-primary-fixed-dim',
    nudge_sent: 'bg-tertiary',
    member_joined: 'bg-secondary',
  };
  return map[eventType] ?? 'bg-outline';
}

function formatEventText(event: RoomFeedEvent): string {
  const meta = event.metadata as Record<string, unknown>;

  switch (event.eventType) {
    case 'first_finish':
      return `${event.displayName} finished first! +${meta.xp_awarded ?? 25} XP`;
    case 'task_complete':
      return `${event.displayName} completed Task ${meta.task_num ?? ''} · +${meta.xp_awarded ?? 20} XP`;
    case 'practice_solved':
      return `${event.displayName} solved the practice problem · +${meta.xp_awarded ?? 30} XP`;
    case 'nudge_sent':
      return `${event.displayName} sent a nudge`;
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
  const [roomType, setRoomType] = useState('daily_sprint');
  const [isLive, setIsLive] = useState(false);
  const [nudgedUsers, setNudgedUsers] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

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
      setRoomType(data.data?.type ?? 'daily_sprint');
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

  function handleCopyCode() {
    navigator.clipboard.writeText(roomCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  const roomTypeLabel = roomType === 'daily_sprint' ? 'Daily Sprint' : roomType.replace(/_/g, ' ');

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-on-surface-variant text-sm font-body">Loading room...</p>
        </div>
      </main>
    );
  }

  if (pageError) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <span className="material-symbols-outlined text-5xl text-outline mb-4 block">error_outline</span>
          <h1 className="text-on-background font-bold text-xl mb-2 font-headline">Room unavailable</h1>
          <p className="text-on-surface-variant text-sm mb-6">{pageError}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-2.5 rounded-full bg-primary hover:bg-primary/90 text-on-primary text-sm font-semibold transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <>
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-surface/70 backdrop-blur-xl shadow-[0_20px_50px_rgba(63,72,73,0.06)]">
        <div className="flex justify-between items-center px-6 lg:px-8 h-16 w-full max-w-[1440px] mx-auto">
          <div className="flex items-center gap-8">
            <span className="text-xl font-black text-primary tracking-tight">DevPath</span>
            <div className="hidden md:flex items-center gap-6">
              <Link className="text-on-surface-variant hover:text-primary transition-all duration-300 font-headline font-bold tracking-tight" href="/dashboard">Dashboard</Link>
              <Link className="text-primary border-b-2 border-primary pb-1 font-headline font-bold tracking-tight" href="/room">Rooms</Link>
              <Link className="text-on-surface-variant hover:text-primary transition-all duration-300 font-headline font-bold tracking-tight" href="/room/heatmap">Heatmap</Link>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low">
              <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-primary animate-pulse' : 'bg-outline'}`} />
              <span className={`text-xs font-bold ${isLive ? 'text-primary' : 'text-on-surface-variant'}`}>
                {isLive ? 'Live' : 'Polling'}
              </span>
            </div>
          </div>
        </div>
        <div className="bg-surface-container-high h-px w-full opacity-20" />
      </nav>

      <main className="pt-24 pb-12 px-6 lg:px-8 max-w-[1440px] mx-auto min-h-screen">
        {/* Room header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-on-background font-headline">{roomName}</h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-secondary-container rounded-full text-xs font-bold text-on-secondary-container uppercase tracking-wider">
                {roomTypeLabel}
              </span>
            </div>
            <p className="text-on-surface-variant text-sm">
              {leaderboard.length} member{leaderboard.length !== 1 ? 's' : ''} competing
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-2.5 shadow-sm">
              <span className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Code</span>
              <span className="text-lg font-mono font-bold text-primary tracking-widest">{roomCode}</span>
              <button
                onClick={handleCopyCode}
                className="ml-1 p-1 hover:bg-surface-container-high rounded-lg transition-colors active:scale-90"
                title="Copy room code"
              >
                <span className="material-symbols-outlined text-sm text-primary">
                  {codeCopied ? 'check' : 'content_copy'}
                </span>
              </button>
            </div>
          </div>
        </header>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* Leaderboard — main column */}
          <div className="lg:col-span-8">
            <div className="bg-surface-container-lowest rounded-xl border border-surface-container-high shadow-sm">
              <div className="px-6 py-4 border-b border-surface-container-high flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">leaderboard</span>
                  <h2 className="text-lg font-bold text-on-background tracking-tight font-headline">Live Leaderboard</h2>
                </div>
                <span className="text-xs text-on-surface-variant">Today&apos;s standings</span>
              </div>

              <div className="p-4 lg:p-6">
                {leaderboard.length === 0 ? (
                  <p className="text-on-surface-variant text-sm text-center py-8">No members yet.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {leaderboard.map((entry, i) => {
                      const isYou = entry.userId === userId;
                      const posLabel = entry.tasksDone === 3
                        ? entry.finishPosition === 1 ? '1st' : entry.finishPosition === 2 ? '2nd' : entry.finishPosition === 3 ? '3rd' : `${i + 1}`
                        : entry.tasksDone > 0 ? `${i + 1}` : '—';
                      const progressPct = Math.round((entry.tasksDone / 3) * 100);

                      return (
                        <div
                          key={entry.userId}
                          className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                            isYou
                              ? 'bg-primary/5 border border-primary/15 shadow-sm'
                              : 'bg-surface-container-low hover:bg-surface-container'
                          }`}
                        >
                          {/* Position */}
                          <span className={`w-10 h-10 flex items-center justify-center rounded-full text-sm font-bold shrink-0 ${
                            entry.finishPosition === 1
                              ? 'bg-tertiary-container text-on-tertiary-container'
                              : 'bg-surface-container-high text-on-surface-variant'
                          }`}>
                            {posLabel}
                          </span>

                          {/* Name + progress bar */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-sm font-semibold text-on-surface truncate">
                                {entry.displayName}
                              </span>
                              {isYou && (
                                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  entry.tasksDone === 3 ? 'bg-primary' : 'bg-primary/60'
                                }`}
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>

                          {/* Task dots */}
                          <div className="flex gap-1.5 shrink-0">
                            {[1, 2, 3].map((t) => (
                              <div
                                key={t}
                                className={`w-3.5 h-3.5 rounded-full transition-colors ${
                                  entry.tasksDone >= t ? 'bg-primary' : 'bg-surface-container-high'
                                }`}
                              />
                            ))}
                          </div>

                          {/* XP */}
                          <div className="text-right shrink-0 min-w-[60px]">
                            <span className="text-sm font-bold text-primary">{entry.xpEarned}</span>
                            <span className="text-xs text-on-surface-variant ml-1">XP</span>
                          </div>

                          {/* Nudge */}
                          {!isYou && entry.tasksDone === 0 && (
                            <button
                              onClick={() => handleNudge(entry.userId)}
                              disabled={nudgedUsers.has(entry.userId)}
                              title={nudgedUsers.has(entry.userId) ? 'Nudged!' : 'Nudge to get started'}
                              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
                                nudgedUsers.has(entry.userId)
                                  ? 'bg-surface-container-high text-on-surface-variant opacity-50 cursor-default'
                                  : 'bg-tertiary-container text-on-tertiary-container hover:shadow-md active:scale-95 cursor-pointer'
                              }`}
                            >
                              {nudgedUsers.has(entry.userId) ? 'Nudged' : 'Nudge'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar — activity feed + share */}
          <aside className="lg:col-span-4 flex flex-col gap-6">
            {/* Share card */}
            <div className="bg-surface-container-lowest rounded-xl border border-surface-container-high shadow-sm p-6">
              <h3 className="text-sm font-bold text-on-background mb-3 font-headline">Invite Friends</h3>
              <p className="text-xs text-on-surface-variant mb-4">
                Share the room code to invite others to this sprint.
              </p>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Join my DevPath room! Code: ${roomCode}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-primary text-on-primary py-3 rounded-full font-bold text-sm tracking-wide transition-all hover:shadow-lg active:scale-[0.98]"
              >
                Share on WhatsApp
                <span className="material-symbols-outlined text-sm">share</span>
              </a>
            </div>

            {/* Activity feed */}
            <div className="bg-surface-container-lowest rounded-xl border border-surface-container-high shadow-sm">
              <div className="px-6 py-4 border-b border-surface-container-high flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-error rounded-full animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Live Feed</span>
                </div>
              </div>

              <div className="p-4 lg:p-6">
                {feed.length === 0 ? (
                  <p className="text-on-surface-variant text-sm text-center py-6">
                    No activity yet — be the first to complete a task!
                  </p>
                ) : (
                  <div className="flex flex-col gap-4">
                    {feed.map((event) => (
                      <div key={event.id} className="flex items-start gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${getEventDot(event.eventType)}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-on-surface leading-snug">{formatEventText(event)}</p>
                          <span className="text-[11px] text-on-surface-variant mt-0.5 block">
                            {new Date(event.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
