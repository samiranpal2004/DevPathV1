'use client';

import type { LeaderboardEntry } from '@/lib/api/leaderboard';

const RANK_COLORS: Record<string, string> = {
  Rookie: 'bg-gray-400',
  Coder: 'bg-emerald-500',
  Builder: 'bg-blue-500',
  Hacker: 'bg-purple-500',
  Architect: 'bg-amber-500',
};

const POSITION_ICONS: Record<number, string> = {
  1: '\u{1F947}',
  2: '\u{1F948}',
  3: '\u{1F949}',
};

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 animate-pulse">
      <div className="w-8 h-5 rounded bg-gray-200" />
      <div className="w-8 h-8 rounded-full bg-gray-200" />
      <div className="flex-1">
        <div className="w-28 h-4 rounded bg-gray-200" />
      </div>
      <div className="w-16 h-4 rounded bg-gray-200" />
      <div className="w-20 h-2 rounded-full bg-gray-200" />
    </div>
  );
}

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  loading: boolean;
  currentUserId: string;
}

export function LeaderboardTable({ entries, loading, currentUserId }: LeaderboardTableProps) {
  if (loading) {
    return (
      <div className="divide-y divide-gray-100">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="py-16 text-center">
        <span className="material-symbols-outlined text-4xl text-gray-300 mb-2 block">
          leaderboard
        </span>
        <p className="text-gray-400 text-sm">No activity yet this period.</p>
        <p className="text-gray-300 text-xs mt-1">Complete tasks to appear on the leaderboard.</p>
      </div>
    );
  }

  const maxXp = entries[0]?.xp || 1;

  return (
    <div className="divide-y divide-gray-100">
      {entries.map((entry) => {
        const isMe = entry.user_id === currentUserId;
        const barWidth = Math.max((entry.xp / maxXp) * 100, 2);
        const rankColor = RANK_COLORS[entry.rank_name] || 'bg-gray-400';
        const positionIcon = POSITION_ICONS[entry.position];

        return (
          <div
            key={entry.user_id}
            className={`flex items-center gap-3 px-4 py-3 transition-colors ${
              isMe ? 'bg-primary/5 border-l-2 border-primary' : 'hover:bg-gray-50'
            }`}
          >
            {/* Position */}
            <div className="w-8 text-center shrink-0">
              {positionIcon ? (
                <span className="text-lg">{positionIcon}</span>
              ) : (
                <span className="text-sm font-semibold text-gray-400">
                  {entry.position}
                </span>
              )}
            </div>

            {/* Avatar */}
            <div className="w-8 h-8 rounded-full shrink-0 overflow-hidden bg-gray-200 flex items-center justify-center">
              {entry.avatar_url ? (
                <img
                  src={entry.avatar_url}
                  alt={entry.display_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs font-bold text-gray-500">
                  {entry.display_name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            {/* Name + rank badge */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium truncate ${isMe ? 'text-primary' : 'text-on-background'}`}>
                  {entry.display_name}
                  {isMe && <span className="text-xs text-gray-400 ml-1">(you)</span>}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full text-white font-semibold ${rankColor}`}>
                  Lv.{entry.level}
                </span>
              </div>
            </div>

            {/* XP + bar */}
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-sm font-semibold text-on-background w-16 text-right">
                {entry.xp.toLocaleString()} <span className="text-xs text-gray-400 font-normal">XP</span>
              </span>
              <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden hidden sm:block">
                <div
                  className="h-full bg-gradient-to-r from-primary to-tertiary-container rounded-full transition-all duration-500"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
