"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const onboarding_routes_1 = __importDefault(require("./routes/onboarding.routes"));
const mission_routes_1 = __importDefault(require("./routes/mission.routes"));
const heatmap_routes_1 = __importDefault(require("./routes/heatmap.routes"));
const room_routes_1 = __importDefault(require("./routes/room.routes"));
const gamification_routes_1 = __importDefault(require("./routes/gamification.routes"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get('/health', (_req, res) => {
    return res.status(200).json({ status: 'ok' });
});
app.use('/api/onboarding', onboarding_routes_1.default);
app.use('/api/mission', mission_routes_1.default);
app.use('/api/heatmap', heatmap_routes_1.default);
app.use('/api/rooms', room_routes_1.default);
app.use('/api', gamification_routes_1.default);
app.use((_req, res) => {
    return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Route not found.',
    });
});
exports.default = app;
