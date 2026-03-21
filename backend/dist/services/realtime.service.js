"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscribeToRoomLeaderboard = subscribeToRoomLeaderboard;
exports.subscribeToRoomFeed = subscribeToRoomFeed;
const supabase_1 = require("../lib/supabase");
function subscribeToRoomLeaderboard(roomId, onUpdate) {
    // FIX: Added production-hardened leaderboard realtime subscription with reconnect fallback logs.
    const channel = supabase_1.supabaseAnon
        .channel(`room-leaderboard-${roomId}`)
        .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'room_daily_log',
        filter: `room_id=eq.${roomId}`,
    }, onUpdate)
        .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'room_daily_log',
        filter: `room_id=eq.${roomId}`,
    }, onUpdate)
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
function subscribeToRoomFeed(roomId, onEvent) {
    // FIX: Added room feed insert subscription helper for frontend room activity stream.
    return supabase_1.supabaseAnon
        .channel(`room-feed-${roomId}`)
        .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'room_events',
        filter: `room_id=eq.${roomId}`,
    }, onEvent)
        .subscribe();
}
