import express, { Request, Response } from 'express';

import { getStreakStatus } from '../services/mission.service';

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

// ─── GET /api/me/streak ───────────────────────────────────────────────────────

router.get('/streak', async (req: Request, res: Response): Promise<void> => {
    const userId = requireUser(req, res);
    if (!userId) return;

    try {
        const status = await getStreakStatus(userId);
        if (!status) {
            res.status(404).json({
                error: 'preferences_not_found',
                message: 'User preferences not found. Complete onboarding first.',
            });
            return;
        }
        res.status(200).json(status);
    } catch (err) {
        console.error('me/streak error:', (err as Error).message);
        res.status(500).json({ error: 'Failed to load streak status' });
    }
});

export default router;
