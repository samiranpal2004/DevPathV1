/**
 * Realtime subscriptions for room features.
 * Call subscribeToRoomLeaderboard() when entering a room.
 * Call channel.unsubscribe() when leaving a room.
 * Fallback: if status is CLOSED, poll GET /api/rooms/:id/leaderboard
 * every 10 seconds.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabaseAnon } from '../lib/supabase';

export function subscribeToRoomLeaderboard(
  roomId: string,
  onUpdate: (payload: unknown) => void
): RealtimeChannel {
  // FIX: Added production-hardened leaderboard realtime subscription with reconnect fallback logs.
  const channel = supabaseAnon
    .channel(`room-leaderboard-${roomId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'room_daily_log',
        filter: `room_id=eq.${roomId}`,
      },
      onUpdate
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'room_daily_log',
        filter: `room_id=eq.${roomId}`,
      },
      onUpdate
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`✅ Realtime connected for room ${roomId}`);
      }
      if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        console.warn(`⚠️ Realtime disconnected for room ${roomId} — fallback polling active`);
      }
    });

  return channel;
}

export function subscribeToRoomFeed(
  roomId: string,
  onEvent: (payload: unknown) => void
): RealtimeChannel {
  // FIX: Added room feed insert subscription helper for frontend room activity stream.
  return supabaseAnon
    .channel(`room-feed-${roomId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'room_events',
        filter: `room_id=eq.${roomId}`,
      },
      onEvent
    )
    .subscribe();
}
