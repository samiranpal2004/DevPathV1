"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../lib/supabase");
const requireAuth_1 = require("../middleware/requireAuth");
const room_service_1 = require("../services/room.service");
const router = (0, express_1.Router)();
const ROOM_TYPES = new Set([
    'daily_sprint',
    'speed_duel',
    '30_day_challenge',
    'topic_battle',
    'cohort',
    'ranked_arena',
]);
const ROOM_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROOM_CODE_REGEX = /^[A-Za-z0-9]{6}$/;
function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}
function isValidRoomId(value) {
    return ROOM_ID_REGEX.test(value);
}
function sendError(res, statusCode, code, message) {
    return res.status(statusCode).json({
        success: false,
        error: { code, message },
    });
}
function sendSuccess(res, statusCode, data) {
    return res.status(statusCode).json({
        success: true,
        data,
    });
}
router.post('/create', async (req, res) => {
    const body = req.body;
    const ownerId = req.userId;
    if (!isNonEmptyString(ownerId)) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Authentication required.');
    }
    if (!isNonEmptyString(body.name) || body.name.trim().length > 50) {
        return sendError(res, 400, 'BAD_REQUEST', 'name must be a non-empty string with max 50 characters.');
    }
    if (!body.type || !ROOM_TYPES.has(body.type)) {
        return sendError(res, 400, 'BAD_REQUEST', 'type must be a valid RoomType.');
    }
    if (body.maxMembers !== undefined) {
        if (!Number.isInteger(body.maxMembers) || body.maxMembers < 2 || body.maxMembers > 10) {
            return sendError(res, 400, 'BAD_REQUEST', 'maxMembers must be an integer between 2 and 10.');
        }
    }
    try {
        const room = await room_service_1.roomService.createRoom({
            ownerId,
            name: body.name,
            type: body.type,
            topic: body.topic,
            maxMembers: body.maxMembers,
            isPrivate: body.isPrivate,
        });
        return sendSuccess(res, 201, room);
    }
    catch (error) {
        if (error instanceof room_service_1.RoomServiceError) {
            return sendError(res, error.statusCode, error.code, error.message);
        }
        return sendError(res, 500, 'INTERNAL_ERROR', 'Unexpected error while creating room.');
    }
});
router.post('/join', async (req, res) => {
    const body = req.body;
    const userId = req.userId;
    if (!isNonEmptyString(userId)) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Authentication required.');
    }
    if (!isNonEmptyString(body.code) || !ROOM_CODE_REGEX.test(body.code)) {
        return sendError(res, 400, 'BAD_REQUEST', 'code must be exactly 6 alphanumeric characters.');
    }
    try {
        const preview = await room_service_1.roomService.joinRoom({
            code: body.code.toUpperCase(),
            userId,
        });
        return sendSuccess(res, 200, preview);
    }
    catch (error) {
        if (error instanceof room_service_1.RoomServiceError) {
            return sendError(res, error.statusCode, error.code, error.message);
        }
        return sendError(res, 500, 'INTERNAL_ERROR', 'Unexpected error while joining room.');
    }
});
router.get('/preview/:code', async (req, res) => {
    try {
        const code = String(req.params.code ?? '').trim().toUpperCase();
        if (!/^[A-Z0-9]{6}$/.test(code)) {
            return sendError(res, 400, 'INVALID_CODE', 'Invalid room code');
        }
        const { data: room, error } = await supabase_1.supabaseAdmin
            .from('rooms')
            .select('id, code, name, type, status, max_members')
            .eq('code', code)
            .eq('status', 'active')
            .single();
        if (error || !room) {
            return sendError(res, 404, 'NOT_FOUND', 'Room not found');
        }
        const { data: members } = await supabase_1.supabaseAdmin
            .from('room_members')
            .select('user_id, joined_at, users(display_name, avatar_url)')
            .eq('room_id', room.id);
        const today = new Date().toISOString().split('T')[0];
        const { data: standings } = await supabase_1.supabaseAdmin
            .from('room_daily_log')
            .select('user_id, tasks_done, xp_earned, finish_position, users(display_name)')
            .eq('room_id', room.id)
            .eq('date', today)
            .order('finish_position', { ascending: true, nullsFirst: false });
        return sendSuccess(res, 200, {
            room,
            members: members ?? [],
            todayStandings: standings ?? [],
        });
    }
    catch {
        return sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch preview');
    }
});
/**
 * GET /api/rooms/my-active-room
 * Returns the active room the current user is in (most recently joined).
 * Returns null if user is not in any active room.
 */
