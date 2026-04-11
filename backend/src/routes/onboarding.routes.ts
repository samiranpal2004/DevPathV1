import express, { Request, Response } from 'express';
import Joi from 'joi';

import { validate } from '../middleware/validate';
import { quizResultSchema, preferencesSchema, parseUrlSchema } from '../schemas/onboarding';
import { saveQuizResult, savePreferences, getPlanPreview, getUserPreferences } from '../services/onboarding.service';
import { parseUrl, parseFromTopic } from '../services/parser.service';
import { generateSkillQuiz, isQuotaError } from '../services/gemini.service';

const router = express.Router();

const parseTopicSchema = Joi.object({
    topic: Joi.string().trim().min(2).max(100).required(),
});

function getUserId(req: Request, res: Response): string | null {
    const userId = req.userId;
    if (!userId) {
        res.status(401).json({ error: 'Unauthorized: authentication required' });
        return null;
    }
    return userId;
}

// ─── POST /api/onboarding/generate-quiz ──────────────────────────────────────
/**
 * Generates 5 skill-assessment questions via Gemini for the given goal.
 * Body: { goal: string }
 */
router.post('/generate-quiz', async (req: Request, res: Response): Promise<void> => {
    const userId = getUserId(req, res);
    if (!userId) return;

    const { goal } = req.body as { goal?: string };
    if (!goal) {
        res.status(400).json({ error: 'goal is required' });
        return;
    }

    try {
        const questions = await generateSkillQuiz(goal);
        res.status(200).json({ questions });
    } catch (err) {
        if (isQuotaError(err)) {
            res.status(429).json({ error: 'quota_exceeded', message: 'Gemini quota reached. Please try again later.' });
            return;
        }
        console.error('generate-quiz error:', (err as Error).message);
        res.status(500).json({ error: 'Failed to generate quiz questions' });
    }
});

// ─── POST /api/onboarding/quiz-result ────────────────────────────────────────

router.post('/quiz-result', validate(quizResultSchema), async (req: Request, res: Response): Promise<void> => {
    const userId = getUserId(req, res);
    if (!userId) return;

    try {
        const result = await saveQuizResult(userId, req.body.answers as boolean[]);
        res.status(200).json({
            skill_tier: result.skill_tier,
            score: result.score,
            message: `Skill tier set to ${result.skill_tier}`,
        });
    } catch (err) {
        console.error('quiz-result error:', (err as Error).message);
        res.status(500).json({ error: 'Failed to save quiz result' });
    }
});

// ─── POST /api/onboarding/preferences ────────────────────────────────────────

router.post('/preferences', validate(preferencesSchema), async (req: Request, res: Response): Promise<void> => {
    const userId = getUserId(req, res);
    if (!userId) return;

    try {
        const { goal, daily_time_minutes } = req.body as { goal: string; daily_time_minutes: number };
        await savePreferences(userId, goal, daily_time_minutes);
        res.status(200).json({ goal, daily_time_minutes, message: 'Preferences saved' });
    } catch (err) {
        console.error('preferences error:', (err as Error).message);
        res.status(500).json({ error: 'Failed to save preferences' });
    }
});

// ─── POST /api/onboarding/parse-url ──────────────────────────────────────────
/**
 * Runs the full Gemini parse pipeline:
 *   1. Check cache (returns instantly if hit)
 *   2. Call Gemini 1.5 Pro
 *   3. Fallback to topic or default plan on failure
 *   4. Store result in daily_plans
 *
 * Body: { url: string, fallback_topic?: string }
 *
 * Error codes returned to frontend:
 *   unsupported_url  — not a YouTube/Udemy URL
 *   invalid_url      — fails URI format (Joi)
 */
router.post('/parse-url', validate(parseUrlSchema), async (req: Request, res: Response): Promise<void> => {
    const userId = getUserId(req, res);
    if (!userId) return;

    const { url, fallback_topic } = req.body as { url: string; fallback_topic?: string };

    try {
        const prefs = await getUserPreferences(userId);
        const skillTier = (prefs?.['skill_tier'] as string) || 'beginner';

        const { plan, fromCache, fallback } = await parseUrl(userId, url, skillTier, fallback_topic || null);

        res.status(200).json({
            plan_id: plan['id'],
            title: plan['title'],
            total_days: plan['total_days'],
            source_type: plan['source_type'],
            from_cache: fromCache,
            fallback: fallback,
            preview_checkpoints: Array.isArray(plan['checkpoints'])
                ? (plan['checkpoints'] as unknown[]).slice(0, 3)
                : [],
        });
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'non_educational_content') {
            const typedErr = err as {
                code: string;
                category: string;
                reason: string;
            };
            res.status(422).json({
                error: 'non_educational_content',
                message: "This doesn't look like educational content. DevPath only supports technical and coding tutorials.",
                category: typedErr.category,
                reason: typedErr.reason,
            });
            return;
        }

        if ((err as NodeJS.ErrnoException).code === 'unsupported_url') {
            res.status(422).json({
                error: 'unsupported_url',
                message: 'URL must be a YouTube video, YouTube playlist, or Udemy course.',
            });
            return;
        }
        console.error('parse-url error:', (err as Error).message);
        res.status(500).json({ error: 'Failed to parse URL' });
    }
});

// ─── POST /api/onboarding/parse-topic ────────────────────────────────────────
/**
 * Fallback path: generate a curriculum from a topic name (no URL).
 * Body: { topic: string }
 */
router.post('/parse-topic', validate(parseTopicSchema), async (req: Request, res: Response): Promise<void> => {
    const userId = getUserId(req, res);
    if (!userId) return;

    try {
        const prefs = await getUserPreferences(userId);
        const skillTier = (prefs?.['skill_tier'] as string) || 'beginner';

        const { plan, fallback } = await parseFromTopic(userId, req.body.topic as string, skillTier);

        res.status(200).json({
            plan_id: plan['id'],
            title: plan['title'],
            total_days: plan['total_days'],
            source_type: plan['source_type'],
            fallback,
            preview_checkpoints: Array.isArray(plan['checkpoints'])
                ? (plan['checkpoints'] as unknown[]).slice(0, 3)
                : [],
        });
    } catch (err) {
        console.error('parse-topic error:', (err as Error).message);
        res.status(500).json({ error: 'Failed to generate topic curriculum' });
    }
});

// ─── GET /api/onboarding/plan-preview ────────────────────────────────────────

router.get('/plan-preview', async (req: Request, res: Response): Promise<void> => {
    const userId = getUserId(req, res);
    if (!userId) return;

    try {
        const preview = await getPlanPreview(userId);
        if (!preview) {
            res.status(404).json({
                error: 'no_active_plan',
                message: 'No active plan found. Complete URL parsing first.',
            });
            return;
        }
        res.status(200).json(preview);
    } catch (err) {
        console.error('plan-preview error:', (err as Error).message);
        res.status(500).json({ error: 'Failed to fetch plan preview' });
    }
});

export default router;
