'use client';

import { useEffect, useRef } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { usePathname, useRouter } from 'next/navigation';

export function AuthSync() {
  const { isSignedIn, getToken, isLoaded } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const needsOnboardingRef = useRef<boolean | null>(null);
  const isSyncingRef = useRef(false);

  useEffect(() => {
    if (!isLoaded) return;

    // If user is not signed in and trying to access protected routes, redirect to sign-in
    if (!isSignedIn && (pathname === '/dashboard' || pathname === '/onboarding' || pathname === '/')) {
      router.push('/sign-in');
      return;
    }

    if (!isSignedIn || !user) return;
    if (pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up')) return;

    async function ensureSyncAndRoute() {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiBaseUrl) {
        return;
      }

      try {
        if (needsOnboardingRef.current === null && !isSyncingRef.current) {
          isSyncingRef.current = true;

          const token = await getToken();
          if (!token) {
            isSyncingRef.current = false;
            return;
          }

          const res = await fetch(`${apiBaseUrl}/api/auth/sync`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (!res.ok) {
            const errorText = await res.text();
            console.error('Sync failed with status', res.status, ':', errorText);
            try {
              const errorJson = JSON.parse(errorText);
              console.error('Parsed error:', errorJson);
            } catch (e) {
              // Response is not JSON
            }
            isSyncingRef.current = false;
            return;
          }

          const data = await res.json();
          needsOnboardingRef.current = Boolean(data?.data?.needsOnboarding);
          isSyncingRef.current = false;
        }

        const needsOnboarding = needsOnboardingRef.current;
        if (needsOnboarding === null) return;

        if (needsOnboarding && pathname !== '/onboarding') {
          router.push('/onboarding');
          return;
        }

        if (!needsOnboarding && pathname === '/onboarding') {
          router.push('/dashboard');
          return;
        }

        if (!needsOnboarding && pathname === '/') {
          router.push('/dashboard');
        }
      } catch (error) {
        isSyncingRef.current = false;
        console.error('AuthSync error:', error);
      }
    }

    void ensureSyncAndRoute();
  }, [getToken, isLoaded, isSignedIn, pathname, router, user]);

  return null;
}
