'use client';

import { UserButton, useUser } from '@clerk/nextjs';

export function Navbar() {
  const { user, isLoaded } = useUser();

  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-950">
      <span className="text-white font-bold text-lg">DevPath</span>

      {isLoaded && user && (
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-sm hidden sm:block">
            {user.firstName ?? user.emailAddresses[0]?.emailAddress}
          </span>
          <UserButton
            afterSignOutUrl="/"
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
