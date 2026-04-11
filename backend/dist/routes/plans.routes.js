"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const joi_1 = __importDefault(require("joi"));
const validate_1 = require("../middleware/validate");
const gemini_service_1 = require("../services/gemini.service");
const parser_service_1 = require("../services/parser.service");
const onboarding_service_1 = require("../services/onboarding.service");
const default_plans_1 = require("../data/default-plans");
const supabase_1 = require("../lib/supabase");
const router = express_1.default.Router();
// ─── Schemas ─────────────────────────────────────────────────────────────────
const analyzeVideoSchema = joi_1.default.object({
    url: joi_1.default.string().uri().required().messages({
        'string.uri': 'url must be a valid URI',
        'any.required': 'url is required',
    }),
});
const generatePlanSchema = joi_1.default.object({
    url: joi_1.default.string().uri().required(),
    analysis: joi_1.default.object({
        topic: joi_1.default.string().required(),
        concepts: joi_1.default.array().items(joi_1.default.string()).required(),
        difficulty_estimate: joi_1.default.string().required(),
        total_duration_minutes: joi_1.default.number().required(),
        summary: joi_1.default.string().required(),
    }).required(),
    answers: joi_1.default.array().items(joi_1.default.boolean().required()).min(1).required(),
    daily_time_minutes: joi_1.default.number().valid(15, 20, 30).optional(),
});
function getUserId(req, res) {
    const userId = req.userId;
    if (!userId) {
        res.status(401).json({ error: 'Unauthorized: authentication required' });
        return null;
    }
    return userId;
}
async function fetchYouTubeVideoTitle(url) {
    const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    const videoId = videoIdMatch?.[1];
    if (!videoId)
        return null;
    try {
        const oEmbedUrl = `https://www.youtube.com/oembed` +
            `?url=https://www.youtube.com/watch?v=${videoId}` +
            `&format=json`;
        const response = await fetch(oEmbedUrl);
        if (!response.ok)
            return null;
        const data = await response.json();
        return typeof data.title === 'string' && data.title.trim().length > 0
            ? data.title
            : null;
    }
    catch {
        return null;
    }
}
// ─── POST /api/plans/analyze-video ───────────────────────────────────────────
/**
 * Step 1: Gemini watches the video, returns topic analysis + quiz questions
 * to assess the user's level on this topic.
 */
router.post('/analyze-video', (0, validate_1.validate)(analyzeVideoSchema), async (req, res) => {
    const userId = getUserId(req, res);
    if (!userId)
        return;
    const { url } = req.body;
    // Validate URL type
    const detection = (0, onboarding_service_1.detectUrlType)(url);
    if (!detection.valid) {
        res.status(422).json({
            error: 'unsupported_url',
            message: 'URL must be a YouTube video or playlist.',
        });
        return;
    }
    try {
        const videoTitle = await fetchYouTubeVideoTitle(url);
        const validation = await (0, gemini_service_1.validateEducationalContent)(url, videoTitle ?? undefined);
        if (!validation.isEducational) {
            res.status(422).json({
                error: 'non_educational_content',
                message: "This doesn't look like educational content. DevPath only supports technical and coding tutorials.",
                category: validation.category,
                reason: validation.reason,
            });
            return;
        }
        const result = await (0, gemini_service_1.analyzeVideoForQuiz)(url);
        res.status(200).json({
            analysis: result.analysis,
            questions: result.questions,
            source_type: detection.source_type,
        });
    }
    catch (err) {
        if ((0, gemini_service_1.isQuotaError)(err)) {
            res.status(429).json({ error: 'quota_exceeded', message: 'Gemini quota reached. Please try again later.' });
            return;
        }
        console.error('analyze-video error:', err.message);
        res.status(500).json({ error: 'Failed to analyze video' });
    }
});
// ─── POST /api/plans/generate ────────────────────────────────────────────────
/**
 * Step 2: User's quiz answers determine their skill level.
 * Gemini generates a personalised day-wise plan based on that level.
 * Plan is stored WITHOUT deactivating existing plans.
 */
