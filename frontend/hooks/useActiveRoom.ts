'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';

export interface ActiveRoom {
  id: string;
  code: string;
  name: string;
}

export function useActiveRoom(): {
  activeRoom: ActiveRoom | null;
  isLoading: boolean;
} {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const [activeRoom, setActiveRoom] = useState<ActiveRoom | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      setIsLoading(false);
      return;
    }

    async function fetchActiveRoom() {
      try {
        const token = await getToken();
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/rooms/my-active-room`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (res.ok) {
          const data = await res.json();
          setActiveRoom(data.data ?? null);
        } else {
          setActiveRoom(null);
        }
      } catch {
        setActiveRoom(null);
      } finally {
        setIsLoading(false);
      }
    }

    void fetchActiveRoom();
  }, [isLoaded, isSignedIn, getToken]);

  return { activeRoom, isLoading };
}
