/**
 * Phase 3 — Daily mission tests
 * All DB calls are mocked.
 */

jest.mock('../lib/supabase', () => ({
    supabaseAdmin: { from: jest.fn() },
}));

jest.mock('../services/xp.service', () => ({
    XpService: jest.fn().mockImplementation(() => ({ awardXp: jest.fn(), getUserXp: jest.fn() })),
    awardXp: jest.fn().mockResolvedValue(undefined),
    getUserXp: jest.fn().mockResolvedValue({ total_xp: 100, weekly_xp: 50, level: 1 }),
    XP: {
        TASK_COMPLETE: 20,
        PRACTICE_SOLVED: 30,
        FULL_DAY_COMPLETE: 25,
        STREAK_BONUS: 10,
        NO_HINT_BONUS: 15,
        BUSY_DAY: 5,
    },
}));

import { supabaseAdmin } from '../lib/supabase';
import { awardXp, XP } from '../services/xp.service';
import { calculateCurrentDay } from '../services/mission.service';
import request from 'supertest';
import app from '../app';

const mockFrom = supabaseAdmin.from as jest.MockedFunction<typeof supabaseAdmin.from>;
const mockAwardXp = awardXp as jest.MockedFunction<typeof awardXp>;

const USER_ID = 'mission-test-user';

// ─── calculateCurrentDay ──────────────────────────────────────────────────────

describe('calculateCurrentDay', () => {
    test('returns 1 if start_date is today', () => {
        const today = new Date().toISOString().split('T')[0];
        expect(calculateCurrentDay(today)).toBe(1);
    });

    test('returns 2 if start_date is yesterday', () => {
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        expect(calculateCurrentDay(yesterday)).toBe(2);
    });

    test('returns 8 if start_date is 7 days ago', () => {
        const d = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
        expect(calculateCurrentDay(d)).toBe(8);
    });

    test('never returns less than 1', () => {
        const future = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        expect(calculateCurrentDay(future)).toBeGreaterThanOrEqual(1);
    });
});

// ─── Shared DB mock builder ───────────────────────────────────────────────────

function makeChain(singleResult: unknown, insertResult?: unknown) {
    return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue(singleResult || { data: null, error: null }),
        update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnThis(),
        }),
        insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue(
                insertResult || { data: { id: 'new-id' }, error: null }
            ),
        }),
        count: 0,
    };
}

const CHECKPOINT = {
    day: 1,
    title: 'Variables',
    concepts: ['var', 'let', 'const'],
    task1: { title: 'Watch', description: 'Watch the video', duration_minutes: 10 },
    task2: { title: 'Exercise', description: 'Write code', duration_minutes: 5 },
    practice: {
        title: 'Fix vars',
        description: 'Debug broken code',
        difficulty: 'beginner',
        starter_code: 'var x = ;',
        test_cases: ['x should be 5'],
    },
};

const ACTIVE_PLAN = {
    id: 'plan-uuid-1',
    user_id: USER_ID,
    title: 'JS Fundamentals',
    total_days: 30,
    current_day: 1,
    status: 'active',
    source_type: 'youtube_playlist',
    checkpoints: [CHECKPOINT],
};

const USER_PREFS = {
    user_id: USER_ID,
    skill_tier: 'beginner',
    streak_count: 5,
    longest_streak: 5,
    freeze_count: 1,
    last_active_date: '2020-01-01',
    start_date: new Date().toISOString().split('T')[0],
};

// ─── GET /api/mission/today ───────────────────────────────────────────────────

