import { useAuth } from '@clerk/nextjs';

export function useApi() {
  const { getToken } = useAuth();

  async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = await getToken();

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error?.error?.message ?? 'Request failed');
    }

    return response.json() as Promise<T>;
  }

  return { apiFetch };
}
