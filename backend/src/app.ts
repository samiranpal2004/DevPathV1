import cors from 'cors';
import express, { type Request, type Response } from 'express';

import { clerkAuth, requireAuth } from './middleware/requireAuth';
import onboardingRoutes from './routes/onboarding.routes';
import missionRoutes from './routes/missions.routes';
import meRoutes from './routes/me.routes';
import heatmapRoutes from './routes/heatmap.routes';
import roomRoutes from './routes/room.routes';
import gamificationRoutes from './routes/gamification.routes';
import leaderboardRoutes from './routes/leaderboard.routes';
import authRoutes from './routes/auth.routes';

const app = express();

app.use(
  cors({
    origin: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      process.env.FRONTEND_URL ?? '',
    ].filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id'],
  })
);
app.use(express.json());
app.use(clerkAuth);

app.get('/health', (_req: Request, res: Response) => {
  return res.status(200).json({ status: 'ok' });
});

app.use('/api', (req: Request, res: Response, next) => {
  const isPublicRoomPreview =
    req.path.startsWith('/rooms/preview/') ||
    req.originalUrl.includes('/api/rooms/preview/');

  if (isPublicRoomPreview) {
    next();
    return;
  }

  requireAuth(req, res, next);
});
app.use('/api/auth', authRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/mission', missionRoutes);
app.use('/api/me', meRoutes);
app.use('/api/heatmap', heatmapRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api', gamificationRoutes);

app.use((_req: Request, res: Response) => {
  return res.status(404).json({
    error: 'NOT_FOUND',
    message: 'Route not found.',
  });
});

export default app;
