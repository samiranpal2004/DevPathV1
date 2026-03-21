import { Router, type Request, type Response } from 'express';
import { XpService } from '../services/xp.service';
import { BadgeService } from '../services/badge.service';
import { supabaseAdmin } from '../lib/supabase';
import type { UserXpProfile, StreakProfile, Badge } from '../types/gamification.types';

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
const xpService = new XpService();
const badgeService = new BadgeService();

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Generic error response helper
 */
function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string
): Response<ApiErrorBody> {
  return res.status(statusCode).json({
    success: false,
    error: { code, message },
  });
}

/**
 * Generic success response helper
 */
function sendSuccess<T>(res: Response, statusCode: number, data: T): Response<ApiSuccessBody<T>> {
  return res.status(statusCode).json({
    success: true,
    data,
  });
}

/**
 * Validate and extract userId from x-user-id header
 */
function extractUserId(req: Request): string | null {
  const userId = req.headers['x-user-id'];
  if (typeof userId !== 'string') {
    return null;
  }
  const trimmed = userId.trim();
  if (!UUID_REGEX.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * GET /api/me/xp
 * Return full XP profile with level, rank, and progress
 */
router.get('/me/xp', async (req: Request, res: Response): Promise<Response> => {
  const userId = extractUserId(req);

  if (!userId) {
    return sendError(res, 400, 'INVALID_USER_ID', 'Invalid or missing x-user-id header');
  }

  try {
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('gamification_on')
      .eq('id', userId)
      .single();

    const gamificationOn = user?.gamification_on ?? true;
    if (!gamificationOn) {
      const streakProfile = await xpService.getStreak(userId);
      const { count: activeDays } = await supabaseAdmin
        .from('contributions')
        .select('date', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gt('count', 0);

      // FIX: XP endpoint now returns minimal non-gamified payload when gamification_on is false.
      return sendSuccess(res, 200, {
        streakDays: streakProfile.currentStreak,
        activeDays: activeDays ?? 0,
        gamificationOn: false,
      });
    }

    const profile: UserXpProfile = await xpService.getUserXpProfile(userId);
    return sendSuccess<UserXpProfile & { gamificationOn: true }>(res, 200, {
      ...profile,
      gamificationOn: true,
    });
  } catch (error) {
    console.error('Error fetching XP profile:', error);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to fetch XP profile');
  }
});

/**
 * GET /api/me/streak
 * Return current streak, longest streak, freeze count, and last active date
 */
router.get('/me/streak', async (req: Request, res: Response): Promise<Response> => {
  const userId = extractUserId(req);

  if (!userId) {
    return sendError(res, 400, 'INVALID_USER_ID', 'Invalid or missing x-user-id header');
  }

  try {
    const streak: StreakProfile = await xpService.getStreak(userId);
    return sendSuccess<StreakProfile>(res, 200, streak);
  } catch (error) {
    console.error('Error fetching streak:', error);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to fetch streak');
  }
});

/**
 * GET /api/me/badges
 * Return all badges for this user, ordered by most recent
 */
router.get('/me/badges', async (req: Request, res: Response): Promise<Response> => {
  const userId = extractUserId(req);

  if (!userId) {
    return sendError(res, 400, 'INVALID_USER_ID', 'Invalid or missing x-user-id header');
  }

  try {
    const badges: Badge[] = await badgeService.getUserBadges(userId);
    return sendSuccess<Badge[]>(res, 200, badges);
  } catch (error) {
    console.error('Error fetching badges:', error);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to fetch badges');
  }
});

/**
 * GET /api/me/level
 * Return level, rank, XP to next level, and progress percentage
 */
router.get(
  '/me/level',
  async (req: Request, res: Response): Promise<Response> => {
    const userId = extractUserId(req);

    if (!userId) {
      return sendError(res, 400, 'INVALID_USER_ID', 'Invalid or missing x-user-id header');
    }

    try {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('gamification_on')
        .eq('id', userId)
        .single();

      const gamificationOn = user?.gamification_on ?? true;
      if (!gamificationOn) {
        const streakProfile = await xpService.getStreak(userId);
        const { count: activeDays } = await supabaseAdmin
          .from('contributions')
          .select('date', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gt('count', 0);

        // FIX: Level endpoint now respects gamification toggle and hides level/rank details.
        return sendSuccess(res, 200, {
          streakDays: streakProfile.currentStreak,
          activeDays: activeDays ?? 0,
          gamificationOn: false,
        });
      }

      const profile: UserXpProfile = await xpService.getUserXpProfile(userId);
      const levelData = {
        level: profile.level,
        rank: profile.rank,
        xpToNextLevel: profile.xpToNextLevel,
        progressPercent: profile.progressPercent,
        gamificationOn: true,
      };
      return sendSuccess(res, 200, levelData);
    } catch (error) {
      console.error('Error fetching level info:', error);
      return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to fetch level info');
    }
  }
);

router.patch('/me/gamification-toggle', async (req: Request, res: Response): Promise<Response> => {
  const userId = req.headers['x-user-id'] as string;
  if (!isValidUUID(userId)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_UUID', message: 'Invalid user ID' },
    });
  }

  const { enabled } = req.body as { enabled: boolean };
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'enabled must be boolean' },
    });
  }

  // FIX: Added explicit API to toggle gamification_on per user profile.
  await supabaseAdmin.from('users').update({ gamification_on: enabled }).eq('id', userId);

  return res.json({ success: true, data: { gamificationOn: enabled } });
});

export default router;
