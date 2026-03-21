'use client';

import { useEffect, useState } from 'react';

function getTimeLeft(resetsAt: string): string {
  const diff = new Date(resetsAt).getTime() - Date.now();
  if (diff <= 0) return 'Resetting...';
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

interface LeaderboardCountdownProps {
  resetsAt: string;
}

export function LeaderboardCountdown({ resetsAt }: LeaderboardCountdownProps) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(resetsAt));

  useEffect(() => {
    setTimeLeft(getTimeLeft(resetsAt));
    const interval = setInterval(() => {
      setTimeLeft(getTimeLeft(resetsAt));
    }, 60_000);
    return () => clearInterval(interval);
  }, [resetsAt]);

  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-400">
      <span className="material-symbols-outlined text-sm">timer</span>
      Resets in {timeLeft}
    </div>
  );
}
