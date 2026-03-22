"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const heatmap_service_1 = require("../services/heatmap.service");
const router = (0, express_1.Router)();
// GET /api/heatmap/me — heatmap for the authenticated user
router.get('/me', async (req, res) => {
    const userId = req.userId;
    console.log('[Heatmap] userId received:', userId); // ADD THIS
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' });
    }
    try {
        const payload = await heatmap_service_1.heatmapService.getHeatmap(userId);
        return res.status(200).json(payload);
    }
    catch (error) {
        if (error instanceof heatmap_service_1.AppError) {
            return res.status(error.statusCode).json({ error: error.code, message: error.message });
        }
        return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Unexpected error while fetching heatmap.' });
    }
});
router.get('/:userId', async (req, res) => {
    const userId = String(req.params.userId ?? '').trim();
    if (!userId) {
        return res.status(400).json({
            error: 'BadRequest',
            message: 'userId is required.',
        });
    }
    try {
        const payload = await heatmap_service_1.heatmapService.getHeatmap(userId);
        return res.status(200).json(payload);
    }
    catch (error) {
        if (error instanceof heatmap_service_1.AppError) {
            return res.status(error.statusCode).json({
                error: error.code,
                message: error.message,
            });
        }
        return res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: 'Unexpected error while fetching heatmap.',
        });
    }
});
exports.default = router;
