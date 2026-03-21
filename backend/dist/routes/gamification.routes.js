"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const xp_service_1 = require("../services/xp.service");
const badge_service_1 = require("../services/badge.service");
const supabase_1 = require("../lib/supabase");
const router = (0, express_1.Router)();
const xpService = new xp_service_1.XpService();
const badgeService = new badge_service_1.BadgeService();
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
 * Extract userId from Clerk auth middleware
 */
function extractUserId(req) {
    return req.userId;
}
/**
 * GET /api/me/xp
 * Return full XP profile with level, rank, and progress
 */
router.get('/me/xp', async (req, res) => {
    const userId = extractUserId(req);
    if (!userId) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
    }
    try {
        const { data: user } = await supabase_1.supabaseAdmin
            .from('users')
            .select('gamification_on')
            .eq('id', userId)
            .single();
        const gamificationOn = user?.gamification_on ?? true;
        if (!gamificationOn) {
            const streakProfile = await xpService.getStreak(userId);
            const { count: activeDays } = await supabase_1.supabaseAdmin
                .from('contributions')
                .select('date', { count: 'exact', head: true })
                .eq('user_id', userId)
                .gt('count', 0);
            // FIX: XP endpoint now returns minimal non-gamified payload when gamification_on is false.
            return sendSuccess(res, 200, {
                streakDays: streakProfile.currentStreak,
                activeDays: activeDays ?? 0,
                gamificationOn: false,
            });
        }
        const profile = await xpService.getUserXpProfile(userId);
        return sendSuccess(res, 200, {
            ...profile,
            gamificationOn: true,
        });
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
        return sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
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
        return sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
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
        return sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
    }
    try {
        const { data: user } = await supabase_1.supabaseAdmin
            .from('users')
            .select('gamification_on')
            .eq('id', userId)
            .single();
        const gamificationOn = user?.gamification_on ?? true;
        if (!gamificationOn) {
            const streakProfile = await xpService.getStreak(userId);
            const { count: activeDays } = await supabase_1.supabaseAdmin
                .from('contributions')
                .select('date', { count: 'exact', head: true })
                .eq('user_id', userId)
                .gt('count', 0);
            // FIX: Level endpoint now respects gamification toggle and hides level/rank details.
            return sendSuccess(res, 200, {
                streakDays: streakProfile.currentStreak,
                activeDays: activeDays ?? 0,
                gamificationOn: false,
            });
        }
        const profile = await xpService.getUserXpProfile(userId);
        const levelData = {
            level: profile.level,
            rank: profile.rank,
            xpToNextLevel: profile.xpToNextLevel,
            progressPercent: profile.progressPercent,
            gamificationOn: true,
        };
        return sendSuccess(res, 200, levelData);
    }
    catch (error) {
        console.error('Error fetching level info:', error);
        return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to fetch level info');
    }
});
router.patch('/me/gamification-toggle', async (req, res) => {
    const userId = req.userId;
    if (!userId) {
        return res.status(400).json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
    }
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
        return res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'enabled must be boolean' },
        });
    }
    // FIX: Added explicit API to toggle gamification_on per user profile.
    await supabase_1.supabaseAdmin.from('users').update({ gamification_on: enabled }).eq('id', userId);
    return res.json({ success: true, data: { gamificationOn: enabled } });
});
exports.default = router;
