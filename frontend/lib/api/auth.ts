import { api } from './client';

export interface User {
  id: string;
  email: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  gamification_on: boolean;
  leaderboard_opt_in: boolean;
  created_at: string;
}

/** Persist userId in localStorage so the interceptor picks it up. */
export function setCurrentUser(userId: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('devpath-user-id', userId);
  }
}

export function clearCurrentUser() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('devpath-user-id');
  }
}

export function getCurrentUserId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('devpath-user-id');
}

/** Health-check — also used to verify the API is reachable. */
export async function healthCheck(): Promise<{ status: string }> {
  const res = await api.get('/health');
  return res.data;
}
