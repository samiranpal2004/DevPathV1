import { clerkMiddleware, getAuth } from '@clerk/express';
import type { NextFunction, Request, Response } from 'express';

import { toInternalUserId } from '../utils/userId';

export const clerkAuth = clerkMiddleware();

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const { userId: clerkUserId } = getAuth(req);

  if (!clerkUserId) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });
    return;
  }

  req.clerkUserId = clerkUserId;
  req.userId = toInternalUserId(clerkUserId);
  // Inject so existing route handlers that read req.headers['x-user-id'] work transparently
  req.headers['x-user-id'] = req.userId;
  next();
}

declare global {
  namespace Express {
    interface Request {
      userId: string;
      clerkUserId: string;
    }
  }
}
