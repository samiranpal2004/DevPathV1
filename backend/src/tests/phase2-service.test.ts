/**
 * Phase 2 — parser service unit tests (no HTTP layer, no route mocking)
 * Mocks only DB and Gemini SDK.
 */

jest.mock('../lib/supabase', () => ({
    supabaseAdmin: { from: jest.fn() },
}));

jest.mock('../services/gemini.service', () => ({
    parseVideoUrl: jest.fn(),
    generateTopicCurriculum: jest.fn(),
    isQuotaError: jest.fn((err: Error) => err?.message?.includes('quota')),
}));

import { supabaseAdmin } from '../lib/supabase';
import * as gemini from '../services/gemini.service';
import { buildCacheKey, validateParsedPlan, parseUrl, parseFromTopic } from '../services/parser.service';
import { DEFAULT_JS_PLAN } from '../data/default-plans';

const mockFrom = supabaseAdmin.from as jest.MockedFunction<typeof supabaseAdmin.from>;
const mockParseVideoUrl = gemini.parseVideoUrl as jest.MockedFunction<typeof gemini.parseVideoUrl>;
const mockGenerateTopicCurriculum = gemini.generateTopicCurriculum as jest.MockedFunction<typeof gemini.generateTopicCurriculum>;
const mockIsQuotaError = gemini.isQuotaError as jest.MockedFunction<typeof gemini.isQuotaError>;

const USER_ID = 'user-uuid-test';
const SKILL_TIER = 'beginner';
const YT_PLAYLIST = 'https://www.youtube.com/playlist?list=PLillGF-RfqbbnEGy3ROiLWk7JMCrSPgBN';

function mockPlan(overrides: Record<string, unknown> = {}) {
    return {
        title: 'JS Fundamentals',
        total_duration_minutes: 300,
        checkpoints: [{
            day: 1, title: 'Variables', concepts: ['var', 'let'],
            task1: { title: 'Watch', description: 'Watch video', duration_minutes: 10 },
            task2: { title: 'Exercise', description: 'Code', duration_minutes: 5 },
            practice: { title: 'Fix code', description: 'Debug', difficulty: 'beginner' },
        }],
        ...overrides,
    };
}

// Builds a chainable Supabase mock
function makeDailyPlanChain(singleResult: unknown) {
    const updateChain: Record<string, unknown> = {};
    updateChain['eq'] = jest.fn().mockReturnValue(updateChain);

    return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue(singleResult),
        update: jest.fn().mockReturnValue(updateChain),
        insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue(singleResult),
        }),
    };
}

// ─── buildCacheKey ────────────────────────────────────────────────────────────

describe('buildCacheKey', () => {
    test('returns consistent sha256 hash', () => {
        const key1 = buildCacheKey(YT_PLAYLIST, USER_ID, SKILL_TIER);
        const key2 = buildCacheKey(YT_PLAYLIST, USER_ID, SKILL_TIER);
        expect(key1).toBe(key2);
        expect(key1).toHaveLength(64);
    });

    test('returns different key for different user', () => {
        expect(buildCacheKey(YT_PLAYLIST, 'user-a', SKILL_TIER)).not.toBe(
            buildCacheKey(YT_PLAYLIST, 'user-b', SKILL_TIER)
        );
    });

    test('returns different key for different skill tier', () => {
        expect(buildCacheKey(YT_PLAYLIST, USER_ID, 'beginner')).not.toBe(
            buildCacheKey(YT_PLAYLIST, USER_ID, 'intermediate')
        );
    });
});

// ─── validateParsedPlan ───────────────────────────────────────────────────────

describe('validateParsedPlan', () => {
    test('passes for a valid plan', () => {
        expect(() => validateParsedPlan(mockPlan())).not.toThrow();
    });

    test('throws if plan is not an object', () => {
        expect(() => validateParsedPlan(null)).toThrow('Plan is not an object');
        expect(() => validateParsedPlan('string')).toThrow('Plan is not an object');
    });

    test('throws if title is missing', () => {
        expect(() => validateParsedPlan(mockPlan({ title: undefined }))).toThrow('Plan missing title');
    });

    test('throws if checkpoints is empty', () => {
        expect(() => validateParsedPlan(mockPlan({ checkpoints: [] }))).toThrow('Plan missing checkpoints');
    });

    test('throws if checkpoint missing task1', () => {
        const plan = mockPlan() as Record<string, unknown>;
        const checkpoints = plan['checkpoints'] as Record<string, unknown>[];
        delete checkpoints[0]['task1'];
        expect(() => validateParsedPlan(plan)).toThrow('Checkpoint missing task1');
    });
});

