"use strict";
/**
 * Phase 5 — Stuck detection tests
 * Tests POST /api/mission/stuck endpoint.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
jest.mock('../lib/supabase', () => ({
    supabaseAdmin: { from: jest.fn() },
}));
jest.mock('../services/xp.service', () => ({
    XpService: jest.fn().mockImplementation(() => ({ awardXp: jest.fn(), getUserXp: jest.fn() })),
    awardXp: jest.fn().mockResolvedValue(undefined),
    XP: {
        TASK_COMPLETE: 20,
        PRACTICE_SOLVED: 30,
        FULL_DAY_COMPLETE: 25,
        STREAK_BONUS: 10,
        NO_HINT_BONUS: 15,
        BUSY_DAY: 5,
    },
}));
jest.mock('../services/gemini.service', () => ({
    getMicroLesson: jest.fn(),
    isQuotaError: jest.fn(),
    parseVideoUrl: jest.fn(),
    generateTopicCurriculum: jest.fn(),
}));
const supabase_1 = require("../lib/supabase");
const gemini_service_1 = require("../services/gemini.service");
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../app"));
const mockFrom = supabase_1.supabaseAdmin.from;
const mockGetMicroLesson = gemini_service_1.getMicroLesson;
const mockIsQuotaError = gemini_service_1.isQuotaError;
const USER_ID = 'stuck-test-user';
const PLAN_ID = '00000000-0000-0000-0000-000000000001';
const BASE_PREFS = { skill_tier: 'beginner' };
const VALID_BODY = {
    plan_id: PLAN_ID,
    day_number: 3,
    problem: 'Write a function that returns the sum of two numbers.',
    topic: 'JavaScript Functions',
};
// ─── Shared mock builders ─────────────────────────────────────────────────────
function makePrefsChain(data) {
    return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data, error: null }),
    };
}
function setupMocks({ prefs = BASE_PREFS, attempts = [], microLesson = 'Step 1: Check your syntax.', } = {}) {
    mockGetMicroLesson.mockResolvedValue(microLesson);
    mockIsQuotaError.mockReturnValue(false);
    mockFrom.mockImplementation((table) => {
        if (table === 'user_preferences')
            return makePrefsChain(prefs);
        if (table === 'practice_attempts') {
            return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue({ data: attempts, error: null }),
                insert: jest.fn().mockResolvedValue({ data: null, error: null }),
            };
        }
        return {};
    });
}
// ─── POST /api/mission/stuck ──────────────────────────────────────────────────
describe('POST /api/mission/stuck', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    test('returns 401 without x-user-id header', async () => {
        const res = await (0, supertest_1.default)(app_1.default).post('/api/mission/stuck').send(VALID_BODY);
        expect(res.status).toBe(401);
    });
    test('returns 400 when plan_id is missing', async () => {
        const { plan_id: _p, ...body } = VALID_BODY;
        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/mission/stuck')
            .set('x-user-id', USER_ID)
            .send(body);
        expect(res.status).toBe(400);
    });
    test('returns 400 when problem is missing', async () => {
        const { problem: _p, ...body } = VALID_BODY;
        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/mission/stuck')
            .set('x-user-id', USER_ID)
            .send(body);
        expect(res.status).toBe(400);
    });
    test('returns 400 when topic is missing', async () => {
        const { topic: _t, ...body } = VALID_BODY;
        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/mission/stuck')
            .set('x-user-id', USER_ID)
            .send(body);
        expect(res.status).toBe(400);
    });
    test('returns 200 with micro_lesson on success', async () => {
        setupMocks({ microLesson: 'Step 1: Check your variables.' });
        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/mission/stuck')
            .set('x-user-id', USER_ID)
            .send(VALID_BODY);
        expect(res.status).toBe(200);
        expect(res.body.micro_lesson).toBe('Step 1: Check your variables.');
        expect(res.body.fallback).toBe(false);
    });
    test('calls getMicroLesson with correct context', async () => {
        const attempts = [
            { passed: false, error_type: 'scope_error' },
            { passed: false, error_type: 'type_error' },
        ];
        setupMocks({ attempts });
        await (0, supertest_1.default)(app_1.default)
            .post('/api/mission/stuck')
            .set('x-user-id', USER_ID)
            .send(VALID_BODY);
        expect(mockGetMicroLesson).toHaveBeenCalledWith({
            topic: VALID_BODY.topic,
            problem: VALID_BODY.problem,
            errorTypes: ['scope_error', 'type_error'],
            skillTier: 'beginner',
        });
    });
    test('uses "unknown error" when attempts have no error_type', async () => {
        setupMocks({ attempts: [{ passed: false, error_type: null }] });
        await (0, supertest_1.default)(app_1.default)
            .post('/api/mission/stuck')
            .set('x-user-id', USER_ID)
            .send(VALID_BODY);
        expect(mockGetMicroLesson).toHaveBeenCalledWith(expect.objectContaining({ errorTypes: ['unknown error'] }));
    });
    test('inserts a practice_attempts row with hint_used=true', async () => {
        const insertMock = jest.fn().mockResolvedValue({ data: null, error: null });
        mockGetMicroLesson.mockResolvedValue('hint text');
        mockIsQuotaError.mockReturnValue(false);
        mockFrom.mockImplementation((table) => {
            if (table === 'user_preferences')
                return makePrefsChain(BASE_PREFS);
            if (table === 'practice_attempts') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    order: jest.fn().mockReturnThis(),
                    limit: jest.fn().mockResolvedValue({ data: [], error: null }),
                    insert: insertMock,
                };
            }
            return {};
        });
        await (0, supertest_1.default)(app_1.default)
            .post('/api/mission/stuck')
            .set('x-user-id', USER_ID)
            .send(VALID_BODY);
        expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ hint_used: true, passed: false }));
    });
    test('returns fallback message on quota error', async () => {
        mockGetMicroLesson.mockRejectedValue(new Error('quota exceeded'));
        mockIsQuotaError.mockReturnValue(true);
        mockFrom.mockImplementation((table) => {
            if (table === 'user_preferences')
                return makePrefsChain(BASE_PREFS);
            if (table === 'practice_attempts') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    order: jest.fn().mockReturnThis(),
                    limit: jest.fn().mockResolvedValue({ data: [], error: null }),
                    insert: jest.fn().mockResolvedValue({ data: null, error: null }),
                };
            }
            return {};
        });
        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/mission/stuck')
            .set('x-user-id', USER_ID)
            .send(VALID_BODY);
        expect(res.status).toBe(200);
        expect(res.body.fallback).toBe(true);
        expect(typeof res.body.micro_lesson).toBe('string');
        expect(res.body.micro_lesson.length).toBeGreaterThan(0);
    });
    test('returns 500 on unexpected Gemini error', async () => {
        mockGetMicroLesson.mockRejectedValue(new Error('network timeout'));
        mockIsQuotaError.mockReturnValue(false);
        mockFrom.mockImplementation((table) => {
            if (table === 'user_preferences')
                return makePrefsChain(BASE_PREFS);
            if (table === 'practice_attempts') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    order: jest.fn().mockReturnThis(),
                    limit: jest.fn().mockResolvedValue({ data: [], error: null }),
                    insert: jest.fn().mockResolvedValue({ data: null, error: null }),
                };
            }
            return {};
        });
        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/mission/stuck')
            .set('x-user-id', USER_ID)
            .send(VALID_BODY);
        expect(res.status).toBe(500);
    });
});
