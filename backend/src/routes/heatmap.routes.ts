import { Router, type Request, type Response } from 'express';

import { AppError, heatmapService } from '../services/heatmap.service';

const router = Router();

// GET /api/heatmap/me — heatmap for the authenticated user
router.get('/me', async (req: Request, res: Response): Promise<Response> => {
  const userId = req.userId;
    console.log('[Heatmap] userId received:', userId); // ADD THIS

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' });
  }

  try {
    const payload = await heatmapService.getHeatmap(userId);
    return res.status(200).json(payload);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Unexpected error while fetching heatmap.' });
  }
});

router.get('/:userId', async (req: Request, res: Response): Promise<Response> => {
  const userId = String(req.params.userId ?? '').trim();

  if (!userId) {
    return res.status(400).json({
      error: 'BadRequest',
      message: 'userId is required.',
    });
  }

  try {
    const payload = await heatmapService.getHeatmap(userId);
    return res.status(200).json(payload);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        error: error.code,
        message: error.message,
      });
    }

    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Unexpected error while fetching heatmap.',
    });
  }
});

export default router;