// ─── parseUrl — Gemini success ────────────────────────────────────────────────

describe('parseUrl — Gemini success', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        const storedPlan = {
            id: 'new-plan-id', title: 'JS Fundamentals', total_days: 1,
            source_type: 'youtube_playlist', checkpoints: mockPlan().checkpoints,
        };
        mockFrom.mockReturnValue({
            ...makeDailyPlanChain({ data: null, error: null }),
            single: jest.fn()
                .mockResolvedValueOnce({ data: null, error: null })
                .mockResolvedValue({ data: storedPlan, error: null }),
            insert: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: storedPlan, error: null }),
            }),
        } as unknown as ReturnType<typeof supabaseAdmin.from>);
        mockParseVideoUrl.mockResolvedValue(mockPlan());
    });

    test('calls Gemini and returns fromCache=false', async () => {
        const result = await parseUrl(USER_ID, YT_PLAYLIST, SKILL_TIER);
        expect(mockParseVideoUrl).toHaveBeenCalledWith(YT_PLAYLIST);
        expect(result.fromCache).toBe(false);
        expect(result.fallback).toBeNull();
    });
});

// ─── parseUrl — quota fallback ────────────────────────────────────────────────

describe('parseUrl — quota fallback', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        const defaultPlanRow = {
            id: 'default-plan-id', title: DEFAULT_JS_PLAN.title,
            total_days: DEFAULT_JS_PLAN.checkpoints.length,
            source_type: 'default', checkpoints: DEFAULT_JS_PLAN.checkpoints,
        };
        mockFrom.mockReturnValue({
            ...makeDailyPlanChain({ data: null, error: null }),
            single: jest.fn()
                .mockResolvedValueOnce({ data: null, error: null })
                .mockResolvedValue({ data: defaultPlanRow, error: null }),
            insert: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: defaultPlanRow, error: null }),
            }),
        } as unknown as ReturnType<typeof supabaseAdmin.from>);
        mockParseVideoUrl.mockRejectedValue(new Error('quota exceeded'));
        mockIsQuotaError.mockReturnValue(true);
    });

    test('returns default plan with fallback=quota_default', async () => {
        const result = await parseUrl(USER_ID, YT_PLAYLIST, SKILL_TIER);
        expect(result.fallback).toBe('quota_default');
        expect(result.fromCache).toBe(false);
    });
});

// ─── parseUrl — unsupported URL ───────────────────────────────────────────────

describe('parseUrl — unsupported URL', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFrom.mockReturnValue(makeDailyPlanChain({ data: null, error: null }) as unknown as ReturnType<typeof supabaseAdmin.from>);
    });

    test('throws unsupported_url for a non-YouTube/Udemy URL', async () => {
        await expect(
            parseUrl(USER_ID, 'https://github.com/some/repo', SKILL_TIER)
        ).rejects.toMatchObject({ code: 'unsupported_url' });
    });
});

// ─── parseFromTopic ───────────────────────────────────────────────────────────

describe('parseFromTopic', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        const topicPlan = {
            id: 'topic-plan-id', title: 'React from scratch',
            total_days: 1, source_type: 'topic',
            checkpoints: mockPlan().checkpoints,
        };
        mockFrom.mockReturnValue({
            ...makeDailyPlanChain({ data: topicPlan, error: null }),
            insert: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: topicPlan, error: null }),
            }),
        } as unknown as ReturnType<typeof supabaseAdmin.from>);
        mockGenerateTopicCurriculum.mockResolvedValue(mockPlan({ title: 'React from scratch' }));
    });

    test('calls generateTopicCurriculum and stores plan', async () => {
        const result = await parseFromTopic(USER_ID, 'React', SKILL_TIER);
        expect(mockGenerateTopicCurriculum).toHaveBeenCalledWith('React', SKILL_TIER);
        expect(result.fromCache).toBe(false);
    });
});
