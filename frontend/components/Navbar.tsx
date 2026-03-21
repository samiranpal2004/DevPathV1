'use client';

import Link from 'next/link';
import { UserButton, useUser } from '@clerk/nextjs';
import { XpBar } from './XpBar';
import { StreakBadge } from './StreakBadge';

export function Navbar() {
  const { user, isLoaded } = useUser();

  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-950">
      <span className="text-white font-bold text-lg">DevPath</span>

      {isLoaded && user && (
        <div className="flex items-center gap-4">
          <StreakBadge />
          <XpBar />
          <Link
            href="/leaderboard"
            className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-base">leaderboard</span>
            <span className="hidden sm:inline">Leaderboard</span>
          </Link>
          <div className="w-px h-6 bg-gray-700" />
          <span className="text-gray-400 text-sm hidden sm:block">
            {user.firstName ?? user.emailAddresses[0]?.emailAddress}
          </span>
          <UserButton
            appearance={{
              elements: {
                avatarBox: 'w-8 h-8',
              },
            }}
          />
        </div>
      )}
    </nav>
  );
}