router.post('/generate', (0, validate_1.validate)(generatePlanSchema), async (req, res) => {
    const userId = getUserId(req, res);
    if (!userId)
        return;
    const { url, analysis, answers, daily_time_minutes } = req.body;
    // Determine skill level from quiz answers
    const correctCount = answers.filter(Boolean).length;
    const total = answers.length;
    const pct = total > 0 ? correctCount / total : 0;
    let skillLevel;
    if (pct < 0.4)
        skillLevel = 'beginner';
    else if (pct < 0.8)
        skillLevel = 'familiar';
    else
        skillLevel = 'intermediate';
    // Get daily time from prefs or request
    let dailyTime = daily_time_minutes ?? 20;
    if (!daily_time_minutes) {
        const { data: prefs } = await supabase_1.supabaseAdmin
            .from('user_preferences')
            .select('daily_time_minutes')
            .eq('user_id', userId)
            .single();
        if (prefs?.daily_time_minutes)
            dailyTime = prefs.daily_time_minutes;
    }
    try {
        const rawPlan = await (0, gemini_service_1.generatePersonalizedPlan)(analysis, skillLevel, dailyTime);
        const stripped = rawPlan.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
        let parsedPlan;
        try {
            parsedPlan = JSON.parse(stripped);
            (0, parser_service_1.validateParsedPlan)(parsedPlan);
        }
        catch {
            // Fallback to default plan on parse failure
            const defaultPlan = (0, default_plans_1.getDefaultPlan)('javascript');
            const stored = await (0, parser_service_1.storePlanKeepExisting)(userId, url, 'default', defaultPlan, skillLevel);
            res.status(200).json({
                plan: stored,
                skill_level: skillLevel,
                fallback: 'parse_default',
            });
            return;
        }
        // Detect source type
        const detection = (0, onboarding_service_1.detectUrlType)(url);
        const sourceType = detection.valid ? detection.source_type : 'youtube_video';
        const stored = await (0, parser_service_1.storePlanKeepExisting)(userId, url, sourceType, parsedPlan, skillLevel);
        res.status(200).json({
            plan: stored,
            skill_level: skillLevel,
            fallback: null,
        });
    }
    catch (err) {
        if ((0, gemini_service_1.isQuotaError)(err)) {
            // Quota fallback
            const defaultPlan = (0, default_plans_1.getDefaultPlan)('javascript');
            const stored = await (0, parser_service_1.storePlanKeepExisting)(userId, url, 'default', defaultPlan, skillLevel);
            res.status(200).json({
                plan: stored,
                skill_level: skillLevel,
                fallback: 'quota_default',
            });
            return;
        }
        console.error('generate-plan error:', err.message);
        res.status(500).json({ error: 'Failed to generate plan' });
    }
});
// ─── GET /api/plans ──────────────────────────────────────────────────────────
/**
 * Returns all plans for the user with completion progress.
 */
router.get('/', async (req, res) => {
    const userId = getUserId(req, res);
    if (!userId)
        return;
    try {
        const { data: plans, error } = await supabase_1.supabaseAdmin
            .from('daily_plans')
            .select('id, title, source_url, source_type, total_days, current_day, status, checkpoints, generated_at')
            .eq('user_id', userId)
            .order('generated_at', { ascending: false });
        if (error)
            throw new Error(error.message);
        // For each plan, count completed tasks from xp_events
        const plansWithProgress = await Promise.all((plans || []).map(async (plan) => {
            const planId = plan.id;
            const checkpoints = plan.checkpoints;
            const totalDays = plan.total_days;
            // Fetch xp_events scoped to this plan (new format: {planId}:day_X_taskKey)
            const { data: newFormatEvents } = await supabase_1.supabaseAdmin
                .from('xp_events')
                .select('task_id')
                .eq('user_id', userId)
                .like('task_id', `${planId}:day_%`);
            // Also check old format for backwards compatibility
            const { data: oldFormatEvents } = await supabase_1.supabaseAdmin
                .from('xp_events')
                .select('task_id')
                .eq('user_id', userId)
                .like('task_id', 'day_%')
                .not('task_id', 'like', '%:%');
            const completedTaskIds = new Set();
            for (const evt of (newFormatEvents || [])) {
                completedTaskIds.add(evt.task_id.replace(`${planId}:`, ''));
            }
            for (const evt of (oldFormatEvents || [])) {
                completedTaskIds.add(evt.task_id);
            }
            // Calculate per-day progress
            const dayProgress = {};
            for (let d = 1; d <= totalDays; d++) {
                dayProgress[d] = {
                    task1: completedTaskIds.has(`day_${d}_task1`),
                    task2: completedTaskIds.has(`day_${d}_task2`),
                    practice: completedTaskIds.has(`day_${d}_practice`),
                };
            }
            // Count how many days are fully completed
            const daysCompleted = Object.values(dayProgress).filter((dp) => dp.task1 && dp.task2 && dp.practice).length;
            return {
                id: planId,
                title: plan.title,
                source_url: plan.source_url,
                source_type: plan.source_type,
                total_days: totalDays,
                current_day: plan.current_day,
                status: plan.status,
                generated_at: plan.generated_at,
                days_completed: daysCompleted,
                day_progress: dayProgress,
                preview_checkpoints: Array.isArray(checkpoints) ? checkpoints.slice(0, 3) : [],
            };
        }));
        res.status(200).json({ plans: plansWithProgress });
    }
    catch (err) {
        console.error('get-plans error:', err.message);
        res.status(500).json({ error: 'Failed to fetch plans' });
    }
});
// ─── POST /api/plans/:id/activate ────────────────────────────────────────────
/**
 * Set a specific plan as the active plan for daily missions.
 */
