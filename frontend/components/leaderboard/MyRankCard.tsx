'use client';

import type { MyRank, LeaderboardFilter } from '@/lib/api/leaderboard';

const RANK_COLORS: Record<string, string> = {
  Rookie: 'bg-gray-400',
  Coder: 'bg-emerald-500',
  Builder: 'bg-blue-500',
  Hacker: 'bg-purple-500',
  Architect: 'bg-amber-500',
};

interface MyRankCardProps {
  me: MyRank;
  filter: LeaderboardFilter;
}

export function MyRankCard({ me, filter }: MyRankCardProps) {
  const rankColor = RANK_COLORS[me.rank_name] || 'bg-gray-400';
  const filterLabel =
    filter === 'weekly' ? 'this week' :
    filter === 'today' ? 'today' :
    'all time';

  return (
    <div className="flex items-center justify-between px-5 py-4 bg-surface-container-low border border-outline-variant rounded-xl">
      <div className="flex items-center gap-4">
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Your rank</p>
          <p className="text-2xl font-bold text-on-background headline-text">
            #{me.position}
            {me.position === 1 && <span className="ml-1 text-lg">{'\u{1F3C6}'}</span>}
          </p>
        </div>

        <div className="w-px h-10 bg-outline-variant" />

        <div>
          <p className="text-sm font-semibold text-on-background">
            {me.xp.toLocaleString()} <span className="text-xs text-gray-400 font-normal">XP {filterLabel}</span>
          </p>
          <span className={`text-[10px] px-2 py-0.5 rounded-full text-white font-semibold ${rankColor}`}>
            {me.rank_name}
          </span>
        </div>
      </div>

      {me.position <= 3 && (
        <span className="material-symbols-outlined text-tertiary-container text-2xl">
          emoji_events
        </span>
      )}
    </div>
  );
}
