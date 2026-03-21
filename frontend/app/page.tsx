'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    // Route to dashboard on mount
    // AuthSync will handle onboarding redirect if needed
    router.push('/dashboard');
  }, [router]);

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <p className="text-gray-400">Loading...</p>
    </main>
  );
}
