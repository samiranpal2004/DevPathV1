"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
/**
 * Extract userId from x-user-id header
 */
function extractUserId(req) {
    const userId = req.headers['x-user-id'];
    if (typeof userId !== 'string') {
        return null;
    }
    return userId.trim() || null;
}
/**
 * Send error response
 */
function sendError(res, statusCode, code, message) {
    return res.status(statusCode).json({
        success: false,
        error: { code, message },
    });
}
/**
 * Send success response
 */
function sendSuccess(res, statusCode, data) {
    return res.status(statusCode).json({
        success: true,
        data,
    });
}
/**
 * GET /api/mission/today
 * Get today's mission from active plan
 */
router.get('/today', async (req, res) => {
    const userId = extractUserId(req);
    if (!userId) {
        return sendError(res, 400, 'INVALID_USER_ID', 'Invalid or missing x-user-id header');
    }
    try {
        // eslint-disable-next-line global-require,@typescript-eslint/no-var-requires
        const { getTodayMission } = require('../../services/mission');
        const mission = await getTodayMission(userId);
        if (!mission) {
            return sendError(res, 404, 'NO_ACTIVE_PLAN', 'No active plan found. Complete onboarding first.');
        }
        return sendSuccess(res, 200, mission);
    }
    catch (error) {
        console.error('mission/today error:', error);
        return sendError(res, 500, 'INTERNAL_ERROR', "Failed to load today's mission");
    }
});
/**
 * POST /api/mission/complete-task
 * Mark task 1 or 2 complete for today
 */
router.post('/complete-task', async (req, res) => {
    const userId = extractUserId(req);
    if (!userId) {
        return sendError(res, 400, 'INVALID_USER_ID', 'Invalid or missing x-user-id header');
    }
    try {
        const { task_num, day_number } = req.body;
        if (typeof task_num !== 'number' || ![1, 2].includes(task_num)) {
            return sendError(res, 400, 'INVALID_TASK', 'task_num must be 1 or 2');
        }
        if (typeof day_number !== 'number' || day_number < 1) {
            return sendError(res, 400, 'INVALID_DAY', 'day_number must be a positive number');
        }
        // eslint-disable-next-line global-require,@typescript-eslint/no-var-requires
        const { completeTask } = require('../../services/mission');
        const result = await completeTask(userId, task_num, day_number);
        return sendSuccess(res, 200, result);
    }
    catch (error) {
        console.error('complete-task error:', error);
        return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to complete task');
    }
});
/**
 * POST /api/mission/submit-practice
 * Submit code solution to practice problem
 */
router.post('/submit-practice', async (req, res) => {
    const userId = extractUserId(req);
    if (!userId) {
        return sendError(res, 400, 'INVALID_USER_ID', 'Invalid or missing x-user-id header');
    }
    try {
        const { plan_id, day_number, passed, submitted_code, error_type, hint_used, } = req.body;
        if (typeof plan_id !== 'string') {
            return sendError(res, 400, 'INVALID_PLAN', 'plan_id must be a string');
        }
        if (typeof day_number !== 'number' || day_number < 1) {
            return sendError(res, 400, 'INVALID_DAY', 'day_number must be a positive number');
        }
        if (typeof passed !== 'boolean') {
            return sendError(res, 400, 'INVALID_PASSED', 'passed must be a boolean');
        }
        // eslint-disable-next-line global-require,@typescript-eslint/no-var-requires
        const { submitPractice } = require('../../services/mission');
        const result = await submitPractice(userId, plan_id, day_number, passed, submitted_code, error_type, hint_used);
        return sendSuccess(res, 200, result);
    }
    catch (error) {
        console.error('submit-practice error:', error);
        return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to submit practice');
    }
});
/**
 * POST /api/mission/busy-day
 * Register a busy day (uses 1 freeze)
 */
router.post('/busy-day', async (req, res) => {
    const userId = extractUserId(req);
    if (!userId) {
        return sendError(res, 400, 'INVALID_USER_ID', 'Invalid or missing x-user-id header');
    }
    try {
        // eslint-disable-next-line global-require,@typescript-eslint/no-var-requires
        const { busyDay } = require('../../services/mission');
        const result = await busyDay(userId);
        return sendSuccess(res, 200, result);
    }
    catch (error) {
        console.error('busy-day error:', error);
        return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to register busy day');
    }
});
/**
 * POST /api/mission/skip-day
 * Skip the current day (uses 1 freeze)
 */
router.post('/skip-day', async (req, res) => {
    const userId = extractUserId(req);
    if (!userId) {
        return sendError(res, 400, 'INVALID_USER_ID', 'Invalid or missing x-user-id header');
    }
    try {
        // eslint-disable-next-line global-require,@typescript-eslint/no-var-requires
        const { skipDay } = require('../../services/mission');
        const result = await skipDay(userId);
        return sendSuccess(res, 200, result);
    }
    catch (error) {
        console.error('skip-day error:', error);
        return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to register skip day');
    }
});
/**
 * POST /api/mission/stuck
 * Get AI-powered hint for stuck practice problem
 */
router.post('/stuck', async (req, res) => {
    const userId = extractUserId(req);
    if (!userId) {
        return sendError(res, 400, 'INVALID_USER_ID', 'Invalid or missing x-user-id header');
    }
    try {
        const { plan_id, day_number, problem, topic } = req.body;
        if (typeof plan_id !== 'string') {
            return sendError(res, 400, 'INVALID_PLAN', 'plan_id must be a string');
        }
        if (typeof day_number !== 'number' || day_number < 1) {
            return sendError(res, 400, 'INVALID_DAY', 'day_number must be a positive number');
        }
        if (typeof problem !== 'string' || problem.trim().length === 0) {
            return sendError(res, 400, 'INVALID_PROBLEM', 'problem must be a non-empty string');
        }
        if (typeof topic !== 'string' || topic.trim().length === 0) {
            return sendError(res, 400, 'INVALID_TOPIC', 'topic must be a non-empty string');
        }
        // eslint-disable-next-line global-require,@typescript-eslint/no-var-requires
        const { getStuckHint } = require('../../services/mission');
        const result = await getStuckHint(userId, plan_id, day_number, problem, topic);
        return sendSuccess(res, 200, result);
    }
    catch (error) {
        console.error('mission/stuck error:', error);
        return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to get hint');
    }
});
exports.default = router;
