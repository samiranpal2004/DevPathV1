"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const validate_1 = require("../middleware/validate");
const missions_1 = require("../schemas/missions");
const mission_service_1 = require("../services/mission.service");
const router = express_1.default.Router();
// ─── GET /api/mission/today ───────────────────────────────────────────────────
router.get('/today', async (req, res) => {
    const userId = req.userId;
    try {
        const mission = await (0, mission_service_1.getTodayMission)(userId);
        if (!mission) {
            res.status(404).json({
                error: 'no_active_plan',
                message: 'No active plan found. Complete onboarding first.',
            });
            return;
        }
        res.status(200).json(mission);
    }
    catch (err) {
        console.error('mission/today error:', err.message);
        res.status(500).json({ error: "Failed to load today's mission" });
    }
});
// ─── POST /api/mission/complete-task ─────────────────────────────────────────
router.post('/complete-task', (0, validate_1.validate)(missions_1.completeTaskSchema), async (req, res) => {
    const userId = req.userId;
    try {
        const { task_num, day_number, room_id } = req.body;
        // FIX: Pass room_id into completion service so room race bonuses can be awarded.
        const result = await (0, mission_service_1.completeTask)(userId, task_num, day_number, room_id);
        res.status(200).json(result);
    }
    catch (err) {
        console.error('complete-task error:', err.message);
        res.status(500).json({ error: 'Failed to complete task' });
    }
});
// ─── POST /api/mission/submit-practice ───────────────────────────────────────
router.post('/submit-practice', (0, validate_1.validate)(missions_1.submitPracticeSchema), async (req, res) => {
    const userId = req.userId;
    try {
        const { plan_id, day_number, passed, submitted_code, error_type, hint_used } = req.body;
        // FIX: Forward room_id so practice completions participate in room completion checks.
        const result = await (0, mission_service_1.submitPractice)(userId, plan_id, day_number, passed, submitted_code, error_type, hint_used, req.body.room_id);
        res.status(200).json(result);
    }
    catch (err) {
        console.error('submit-practice error:', err.message);
        res.status(500).json({ error: 'Failed to submit practice' });
    }
});
// ─── POST /api/mission/busy-day ───────────────────────────────────────────────
router.post('/busy-day', async (req, res) => {
    const userId = req.userId;
    try {
        const result = await (0, mission_service_1.busyDay)(userId);
        res.status(200).json(result);
    }
    catch (err) {
        console.error('busy-day error:', err.message);
        res.status(500).json({ error: 'Failed to register busy day' });
    }
});
// ─── POST /api/mission/skip-day ───────────────────────────────────────────────
router.post('/skip-day', async (req, res) => {
    const userId = req.userId;
    try {
        const result = await (0, mission_service_1.skipDay)(userId);
        res.status(200).json(result);
    }
    catch (err) {
        console.error('skip-day error:', err.message);
        res.status(500).json({ error: 'Failed to register skip day' });
    }
});
// ─── POST /api/mission/stuck ──────────────────────────────────────────────────
router.post('/stuck', (0, validate_1.validate)(missions_1.stuckSchema), async (req, res) => {
    const userId = req.userId;
    try {
        const { plan_id, day_number, problem, topic } = req.body;
        const result = await (0, mission_service_1.getStuckHint)(userId, plan_id, day_number, problem, topic);
        res.status(200).json(result);
    }
    catch (err) {
        console.error('mission/stuck error:', err.message);
        res.status(500).json({ error: 'Failed to get hint' });
    }
});
exports.default = router;
