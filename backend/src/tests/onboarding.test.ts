import request from 'supertest';

// parser service is mocked so parse-url tests don't hit Gemini
jest.mock('../services/parser.service', () => ({
    parseUrl: jest.fn().mockResolvedValue({
        plan: { id: 'plan-111', title: 'Mock Plan', total_days: 30,
                source_type: 'youtube_playlist', checkpoints: [] },
        fromCache: false,
        fallback: null,
    }),
    parseFromTopic: jest.fn(),
}));

// Mock the DB service so tests run without a real Supabase connection
const PLAN_DATA = {
    id: 'plan-uuid-1',
    title: 'JavaScript Fundamentals',
    total_days: 30,
    checkpoints: [
        { day: 1, title: 'Variables' },
        { day: 2, title: 'Loops' },
        { day: 3, title: 'Functions' },
        { day: 4, title: 'Arrays' },
    ],
};

// The eq() chain is reused at every depth so .single() is always available
const eqChain: Record<string, unknown> = {};
eqChain['eq'] = jest.fn(() => eqChain);
eqChain['order'] = jest.fn(() => eqChain);
eqChain['limit'] = jest.fn(() => eqChain);
eqChain['single'] = jest.fn(() => Promise.resolve({ data: PLAN_DATA, error: null }));
eqChain['not'] = jest.fn(() => eqChain);

jest.mock('../lib/supabase', () => ({
    supabaseAdmin: {
        from: jest.fn(() => ({
            upsert: jest.fn(() => Promise.resolve({ error: null })),
            select: jest.fn(() => eqChain),
        })),
    },
}));

import app from '../app';

const USER_ID = 'test-user-uuid-123';

// ─── POST /api/onboarding/quiz-result ────────────────────────────────────────

describe('POST /api/onboarding/quiz-result', () => {
    test('returns skill_tier=beginner for 0 correct answers', async () => {
        const res = await request(app)
            .post('/api/onboarding/quiz-result')
            .set('x-user-id', USER_ID)
            .send({ answers: [false, false, false, false, false] });

        expect(res.status).toBe(200);
        expect(res.body.skill_tier).toBe('beginner');
        expect(res.body.score).toBe(0);
    });

    test('returns skill_tier=familiar for 2 correct answers', async () => {
        const res = await request(app)
            .post('/api/onboarding/quiz-result')
            .set('x-user-id', USER_ID)
            .send({ answers: [true, true, false, false, false] });

        expect(res.status).toBe(200);
        expect(res.body.skill_tier).toBe('familiar');
        expect(res.body.score).toBe(2);
    });

    test('returns skill_tier=intermediate for 5 correct answers', async () => {
        const res = await request(app)
            .post('/api/onboarding/quiz-result')
            .set('x-user-id', USER_ID)
            .send({ answers: [true, true, true, true, true] });

        expect(res.status).toBe(200);
        expect(res.body.skill_tier).toBe('intermediate');
        expect(res.body.score).toBe(5);
    });

    test('returns 400 if answers length != 5', async () => {
        const res = await request(app)
            .post('/api/onboarding/quiz-result')
            .set('x-user-id', USER_ID)
            .send({ answers: [true, false] });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation failed');
    });

    test('returns 400 if answers is missing', async () => {
        const res = await request(app)
            .post('/api/onboarding/quiz-result')
            .set('x-user-id', USER_ID)
            .send({});

        expect(res.status).toBe(400);
    });

    test('returns 401 if x-user-id header is missing', async () => {
        const res = await request(app)
            .post('/api/onboarding/quiz-result')
            .send({ answers: [true, false, false, false, false] });

        expect(res.status).toBe(401);
    });
});

// ─── POST /api/onboarding/preferences ────────────────────────────────────────

describe('POST /api/onboarding/preferences', () => {
    test('saves valid goal and daily_time_minutes', async () => {
        const res = await request(app)
            .post('/api/onboarding/preferences')
            .set('x-user-id', USER_ID)
            .send({ goal: 'course', daily_time_minutes: 20 });

        expect(res.status).toBe(200);
        expect(res.body.goal).toBe('course');
        expect(res.body.daily_time_minutes).toBe(20);
    });

    test('returns 400 for invalid goal value', async () => {
        const res = await request(app)
            .post('/api/onboarding/preferences')
            .set('x-user-id', USER_ID)
            .send({ goal: 'gaming', daily_time_minutes: 20 });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation failed');
    });

    test('returns 400 for invalid daily_time_minutes', async () => {
        const res = await request(app)
            .post('/api/onboarding/preferences')
            .set('x-user-id', USER_ID)
            .send({ goal: 'job', daily_time_minutes: 45 });

        expect(res.status).toBe(400);
    });

    test('returns 401 without x-user-id header', async () => {
        const res = await request(app)
            .post('/api/onboarding/preferences')
            .send({ goal: 'job', daily_time_minutes: 15 });

        expect(res.status).toBe(401);
    });
});

// ─── POST /api/onboarding/parse-url ──────────────────────────────────────────

describe('POST /api/onboarding/parse-url', () => {
    test('returns 200 with plan for valid YouTube URL (parser mocked)', async () => {
        const res = await request(app)
            .post('/api/onboarding/parse-url')
            .set('x-user-id', USER_ID)
            .send({ url: 'https://www.youtube.com/playlist?list=PLillGF-RfqbbnEGy3ROiLWk7JMCrSPgBN' });

        expect(res.status).toBe(200);
        expect(res.body.plan_id).toBe('plan-111');
    });

    test('returns 401 without x-user-id header', async () => {
        const res = await request(app)
            .post('/api/onboarding/parse-url')
            .send({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });

        expect(res.status).toBe(401);
    });

    test('returns 400 for non-URI string', async () => {
        const res = await request(app)
            .post('/api/onboarding/parse-url')
            .set('x-user-id', USER_ID)
            .send({ url: 'not a url at all' });

        expect(res.status).toBe(400);
    });

    test('returns 400 when url is missing', async () => {
        const res = await request(app)
            .post('/api/onboarding/parse-url')
            .set('x-user-id', USER_ID)
            .send({});

        expect(res.status).toBe(400);
    });
});

// ─── GET /api/onboarding/plan-preview ────────────────────────────────────────

describe('GET /api/onboarding/plan-preview', () => {
    test('returns first 3 checkpoints only', async () => {
        const res = await request(app)
            .get('/api/onboarding/plan-preview')
            .set('x-user-id', USER_ID);

        expect(res.status).toBe(200);
        expect(res.body.preview_checkpoints).toHaveLength(3);
        expect(res.body.title).toBe('JavaScript Fundamentals');
        expect(res.body.total_days).toBe(30);
    });

    test('returns 401 without x-user-id header', async () => {
        const res = await request(app).get('/api/onboarding/plan-preview');
        expect(res.status).toBe(401);
    });
});

// ─── mapScoreToSkillTier unit tests ──────────────────────────────────────────

describe('mapScoreToSkillTier', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { mapScoreToSkillTier } = require('../services/onboarding.service');

    test.each([
        [0, 'beginner'],
        [1, 'beginner'],
        [2, 'familiar'],
        [3, 'familiar'],
        [4, 'intermediate'],
        [5, 'intermediate'],
    ])('score %i → %s', (score: number, expected: string) => {
        expect(mapScoreToSkillTier(score)).toBe(expected);
    });
});
