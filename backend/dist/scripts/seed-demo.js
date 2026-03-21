"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const supabase_1 = require("../lib/supabase");
const DEMO_USER_ID = 'user_demo00000000000000001';
const ROHAN_USER_ID = '00000000-0000-0000-0000-000000000002';
const PRIYA_USER_ID = '00000000-0000-0000-0000-000000000003';
const DEMO_ROOM_ID = '00000000-0000-0000-0000-000000000042';
function toIsoDate(date) {
    return date.toISOString().slice(0, 10);
}
function addDays(baseDate, daysToAdd) {
    const nextDate = new Date(baseDate);
    nextDate.setUTCDate(nextDate.getUTCDate() + daysToAdd);
    return nextDate;
}
function deterministicUuid(seed) {
    return `00000000-0000-0000-0000-${seed.toString().padStart(12, '0')}`;
}
function buildRecentDays(count) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const oldest = addDays(today, -(count - 1));
    return Array.from({ length: count }, (_, index) => toIsoDate(addDays(oldest, index)));
}
async function seedDemoUser(todayIso) {
    console.log('1a) Seeding demo user + preferences...');
    const { error: userError } = await supabase_1.supabaseAdmin.from('users').upsert({
        id: DEMO_USER_ID,
        email: 'demo@devpath.app',
        display_name: 'Alex (Demo)',
        username: 'alex_demo',
        gamification_on: true,
        updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
    if (userError) {
        throw new Error(`Failed to seed demo user: ${userError.message}`);
    }
    const { error: prefError } = await supabase_1.supabaseAdmin.from('user_preferences').upsert({
        user_id: DEMO_USER_ID,
        skill_tier: 'beginner',
        goal: 'course',
        daily_time_minutes: 20,
        streak_count: 12,
        longest_streak: 12,
        freeze_count: 1,
        last_active_date: todayIso,
        updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (prefError) {
        throw new Error(`Failed to seed user preferences: ${prefError.message}`);
    }
}
async function seedContributionHistory() {
    console.log('1b) Seeding 12-day contribution history...');
    const days = buildRecentDays(12);
    const rows = [];
    let seed = 1000;
    days.forEach((dateIso, index) => {
        const dayNumber = index + 1;
        rows.push({
            id: deterministicUuid(seed),
            user_id: DEMO_USER_ID,
            date: dateIso,
            event_type: 'solo_task',
            delta: 2.0,
            created_at: `${dateIso}T09:00:00.000Z`,
        });
        seed += 1;
        if (dayNumber === 6 || dayNumber === 12) {
            rows.push({
                id: deterministicUuid(seed),
                user_id: DEMO_USER_ID,
                date: dateIso,
                event_type: 'practice_solved',
                delta: 1.0,
                created_at: `${dateIso}T14:00:00.000Z`,
            });
            seed += 1;
        }
        if (dayNumber === 9 || dayNumber === 12) {
            rows.push({
                id: deterministicUuid(seed),
                user_id: DEMO_USER_ID,
                date: dateIso,
                event_type: 'quest_complete',
                delta: 1.0,
                created_at: `${dateIso}T19:00:00.000Z`,
            });
            seed += 1;
        }
    });
    const { error } = await supabase_1.supabaseAdmin.from('contribution_events').upsert(rows, {
        onConflict: 'id',
    });
    if (error) {
        throw new Error(`Failed to seed contribution events: ${error.message}`);
    }
}
async function seedXpHistory() {
    console.log('1c) Seeding XP history (~350 XP total)...');
    const days = buildRecentDays(12);
    const xpRows = [];
    let seed = 2000;
    const taskDays = [1, 2, 3, 4, 6, 8, 10, 12];
    for (const dayNumber of taskDays) {
        const dateIso = days[dayNumber - 1];
        xpRows.push({
            id: deterministicUuid(seed),
            user_id: DEMO_USER_ID,
            amount: 20,
            reason: 'task_complete',
            created_at: `${dateIso}T10:15:00.000Z`,
        });
        seed += 1;
    }
    const practiceDays = [2, 4, 7, 9, 12];
    for (const dayNumber of practiceDays) {
        const dateIso = days[dayNumber - 1];
        xpRows.push({
            id: deterministicUuid(seed),
            user_id: DEMO_USER_ID,
            amount: 30,
            reason: 'practice_solved',
            created_at: `${dateIso}T16:40:00.000Z`,
        });
        seed += 1;
    }
    const streakBonusDays = [7, 12];
    for (const dayNumber of streakBonusDays) {
        const dateIso = days[dayNumber - 1];
        xpRows.push({
            id: deterministicUuid(seed),
            user_id: DEMO_USER_ID,
            amount: 20,
            reason: 'streak_bonus',
            created_at: `${dateIso}T21:00:00.000Z`,
        });
        seed += 1;
    }
    const { error } = await supabase_1.supabaseAdmin.from('xp_events').upsert(xpRows, {
        onConflict: 'id',
    });
    if (error) {
        throw new Error(`Failed to seed XP events: ${error.message}`);
    }
}
async function seedBadges() {
    console.log('1d) Seeding badges...');
    const badges = [
        'first_step',
        'problem_solver',
        'course_linked',
        'week_warrior',
        'life_happens',
        'pure_instinct',
    ];
    const rows = badges.map((badgeKey) => ({
        user_id: DEMO_USER_ID,
        badge_key: badgeKey,
        awarded_at: new Date().toISOString(),
    }));
    const { error } = await supabase_1.supabaseAdmin.from('badges').upsert(rows, {
        onConflict: 'user_id,badge_key',
        ignoreDuplicates: true,
    });
    if (error) {
        throw new Error(`Failed to seed badges: ${error.message}`);
    }
}
async function seedRoom(todayIso) {
    console.log('1e) Seeding demo room, members, daily log, and feed...');
    const userRows = [
        {
            id: ROHAN_USER_ID,
            email: 'rohan@demo.devpath.app',
            display_name: 'Rohan',
            username: 'rohan_demo',
            gamification_on: true,
            updated_at: new Date().toISOString(),
        },
        {
            id: PRIYA_USER_ID,
            email: 'priya@demo.devpath.app',
            display_name: 'Priya',
            username: 'priya_demo',
            gamification_on: true,
            updated_at: new Date().toISOString(),
        },
    ];
    const { error: fakeUsersError } = await supabase_1.supabaseAdmin.from('users').upsert(userRows, {
        onConflict: 'id',
    });
    if (fakeUsersError) {
        throw new Error(`Failed to seed room member users: ${fakeUsersError.message}`);
    }
    const { data: existingRoom, error: existingRoomError } = await supabase_1.supabaseAdmin
        .from('rooms')
        .select('id')
        .eq('code', 'KGEC42')
        .maybeSingle();
    if (existingRoomError) {
        throw new Error(`Failed to lookup demo room: ${existingRoomError.message}`);
    }
    const roomId = existingRoom?.id ?? DEMO_ROOM_ID;
    if (existingRoom?.id) {
        const { error: updateRoomError } = await supabase_1.supabaseAdmin
            .from('rooms')
            .update({
            name: 'KGEC DSA Squad',
            type: 'daily_sprint',
            status: 'active',
            owner_id: DEMO_USER_ID,
            is_private: true,
        })
            .eq('code', 'KGEC42');
        if (updateRoomError) {
            throw new Error(`Failed to update demo room: ${updateRoomError.message}`);
        }
    }
    else {
        const { error: insertRoomError } = await supabase_1.supabaseAdmin.from('rooms').insert({
            id: DEMO_ROOM_ID,
            code: 'KGEC42',
            name: 'KGEC DSA Squad',
            type: 'daily_sprint',
            status: 'active',
            owner_id: DEMO_USER_ID,
            is_private: true,
        });
        if (insertRoomError) {
            throw new Error(`Failed to seed demo room: ${insertRoomError.message}`);
        }
    }
    const memberRows = [
        { room_id: roomId, user_id: DEMO_USER_ID },
        { room_id: roomId, user_id: ROHAN_USER_ID },
        { room_id: roomId, user_id: PRIYA_USER_ID },
    ];
    const { error: membersError } = await supabase_1.supabaseAdmin.from('room_members').upsert(memberRows, {
        onConflict: 'room_id,user_id',
    });
    if (membersError) {
        throw new Error(`Failed to seed room members: ${membersError.message}`);
    }
    const now = new Date();
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    const ninetyMinutesAgo = new Date(now.getTime() - 90 * 60 * 1000).toISOString();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const dailyLogRows = [
        {
            room_id: roomId,
            user_id: DEMO_USER_ID,
            date: todayIso,
            tasks_done: 2,
            xp_earned: 45,
            started_at: twoHoursAgo,
            completed_at: null,
            finish_position: null,
        },
        {
            room_id: roomId,
            user_id: ROHAN_USER_ID,
            date: todayIso,
            tasks_done: 3,
            xp_earned: 70,
            finish_position: 1,
            started_at: threeHoursAgo,
            completed_at: ninetyMinutesAgo,
        },
        {
            room_id: roomId,
            user_id: PRIYA_USER_ID,
            date: todayIso,
            tasks_done: 1,
            xp_earned: 20,
            started_at: oneHourAgo,
            completed_at: null,
            finish_position: null,
        },
    ];
    const { error: dailyLogError } = await supabase_1.supabaseAdmin.from('room_daily_log').upsert(dailyLogRows, {
        onConflict: 'room_id,user_id,date',
    });
    if (dailyLogError) {
        throw new Error(`Failed to seed room_daily_log: ${dailyLogError.message}`);
    }
    const eventRows = [
        {
            id: deterministicUuid(3001),
            room_id: roomId,
            user_id: ROHAN_USER_ID,
            event_type: 'first_finish',
            metadata: {
                message: 'Rohan completed all 3 tasks — first finish',
                xp_awarded: 25,
            },
            created_at: new Date(now.getTime() - 80 * 60 * 1000).toISOString(),
        },
        {
            id: deterministicUuid(3002),
            room_id: roomId,
            user_id: DEMO_USER_ID,
            event_type: 'task_complete',
            metadata: {
                message: 'Alex completed task 2',
                task_num: 2,
            },
            created_at: new Date(now.getTime() - 50 * 60 * 1000).toISOString(),
        },
        {
            id: deterministicUuid(3003),
            room_id: roomId,
            user_id: PRIYA_USER_ID,
            event_type: 'task_complete',
            metadata: {
                message: 'Priya completed task 1',
                task_num: 1,
            },
            created_at: new Date(now.getTime() - 35 * 60 * 1000).toISOString(),
        },
        {
            id: deterministicUuid(3004),
            room_id: roomId,
            user_id: DEMO_USER_ID,
            event_type: 'nudge_sent',
            metadata: {
                message: 'Alex nudged Priya',
                target_user_id: PRIYA_USER_ID,
            },
            created_at: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
        },
    ];
    const { error: roomEventsError } = await supabase_1.supabaseAdmin.from('room_events').upsert(eventRows, {
        onConflict: 'id',
    });
    if (roomEventsError) {
        throw new Error(`Failed to seed room_events: ${roomEventsError.message}`);
    }
}
async function seedPracticeAttempts() {
    console.log('1f) Seeding pre-stuck practice attempts (day 5)...');
    const days = buildRecentDays(12);
    const day5Iso = days[4];
    const attempts = [1, 2, 3].map((attemptIndex) => ({
        id: deterministicUuid(4000 + attemptIndex),
        user_id: DEMO_USER_ID,
        plan_id: null,
        day_number: 5,
        passed: false,
        hint_used: false,
        auto_hint: false,
        attempt_count: attemptIndex,
        error_type: 'closure_scope_error',
        submitted_code: 'function run() { return count + 1; }',
        created_at: `${day5Iso}T1${attemptIndex}:00:00.000Z`,
    }));
    const { error } = await supabase_1.supabaseAdmin.from('practice_attempts').upsert(attempts, {
        onConflict: 'id',
    });
    if (error) {
        throw new Error(`Failed to seed practice attempts: ${error.message}`);
    }
}
async function run() {
    console.log('🌱 Starting demo seed...');
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayIso = toIsoDate(today);
    await seedDemoUser(todayIso);
    await seedContributionHistory();
    await seedXpHistory();
    await seedBadges();
    await seedRoom(todayIso);
    await seedPracticeAttempts();
    console.log('✅ Demo seed completed successfully.');
}
run()
    .then(() => {
    process.exit(0);
})
    .catch((error) => {
    const message = error instanceof Error ? error.message : 'Unknown seed error';
    console.error(`❌ Demo seed failed: ${message}`);
    process.exit(1);
});
