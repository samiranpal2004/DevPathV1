import { Router, type Request, type Response } from 'express';

import { RoomServiceError, roomService } from '../services/room.service';
import { CreateRoomPayload, JoinRoomPayload, RoomType } from '../types/room.types';

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

const ROOM_TYPES: ReadonlySet<RoomType> = new Set([
  'daily_sprint',
  'speed_duel',
  '30_day_challenge',
  'topic_battle',
  'cohort',
  'ranked_arena',
]);

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROOM_CODE_REGEX = /^[A-Za-z0-9]{6}$/;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

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

router.post('/create', async (req: Request, res: Response): Promise<Response> => {
  const body = req.body as Partial<CreateRoomPayload>;

  if (!isNonEmptyString(body.ownerId) || !isValidUuid(body.ownerId)) {
    return sendError(res, 400, 'BAD_REQUEST', 'ownerId must be a valid UUID.');
  }

  if (!isNonEmptyString(body.name) || body.name.trim().length > 50) {
    return sendError(res, 400, 'BAD_REQUEST', 'name must be a non-empty string with max 50 characters.');
  }

  if (!body.type || !ROOM_TYPES.has(body.type)) {
    return sendError(res, 400, 'BAD_REQUEST', 'type must be a valid RoomType.');
  }

  if (body.maxMembers !== undefined) {
    if (!Number.isInteger(body.maxMembers) || body.maxMembers < 2 || body.maxMembers > 10) {
      return sendError(res, 400, 'BAD_REQUEST', 'maxMembers must be an integer between 2 and 10.');
    }
  }

  try {
    const room = await roomService.createRoom({
      ownerId: body.ownerId,
      name: body.name,
      type: body.type,
      topic: body.topic,
      maxMembers: body.maxMembers,
      isPrivate: body.isPrivate,
    });

    return sendSuccess(res, 201, room);
  } catch (error) {
    if (error instanceof RoomServiceError) {
      return sendError(res, error.statusCode, error.code, error.message);
    }

    return sendError(res, 500, 'INTERNAL_ERROR', 'Unexpected error while creating room.');
  }
});

router.post('/join', async (req: Request, res: Response): Promise<Response> => {
  const body = req.body as Partial<JoinRoomPayload>;

  if (!isNonEmptyString(body.userId) || !isValidUuid(body.userId)) {
    return sendError(res, 400, 'BAD_REQUEST', 'userId must be a valid UUID.');
  }

  if (!isNonEmptyString(body.code) || !ROOM_CODE_REGEX.test(body.code)) {
    return sendError(res, 400, 'BAD_REQUEST', 'code must be exactly 6 alphanumeric characters.');
  }

  try {
    const preview = await roomService.joinRoom({
      code: body.code.toUpperCase(),
      userId: body.userId,
    });

    return sendSuccess(res, 200, preview);
  } catch (error) {
    if (error instanceof RoomServiceError) {
      return sendError(res, error.statusCode, error.code, error.message);
    }

    return sendError(res, 500, 'INTERNAL_ERROR', 'Unexpected error while joining room.');
  }
});

router.get('/:id/leaderboard', async (req: Request, res: Response): Promise<Response> => {
  const roomId = String(req.params.id ?? '').trim();

  if (!isValidUuid(roomId)) {
    return sendError(res, 400, 'BAD_REQUEST', 'id must be a valid UUID.');
  }

  try {
    const standings = await roomService.getLeaderboard(roomId);
    return sendSuccess(res, 200, standings);
  } catch (error) {
    if (error instanceof RoomServiceError) {
      return sendError(res, error.statusCode, error.code, error.message);
    }

    return sendError(res, 500, 'INTERNAL_ERROR', 'Unexpected error while fetching leaderboard.');
  }
});

router.get('/:id/feed', async (req: Request, res: Response): Promise<Response> => {
  const roomId = String(req.params.id ?? '').trim();

  if (!isValidUuid(roomId)) {
    return sendError(res, 400, 'BAD_REQUEST', 'id must be a valid UUID.');
  }

  try {
    const feed = await roomService.getRoomFeed(roomId);
    return sendSuccess(res, 200, feed);
  } catch (error) {
    if (error instanceof RoomServiceError) {
      return sendError(res, error.statusCode, error.code, error.message);
    }

    return sendError(res, 500, 'INTERNAL_ERROR', 'Unexpected error while fetching room feed.');
  }
});

router.post('/:id/nudge/:userId', async (req: Request, res: Response): Promise<Response> => {
  const roomId = String(req.params.id ?? '').trim();
  const targetUserId = String(req.params.userId ?? '').trim();
  const nudgerId = String((req.body as { nudgerId?: string } | undefined)?.nudgerId ?? '').trim();

  if (!isValidUuid(roomId)) {
    return sendError(res, 400, 'BAD_REQUEST', 'id must be a valid UUID.');
  }

  if (!isValidUuid(targetUserId)) {
    return sendError(res, 400, 'BAD_REQUEST', 'userId must be a valid UUID.');
  }

  if (!isValidUuid(nudgerId)) {
    return sendError(res, 400, 'BAD_REQUEST', 'nudgerId must be a valid UUID.');
  }

  try {
    await roomService.nudgeMember(roomId, nudgerId, targetUserId);
    return sendSuccess(res, 200, { message: 'Nudge sent.' });
  } catch (error) {
    if (error instanceof RoomServiceError) {
      return sendError(res, error.statusCode, error.code, error.message);
    }

    return sendError(res, 500, 'INTERNAL_ERROR', 'Unexpected error while sending nudge.');
  }
});

export default router;
