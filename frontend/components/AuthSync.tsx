'use client';

import { useEffect, useRef } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { usePathname, useRouter } from 'next/navigation';

export function AuthSync() {
  const { isSignedIn, getToken, isLoaded } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const isSyncingRef = useRef(false);

  useEffect(() => {
    if (!isLoaded) return;

    // Redirect unauthenticated users away from protected pages
    if (!isSignedIn && (pathname === '/dashboard' || pathname === '/onboarding' || pathname === '/')) {
      router.push('/sign-in');
      return;
    }

    if (!isSignedIn || !user) return;
    if (pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up')) return;

    if (isSyncingRef.current) return;

    async function syncAndRoute() {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiBaseUrl) return;

      isSyncingRef.current = true;
      try {
        const token = await getToken();
        if (!token) return;

        // Sync user to DB — creates default preferences if missing
        await fetch(`${apiBaseUrl}/api/auth/sync`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        // After login/signup always go to dashboard
        if (pathname === '/' || pathname === '/onboarding') {
          router.push('/dashboard');
        }
      } catch (error) {
        console.error('AuthSync error:', error);
      } finally {
        isSyncingRef.current = false;
      }
    }

    void syncAndRoute();
  }, [getToken, isLoaded, isSignedIn, pathname, router, user]);

  return null;
}
