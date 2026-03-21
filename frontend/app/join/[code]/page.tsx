'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import type { RoomPreview, LeaderboardEntry } from '@/lib/types/room';

export default function JoinRoomPage() {
  const params = useParams();
  const code = (params.code as string).toUpperCase();
  const router = useRouter();
  const { isSignedIn, isLoaded, getToken } = useAuth();

  const [preview, setPreview] = useState<RoomPreview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function fetchPreview() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/rooms/preview/${code}`);
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error('Failed to load room');
        const data = await res.json();
        setPreview(data.data);
      } catch {
        setError('Could not load room details. Check the code and try again.');
      } finally {
        setIsLoading(false);
      }
    }

    if (code) {
      void fetchPreview();
    }
  }, [code]);

  async function handleJoin() {
    if (!isSignedIn) {
      const returnUrl = encodeURIComponent(`/join/${code}`);
      router.push(`/sign-in?redirect_url=${returnUrl}`);
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/rooms/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message ?? 'Failed to join room');
      }

      const data = await res.json();
      router.push(`/rooms/${data.data.room.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join');
      setIsJoining(false);
    }
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

  if (notFound) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-5xl mb-4">🔍</p>
          <h1 className="text-white font-bold text-xl mb-2">Room not found</h1>
          <p className="text-gray-400 text-sm mb-6">
            The code{' '}
            <span className="text-white font-mono bg-gray-800 px-2 py-0.5 rounded">{code}</span>{' '}
            doesn&apos;t match any active room.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-semibold transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </main>
    );
  }

  if (error && !preview) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-5xl mb-4">⚠️</p>
          <h1 className="text-white font-bold text-xl mb-2">Something went wrong</h1>
          <p className="text-gray-400 text-sm mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 rounded-lg border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white text-sm transition-colors"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <p className="text-gray-400 text-sm text-center mb-3">You&apos;re invited to join</p>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <div className="mb-6">
            <h1 className="text-white font-bold text-2xl mb-1">{preview?.room.name}</h1>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">Daily Sprint</span>
              <span className="text-gray-600">·</span>
              <span className="text-gray-400 text-sm">
                {preview?.members.length ?? 0} member{(preview?.members.length ?? 0) !== 1 ? 's' : ''}
              </span>
              <span className="text-gray-600">·</span>
              <span className="font-mono text-green-400 text-sm bg-green-500/10 px-2 py-0.5 rounded">{code}</span>
            </div>
          </div>

          {preview?.todayStandings && preview.todayStandings.length > 0 && (
            <div className="mb-6">
              <p className="text-gray-500 text-xs uppercase tracking-widest mb-3">Today&apos;s race</p>
              <div className="flex flex-col gap-2">
                {preview.todayStandings.map((entry: LeaderboardEntry, i: number) => (
                  <div key={entry.userId} className="flex items-center gap-3 bg-gray-800/50 rounded-xl px-3 py-2.5">
                    <span className="text-gray-500 text-sm w-4">{i + 1}</span>
                    <span className="text-white text-sm flex-1 truncate">{entry.displayName}</span>
                    <div className="flex gap-1">
                      {[1, 2, 3].map((t) => (
                        <div
                          key={t}
                          className={`w-3 h-3 rounded-sm ${entry.tasksDone >= t ? 'bg-green-500' : 'bg-gray-700'}`}
                        />
                      ))}
                    </div>
                    <span className="text-gray-400 text-xs w-14 text-right shrink-0">{entry.xpEarned} XP</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {preview?.members && (preview.todayStandings?.length ?? 0) === 0 && (
            <div className="mb-6">
              <p className="text-gray-500 text-xs uppercase tracking-widest mb-3">Members</p>
              <div className="flex flex-col gap-2">
                {preview.members.map((m) => (
                  <div key={m.userId} className="flex items-center gap-3 bg-gray-800/50 rounded-xl px-3 py-2">
                    <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-400">
                      {(m.displayName ?? '?').charAt(0).toUpperCase()}
                    </div>
                    <span className="text-white text-sm">{m.displayName ?? 'Unknown'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="text-red-400 text-sm mb-4 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            onClick={() => void handleJoin()}
            disabled={isJoining || !isLoaded}
            className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isJoining ? 'Joining...' : isSignedIn ? 'Join & Start Racing →' : 'Sign in to Join →'}
          </button>

          {!isSignedIn && isLoaded && (
            <p className="text-gray-600 text-xs text-center mt-3">You&apos;ll be redirected back here after signing in</p>
          )}
        </div>
      </div>
    </main>
  );
}
