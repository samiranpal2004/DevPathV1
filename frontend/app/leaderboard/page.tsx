'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';

import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { MyRankCard } from '@/components/leaderboard/MyRankCard';
import { LeaderboardCountdown } from '@/components/leaderboard/LeaderboardCountdown';
import type {
  LeaderboardFilter,
  LeaderboardEntry,
  MyRank,
} from '@/lib/api/leaderboard';

const FILTERS: { key: LeaderboardFilter; label: string }[] = [
  { key: 'weekly', label: 'This week' },
  { key: 'alltime', label: 'All time' },
  { key: 'today', label: 'Today' },
];

function LeaderboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { getToken } = useAuth();

  const filterParam = searchParams.get('filter');
  const filter: LeaderboardFilter =
    filterParam === 'alltime' || filterParam === 'today' ? filterParam : 'weekly';

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [me, setMe] = useState<MyRank | null>(null);
  const [resetsAt, setResetsAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [internalUserId, setInternalUserId] = useState('');

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(
        `${apiBase}/api/leaderboard/global?filter=${filter}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) return;
      const body = await res.json();
      if (body.success) {
        setEntries(body.data.entries);
        setMe(body.data.me);
        setResetsAt(body.data.resets_at);
        if (body.data.me?.user_id) {
          setInternalUserId(body.data.me.user_id);
        }
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [filter, getToken]);

  useEffect(() => {
    void fetchLeaderboard();
  }, [fetchLeaderboard]);

  function setFilter(f: LeaderboardFilter) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('filter', f);
    router.replace(`/leaderboard?${params.toString()}`);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-on-background headline-text">Leaderboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">See how you stack up against other learners.</p>
        </div>
        {filter === 'weekly' && resetsAt && <LeaderboardCountdown resetsAt={resetsAt} />}
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 mb-5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f.key
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-outline-variant overflow-hidden mb-4">
        <LeaderboardTable
          entries={entries}
          loading={loading}
          currentUserId={internalUserId}
        />
      </div>

      {/* My rank card — always visible */}
      {me && !loading && <MyRankCard me={me} filter={filter} />}
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold text-on-background headline-text mb-6">Leaderboard</h1>
          <div className="bg-white rounded-xl border border-outline-variant overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3 animate-pulse">
                <div className="w-8 h-5 rounded bg-gray-200" />
                <div className="w-8 h-8 rounded-full bg-gray-200" />
                <div className="flex-1"><div className="w-28 h-4 rounded bg-gray-200" /></div>
                <div className="w-16 h-4 rounded bg-gray-200" />
              </div>
            ))}
          </div>
        </div>
      }
    >
      <LeaderboardContent />
    </Suspense>
  );
}
