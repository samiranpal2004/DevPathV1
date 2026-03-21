"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const requireAuth_1 = require("./middleware/requireAuth");
const onboarding_routes_1 = __importDefault(require("./routes/onboarding.routes"));
const missions_routes_1 = __importDefault(require("./routes/missions.routes"));
const me_routes_1 = __importDefault(require("./routes/me.routes"));
const heatmap_routes_1 = __importDefault(require("./routes/heatmap.routes"));
const room_routes_1 = __importDefault(require("./routes/room.routes"));
const gamification_routes_1 = __importDefault(require("./routes/gamification.routes"));
const leaderboard_routes_1 = __importDefault(require("./routes/leaderboard.routes"));
const plans_routes_1 = __importDefault(require("./routes/plans.routes"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const debug_routes_1 = __importDefault(require("./routes/debug.routes"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        process.env.FRONTEND_URL ?? '',
    ].filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id'],
}));
app.use(express_1.default.json());
app.use(requireAuth_1.clerkAuth);
app.get('/health', (_req, res) => {
    return res.status(200).json({ status: 'ok' });
});
// Debug route is intentionally public for local Gemini diagnostics.
// Remove before production deployment.
app.use('/api', debug_routes_1.default);
app.use('/api', (req, res, next) => {
    const isPublicRoomPreview = req.path.startsWith('/rooms/preview/') ||
        req.originalUrl.includes('/api/rooms/preview/');
    const isPublicDebugGeminiTest = req.path.startsWith('/debug/gemini-test') ||
        req.originalUrl.includes('/api/debug/gemini-test');
    console.log('[App:authGate] path:', req.path, 'originalUrl:', req.originalUrl);
    console.log('[App:authGate] bypass room preview:', isPublicRoomPreview, 'bypass debug:', isPublicDebugGeminiTest);
    if (isPublicRoomPreview || isPublicDebugGeminiTest) {
        next();
        return;
    }
    (0, requireAuth_1.requireAuth)(req, res, next);
});
app.use('/api/auth', auth_routes_1.default);
app.use('/api/onboarding', onboarding_routes_1.default);
app.use('/api/mission', missions_routes_1.default);
app.use('/api/me', me_routes_1.default);
app.use('/api/heatmap', heatmap_routes_1.default);
app.use('/api/rooms', room_routes_1.default);
app.use('/api/leaderboard', leaderboard_routes_1.default);
app.use('/api/plans', plans_routes_1.default);
app.use('/api', gamification_routes_1.default);
app.use((_req, res) => {
    return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Route not found.',
    });
});
exports.default = app;
