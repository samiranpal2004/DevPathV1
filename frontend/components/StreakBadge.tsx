'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  freezeCount: number;
}

export function StreakBadge() {
  const { getToken } = useAuth();
  const [streak, setStreak] = useState<StreakData | null>(null);
  const apiBase = process.env.NEXT_PUBLIC_API_URL;

  const fetchStreak = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${apiBase}/api/me/streak`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const body = await res.json() as { success: boolean; data: StreakData };
      if (body.success) {
        setStreak(body.data);
      }
    } catch {
      // silently fail
    }
  }, [getToken, apiBase]);

  useEffect(() => {
    void fetchStreak();
    const handler = () => void fetchStreak();
    window.addEventListener('devpath:xp-changed', handler);
    return () => window.removeEventListener('devpath:xp-changed', handler);
  }, [fetchStreak]);

  if (!streak) return null;

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-400 text-xs font-bold">
      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
        local_fire_department
      </span>
      {streak.currentStreak}
      {streak.freezeCount > 0 && (
        <span className="text-blue-400 ml-0.5" title="Freeze available">
          <span className="material-symbols-outlined text-xs">ac_unit</span>
        </span>
      )}
    </div>
  );
}