describe('GET /api/mission/today', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        mockFrom.mockImplementation((table: string) => {
            if (table === 'daily_plans') {
                return makeChain({ data: ACTIVE_PLAN, error: null }) as unknown as ReturnType<typeof supabaseAdmin.from>;
            }
            if (table === 'user_preferences') {
                return makeChain({ data: USER_PREFS, error: null }) as unknown as ReturnType<typeof supabaseAdmin.from>;
            }
            if (table === 'xp_events') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    in: jest.fn().mockReturnThis(),
                    gte: jest.fn().mockResolvedValue({ data: [], error: null }),
                } as unknown as ReturnType<typeof supabaseAdmin.from>;
            }
            return makeChain({ data: null, error: null }) as unknown as ReturnType<typeof supabaseAdmin.from>;
        });
    });

    test('returns mission with task1, task2, practice', async () => {
        const res = await request(app)
            .get('/api/mission/today')
            .set('x-user-id', USER_ID);

        expect(res.status).toBe(200);
        expect(res.body.task1).toBeDefined();
        expect(res.body.task2).toBeDefined();
        expect(res.body.practice).toBeDefined();
        expect(res.body.day_number).toBe(1);
        expect(res.body.streak_count).toBe(5);
        expect(res.body.freeze_count).toBe(1);
    });

    test('returns 401 without x-user-id', async () => {
        const res = await request(app).get('/api/mission/today');
        expect(res.status).toBe(401);
    });

    test('returns 404 when no active plan exists', async () => {
        mockFrom.mockImplementation((table: string) => {
            if (table === 'daily_plans') return makeChain({ data: null, error: null }) as unknown as ReturnType<typeof supabaseAdmin.from>;
            if (table === 'user_preferences') return makeChain({ data: USER_PREFS, error: null }) as unknown as ReturnType<typeof supabaseAdmin.from>;
            return makeChain({ data: null, error: null }) as unknown as ReturnType<typeof supabaseAdmin.from>;
        });

        const res = await request(app)
            .get('/api/mission/today')
            .set('x-user-id', USER_ID);

        expect(res.status).toBe(404);
    });

    test('task1.done=true when already completed today', async () => {
        mockFrom.mockImplementation((table: string) => {
            if (table === 'daily_plans') return makeChain({ data: ACTIVE_PLAN, error: null }) as unknown as ReturnType<typeof supabaseAdmin.from>;
            if (table === 'user_preferences') return makeChain({ data: USER_PREFS, error: null }) as unknown as ReturnType<typeof supabaseAdmin.from>;
            if (table === 'xp_events') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    in: jest.fn().mockReturnThis(),
                    gte: jest.fn().mockResolvedValue({
                        data: [{ reason: 'task1_complete' }],
                        error: null,
                    }),
                } as unknown as ReturnType<typeof supabaseAdmin.from>;
            }
            return makeChain({ data: null, error: null }) as unknown as ReturnType<typeof supabaseAdmin.from>;
        });

        const res = await request(app)
            .get('/api/mission/today')
            .set('x-user-id', USER_ID);

        expect(res.status).toBe(200);
        expect(res.body.task1.done).toBe(true);
        expect(res.body.task2.done).toBe(false);
    });
});

// ─── POST /api/mission/complete-task ─────────────────────────────────────────

