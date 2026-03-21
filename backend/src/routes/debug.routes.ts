import { Router, type Request, type Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// GET /api/debug/gemini-test
// Tests Gemini API key with a minimal call
router.get('/debug/gemini-test', async (_req: Request, res: Response) => {
  console.log('[Debug] Testing Gemini API...');

  const results: Record<string, unknown> = {
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
  } catch (err) {
    results.flashModel = {
      status: 'FAILED',
      error: (err as Error).message,
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
  } catch (err) {
    results.proModel = {
      status: 'FAILED',
      error: (err as Error).message,
    };
    console.error('[Debug] Pro test FAILED:', err);
  }

  return res.json(results);
});

export default router;
