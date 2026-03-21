"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const xp_service_1 = require("../services/xp.service");
const badge_service_1 = require("../services/badge.service");
const router = (0, express_1.Router)();
const xpService = new xp_service_1.XpService();
const badgeService = new badge_service_1.BadgeService();
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/**
 * Generic error response helper
 */
function sendError(res, statusCode, code, message) {
    return res.status(statusCode).json({
        success: false,
        error: { code, message },
    });
}
/**
 * Generic success response helper
 */
function sendSuccess(res, statusCode, data) {
    return res.status(statusCode).json({
        success: true,
        data,
    });
}
/**
 * Validate and extract userId from x-user-id header
 */
function extractUserId(req) {
    const userId = req.headers['x-user-id'];
    if (typeof userId !== 'string') {
        return null;
    }
    const trimmed = userId.trim();
    if (!UUID_REGEX.test(trimmed)) {
        return null;
    }
    return trimmed;
}
/**
 * GET /api/me/xp
 * Return full XP profile with level, rank, and progress
 */
router.get('/me/xp', async (req, res) => {
    const userId = extractUserId(req);
    if (!userId) {
        return sendError(res, 400, 'INVALID_USER_ID', 'Invalid or missing x-user-id header');
    }
    try {
        const profile = await xpService.getUserXpProfile(userId);
        return sendSuccess(res, 200, profile);
    }
    catch (error) {
        console.error('Error fetching XP profile:', error);
        return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to fetch XP profile');
    }
});
/**
 * GET /api/me/streak
 * Return current streak, longest streak, freeze count, and last active date
 */
router.get('/me/streak', async (req, res) => {
    const userId = extractUserId(req);
    if (!userId) {
        return sendError(res, 400, 'INVALID_USER_ID', 'Invalid or missing x-user-id header');
    }
    try {
        const streak = await xpService.getStreak(userId);
        return sendSuccess(res, 200, streak);
    }
    catch (error) {
        console.error('Error fetching streak:', error);
        return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to fetch streak');
    }
});
/**
 * GET /api/me/badges
 * Return all badges for this user, ordered by most recent
 */
router.get('/me/badges', async (req, res) => {
    const userId = extractUserId(req);
    if (!userId) {
        return sendError(res, 400, 'INVALID_USER_ID', 'Invalid or missing x-user-id header');
    }
    try {
        const badges = await badgeService.getUserBadges(userId);
        return sendSuccess(res, 200, badges);
    }
    catch (error) {
        console.error('Error fetching badges:', error);
        return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to fetch badges');
    }
});
/**
 * GET /api/me/level
 * Return level, rank, XP to next level, and progress percentage
 */
router.get('/me/level', async (req, res) => {
    const userId = extractUserId(req);
    if (!userId) {
        return sendError(res, 400, 'INVALID_USER_ID', 'Invalid or missing x-user-id header');
    }
    try {
        const profile = await xpService.getUserXpProfile(userId);
        const levelData = {
            level: profile.level,
            rank: profile.rank,
            xpToNextLevel: profile.xpToNextLevel,
            progressPercent: profile.progressPercent,
        };
        return sendSuccess(res, 200, levelData);
    }
    catch (error) {
        console.error('Error fetching level info:', error);
        return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to fetch level info');
    }
});
exports.default = router;
