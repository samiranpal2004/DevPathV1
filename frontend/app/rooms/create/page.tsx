'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';

export default function CreateRoomPage() {
  const router = useRouter();
  const { getToken } = useAuth();

  const [name, setName] = useState('');
  const [maxMembers, setMaxMembers] = useState(5);
  const [isCreating, setIsCreating] = useState(false);
  const [createdRoom, setCreatedRoom] = useState<{
    id: string;
    code: string;
    name: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<null | 'code' | 'link'>(null);

  async function handleCreate() {
    if (!name.trim() || isCreating) return;

    setIsCreating(true);
    setError(null);

    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/rooms/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          type: 'daily_sprint',
          maxMembers,
          isPrivate: true,
        }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        throw new Error(err.error?.message ?? 'Failed to create room');
      }

      const data = (await res.json()) as {
        data: { id: string; code: string; name: string };
      };

      setCreatedRoom({
        id: data.data.id,
        code: data.data.code,
        name: data.data.name,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsCreating(false);
    }
  }

  async function copyToClipboard(text: string, target: 'code' | 'link') {
    await navigator.clipboard.writeText(text);
    setCopied(target);
    setTimeout(() => setCopied(null), 2000);
  }

  const shareUrl = createdRoom ? `${window.location.origin}/join/${createdRoom.code}` : '';

  const whatsappUrl = createdRoom
    ? `https://wa.me/?text=${encodeURIComponent(
        `Join my DevPath coding room!\nCode: ${createdRoom.code}\n${shareUrl}`
      )}`
    : '#';

  if (createdRoom) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
          <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">✅</span>
          </div>

          <h1 className="text-white font-bold text-2xl mb-1">Room Created!</h1>
          <p className="text-gray-400 text-sm mb-8">{createdRoom.name}</p>

          <p className="text-gray-400 text-xs uppercase tracking-widest mb-3">Share this code</p>
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-4">
            <p className="text-green-400 font-mono font-bold text-4xl tracking-[0.5em] text-center pl-[0.5em]">
              {createdRoom.code}
            </p>
          </div>

          <div className="flex gap-3 mb-6">
            <button
              onClick={() => void copyToClipboard(createdRoom.code, 'code')}
              className="flex-1 py-2.5 rounded-lg border border-gray-700 text-gray-300 hover:border-gray-600 hover:text-white transition-colors text-sm"
            >
              {copied === 'code' ? '✓ Copied!' : 'Copy Code'}
            </button>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white transition-colors text-sm text-center"
            >
              WhatsApp
            </a>
          </div>

          <p className="text-gray-400 text-xs uppercase tracking-widest mb-2 text-left">Or share link</p>
          <div className="bg-gray-800/50 border border-gray-800 rounded-lg p-3 mb-6 flex items-center gap-2">
            <p className="text-gray-500 text-xs truncate flex-1">{shareUrl}</p>
            <button
              onClick={() => void copyToClipboard(shareUrl, 'link')}
              className="text-green-400 text-xs hover:text-green-300 shrink-0"
            >
              {copied === 'link' ? 'Copied' : 'Copy'}
            </button>
          </div>

          <button
            onClick={() => router.push(`/rooms/${createdRoom.id}`)}
            className="w-full py-3 rounded-lg bg-green-600 hover:bg-green-500 text-white font-semibold transition-colors"
          >
            Go to Room →
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-8">
        <h1 className="text-white font-bold text-2xl mb-1">Create a Room</h1>
        <p className="text-gray-400 text-sm mb-8">Challenge your friends to a daily coding race</p>

        <label className="block text-gray-300 text-sm font-medium mb-2">Room name</label>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              void handleCreate();
            }
          }}
          placeholder="e.g. KGEC DSA Squad"
          maxLength={50}
          className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition-colors mb-6"
        />

        <label className="block text-gray-300 text-sm font-medium mb-3">Max members</label>
        <div className="flex gap-2 mb-8">
          {[2, 3, 5, 10].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMaxMembers(value)}
              className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                maxMembers === value
                  ? 'border-green-500 bg-green-500/10 text-green-400'
                  : 'border-gray-700 text-gray-400 hover:border-gray-600'
              }`}
            >
              {value}
            </button>
          ))}
        </div>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        <button
          onClick={() => void handleCreate()}
          disabled={!name.trim() || isCreating}
          className="w-full py-3 rounded-lg bg-green-600 hover:bg-green-500 text-white font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed mb-4"
        >
          {isCreating ? 'Creating...' : 'Create Room →'}
        </button>

        <p className="text-gray-600 text-xs text-center">Daily Sprint · First to finish all 3 tasks wins</p>
      </div>
    </main>
  );
}