import { Router, type Request, type Response } from 'express';

import { AppError, heatmapService } from '../services/heatmap.service';

const router = Router();

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

router.get('/:userId', async (req: Request, res: Response): Promise<Response> => {
  const userId = String(req.params.userId ?? '').trim();

  if (!userId) {
    return res.status(400).json({
      error: 'BadRequest',
      message: 'userId is required.',
    });
  }

  if (!UUID_V4_REGEX.test(userId)) {
    return res.status(400).json({
      error: 'BadRequest',
      message: 'userId must be a valid UUID.',
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
