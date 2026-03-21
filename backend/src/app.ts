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
import plansRoutes from './routes/plans.routes';
import authRoutes from './routes/auth.routes';
import debugRoutes from './routes/debug.routes';

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

// Debug route is intentionally public for local Gemini diagnostics.
// Remove before production deployment.
app.use('/api', debugRoutes);

app.use('/api', (req: Request, res: Response, next) => {
  const isPublicRoomPreview =
    req.path.startsWith('/rooms/preview/') ||
    req.originalUrl.includes('/api/rooms/preview/');
  const isPublicDebugGeminiTest =
    req.path.startsWith('/debug/gemini-test') ||
    req.originalUrl.includes('/api/debug/gemini-test');

  console.log('[App:authGate] path:', req.path, 'originalUrl:', req.originalUrl);
  console.log('[App:authGate] bypass room preview:', isPublicRoomPreview, 'bypass debug:', isPublicDebugGeminiTest);

  if (isPublicRoomPreview || isPublicDebugGeminiTest) {
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
app.use('/api/plans', plansRoutes);
app.use('/api', gamificationRoutes);

app.use((_req: Request, res: Response) => {
  return res.status(404).json({
    error: 'NOT_FOUND',
    message: 'Route not found.',
  });
});

export default app;