router.post('/:id/activate', async (req, res) => {
    const userId = getUserId(req, res);
    if (!userId)
        return;
    const planId = req.params.id;
    try {
        // Verify the plan belongs to this user
        const { data: plan } = await supabase_1.supabaseAdmin
            .from('daily_plans')
            .select('id')
            .eq('id', planId)
            .eq('user_id', userId)
            .single();
        if (!plan) {
            res.status(404).json({ error: 'Plan not found' });
            return;
        }
        // Deactivate all other plans
        await supabase_1.supabaseAdmin
            .from('daily_plans')
            .update({ status: 'paused' })
            .eq('user_id', userId)
            .eq('status', 'active');
        // Activate the selected plan
        await supabase_1.supabaseAdmin
            .from('daily_plans')
            .update({ status: 'active' })
            .eq('id', planId);
        res.status(200).json({ message: 'Plan activated', plan_id: planId });
    }
    catch (err) {
        console.error('activate-plan error:', err.message);
        res.status(500).json({ error: 'Failed to activate plan' });
    }
});
// ─── GET /api/plans/:id/progress ─────────────────────────────────────────────
/**
 * Returns per-day completion status for a specific plan.
 * Checks xp_events with task_id format: {planId}:day_{d}_{taskKey}
 * Also falls back to the older format (day_{d}_{taskKey}) for backwards compat.
 */
router.get('/:id/progress', async (req, res) => {
    const userId = getUserId(req, res);
    if (!userId)
        return;
    const planId = req.params.id;
    try {
        // Verify the plan belongs to this user and get total_days
        const { data: plan } = await supabase_1.supabaseAdmin
            .from('daily_plans')
            .select('id, total_days')
            .eq('id', planId)
            .eq('user_id', userId)
            .single();
        if (!plan) {
            res.status(404).json({ error: 'Plan not found' });
            return;
        }
        const totalDays = plan.total_days;
        // Fetch all xp_events with task_ids matching this plan
        // New format: {planId}:day_X_taskKey
        const { data: newFormatEvents } = await supabase_1.supabaseAdmin
            .from('xp_events')
            .select('task_id')
            .eq('user_id', userId)
            .like('task_id', `${planId}:day_%`);
        // Also check old format for backwards compatibility: day_X_taskKey
        const { data: oldFormatEvents } = await supabase_1.supabaseAdmin
            .from('xp_events')
            .select('task_id')
            .eq('user_id', userId)
            .like('task_id', 'day_%')
            .not('task_id', 'like', '%:%');
        const completedTaskIds = new Set();
        // Parse new format: {planId}:day_X_taskKey → day_X_taskKey
        for (const evt of (newFormatEvents || [])) {
            const stripped = evt.task_id.replace(`${planId}:`, '');
            completedTaskIds.add(stripped);
        }
        // Add old format directly
        for (const evt of (oldFormatEvents || [])) {
            completedTaskIds.add(evt.task_id);
        }
        // Build per-day progress
        const dayProgress = {};
        for (let d = 1; d <= totalDays; d++) {
            dayProgress[d] = {
                task1: completedTaskIds.has(`day_${d}_task1`),
                task2: completedTaskIds.has(`day_${d}_task2`),
                practice: completedTaskIds.has(`day_${d}_practice`),
            };
        }
        const daysCompleted = Object.values(dayProgress).filter((dp) => dp.task1 && dp.task2 && dp.practice).length;
        res.status(200).json({
            plan_id: planId,
            total_days: totalDays,
            days_completed: daysCompleted,
            day_progress: dayProgress,
        });
    }
    catch (err) {
        console.error('plan-progress error:', err.message);
        res.status(500).json({ error: 'Failed to fetch plan progress' });
    }
});
exports.default = router;
