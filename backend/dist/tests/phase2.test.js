"use strict";
/**
 * Phase 2 — HTTP route tests for parse-url and parse-topic endpoints.
 * Mocks the parser service so no Gemini calls are made.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
jest.mock('../lib/supabase', () => ({
    supabaseAdmin: { from: jest.fn() },
}));
jest.mock('../services/onboarding.service', () => ({
    saveQuizResult: jest.fn(),
    savePreferences: jest.fn(),
    detectUrlType: jest.requireActual('../services/onboarding.service').detectUrlType,
    getPlanPreview: jest.fn(),
    getUserPreferences: jest.fn().mockResolvedValue({ skill_tier: 'beginner' }),
}));
jest.mock('../services/parser.service', () => ({
    parseUrl: jest.fn().mockResolvedValue({
        plan: {
            id: 'plan-123', title: 'Test Plan', total_days: 30,
            source_type: 'youtube_playlist', checkpoints: [],
        },
        fromCache: false,
        fallback: null,
    }),
    parseFromTopic: jest.fn().mockResolvedValue({
        plan: {
            id: 'plan-456', title: 'Topic Plan', total_days: 30,
            source_type: 'topic', checkpoints: [],
        },
        fromCache: false,
        fallback: null,
    }),
}));
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../app"));
const parser_service_1 = require("../services/parser.service");
const USER_ID = 'route-test-user';
const YT_PLAYLIST = 'https://www.youtube.com/playlist?list=PLillGF-RfqbbnEGy3ROiLWk7JMCrSPgBN';
const mockParseUrl = parser_service_1.parseUrl;
// ─── POST /api/onboarding/parse-url ──────────────────────────────────────────
describe('POST /api/onboarding/parse-url (route)', () => {
    test('returns 200 and plan for valid YouTube playlist URL', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/onboarding/parse-url')
            .set('x-user-id', USER_ID)
            .send({ url: YT_PLAYLIST });
        expect(res.status).toBe(200);
        expect(res.body.plan_id).toBe('plan-123');
        expect(res.body.source_type).toBe('youtube_playlist');
        expect(res.body.from_cache).toBe(false);
    });
    test('returns 200 with from_cache=true on cache hit', async () => {
        mockParseUrl.mockResolvedValueOnce({
            plan: { id: 'cached-plan', title: 'Cached', total_days: 30,
                source_type: 'youtube_playlist', checkpoints: [] },
            fromCache: true,
            fallback: null,
        });
        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/onboarding/parse-url')
            .set('x-user-id', USER_ID)
            .send({ url: YT_PLAYLIST });
        expect(res.status).toBe(200);
        expect(res.body.from_cache).toBe(true);
    });
    test('returns 422 for unsupported URL', async () => {
        mockParseUrl.mockRejectedValueOnce(Object.assign(new Error('unsupported_url'), { code: 'unsupported_url' }));
        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/onboarding/parse-url')
            .set('x-user-id', USER_ID)
            .send({ url: 'https://github.com/foo/bar' });
        expect(res.status).toBe(422);
        expect(res.body.error).toBe('unsupported_url');
    });
    test('returns 400 for non-URI string', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/onboarding/parse-url')
            .set('x-user-id', USER_ID)
            .send({ url: 'not a url' });
        expect(res.status).toBe(400);
    });
    test('returns 401 without x-user-id', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/onboarding/parse-url')
            .send({ url: YT_PLAYLIST });
        expect(res.status).toBe(401);
    });
    test('returns fallback field when quota exceeded', async () => {
        mockParseUrl.mockResolvedValueOnce({
            plan: { id: 'def-plan', title: 'Default JS Plan', total_days: 5,
                source_type: 'default', checkpoints: [] },
            fromCache: false,
            fallback: 'quota_default',
        });
        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/onboarding/parse-url')
            .set('x-user-id', USER_ID)
            .send({ url: YT_PLAYLIST });
        expect(res.status).toBe(200);
        expect(res.body.fallback).toBe('quota_default');
    });
});
// ─── POST /api/onboarding/parse-topic ────────────────────────────────────────
describe('POST /api/onboarding/parse-topic (route)', () => {
    test('returns 200 for valid topic', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/onboarding/parse-topic')
            .set('x-user-id', USER_ID)
            .send({ topic: 'React hooks' });
        expect(res.status).toBe(200);
        expect(res.body.source_type).toBe('topic');
        expect(res.body.plan_id).toBe('plan-456');
    });
    test('returns 400 for missing topic', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/onboarding/parse-topic')
            .set('x-user-id', USER_ID)
            .send({});
        expect(res.status).toBe(400);
    });
    test('returns 400 for topic shorter than 2 chars', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/onboarding/parse-topic')
            .set('x-user-id', USER_ID)
            .send({ topic: 'a' });
        expect(res.status).toBe(400);
    });
    test('returns 401 without x-user-id', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/onboarding/parse-topic')
            .send({ topic: 'JavaScript' });
        expect(res.status).toBe(401);
    });
});
