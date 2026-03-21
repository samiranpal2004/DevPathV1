"use strict";
/**
 * Phase 4 — Streak system tests
 * Tests GET /api/me/streak endpoint and streak status logic.
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
const supabase_1 = require("../lib/supabase");
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../app"));
const mockFrom = supabase_1.supabaseAdmin.from;
const USER_ID = 'streak-test-user';
// Helpers to build dates relative to today
function daysAgo(n) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
}
const TODAY = daysAgo(0);
const YESTERDAY = daysAgo(1);
// ─── Shared mock builder ──────────────────────────────────────────────────────
function makePrefsChain(prefsData) {
    return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: prefsData, error: null }),
    };
}
function makeEventsChain(eventRows) {
    return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockResolvedValue({ data: eventRows, error: null }),
    };
}
const BASE_PREFS = {
    user_id: USER_ID,
    streak_count: 5,
    longest_streak: 10,
    freeze_count: 1,
    freeze_last_used: null,
    last_active_date: YESTERDAY,
};
// ─── GET /api/me/streak ───────────────────────────────────────────────────────
describe('GET /api/me/streak', () => {
    test('returns 401 without x-user-id header', async () => {
        const res = await (0, supertest_1.default)(app_1.default).get('/api/me/streak');
        expect(res.status).toBe(401);
    });
    test('returns 404 when user preferences not found', async () => {
        mockFrom.mockImplementation((table) => {
            if (table === 'user_preferences')
                return makePrefsChain(null);
            return makeEventsChain([]);
        });
        const res = await (0, supertest_1.default)(app_1.default)
            .get('/api/me/streak')
            .set('x-user-id', USER_ID);
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('preferences_not_found');
    });
    test('returns streak_count, longest_streak, freeze_count', async () => {
        mockFrom.mockImplementation((table) => {
            if (table === 'user_preferences')
                return makePrefsChain(BASE_PREFS);
            return makeEventsChain([]);
        });
        const res = await (0, supertest_1.default)(app_1.default)
            .get('/api/me/streak')
            .set('x-user-id', USER_ID);
        expect(res.status).toBe(200);
        expect(res.body.streak_count).toBe(5);
        expect(res.body.longest_streak).toBe(10);
        expect(res.body.freeze_count).toBe(1);
    });
    test('last_7_days has 7 entries', async () => {
        mockFrom.mockImplementation((table) => {
            if (table === 'user_preferences')
                return makePrefsChain(BASE_PREFS);
            return makeEventsChain([]);
        });
        const res = await (0, supertest_1.default)(app_1.default)
            .get('/api/me/streak')
            .set('x-user-id', USER_ID);
        expect(res.status).toBe(200);
        expect(res.body.last_7_days).toHaveLength(7);
    });
    test('day with contribution_event shows status=done', async () => {
        mockFrom.mockImplementation((table) => {
            if (table === 'user_preferences')
                return makePrefsChain(BASE_PREFS);
            if (table === 'contribution_events') {
                return makeEventsChain([{ date: YESTERDAY }]);
            }
            return makeEventsChain([]);
        });
        const res = await (0, supertest_1.default)(app_1.default)
            .get('/api/me/streak')
            .set('x-user-id', USER_ID);
        expect(res.status).toBe(200);
        const yesterdayEntry = res.body.last_7_days.find((d) => d.date === YESTERDAY);
        expect(yesterdayEntry.status).toBe('done');
    });
    test('today without activity shows status=today', async () => {
        mockFrom.mockImplementation((table) => {
            if (table === 'user_preferences')
                return makePrefsChain(BASE_PREFS);
            return makeEventsChain([]);
        });
        const res = await (0, supertest_1.default)(app_1.default)
            .get('/api/me/streak')
            .set('x-user-id', USER_ID);
        expect(res.status).toBe(200);
        const todayEntry = res.body.last_7_days.find((d) => d.date === TODAY);
        expect(todayEntry.status).toBe('today');
    });
    test('day matching freeze_last_used shows status=frozen', async () => {
        mockFrom.mockImplementation((table) => {
            if (table === 'user_preferences') {
                return makePrefsChain({ ...BASE_PREFS, freeze_last_used: YESTERDAY });
            }
            return makeEventsChain([]);
        });
        const res = await (0, supertest_1.default)(app_1.default)
            .get('/api/me/streak')
            .set('x-user-id', USER_ID);
        expect(res.status).toBe(200);
        const frozenEntry = res.body.last_7_days.find((d) => d.date === YESTERDAY);
        expect(frozenEntry.status).toBe('frozen');
    });
    test('streak_safe=true when freeze used today', async () => {
        mockFrom.mockImplementation((table) => {
            if (table === 'user_preferences') {
                return makePrefsChain({ ...BASE_PREFS, freeze_last_used: TODAY, freeze_count: 0 });
            }
            return makeEventsChain([]);
        });
        const res = await (0, supertest_1.default)(app_1.default)
            .get('/api/me/streak')
            .set('x-user-id', USER_ID);
        expect(res.status).toBe(200);
        expect(res.body.streak_safe).toBe(true);
    });
    test('streak_safe=false when no freeze used today', async () => {
        mockFrom.mockImplementation((table) => {
            if (table === 'user_preferences')
                return makePrefsChain(BASE_PREFS);
            return makeEventsChain([]);
        });
        const res = await (0, supertest_1.default)(app_1.default)
            .get('/api/me/streak')
            .set('x-user-id', USER_ID);
        expect(res.status).toBe(200);
        expect(res.body.streak_safe).toBe(false);
    });
    test('past days without activity show status=missed', async () => {
        mockFrom.mockImplementation((table) => {
            if (table === 'user_preferences')
                return makePrefsChain(BASE_PREFS);
            return makeEventsChain([]);
        });
        const res = await (0, supertest_1.default)(app_1.default)
            .get('/api/me/streak')
            .set('x-user-id', USER_ID);
        expect(res.status).toBe(200);
        const d3 = res.body.last_7_days.find((d) => d.date === daysAgo(3));
        expect(d3.status).toBe('missed');
    });
});
