import { Router, type Request, type Response } from 'express';
import { leaderboardService, type LeaderboardFilter } from '../services/leaderboard.service';

interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

interface ApiSuccessBody<T> {
  success: true;
  data: T;
}

const router = Router();

const VALID_FILTERS = new Set<LeaderboardFilter>(['weekly', 'alltime', 'today']);
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sendError(res: Response, statusCode: number, code: string, message: string): Response<ApiErrorBody> {
  return res.status(statusCode).json({
    success: false,
    error: { code, message },
  });
}

function sendSuccess<T>(res: Response, statusCode: number, data: T): Response<ApiSuccessBody<T>> {
  return res.status(statusCode).json({
    success: true,
    data,
  });
}

/**
 * GET /api/leaderboard/global
 * Query params: filter (weekly|alltime|today), page (int), limit (int, max 100)
 */
router.get('/global', async (req: Request, res: Response): Promise<Response> => {
  const userId = req.userId;
  if (!userId) {
    return sendError(res, 401, 'UNAUTHORIZED', 'Authentication required.');
  }

  const filterParam = (req.query.filter as string) || 'weekly';
  if (!VALID_FILTERS.has(filterParam as LeaderboardFilter)) {
    return sendError(res, 400, 'BAD_REQUEST', 'filter must be one of: weekly, alltime, today.');
  }
  const filter = filterParam as LeaderboardFilter;

  let page = parseInt(req.query.page as string, 10);
  if (isNaN(page) || page < 1) page = 1;

  let limit = parseInt(req.query.limit as string, 10);
  if (isNaN(limit) || limit < 1) limit = 100;
  if (limit > 100) limit = 100;

  try {
    const result = await leaderboardService.getGlobal(userId, filter, page, limit);
    return sendSuccess(res, 200, result);
  } catch (error) {
    console.error('Error fetching global leaderboard:', error);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to fetch leaderboard.');
  }
});

/**
 * GET /api/leaderboard/room/:roomId
 * Returns today's room leaderboard standings.
 */
router.get('/room/:roomId', async (req: Request, res: Response): Promise<Response> => {
  const userId = req.userId;
  if (!userId) {
    return sendError(res, 401, 'UNAUTHORIZED', 'Authentication required.');
  }

  const roomId = String(req.params.roomId ?? '').trim();
  if (!UUID_REGEX.test(roomId)) {
    return sendError(res, 400, 'BAD_REQUEST', 'roomId must be a valid UUID.');
  }

  try {
    const entries = await leaderboardService.getRoomLeaderboard(roomId, userId);
    return sendSuccess(res, 200, { room_id: roomId, entries });
  } catch (error) {
    console.error('Error fetching room leaderboard:', error);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to fetch room leaderboard.');
  }
});

export default router;
