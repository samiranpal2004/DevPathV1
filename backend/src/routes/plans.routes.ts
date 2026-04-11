import express, { Request, Response } from 'express';
import Joi from 'joi';

import { validate } from '../middleware/validate';
import {
    analyzeVideoForQuiz,
    generatePersonalizedPlan,
    isQuotaError,
    validateEducationalContent,
} from '../services/gemini.service';
import type { VideoAnalysis } from '../services/gemini.service';
import { storePlanKeepExisting, validateParsedPlan } from '../services/parser.service';
import { detectUrlType } from '../services/onboarding.service';
import { getDefaultPlan } from '../data/default-plans';
import { supabaseAdmin } from '../lib/supabase';

const router = express.Router();

// ─── Schemas ─────────────────────────────────────────────────────────────────

const analyzeVideoSchema = Joi.object({
    url: Joi.string().uri().required().messages({
        'string.uri': 'url must be a valid URI',
        'any.required': 'url is required',
    }),
});

const generatePlanSchema = Joi.object({
    url: Joi.string().uri().required(),
    analysis: Joi.object({
        topic: Joi.string().required(),
        concepts: Joi.array().items(Joi.string()).required(),
        difficulty_estimate: Joi.string().required(),
        total_duration_minutes: Joi.number().required(),
        summary: Joi.string().required(),
    }).required(),
    answers: Joi.array().items(Joi.boolean().required()).min(1).required(),
    daily_time_minutes: Joi.number().valid(15, 20, 30).optional(),
});

function getUserId(req: Request, res: Response): string | null {
    const userId = req.userId;
    if (!userId) {
        res.status(401).json({ error: 'Unauthorized: authentication required' });
        return null;
    }
    return userId;
}