describe('POST /api/mission/complete-task', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        mockFrom.mockImplementation((table: string) => {
            if (table === 'xp_events') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    in: jest.fn().mockReturnThis(),
                    gte: jest.fn().mockResolvedValue({ data: [], error: null }),
                    insert: jest.fn().mockResolvedValue({ error: null }),
                } as unknown as ReturnType<typeof supabaseAdmin.from>;
            }
            if (table === 'user_preferences') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    single: jest.fn().mockResolvedValue({ data: USER_PREFS, error: null }),
                    update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
                } as unknown as ReturnType<typeof supabaseAdmin.from>;
            }
            if (table === 'contribution_events') {
                return { insert: jest.fn().mockResolvedValue({ error: null }) } as unknown as ReturnType<typeof supabaseAdmin.from>;
            }
            return makeChain({ data: null, error: null }) as unknown as ReturnType<typeof supabaseAdmin.from>;
        });
    });

    test('returns 200 with xp_awarded=20 for task 1', async () => {
        const res = await request(app)
            .post('/api/mission/complete-task')
            .set('x-user-id', USER_ID)
            .send({ task_num: 1, day_number: 1 });

        expect(res.status).toBe(200);
        expect(mockAwardXp).toHaveBeenCalledWith(USER_ID, XP.TASK_COMPLETE, 'task1_complete');
    });

    test('returns 200 with xp_awarded=20 for task 2', async () => {
        const res = await request(app)
            .post('/api/mission/complete-task')
            .set('x-user-id', USER_ID)
            .send({ task_num: 2, day_number: 1 });

        expect(res.status).toBe(200);
        expect(mockAwardXp).toHaveBeenCalledWith(USER_ID, XP.TASK_COMPLETE, 'task2_complete');
    });

    test('returns 400 for invalid task_num', async () => {
        const res = await request(app)
            .post('/api/mission/complete-task')
            .set('x-user-id', USER_ID)
            .send({ task_num: 3, day_number: 1 });

        expect(res.status).toBe(400);
    });

    test('already_done=true when task already completed', async () => {
        mockFrom.mockImplementation((table: string) => {
            if (table === 'xp_events') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    in: jest.fn().mockReturnThis(),
                    gte: jest.fn().mockResolvedValue({
                        data: [{ reason: 'task1_complete' }],
                        error: null,
                    }),
                    insert: jest.fn().mockResolvedValue({ error: null }),
                } as unknown as ReturnType<typeof supabaseAdmin.from>;
            }
            return makeChain({ data: USER_PREFS, error: null }) as unknown as ReturnType<typeof supabaseAdmin.from>;
        });

        const res = await request(app)
            .post('/api/mission/complete-task')
            .set('x-user-id', USER_ID)
            .send({ task_num: 1, day_number: 1 });

        expect(res.status).toBe(200);
        expect(res.body.already_done).toBe(true);
        expect(res.body.xp_awarded).toBe(0);
    });
});

// ─── POST /api/mission/submit-practice ───────────────────────────────────────

describe('POST /api/mission/submit-practice', () => {
    const PLAN_ID = '550e8400-e29b-41d4-a716-446655440000';

    beforeEach(() => {
        jest.clearAllMocks();

        mockFrom.mockImplementation((table: string) => {
            if (table === 'practice_attempts') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    count: 0,
                    insert: jest.fn().mockReturnValue({
                        select: jest.fn().mockReturnThis(),
                        single: jest.fn().mockResolvedValue({ data: { id: 'attempt-1' }, error: null }),
                    }),
                } as unknown as ReturnType<typeof supabaseAdmin.from>;
            }
            if (table === 'contribution_events') {
                return { insert: jest.fn().mockResolvedValue({ error: null }) } as unknown as ReturnType<typeof supabaseAdmin.from>;
            }
            return makeChain({ data: null, error: null }) as unknown as ReturnType<typeof supabaseAdmin.from>;
        });
    });

    test('awards 45 XP on pass without hint (30 + 15 no-hint bonus)', async () => {
        const res = await request(app)
            .post('/api/mission/submit-practice')
            .set('x-user-id', USER_ID)
            .send({ plan_id: PLAN_ID, day_number: 1, passed: true, hint_used: false });

        expect(res.status).toBe(200);
        expect(res.body.passed).toBe(true);
        expect(mockAwardXp).toHaveBeenCalledWith(
            USER_ID,
            XP.PRACTICE_SOLVED + XP.NO_HINT_BONUS,
            'practice_solved_no_hint'
        );
    });

    test('awards 30 XP on pass with hint used', async () => {
        const res = await request(app)
            .post('/api/mission/submit-practice')
            .set('x-user-id', USER_ID)
            .send({ plan_id: PLAN_ID, day_number: 1, passed: true, hint_used: true });

        expect(res.status).toBe(200);
        expect(mockAwardXp).toHaveBeenCalledWith(USER_ID, XP.PRACTICE_SOLVED, 'practice_solved');
    });

    test('awards 0 XP on fail', async () => {
        const res = await request(app)
            .post('/api/mission/submit-practice')
            .set('x-user-id', USER_ID)
            .send({ plan_id: PLAN_ID, day_number: 1, passed: false, error_type: 'scope_error' });

        expect(res.status).toBe(200);
        expect(res.body.passed).toBe(false);
        expect(res.body.xp_awarded).toBe(0);
        expect(mockAwardXp).not.toHaveBeenCalled();
    });

    test('returns 400 for missing plan_id', async () => {
        const res = await request(app)
            .post('/api/mission/submit-practice')
            .set('x-user-id', USER_ID)
            .send({ day_number: 1, passed: true });

        expect(res.status).toBe(400);
    });
});

