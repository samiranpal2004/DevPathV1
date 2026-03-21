"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const validate_1 = require("../middleware/validate");
const missions_1 = require("../schemas/missions");
const mission_service_1 = require("../services/mission.service");
const gemini_service_1 = require("../services/gemini.service");
const supabase_1 = require("../lib/supabase");
const router = express_1.default.Router();
// ─── GET /api/mission/today ───────────────────────────────────────────────────
router.get('/today', async (req, res) => {
    const userId = req.userId;
    try {
        const mission = await (0, mission_service_1.getTodayMission)(userId);
        if (!mission) {
            res.status(404).json({
                error: 'no_active_plan',
                message: 'No active plan found. Complete onboarding first.',
            });
            return;
        }
        res.status(200).json(mission);
    }
    catch (err) {
        console.error('mission/today error:', err.message);
        res.status(500).json({ error: "Failed to load today's mission" });
    }
});
// ─── POST /api/mission/complete-task ─────────────────────────────────────────
router.post('/complete-task', (0, validate_1.validate)(missions_1.completeTaskSchema), async (req, res) => {
    const userId = req.userId;
    try {
        const { task_num, day_number, room_id } = req.body;
        // FIX: Pass room_id into completion service so room race bonuses can be awarded.
        const result = await (0, mission_service_1.completeTask)(userId, task_num, day_number, room_id);
        res.status(200).json(result);
    }
    catch (err) {
        console.error('complete-task error:', err.message);
        res.status(500).json({ error: 'Failed to complete task' });
    }
});
// ─── POST /api/mission/submit-practice ───────────────────────────────────────
router.post('/submit-practice', (0, validate_1.validate)(missions_1.submitPracticeSchema), async (req, res) => {
    const userId = req.userId;
    try {
        const { plan_id, day_number, passed, submitted_code, error_type, hint_used } = req.body;
        // FIX: Forward room_id so practice completions participate in room completion checks.
        const result = await (0, mission_service_1.submitPractice)(userId, plan_id, day_number, passed, submitted_code, error_type, hint_used, req.body.room_id);
        res.status(200).json(result);
    }
    catch (err) {
        console.error('submit-practice error:', err.message);
        res.status(500).json({ error: 'Failed to submit practice' });
    }
});
// ─── POST /api/mission/busy-day ───────────────────────────────────────────────
router.post('/busy-day', async (req, res) => {
    const userId = req.userId;
    try {
        const result = await (0, mission_service_1.busyDay)(userId);
        res.status(200).json(result);
    }
    catch (err) {
        console.error('busy-day error:', err.message);
        res.status(500).json({ error: 'Failed to register busy day' });
    }
});
// ─── POST /api/mission/skip-day ───────────────────────────────────────────────
router.post('/skip-day', async (req, res) => {
    const userId = req.userId;
    try {
        const result = await (0, mission_service_1.skipDay)(userId);
        res.status(200).json(result);
    }
    catch (err) {
        console.error('skip-day error:', err.message);
        res.status(500).json({ error: 'Failed to register skip day' });
    }
});
// ─── POST /api/mission/stuck ──────────────────────────────────────────────────
router.post('/stuck', (0, validate_1.validate)(missions_1.stuckSchema), async (req, res) => {
    const userId = req.userId;
    try {
        const { plan_id, day_number, problem, topic } = req.body;
        const result = await (0, mission_service_1.getStuckHint)(userId, plan_id, day_number, problem, topic);
        res.status(200).json(result);
    }
    catch (err) {
        console.error('mission/stuck error:', err.message);
        res.status(500).json({ error: 'Failed to get hint' });
    }
});
// ─── POST /api/mission/evaluate-code ─────────────────────────────────────────
/**
 * Gemini Flash evaluates the submitted code against the task description.
 * Awards XP if passed (score >= 70).
 */
router.post('/evaluate-code', async (req, res) => {
    const userId = req.userId;
    const { code, language, task_title, task_description, plan_id, day_number, task_key } = req.body;
    if (!code || !code.trim()) {
        res.status(400).json({ error: 'code is required' });
        return;
    }
    if (!language) {
        res.status(400).json({ error: 'language is required' });
        return;
    }
    if (!task_title || !task_description) {
        res.status(400).json({ error: 'task_title and task_description are required' });
        return;
    }
    try {
        const evalResult = await (0, gemini_service_1.evaluateCode)(code, language, task_title, task_description);
        let xpAwarded = 0;
        if (evalResult.passed) {
            const xpAmount = task_key === 'practice' ? 30 : 20;
            xpAwarded = xpAmount;
            // Award XP event
            await supabase_1.supabaseAdmin.from('xp_events').insert({
                user_id: userId,
                amount: xpAmount,
                reason: task_key === 'practice' ? 'practice_solved' : 'task_complete',
                task_id: day_number ? `day_${day_number}_${task_key}` : null,
            });
            // Heatmap contribution
            await supabase_1.supabaseAdmin.from('contribution_events').insert({
                user_id: userId,
                date: new Date().toISOString().slice(0, 10),
                event_type: task_key === 'practice' ? 'practice_solved' : 'solo_task',
                delta: 1.0,
            });
            // Log practice attempt
            if (plan_id && day_number) {
                await supabase_1.supabaseAdmin.from('practice_attempts').insert({
                    user_id: userId,
                    plan_id,
                    day_number,
                    passed: true,
                    hint_used: false,
                    submitted_code: code,
                });
            }
        }
        // Get updated XP total
        const { data: xpRows } = await supabase_1.supabaseAdmin
            .from('xp_events')
            .select('amount')
            .eq('user_id', userId);
        const newTotalXp = (xpRows ?? []).reduce((sum, r) => sum + r.amount, 0);
        res.status(200).json({
            data: {
                ...evalResult,
                xpAwarded,
                newTotalXp,
            },
        });
    }
    catch (err) {
        if ((0, gemini_service_1.isQuotaError)(err)) {
            res.status(429).json({ error: 'quota_exceeded', message: 'Gemini quota reached. Try again shortly.' });
            return;
        }
        console.error('evaluate-code error:', err.message);
        res.status(500).json({ error: 'Failed to evaluate code' });
    }
});
exports.default = router;
