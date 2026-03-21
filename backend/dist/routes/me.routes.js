"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mission_service_1 = require("../services/mission.service");
const router = express_1.default.Router();
// ─── GET /api/me/streak ───────────────────────────────────────────────────────
router.get('/streak', async (req, res) => {
    const userId = req.userId;
    try {
        const status = await (0, mission_service_1.getStreakStatus)(userId);
        if (!status) {
            res.status(404).json({
                error: 'preferences_not_found',
                message: 'User preferences not found. Complete onboarding first.',
            });
            return;
        }
        res.status(200).json(status);
    }
    catch (err) {
        console.error('me/streak error:', err.message);
        res.status(500).json({ error: 'Failed to load streak status' });
    }
});
exports.default = router;