async function fetchYouTubeVideoTitle(url: string): Promise<string | null> {
    const videoIdMatch = url.match(
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    const videoId = videoIdMatch?.[1];
    if (!videoId) return null;

    try {
        const oEmbedUrl =
            `https://www.youtube.com/oembed` +
            `?url=https://www.youtube.com/watch?v=${videoId}` +
            `&format=json`;
        const response = await fetch(oEmbedUrl);
        if (!response.ok) return null;

        const data = await response.json() as { title?: string };
        return typeof data.title === 'string' && data.title.trim().length > 0
            ? data.title
            : null;
    } catch {
        return null;
    }
}

// ─── POST /api/plans/analyze-video ───────────────────────────────────────────
/**
 * Step 1: Gemini watches the video, returns topic analysis + quiz questions
 * to assess the user's level on this topic.
 */
router.post('/analyze-video', validate(analyzeVideoSchema), async (req: Request, res: Response): Promise<void> => {
    const userId = getUserId(req, res);
    if (!userId) return;

    const { url } = req.body as { url: string };

    // Validate URL type
    const detection = detectUrlType(url);
    if (!detection.valid) {
        res.status(422).json({
            error: 'unsupported_url',
            message: 'URL must be a YouTube video or playlist.',
        });
        return;
    }

    try {
        const videoTitle = await fetchYouTubeVideoTitle(url);
        const validation = await validateEducationalContent(url, videoTitle ?? undefined);
        if (!validation.isEducational) {
            res.status(422).json({
                error: 'non_educational_content',
                message: "This doesn't look like educational content. DevPath only supports technical and coding tutorials.",
                category: validation.category,
                reason: validation.reason,
            });
            return;
        }

        const result = await analyzeVideoForQuiz(url);
        res.status(200).json({
            analysis: result.analysis,
            questions: result.questions,
            source_type: detection.source_type,
        });
    } catch (err) {
        if (isQuotaError(err)) {
            res.status(429).json({ error: 'quota_exceeded', message: 'Gemini quota reached. Please try again later.' });
            return;
        }
        console.error('analyze-video error:', (err as Error).message);
        res.status(500).json({ error: 'Failed to analyze video' });
    }
});

// ─── POST /api/plans/generate ────────────────────────────────────────────────
/**
 * Step 2: User's quiz answers determine their skill level.
 * Gemini generates a personalised day-wise plan based on that level.
 * Plan is stored WITHOUT deactivating existing plans.
 */
router.post('/generate', validate(generatePlanSchema), async (req: Request, res: Response): Promise<void> => {
    const userId = getUserId(req, res);
    if (!userId) return;

    const { url, analysis, answers, daily_time_minutes } = req.body as {
        url: string;
        analysis: VideoAnalysis;
        answers: boolean[];
        daily_time_minutes?: number;
    };

    // Determine skill level from quiz answers
    const correctCount = answers.filter(Boolean).length;
    const total = answers.length;
    const pct = total > 0 ? correctCount / total : 0;
    let skillLevel: string;
    if (pct < 0.4) skillLevel = 'beginner';
    else if (pct < 0.8) skillLevel = 'familiar';
    else skillLevel = 'intermediate';

    // Get daily time from prefs or request
    let dailyTime = daily_time_minutes ?? 20;
    if (!daily_time_minutes) {
        const { data: prefs } = await supabaseAdmin
            .from('user_preferences')
            .select('daily_time_minutes')
            .eq('user_id', userId)
            .single();
        if (prefs?.daily_time_minutes) dailyTime = prefs.daily_time_minutes as number;
    }

    try {
        const rawPlan = await generatePersonalizedPlan(analysis, skillLevel, dailyTime);
        const stripped = rawPlan.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
        let parsedPlan: Record<string, unknown>;

        try {
            parsedPlan = JSON.parse(stripped) as Record<string, unknown>;
            validateParsedPlan(parsedPlan);
        } catch {
            // Fallback to default plan on parse failure
            const defaultPlan = getDefaultPlan('javascript');
            const stored = await storePlanKeepExisting(userId, url, 'default', defaultPlan as unknown as Record<string, unknown>, skillLevel);
            res.status(200).json({
                plan: stored,
                skill_level: skillLevel,
                fallback: 'parse_default',
            });
            return;
        }

        // Detect source type
        const detection = detectUrlType(url);
        const sourceType = detection.valid ? detection.source_type : 'youtube_video';

        const stored = await storePlanKeepExisting(userId, url, sourceType, parsedPlan, skillLevel);
        res.status(200).json({
            plan: stored,
            skill_level: skillLevel,
            fallback: null,
        });
    } catch (err) {
        if (isQuotaError(err)) {
            // Quota fallback
            const defaultPlan = getDefaultPlan('javascript');
            const stored = await storePlanKeepExisting(userId, url, 'default', defaultPlan as unknown as Record<string, unknown>, skillLevel);
            res.status(200).json({
                plan: stored,
                skill_level: skillLevel,
                fallback: 'quota_default',
            });
            return;
        }
        console.error('generate-plan error:', (err as Error).message);
        res.status(500).json({ error: 'Failed to generate plan' });
    }
});

// ─── GET /api/plans ──────────────────────────────────────────────────────────
/**
 * Returns all plans for the user with completion progress.
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
    const userId = getUserId(req, res);
    if (!userId) return;

    try {
        const { data: plans, error } = await supabaseAdmin
            .from('daily_plans')
            .select('id, title, source_url, source_type, total_days, current_day, status, checkpoints, generated_at')
            .eq('user_id', userId)
            .order('generated_at', { ascending: false });

        if (error) throw new Error(error.message);

        // For each plan, count completed tasks from xp_events
        const plansWithProgress = await Promise.all(
            ((plans || []) as Record<string, unknown>[]).map(async (plan) => {
                const planId = plan.id as string;
                const checkpoints = plan.checkpoints as Array<Record<string, unknown>>;
                const totalDays = plan.total_days as number;

                // Fetch xp_events scoped to this plan (new format: {planId}:day_X_taskKey)
                const { data: newFormatEvents } = await supabaseAdmin
                    .from('xp_events')
                    .select('task_id')
                    .eq('user_id', userId)
                    .like('task_id', `${planId}:day_%`);

                // Also check old format for backwards compatibility
                const { data: oldFormatEvents } = await supabaseAdmin
                    .from('xp_events')
                    .select('task_id')
                    .eq('user_id', userId)
                    .like('task_id', 'day_%')
                    .not('task_id', 'like', '%:%');

                const completedTaskIds = new Set<string>();
                for (const evt of (newFormatEvents || []) as { task_id: string }[]) {
                    completedTaskIds.add(evt.task_id.replace(`${planId}:`, ''));
                }
                for (const evt of (oldFormatEvents || []) as { task_id: string }[]) {
                    completedTaskIds.add(evt.task_id);
                }

                // Calculate per-day progress
                const dayProgress: Record<number, { task1: boolean; task2: boolean; practice: boolean }> = {};
                for (let d = 1; d <= totalDays; d++) {
                    dayProgress[d] = {
                        task1: completedTaskIds.has(`day_${d}_task1`),
                        task2: completedTaskIds.has(`day_${d}_task2`),
                        practice: completedTaskIds.has(`day_${d}_practice`),
                    };
                }

                // Count how many days are fully completed
                const daysCompleted = Object.values(dayProgress).filter(
                    (dp) => dp.task1 && dp.task2 && dp.practice
                ).length;

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
            })
        );

        res.status(200).json({ plans: plansWithProgress });
    } catch (err) {
        console.error('get-plans error:', (err as Error).message);
        res.status(500).json({ error: 'Failed to fetch plans' });
    }
});

// ─── POST /api/plans/:id/activate ────────────────────────────────────────────
/**
 * Set a specific plan as the active plan for daily missions.
 */
router.post('/:id/activate', async (req: Request, res: Response): Promise<void> => {
    const userId = getUserId(req, res);
    if (!userId) return;

    const planId = req.params.id;

    try {
        // Verify the plan belongs to this user
        const { data: plan } = await supabaseAdmin
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
        await supabaseAdmin
            .from('daily_plans')
            .update({ status: 'paused' })
            .eq('user_id', userId)
            .eq('status', 'active');

        // Activate the selected plan
        await supabaseAdmin
            .from('daily_plans')
            .update({ status: 'active' })
            .eq('id', planId);

        res.status(200).json({ message: 'Plan activated', plan_id: planId });
    } catch (err) {
        console.error('activate-plan error:', (err as Error).message);
        res.status(500).json({ error: 'Failed to activate plan' });
    }
});

// ─── GET /api/plans/:id/progress ─────────────────────────────────────────────
/**
 * Returns per-day completion status for a specific plan.
 * Checks xp_events with task_id format: {planId}:day_{d}_{taskKey}
 * Also falls back to the older format (day_{d}_{taskKey}) for backwards compat.
 */
router.get('/:id/progress', async (req: Request, res: Response): Promise<void> => {
    const userId = getUserId(req, res);
    if (!userId) return;

    const planId = req.params.id;

    try {
        // Verify the plan belongs to this user and get total_days
        const { data: plan } = await supabaseAdmin
            .from('daily_plans')
            .select('id, total_days')
            .eq('id', planId)
            .eq('user_id', userId)
            .single();

        if (!plan) {
            res.status(404).json({ error: 'Plan not found' });
            return;
        }

        const totalDays = (plan as { total_days: number }).total_days;

        // Fetch all xp_events with task_ids matching this plan
        // New format: {planId}:day_X_taskKey
        const { data: newFormatEvents } = await supabaseAdmin
            .from('xp_events')
            .select('task_id')
            .eq('user_id', userId)
            .like('task_id', `${planId}:day_%`);

        // Also check old format for backwards compatibility: day_X_taskKey
        const { data: oldFormatEvents } = await supabaseAdmin
            .from('xp_events')
            .select('task_id')
            .eq('user_id', userId)
            .like('task_id', 'day_%')
            .not('task_id', 'like', '%:%');

        const completedTaskIds = new Set<string>();

        // Parse new format: {planId}:day_X_taskKey → day_X_taskKey
        for (const evt of (newFormatEvents || []) as { task_id: string }[]) {
            const stripped = evt.task_id.replace(`${planId}:`, '');
            completedTaskIds.add(stripped);
        }

        // Add old format directly
        for (const evt of (oldFormatEvents || []) as { task_id: string }[]) {
            completedTaskIds.add(evt.task_id);
        }

        // Build per-day progress
        const dayProgress: Record<number, { task1: boolean; task2: boolean; practice: boolean }> = {};
        for (let d = 1; d <= totalDays; d++) {
            dayProgress[d] = {
                task1: completedTaskIds.has(`day_${d}_task1`),
                task2: completedTaskIds.has(`day_${d}_task2`),
                practice: completedTaskIds.has(`day_${d}_practice`),
            };
        }

        const daysCompleted = Object.values(dayProgress).filter(
            (dp) => dp.task1 && dp.task2 && dp.practice
        ).length;

        res.status(200).json({
            plan_id: planId,
            total_days: totalDays,
            days_completed: daysCompleted,
            day_progress: dayProgress,
        });
    } catch (err) {
        console.error('plan-progress error:', (err as Error).message);
        res.status(500).json({ error: 'Failed to fetch plan progress' });
    }
});

export default router;
