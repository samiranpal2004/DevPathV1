'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';

interface XpData {
  totalXp: number;
  weeklyXp: number;
  level: number;
  rank: string;
  xpToNextLevel: number;
  progressPercent: number;
  gamificationOn: boolean;
}

const RANK_COLORS: Record<string, string> = {
  Rookie: 'bg-gray-500',
  Coder: 'bg-emerald-500',
  Builder: 'bg-blue-500',
  Hacker: 'bg-purple-500',
  Architect: 'bg-amber-500',
};

export function XpBar() {
  const { getToken } = useAuth();
  const [xp, setXp] = useState<XpData | null>(null);
  const apiBase = process.env.NEXT_PUBLIC_API_URL;

  const fetchXp = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${apiBase}/api/me/xp`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const body = await res.json() as { success: boolean; data: XpData };
      if (body.success && body.data.gamificationOn !== false) {
        setXp(body.data);
      }
    } catch {
      // silently fail
    }
  }, [getToken, apiBase]);

  useEffect(() => {
    void fetchXp();
    // Refresh XP every 30 seconds to pick up awards from other actions
    const interval = setInterval(() => void fetchXp(), 30000);
    // Also refresh immediately when XP is earned (from ActiveMission, CodeEditor, etc.)
    const handler = () => void fetchXp();
    window.addEventListener('devpath:xp-changed', handler);
    return () => {
      clearInterval(interval);
      window.removeEventListener('devpath:xp-changed', handler);
    };
  }, [fetchXp]);

  if (!xp) return null;

  const rankColor = RANK_COLORS[xp.rank] || 'bg-gray-500';

  return (
    <div className="flex items-center gap-3">
      {/* Level badge */}
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${rankColor} text-white text-xs font-bold`}>
        <span className="material-symbols-outlined text-sm">military_tech</span>
        Lv.{xp.level}
      </div>

      {/* XP bar */}
      <div className="flex flex-col items-end gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-300">
            {xp.totalXp.toLocaleString()} XP
          </span>
          <span className="text-[10px] text-gray-500">{xp.rank}</span>
        </div>
        <div className="w-28 h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-tertiary-container rounded-full transition-all duration-500"
            style={{ width: `${xp.progressPercent}%` }}
          />
        </div>
        {xp.xpToNextLevel > 0 && (
          <span className="text-[9px] text-gray-500">
            {xp.xpToNextLevel} XP to Lv.{xp.level + 1}
          </span>
        )}
      </div>
    </div>
  );
}
