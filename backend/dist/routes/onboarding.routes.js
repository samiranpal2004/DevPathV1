"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const joi_1 = __importDefault(require("joi"));
const validate_1 = require("../middleware/validate");
const onboarding_1 = require("../schemas/onboarding");
const onboarding_service_1 = require("../services/onboarding.service");
const parser_service_1 = require("../services/parser.service");
const gemini_service_1 = require("../services/gemini.service");
const router = express_1.default.Router();
const parseTopicSchema = joi_1.default.object({
    topic: joi_1.default.string().trim().min(2).max(100).required(),
});
function getUserId(req, res) {
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
router.post('/generate-quiz', async (req, res) => {
    const userId = getUserId(req, res);
    if (!userId)
        return;
    const { goal } = req.body;
    if (!goal) {
        res.status(400).json({ error: 'goal is required' });
        return;
    }
    try {
        const questions = await (0, gemini_service_1.generateSkillQuiz)(goal);
        res.status(200).json({ questions });
    }
    catch (err) {
        if ((0, gemini_service_1.isQuotaError)(err)) {
            res.status(429).json({ error: 'quota_exceeded', message: 'Gemini quota reached. Please try again later.' });
            return;
        }
        console.error('generate-quiz error:', err.message);
        res.status(500).json({ error: 'Failed to generate quiz questions' });
    }
});
// ─── POST /api/onboarding/quiz-result ────────────────────────────────────────
router.post('/quiz-result', (0, validate_1.validate)(onboarding_1.quizResultSchema), async (req, res) => {
    const userId = getUserId(req, res);
    if (!userId)
        return;
    try {
        const result = await (0, onboarding_service_1.saveQuizResult)(userId, req.body.answers);
        res.status(200).json({
            skill_tier: result.skill_tier,
            score: result.score,
            message: `Skill tier set to ${result.skill_tier}`,
        });
    }
    catch (err) {
        console.error('quiz-result error:', err.message);
        res.status(500).json({ error: 'Failed to save quiz result' });
    }
});
// ─── POST /api/onboarding/preferences ────────────────────────────────────────
router.post('/preferences', (0, validate_1.validate)(onboarding_1.preferencesSchema), async (req, res) => {
    const userId = getUserId(req, res);
    if (!userId)
        return;
    try {
        const { goal, daily_time_minutes } = req.body;
        await (0, onboarding_service_1.savePreferences)(userId, goal, daily_time_minutes);
        res.status(200).json({ goal, daily_time_minutes, message: 'Preferences saved' });
    }
    catch (err) {
        console.error('preferences error:', err.message);
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
router.post('/parse-url', (0, validate_1.validate)(onboarding_1.parseUrlSchema), async (req, res) => {
    const userId = getUserId(req, res);
    if (!userId)
        return;
    const { url, fallback_topic } = req.body;
    try {
        const prefs = await (0, onboarding_service_1.getUserPreferences)(userId);
        const skillTier = prefs?.['skill_tier'] || 'beginner';
        const { plan, fromCache, fallback } = await (0, parser_service_1.parseUrl)(userId, url, skillTier, fallback_topic || null);
        res.status(200).json({
            plan_id: plan['id'],
            title: plan['title'],
            total_days: plan['total_days'],
            source_type: plan['source_type'],
            from_cache: fromCache,
            fallback: fallback,
            preview_checkpoints: Array.isArray(plan['checkpoints'])
                ? plan['checkpoints'].slice(0, 3)
                : [],
        });
    }
    catch (err) {
        if (err.code === 'non_educational_content') {
            const typedErr = err;
            res.status(422).json({
                error: 'non_educational_content',
                message: "This doesn't look like educational content. DevPath only supports technical and coding tutorials.",
                category: typedErr.category,
                reason: typedErr.reason,
            });
            return;
        }
        if (err.code === 'unsupported_url') {
            res.status(422).json({
                error: 'unsupported_url',
                message: 'URL must be a YouTube video, YouTube playlist, or Udemy course.',
            });
            return;
        }
        console.error('parse-url error:', err.message);
        res.status(500).json({ error: 'Failed to parse URL' });
    }
});
// ─── POST /api/onboarding/parse-topic ────────────────────────────────────────
/**
 * Fallback path: generate a curriculum from a topic name (no URL).
 * Body: { topic: string }
 */
router.post('/parse-topic', (0, validate_1.validate)(parseTopicSchema), async (req, res) => {
    const userId = getUserId(req, res);
    if (!userId)
        return;
    try {
        const prefs = await (0, onboarding_service_1.getUserPreferences)(userId);
        const skillTier = prefs?.['skill_tier'] || 'beginner';
        const { plan, fallback } = await (0, parser_service_1.parseFromTopic)(userId, req.body.topic, skillTier);
        res.status(200).json({
            plan_id: plan['id'],
            title: plan['title'],
            total_days: plan['total_days'],
            source_type: plan['source_type'],
            fallback,
            preview_checkpoints: Array.isArray(plan['checkpoints'])
                ? plan['checkpoints'].slice(0, 3)
                : [],
        });
    }
    catch (err) {
        console.error('parse-topic error:', err.message);
        res.status(500).json({ error: 'Failed to generate topic curriculum' });
    }
});
// ─── GET /api/onboarding/plan-preview ────────────────────────────────────────
router.get('/plan-preview', async (req, res) => {
    const userId = getUserId(req, res);
    if (!userId)
        return;
    try {
        const preview = await (0, onboarding_service_1.getPlanPreview)(userId);
        if (!preview) {
            res.status(404).json({
                error: 'no_active_plan',
                message: 'No active plan found. Complete URL parsing first.',
            });
            return;
        }
        res.status(200).json(preview);
    }
    catch (err) {
        console.error('plan-preview error:', err.message);
        res.status(500).json({ error: 'Failed to fetch plan preview' });
    }
});
exports.default = router;