// ─── POST /api/mission/busy-day ───────────────────────────────────────────────

describe('POST /api/mission/busy-day', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        mockFrom.mockImplementation((table: string) => {
            if (table === 'user_preferences') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    single: jest.fn().mockResolvedValue({ data: USER_PREFS, error: null }),
                    update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
                } as unknown as ReturnType<typeof supabaseAdmin.from>;
            }
            if (table === 'contribution_events') {
                return { insert: jest.fn().mockResolvedValue({ error: null }) } as unknown as ReturnType<typeof supabaseAdmin.from>;
            }
            return makeChain({ data: null, error: null }) as unknown as ReturnType<typeof supabaseAdmin.from>;
        });
    });

    test('uses freeze, preserves streak, awards 5 XP', async () => {
        const res = await request(app)
            .post('/api/mission/busy-day')
            .set('x-user-id', USER_ID);

        expect(res.status).toBe(200);
        expect(res.body.streak_preserved).toBe(true);
        expect(res.body.freeze_used).toBe(true);
        expect(res.body.xp_awarded).toBe(5);
        expect(mockAwardXp).toHaveBeenCalledWith(USER_ID, XP.BUSY_DAY, 'busy_day');
    });

    test('breaks streak when freeze_count=0', async () => {
        mockFrom.mockImplementation((table: string) => {
            if (table === 'user_preferences') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    single: jest.fn().mockResolvedValue({
                        data: { ...USER_PREFS, freeze_count: 0 },
                        error: null,
                    }),
                    update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
                } as unknown as ReturnType<typeof supabaseAdmin.from>;
            }
            if (table === 'contribution_events') {
                return { insert: jest.fn().mockResolvedValue({ error: null }) } as unknown as ReturnType<typeof supabaseAdmin.from>;
            }
            return makeChain({ data: null, error: null }) as unknown as ReturnType<typeof supabaseAdmin.from>;
        });

        const res = await request(app)
            .post('/api/mission/busy-day')
            .set('x-user-id', USER_ID);

        expect(res.status).toBe(200);
        expect(res.body.streak_preserved).toBe(false);
        expect(res.body.freeze_used).toBe(false);
    });
});

// ─── POST /api/mission/skip-day ───────────────────────────────────────────────

describe('POST /api/mission/skip-day', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        mockFrom.mockImplementation((table: string) => {
            if (table === 'user_preferences') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    single: jest.fn().mockResolvedValue({ data: USER_PREFS, error: null }),
                    update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
                } as unknown as ReturnType<typeof supabaseAdmin.from>;
            }
            return makeChain({ data: null, error: null }) as unknown as ReturnType<typeof supabaseAdmin.from>;
        });
    });

    test('uses freeze, preserves streak, awards 0 XP', async () => {
        const res = await request(app)
            .post('/api/mission/skip-day')
            .set('x-user-id', USER_ID);

        expect(res.status).toBe(200);
        expect(res.body.xp_awarded).toBe(0);
        expect(res.body.streak_preserved).toBe(true);
        expect(mockAwardXp).not.toHaveBeenCalled();
    });

    test('breaks streak with no freeze available', async () => {
        mockFrom.mockImplementation((table: string) => {
            if (table === 'user_preferences') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    single: jest.fn().mockResolvedValue({
                        data: { ...USER_PREFS, freeze_count: 0 },
                        error: null,
                    }),
                    update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
                } as unknown as ReturnType<typeof supabaseAdmin.from>;
            }
            return makeChain({ data: null, error: null }) as unknown as ReturnType<typeof supabaseAdmin.from>;
        });

        const res = await request(app)
            .post('/api/mission/skip-day')
            .set('x-user-id', USER_ID);

        expect(res.status).toBe(200);
        expect(res.body.streak_preserved).toBe(false);
    });

    test('returns 401 without x-user-id', async () => {
        const res = await request(app).post('/api/mission/skip-day');
        expect(res.status).toBe(401);
    });
});
