"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const leaderboard_service_1 = require("../services/leaderboard.service");
const router = (0, express_1.Router)();
const VALID_FILTERS = new Set(['weekly', 'alltime', 'today']);
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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
/**
 * GET /api/leaderboard/global
 * Query params: filter (weekly|alltime|today), page (int), limit (int, max 100)
 */
router.get('/global', async (req, res) => {
    const userId = req.userId;
    if (!userId) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const filterParam = req.query.filter || 'weekly';
    if (!VALID_FILTERS.has(filterParam)) {
        return sendError(res, 400, 'BAD_REQUEST', 'filter must be one of: weekly, alltime, today.');
    }
    const filter = filterParam;
    let page = parseInt(req.query.page, 10);
    if (isNaN(page) || page < 1)
        page = 1;
    let limit = parseInt(req.query.limit, 10);
    if (isNaN(limit) || limit < 1)
        limit = 100;
    if (limit > 100)
        limit = 100;
    try {
        const result = await leaderboard_service_1.leaderboardService.getGlobal(userId, filter, page, limit);
        return sendSuccess(res, 200, result);
    }
    catch (error) {
        console.error('Error fetching global leaderboard:', error);
        return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to fetch leaderboard.');
    }
});
/**
 * GET /api/leaderboard/room/:roomId
 * Returns today's room leaderboard standings.
 */
router.get('/room/:roomId', async (req, res) => {
    const userId = req.userId;
    if (!userId) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const roomId = String(req.params.roomId ?? '').trim();
    if (!UUID_REGEX.test(roomId)) {
        return sendError(res, 400, 'BAD_REQUEST', 'roomId must be a valid UUID.');
    }
    try {
        const entries = await leaderboard_service_1.leaderboardService.getRoomLeaderboard(roomId, userId);
        return sendSuccess(res, 200, { room_id: roomId, entries });
    }
    catch (error) {
        console.error('Error fetching room leaderboard:', error);
        return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to fetch room leaderboard.');
    }
});
exports.default = router;
