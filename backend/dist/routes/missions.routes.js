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
    const { code, language, task_title, task_description, plan_id, day_number, task_key, room_id } = req.body;
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
            // Award XP event — include plan_id in task_id so completions
            // can be tracked per-plan across page refreshes.
            const taskIdStr = plan_id && day_number
                ? `${plan_id}:day_${day_number}_${task_key}`
                : day_number
                    ? `day_${day_number}_${task_key}`
                    : null;
            // Check idempotency — don't award XP twice for the same task
            if (taskIdStr) {
                const { data: existing } = await supabase_1.supabaseAdmin
                    .from('xp_events')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('task_id', taskIdStr)
                    .limit(1);
                if (existing && existing.length > 0) {
                    // Already completed — return success but no new XP
                    const { data: xpRows } = await supabase_1.supabaseAdmin
                        .from('xp_events')
                        .select('amount')
                        .eq('user_id', userId);
                    const currentTotalXp = (xpRows ?? []).reduce((sum, r) => sum + r.amount, 0);
                    res.status(200).json({
                        data: {
                            ...evalResult,
                            xpAwarded: 0,
                            newTotalXp: currentTotalXp,
                            already_completed: true,
                        },
                    });
                    return;
                }
            }
            await supabase_1.supabaseAdmin.from('xp_events').insert({
                user_id: userId,
                amount: xpAmount,
                reason: task_key === 'practice' ? 'practice_solved' : 'task_complete',
                task_id: taskIdStr,
                room_id: room_id || null,
            });
            // Heatmap contribution — direct upsert into contributions
            const contribDate = new Date().toISOString().slice(0, 10);
            const contribEventType = task_key === 'practice' ? 'practice_solved' : 'solo_task';
            const contribDelta = 1.0;
            // Insert event row (trigger may or may not fire)
            await supabase_1.supabaseAdmin.from('contribution_events').insert({
                user_id: userId,
                date: contribDate,
                event_type: contribEventType,
                delta: contribDelta,
            });
            // Direct upsert into aggregated contributions
            const soloDelta = contribEventType === 'solo_task' || contribEventType === 'practice_solved' ? contribDelta : 0;
            const { data: existingContrib } = await supabase_1.supabaseAdmin
                .from('contributions')
                .select('count, types')
                .eq('user_id', userId)
                .eq('date', contribDate)
                .maybeSingle();
            if (existingContrib) {
                const newCount = Number(existingContrib.count ?? 0) + contribDelta;
                const oldTypes = (existingContrib.types ?? { solo: 0, room: 0, quests: 0 });
                await supabase_1.supabaseAdmin
                    .from('contributions')
                    .update({
                    count: newCount,
                    intensity: newCount <= 0 ? 0 : newCount <= 2 ? 1 : newCount <= 4 ? 2 : newCount <= 7 ? 3 : newCount <= 9 ? 4 : 5,
                    types: {
                        solo: Number(oldTypes.solo ?? 0) + soloDelta,
                        room: Number(oldTypes.room ?? 0),
                        quests: Number(oldTypes.quests ?? 0),
                    },
                })
                    .eq('user_id', userId)
                    .eq('date', contribDate);
            }
            else {
                await supabase_1.supabaseAdmin
                    .from('contributions')
                    .insert({
                    user_id: userId,
                    date: contribDate,
                    count: contribDelta,
                    intensity: 1,
                    types: { solo: soloDelta, room: 0, quests: 0 },
                });
            }
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
            // ── Update room_daily_log if user is in a room ──
            console.log(`[evaluate-code] room_id received: ${String(room_id ?? 'none')}`);
            if (room_id && typeof room_id === 'string') {
                try {
                    const today = new Date().toISOString().slice(0, 10);
                    const { data: roomLog, error: roomLogErr } = await supabase_1.supabaseAdmin
                        .from('room_daily_log')
                        .select('tasks_done, xp_earned, started_at')
                        .eq('room_id', room_id)
                        .eq('user_id', userId)
                        .eq('date', today)
                        .maybeSingle();
                    if (roomLogErr)
                        console.error('[Room] Failed to read room_daily_log:', roomLogErr);
                    const newTasksDone = (roomLog?.tasks_done || 0) + 1;
                    const newXpEarned = (roomLog?.xp_earned || 0) + xpAmount;
                    const { error: upsertErr } = await supabase_1.supabaseAdmin
                        .from('room_daily_log')
                        .upsert({
                        room_id,
                        user_id: userId,
                        date: today,
                        tasks_done: newTasksDone,
                        xp_earned: newXpEarned,
                        started_at: roomLog?.started_at || new Date().toISOString(),
                    }, { onConflict: 'room_id,user_id,date' });
                    if (upsertErr) {
                        console.error('[Room] room_daily_log upsert failed:', upsertErr);
                    }
                    else {
                        console.log(`[Room] Updated room_daily_log: user=${userId} room=${room_id} tasks=${newTasksDone} xp=${newXpEarned}`);
                    }
                    // Log room event
                    await supabase_1.supabaseAdmin.from('room_events').insert({
                        room_id,
                        user_id: userId,
                        event_type: task_key === 'practice' ? 'practice_solved' : 'task_complete',
                        metadata: {
                            task_num: task_key === 'task1' ? 1 : task_key === 'task2' ? 2 : 3,
                            task_key,
                            xp_awarded: xpAmount,
                            tasks_done: newTasksDone,
                        },
                    });
                    // Check if first to finish all 3 tasks
                    if (newTasksDone >= 3) {
                        const { data: existingPosition } = await supabase_1.supabaseAdmin
                            .from('room_daily_log')
                            .select('finish_position')
                            .eq('room_id', room_id)
                            .eq('date', today)
                            .not('finish_position', 'is', null)
                            .limit(1)
                            .maybeSingle();
                        if (!existingPosition) {
                            await supabase_1.supabaseAdmin
                                .from('room_daily_log')
                                .update({ finish_position: 1, completed_at: new Date().toISOString() })
                                .eq('room_id', room_id)
                                .eq('user_id', userId)
                                .eq('date', today);
                            // Award first-finish bonus XP
                            const bonusXp = 25;
                            xpAwarded += bonusXp;
                            await supabase_1.supabaseAdmin.from('xp_events').insert({
                                user_id: userId,
                                amount: bonusXp,
                                reason: 'room_first_finish',
                                room_id,
                            });
                            await supabase_1.supabaseAdmin.from('room_events').insert({
                                room_id,
                                user_id: userId,
                                event_type: 'first_finish',
                                metadata: { xp_awarded: bonusXp },
                            });
                        }
                    }
                    // Update room member total XP
                    const { data: memberData } = await supabase_1.supabaseAdmin
                        .from('room_members')
                        .select('total_room_xp')
                        .eq('room_id', room_id)
                        .eq('user_id', userId)
                        .maybeSingle();
                    await supabase_1.supabaseAdmin
                        .from('room_members')
                        .update({ total_room_xp: (memberData?.total_room_xp || 0) + xpAmount })
                        .eq('room_id', room_id)
                        .eq('user_id', userId);
                }
                catch (roomErr) {
                    // Room update failure must NOT break task evaluation
                    console.error('[Room] Failed to update room log:', roomErr);
                }
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
