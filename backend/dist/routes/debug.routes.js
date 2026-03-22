"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const generative_ai_1 = require("@google/generative-ai");
const router = (0, express_1.Router)();
const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
// GET /api/debug/gemini-test
// Tests Gemini API key with a minimal call
router.get('/debug/gemini-test', async (_req, res) => {
    console.log('[Debug] Testing Gemini API...');
    const results = {
        apiKeyPresent: !!process.env.GEMINI_API_KEY,
        apiKeyPrefix: `${process.env.GEMINI_API_KEY?.slice(0, 8) ?? 'MISSING'}...`,
        timestamp: new Date().toISOString(),
    };
    // Test 1 — Flash model (cheapest)
    try {
        console.log('[Debug] Testing gemini-2.5-flash...');
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const start = Date.now();
        const result = await model.generateContent('Reply with just the word: OK');
        const text = result.response.text().trim();
        results.flashModel = {
            status: 'SUCCESS',
            response: text,
            latencyMs: Date.now() - start,
        };
        console.log('[Debug] Flash test SUCCESS:', text);
    }
    catch (err) {
        results.flashModel = {
            status: 'FAILED',
            error: err.message,
        };
        console.error('[Debug] Flash test FAILED:', err);
    }
    // Test 2 — Pro model
    try {
        console.log('[Debug] Testing gemini-2.5-flash...');
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const start = Date.now();
        const result = await model.generateContent('Reply with just the word: OK');
        const text = result.response.text().trim();
        results.proModel = {
            status: 'SUCCESS',
            response: text,
            latencyMs: Date.now() - start,
        };
        console.log('[Debug] Pro test SUCCESS:', text);
    }
    catch (err) {
        results.proModel = {
            status: 'FAILED',
            error: err.message,
        };
        console.error('[Debug] Pro test FAILED:', err);
    }
    return res.json(results);
});
exports.default = router;
