import express, { Request, Response } from 'express';

import { validate } from '../middleware/validate';
import { completeTaskSchema, submitPracticeSchema, stuckSchema } from '../schemas/missions';
import {
    getTodayMission,
    completeTask,
    submitPractice,
    busyDay,
    skipDay,
    getStuckHint,
} from '../services/mission.service';
import { evaluateCode, isQuotaError } from '../services/gemini.service';
import { supabaseAdmin } from '../lib/supabase';

const router = express.Router();

// ─── GET /api/mission/today ───────────────────────────────────────────────────

router.get('/today', async (req: Request, res: Response): Promise<void> => {
    const userId = req.userId;

    try {
        const mission = await getTodayMission(userId);
        if (!mission) {
            res.status(404).json({
                error: 'no_active_plan',
                message: 'No active plan found. Complete onboarding first.',
            });
            return;
        }
        res.status(200).json(mission);
    } catch (err) {
        console.error('mission/today error:', (err as Error).message);
        res.status(500).json({ error: "Failed to load today's mission" });
    }
});

// ─── POST /api/mission/complete-task ─────────────────────────────────────────

router.post('/complete-task', validate(completeTaskSchema), async (req: Request, res: Response): Promise<void> => {
    const userId = req.userId;

    try {
        const { task_num, day_number, room_id } = req.body as { task_num: number; day_number: number; room_id?: string };
        // FIX: Pass room_id into completion service so room race bonuses can be awarded.
        const result = await completeTask(userId, task_num, day_number, room_id);
        res.status(200).json(result);
    } catch (err) {
        console.error('complete-task error:', (err as Error).message);
        res.status(500).json({ error: 'Failed to complete task' });
    }
});

// ─── POST /api/mission/submit-practice ───────────────────────────────────────

router.post('/submit-practice', validate(submitPracticeSchema), async (req: Request, res: Response): Promise<void> => {
    const userId = req.userId;

    try {
        const { plan_id, day_number, passed, submitted_code, error_type, hint_used } = req.body as {
            plan_id: string;
            day_number: number;
            passed: boolean;
            submitted_code: string | null;
            error_type: string | null;
            hint_used: boolean;
            room_id?: string;
        };
        // FIX: Forward room_id so practice completions participate in room completion checks.
        const result = await submitPractice(
            userId,
            plan_id,
            day_number,
            passed,
            submitted_code,
            error_type,
            hint_used,
            req.body.room_id as string | undefined
        );
        res.status(200).json(result);
    } catch (err) {
        console.error('submit-practice error:', (err as Error).message);
        res.status(500).json({ error: 'Failed to submit practice' });
    }
});

// ─── POST /api/mission/busy-day ───────────────────────────────────────────────

router.post('/busy-day', async (req: Request, res: Response): Promise<void> => {
    const userId = req.userId;

    try {
        const result = await busyDay(userId);
        res.status(200).json(result);
    } catch (err) {
        console.error('busy-day error:', (err as Error).message);
        res.status(500).json({ error: 'Failed to register busy day' });
    }
});

// ─── POST /api/mission/skip-day ───────────────────────────────────────────────

router.post('/skip-day', async (req: Request, res: Response): Promise<void> => {
    const userId = req.userId;

    try {
        const result = await skipDay(userId);
        res.status(200).json(result);
    } catch (err) {
        console.error('skip-day error:', (err as Error).message);
        res.status(500).json({ error: 'Failed to register skip day' });
    }
});

// ─── POST /api/mission/stuck ──────────────────────────────────────────────────

router.post('/stuck', validate(stuckSchema), async (req: Request, res: Response): Promise<void> => {
    const userId = req.userId;

    try {
        const { plan_id, day_number, problem, topic } = req.body as {
            plan_id: string;
            day_number: number;
            problem: string;
            topic: string;
        };
        const result = await getStuckHint(userId, plan_id, day_number, problem, topic);
        res.status(200).json(result);
    } catch (err) {
        console.error('mission/stuck error:', (err as Error).message);
        res.status(500).json({ error: 'Failed to get hint' });
    }
});

// ─── POST /api/mission/evaluate-code ─────────────────────────────────────────
/**
 * Gemini Flash evaluates the submitted code against the task description.
 * Awards XP if passed (score >= 70).
 */
router.post('/evaluate-code', async (req: Request, res: Response): Promise<void> => {
    const userId = req.userId;

    const { code, language, task_title, task_description, plan_id, day_number, task_key } =
        req.body as {
            code?: string;
            language?: string;
            task_title?: string;
            task_description?: string;
            plan_id?: string;
            day_number?: number;
            task_key?: string;
        };

    if (!code || !code.trim()) {
        res.status(400).json({ error: 'code is required' });
        return;
    }
    if (!language) { res.status(400).json({ error: 'language is required' }); return; }
    if (!task_title || !task_description) {
        res.status(400).json({ error: 'task_title and task_description are required' });
        return;
    }

    try {
        const evalResult = await evaluateCode(code, language, task_title, task_description);

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
                const { data: existing } = await supabaseAdmin
                    .from('xp_events')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('task_id', taskIdStr)
                    .limit(1);

                if (existing && existing.length > 0) {
                    // Already completed — return success but no new XP
                    const { data: xpRows } = await supabaseAdmin
                        .from('xp_events')
                        .select('amount')
                        .eq('user_id', userId);
                    const currentTotalXp = (xpRows ?? []).reduce((sum, r) => sum + (r.amount as number), 0);
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

            await supabaseAdmin.from('xp_events').insert({
                user_id: userId,
                amount: xpAmount,
                reason: task_key === 'practice' ? 'practice_solved' : 'task_complete',
                task_id: taskIdStr,
            });

            // Heatmap contribution
            await supabaseAdmin.from('contribution_events').insert({
                user_id: userId,
                date: new Date().toISOString().slice(0, 10),
                event_type: task_key === 'practice' ? 'practice_solved' : 'solo_task',
                delta: 1.0,
            });

            // Log practice attempt
            if (plan_id && day_number) {
                await supabaseAdmin.from('practice_attempts').insert({
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
        const { data: xpRows } = await supabaseAdmin
            .from('xp_events')
            .select('amount')
            .eq('user_id', userId);
        const newTotalXp = (xpRows ?? []).reduce((sum, r) => sum + (r.amount as number), 0);

        res.status(200).json({
            data: {
                ...evalResult,
                xpAwarded,
                newTotalXp,
            },
        });
    } catch (err) {
        if (isQuotaError(err)) {
            res.status(429).json({ error: 'quota_exceeded', message: 'Gemini quota reached. Try again shortly.' });
            return;
        }
        console.error('evaluate-code error:', (err as Error).message);
        res.status(500).json({ error: 'Failed to evaluate code' });
    }
});

export default router;
