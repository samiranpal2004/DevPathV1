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

const router = express.Router();

function requireUser(req: Request, res: Response): string | null {
    const raw = req.headers['x-user-id'];
    const userId = Array.isArray(raw) ? raw[0] : raw;
    if (!userId) {
        res.status(401).json({ error: 'Unauthorized: x-user-id header required' });
        return null;
    }
    return userId;
}

// ─── GET /api/mission/today ───────────────────────────────────────────────────

router.get('/today', async (req: Request, res: Response): Promise<void> => {
    const userId = requireUser(req, res);
    if (!userId) return;

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
    const userId = requireUser(req, res);
    if (!userId) return;

    try {
        const { task_num, day_number } = req.body as { task_num: number; day_number: number };
        const result = await completeTask(userId, task_num, day_number);
        res.status(200).json(result);
    } catch (err) {
        console.error('complete-task error:', (err as Error).message);
        res.status(500).json({ error: 'Failed to complete task' });
    }
});

// ─── POST /api/mission/submit-practice ───────────────────────────────────────

router.post('/submit-practice', validate(submitPracticeSchema), async (req: Request, res: Response): Promise<void> => {
    const userId = requireUser(req, res);
    if (!userId) return;

    try {
        const { plan_id, day_number, passed, submitted_code, error_type, hint_used } = req.body as {
            plan_id: string;
            day_number: number;
            passed: boolean;
            submitted_code: string | null;
            error_type: string | null;
            hint_used: boolean;
        };
        const result = await submitPractice(userId, plan_id, day_number, passed, submitted_code, error_type, hint_used);
        res.status(200).json(result);
    } catch (err) {
        console.error('submit-practice error:', (err as Error).message);
        res.status(500).json({ error: 'Failed to submit practice' });
    }
});

// ─── POST /api/mission/busy-day ───────────────────────────────────────────────

router.post('/busy-day', async (req: Request, res: Response): Promise<void> => {
    const userId = requireUser(req, res);
    if (!userId) return;

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
    const userId = requireUser(req, res);
    if (!userId) return;

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
    const userId = requireUser(req, res);
    if (!userId) return;

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

export default router;