router.get('/my-active-room', async (req, res) => {
    const userId = req.userId;
    if (!isNonEmptyString(userId)) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Authentication required.');
    }
    try {
        // Find rooms this user is a member of that are currently active
        const { data: memberships, error } = await supabase_1.supabaseAdmin
            .from('room_members')
            .select('room_id')
            .eq('user_id', userId);
        if (error || !memberships || memberships.length === 0) {
            return sendSuccess(res, 200, null);
        }
        const roomIds = memberships.map((m) => m.room_id);
        const { data: activeRoom } = await supabase_1.supabaseAdmin
            .from('rooms')
            .select('id, code, name')
            .in('id', roomIds)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        return sendSuccess(res, 200, activeRoom ?? null);
    }
    catch (err) {
        console.error('[Room] my-active-room failed:', err);
        return sendSuccess(res, 200, null);
    }
});
router.get('/:id', requireAuth_1.requireAuth, async (req, res) => {
    try {
        const id = String(req.params.id ?? '').trim();
        if (!isValidRoomId(id)) {
            return sendError(res, 400, 'INVALID_UUID', 'Invalid room ID');
        }
        const { data, error } = await supabase_1.supabaseAdmin
            .from('rooms')
            .select('id, code, name, type, status, max_members, owner_id, created_at')
            .eq('id', id)
            .single();
        if (error || !data) {
            return sendError(res, 404, 'NOT_FOUND', 'Room not found');
        }
        return sendSuccess(res, 200, data);
    }
    catch {
        return sendError(res, 500, 'SERVER_ERROR', 'Failed to fetch room');
    }
});
router.get('/:id/leaderboard', async (req, res) => {
    const roomId = String(req.params.id ?? '').trim();
    if (!isValidRoomId(roomId)) {
        return sendError(res, 400, 'BAD_REQUEST', 'id must be a valid UUID.');
    }
    try {
        const standings = await room_service_1.roomService.getLeaderboard(roomId);
        return sendSuccess(res, 200, standings);
    }
    catch (error) {
        if (error instanceof room_service_1.RoomServiceError) {
            return sendError(res, error.statusCode, error.code, error.message);
        }
        return sendError(res, 500, 'INTERNAL_ERROR', 'Unexpected error while fetching leaderboard.');
    }
});
router.get('/:id/feed', async (req, res) => {
    const roomId = String(req.params.id ?? '').trim();
    if (!isValidRoomId(roomId)) {
        return sendError(res, 400, 'BAD_REQUEST', 'id must be a valid UUID.');
    }
    try {
        const feed = await room_service_1.roomService.getRoomFeed(roomId);
        return sendSuccess(res, 200, feed);
    }
    catch (error) {
        if (error instanceof room_service_1.RoomServiceError) {
            return sendError(res, error.statusCode, error.code, error.message);
        }
        return sendError(res, 500, 'INTERNAL_ERROR', 'Unexpected error while fetching room feed.');
    }
});
router.post('/:id/nudge/:userId', async (req, res) => {
    const roomId = String(req.params.id ?? '').trim();
    const targetUserId = String(req.params.userId ?? '').trim();
    const nudgerId = req.userId;
    if (!isValidRoomId(roomId)) {
        return sendError(res, 400, 'BAD_REQUEST', 'id must be a valid UUID.');
    }
    if (!isNonEmptyString(targetUserId)) {
        return sendError(res, 400, 'BAD_REQUEST', 'userId must be provided.');
    }
    if (!isNonEmptyString(nudgerId)) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Authentication required.');
    }
    try {
        await room_service_1.roomService.nudgeMember(roomId, nudgerId, targetUserId);
        return sendSuccess(res, 200, { message: 'Nudge sent.' });
    }
    catch (error) {
        if (error instanceof room_service_1.RoomServiceError) {
            return sendError(res, error.statusCode, error.code, error.message);
        }
        return sendError(res, 500, 'INTERNAL_ERROR', 'Unexpected error while sending nudge.');
    }
});
exports.default = router;
