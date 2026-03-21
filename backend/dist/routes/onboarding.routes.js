"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../lib/supabase");
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
 * Map score to skill tier
 */
function mapScoreToSkillTier(correctCount) {
    if (correctCount <= 1)
        return 'beginner';
    if (correctCount <= 3)
        return 'familiar';
    return 'intermediate';
}
/**
 * POST /api/onboarding/quiz-result
 * Save quiz answers and update skill tier
 */
router.post('/quiz-result', async (req, res) => {
    const userId = extractUserId(req);
    if (!userId) {
        return sendError(res, 400, 'INVALID_USER_ID', 'Invalid or missing x-user-id header');
    }
    try {
        const { answers } = req.body;
        // Validate answers
        if (!Array.isArray(answers) || answers.length !== 5 || !answers.every(a => typeof a === 'boolean')) {
            return sendError(res, 400, 'INVALID_ANSWERS', 'answers must be an array of 5 booleans');
        }
        const score = answers.filter(Boolean).length;
        const skillTier = mapScoreToSkillTier(score);
        const { error } = await supabase_1.supabaseAdmin
            .from('user_preferences')
            .upsert({ user_id: userId, skill_tier: skillTier }, { onConflict: 'user_id' });
        if (error) {
            throw new Error(`DB error: ${error.message}`);
        }
        return sendSuccess(res, 200, {
            skill_tier: skillTier,
            score,
            message: `Skill tier set to ${skillTier}`,
        });
    }
    catch (error) {
        console.error('quiz-result error:', error);
        return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to save quiz result');
    }
});
/**
 * POST /api/onboarding/preferences
 * Save goal and daily time preference
 */
router.post('/preferences', async (req, res) => {
    const userId = extractUserId(req);
    if (!userId) {
        return sendError(res, 400, 'INVALID_USER_ID', 'Invalid or missing x-user-id header');
    }
    try {
        const { goal, daily_time_minutes } = req.body;
        // Validate inputs
        const validGoals = ['job', 'course', 'dsa', 'general'];
        if (typeof goal !== 'string' || !validGoals.includes(goal)) {
            return sendError(res, 400, 'INVALID_GOAL', `goal must be one of: ${validGoals.join(', ')}`);
        }
        const validTimes = [15, 20, 30];
        if (typeof daily_time_minutes !== 'number' || !validTimes.includes(daily_time_minutes)) {
            return sendError(res, 400, 'INVALID_TIME', `daily_time_minutes must be one of: ${validTimes.join(', ')}`);
        }
        const { error } = await supabase_1.supabaseAdmin
            .from('user_preferences')
            .upsert({ user_id: userId, goal, daily_time_minutes }, { onConflict: 'user_id' });
        if (error) {
            throw new Error(`DB error: ${error.message}`);
        }
        return sendSuccess(res, 200, {
            goal,
            daily_time_minutes,
            message: 'Preferences saved',
        });
    }
    catch (error) {
        console.error('preferences error:', error);
        return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to save preferences');
    }
});
/**
 * POST /api/onboarding/parse-url
 * Parse YouTube/Udemy URL using Gemini to generate daily plan
 * Note: This calls the old JS parser service temporarily
 */
router.post('/parse-url', async (req, res) => {
    const userId = extractUserId(req);
    if (!userId) {
        return sendError(res, 400, 'INVALID_USER_ID', 'Invalid or missing x-user-id header');
    }
    try {
        const { url, fallback_topic } = req.body;
        if (typeof url !== 'string' || url.trim().length === 0) {
            return sendError(res, 400, 'INVALID_URL', 'url is required and must be a string');
        }
        // Import the old JS parser service
        // eslint-disable-next-line global-require,@typescript-eslint/no-var-requires
        const { parseUrl } = require('../../services/parser');
        // Get user preferences for skill tier
        const { data: prefs } = await supabase_1.supabaseAdmin
            .from('user_preferences')
            .select('skill_tier')
            .eq('user_id', userId)
            .single();
        const skillTier = prefs?.skill_tier || 'beginner';
        const result = await parseUrl(userId, url, skillTier, typeof fallback_topic === 'string' ? fallback_topic : null);
        return sendSuccess(res, 200, {
            plan_id: result.plan.id,
            title: result.plan.title,
            total_days: result.plan.total_days,
            source_type: result.plan.source_type,
            from_cache: result.fromCache,
            fallback: result.fallback,
            preview_checkpoints: Array.isArray(result.plan.checkpoints)
                ? result.plan.checkpoints.slice(0, 3)
                : [],
        });
    }
    catch (error) {
        console.error('parse-url error:', error);
        if (error instanceof Error && error.message.includes('unsupported_url')) {
            return sendError(res, 422, 'UNSUPPORTED_URL', 'URL must be a YouTube video, YouTube playlist, or Udemy course');
        }
        return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to parse URL');
    }
});
/**
 * POST /api/onboarding/parse-topic
 * Generate curriculum from topic name (fallback path)
 */
router.post('/parse-topic', async (req, res) => {
    const userId = extractUserId(req);
    if (!userId) {
        return sendError(res, 400, 'INVALID_USER_ID', 'Invalid or missing x-user-id header');
    }
    try {
        const { topic } = req.body;
        if (typeof topic !== 'string' || topic.trim().length < 2 || topic.trim().length > 100) {
            return sendError(res, 400, 'INVALID_TOPIC', 'topic must be a string between 2 and 100 characters');
        }
        // Import the old JS parser service
        // eslint-disable-next-line global-require,@typescript-eslint/no-var-requires
        const { parseFromTopic } = require('../../services/parser');
        // Get user preferences for skill tier
        const { data: prefs } = await supabase_1.supabaseAdmin
            .from('user_preferences')
            .select('skill_tier')
            .eq('user_id', userId)
            .single();
        const skillTier = prefs?.skill_tier || 'beginner';
        const result = await parseFromTopic(userId, topic.trim(), skillTier);
        return sendSuccess(res, 200, {
            plan_id: result.plan.id,
            title: result.plan.title,
            total_days: result.plan.total_days,
            source_type: result.plan.source_type,
            fallback: result.fallback,
            preview_checkpoints: Array.isArray(result.plan.checkpoints)
                ? result.plan.checkpoints.slice(0, 3)
                : [],
        });
    }
    catch (error) {
        console.error('parse-topic error:', error);
        return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to generate curriculum');
    }
});
/**
 * GET /api/onboarding/plan-preview
 * Get preview of active plan (first 3 days)
 */
router.get('/plan-preview', async (req, res) => {
    const userId = extractUserId(req);
    if (!userId) {
        return sendError(res, 400, 'INVALID_USER_ID', 'Invalid or missing x-user-id header');
    }
    try {
        const { data, error } = await supabase_1.supabaseAdmin
            .from('daily_plans')
            .select('id, title, total_days, checkpoints')
            .eq('user_id', userId)
            .eq('status', 'active')
            .order('generated_at', { ascending: false })
            .limit(1)
            .single();
        if (error || !data) {
            return sendError(res, 404, 'NO_ACTIVE_PLAN', 'No active plan found. Complete URL parsing first.');
        }
        const checkpoints = Array.isArray(data.checkpoints) ? data.checkpoints.slice(0, 3) : [];
        return sendSuccess(res, 200, {
            plan_id: data.id,
            title: data.title,
            total_days: data.total_days,
            preview_checkpoints: checkpoints,
        });
    }
    catch (error) {
        console.error('plan-preview error:', error);
        return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to fetch plan preview');
    }
});
exports.default = router;
