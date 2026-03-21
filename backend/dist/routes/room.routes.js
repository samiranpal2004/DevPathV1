"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
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
