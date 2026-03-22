"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateCurrentDay = calculateCurrentDay;
exports.getActivePlan = getActivePlan;
exports.getTodayMission = getTodayMission;
exports.completeTask = completeTask;
exports.submitPractice = submitPractice;
exports.busyDay = busyDay;
exports.skipDay = skipDay;
exports.getStreakStatus = getStreakStatus;
exports.getStuckHint = getStuckHint;
/**
 * Mission service — Phase 3
 *
 * Handles daily mission retrieval, task completion, practice submission,
 * and day modes (busy/skip).
 */
const supabase_1 = require("../lib/supabase");
const xp_service_1 = require("./xp.service");
const badge_service_1 = require("./badge.service");
const room_service_1 = require("./room.service");
const gemini_service_1 = require("./gemini.service");
const xpService = new xp_service_1.XpService();
const badgeService = new badge_service_1.BadgeService();
const roomService = new room_service_1.RoomService();
async function logContribution(userId, eventType, delta, date) {
    const effectiveDate = date ?? new Date().toISOString().split('T')[0];
    // 1. Insert immutable event row (trigger may or may not work)
    const { error: eventError } = await supabase_1.supabaseAdmin.from('contribution_events').insert({
        user_id: userId,
        date: effectiveDate,
        event_type: eventType,
        delta,
    });
    if (eventError) {
        console.error('contribution_events insert failed:', eventError);
    }
    // 2. Directly upsert aggregated contributions row (don't rely on trigger)
    const soloDelta = eventType === 'solo_task' || eventType === 'practice_solved' ? delta : 0;
    const roomDelta = eventType === 'room_win' ? delta : 0;
    const questsDelta = eventType === 'quest_complete' ? delta : 0;
    const { data: existing } = await supabase_1.supabaseAdmin
        .from('contributions')
        .select('count, types')
        .eq('user_id', userId)
        .eq('date', effectiveDate)
        .maybeSingle();
    if (existing) {
        const newCount = Number(existing.count ?? 0) + delta;
        const oldTypes = (existing.types ?? { solo: 0, room: 0, quests: 0 });
        const { error: updateError } = await supabase_1.supabaseAdmin
            .from('contributions')
            .update({
            count: newCount,
            intensity: computeIntensity(newCount),
            types: {
                solo: Number(oldTypes.solo ?? 0) + soloDelta,
                room: Number(oldTypes.room ?? 0) + roomDelta,
                quests: Number(oldTypes.quests ?? 0) + questsDelta,
            },
        })
            .eq('user_id', userId)
            .eq('date', effectiveDate);
        if (updateError)
            console.error('contributions update failed:', updateError);
    }
    else {
        const { error: insertError } = await supabase_1.supabaseAdmin
            .from('contributions')
            .insert({
            user_id: userId,
            date: effectiveDate,
            count: delta,
            intensity: computeIntensity(delta),
            types: { solo: soloDelta, room: roomDelta, quests: questsDelta },
        });
        if (insertError)
            console.error('contributions insert failed:', insertError);
    }
}
function computeIntensity(count) {
    if (count <= 0)
        return 0;
    if (count <= 2)
        return 1;
    if (count <= 4)
        return 2;
    if (count <= 7)
        return 3;
    if (count <= 9)
        return 4;
    return 5;
}
async function getPracticeCount(userId) {
    // FIX: Added reusable passed-practice counter for action badge checks.
    const { count } = await supabase_1.supabaseAdmin
        .from('practice_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('passed', true);
    return count ?? 0;
}
// ─── Day calculation ──────────────────────────────────────────────────────────
/**
 * Calculate which day of the plan the user is on.
 * Day 1 = start_date, Day 2 = start_date + 1, etc.
 */
function calculateCurrentDay(startDate) {
    const startStr = typeof startDate === 'string'
        ? startDate
        : startDate.toISOString().split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];
    const diffMs = new Date(todayStr).getTime() - new Date(startStr).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays + 1);
}
// ─── Active plan ──────────────────────────────────────────────────────────────
async function getActivePlan(userId) {
    const { data } = await supabase_1.supabaseAdmin
        .from('daily_plans')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('generated_at', { ascending: false })
        .limit(1)
        .single();
    return data || null;
}
/**
 * Check which tasks are already completed today.
 */
async function getTodayCompletions(userId) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data } = await supabase_1.supabaseAdmin
        .from('xp_events')
        .select('reason')
        .eq('user_id', userId)
        .in('reason', ['task1_complete', 'task2_complete', 'full_day_complete'])
        .gte('created_at', todayStart.toISOString());
    const reasons = (data || []).map((r) => r.reason);
    return {
        task1Done: reasons.includes('task1_complete'),
        task2Done: reasons.includes('task2_complete'),
        fullDayDone: reasons.includes('full_day_complete'),
    };
}
async function getTodayTasksComplete(userId) {
    const completions = await getTodayCompletions(userId);
    return completions.task1Done && completions.task2Done;
}
async function checkAndHandlePerfectDay(userId, planId, dayNumber, roomId) {
    const { data: practice } = await supabase_1.supabaseAdmin
        .from('practice_attempts')
        .select('passed')
        .eq('user_id', userId)
        .eq('plan_id', planId)
        .eq('day_number', dayNumber)
        .eq('passed', true)
        .limit(1);
    const practiceComplete = (practice?.length ?? 0) > 0;
    const tasksComplete = await getTodayTasksComplete(userId);
    if (!practiceComplete || !tasksComplete)
        return false;
    const today = new Date().toISOString().split('T')[0];
    const { data: existing } = await supabase_1.supabaseAdmin
        .from('contribution_events')
        .select('id')
        .eq('user_id', userId)
        .eq('event_type', 'perfect_day')
        .eq('date', today)
        .limit(1);
    if (existing && existing.length > 0)
        return false;
    // FIX: Perfect day now logs zero-delta event and awards dedicated XP once per day.
    await logContribution(userId, 'perfect_day', 0);
    await xpService.awardXp({ userId, amount: 25, reason: 'full_day_complete', roomId });
    return true;
}
// ─── GET /api/mission/today ───────────────────────────────────────────────────
/**
 * Build today's mission from the user's active plan.
 */
async function getTodayMission(userId) {
    const [plan, prefs] = await Promise.all([
        getActivePlan(userId),
        supabase_1.supabaseAdmin
            .from('user_preferences')
            .select('*')
            .eq('user_id', userId)
            .single()
            .then(({ data }) => data),
    ]);
    if (!plan || !prefs)
        return null;
    const dayNum = calculateCurrentDay(prefs['start_date']);
    const totalDays = plan['total_days'];
    if (dayNum > totalDays) {
        // Plan completed — mark it done
        await supabase_1.supabaseAdmin
            .from('daily_plans')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', plan['id']);
        return { plan_completed: true, total_days: totalDays };
    }
    const checkpoints = Array.isArray(plan['checkpoints']) ? plan['checkpoints'] : [];
    const checkpoint = checkpoints[dayNum - 1] || checkpoints[checkpoints.length - 1];
    const completions = await getTodayCompletions(userId);
    return {
        plan_id: plan['id'],
        day_number: dayNum,
        total_days: totalDays,
        title: checkpoint['title'],
        concepts: checkpoint['concepts'] || [],
        task1: { ...checkpoint['task1'], done: completions.task1Done },
        task2: { ...checkpoint['task2'], done: completions.task2Done },
        practice: checkpoint['practice'],
        streak_count: prefs['streak_count'],
        freeze_count: prefs['freeze_count'],
        tasks_done_today: [completions.task1Done, completions.task2Done].filter(Boolean).length,
    };
}
// ─── POST /api/mission/complete-task ─────────────────────────────────────────
async function completeTask(userId, taskNum, dayNumber, roomId) {
    // Idempotency: check if already done today
    const completions = await getTodayCompletions(userId);
    if (taskNum === 1 && completions.task1Done) {
        return {
            xp_awarded: 0,
            xpAwarded: 0,
            already_done: true,
            levelUp: null,
            isPerfectDay: false,
        };
    }
    if (taskNum === 2 && completions.task2Done) {
        return {
            xp_awarded: 0,
            xpAwarded: 0,
            already_done: true,
            levelUp: null,
            isPerfectDay: false,
        };
    }
    let totalXp = xp_service_1.XP.TASK_COMPLETE;
    let levelUpEvent = null;
    let isPerfectDay = false;
    const taskLevelUp = await xpService.awardXp({
        userId,
        amount: xp_service_1.XP.TASK_COMPLETE,
        reason: taskNum === 1 ? 'task1_complete' : 'task2_complete',
        taskId: `day_${dayNumber}_task_${taskNum}`,
        roomId,
    });
    levelUpEvent = taskLevelUp ?? null;
    await logContribution(userId, 'solo_task', 1.0);
    // Update streak
    const newStreak = await updateStreak(userId);
    await xpService.checkAndAwardStreakBonus(userId, newStreak);
    const updatedCompletions = await getTodayCompletions(userId);
    const bothDone = (taskNum === 1 ? true : updatedCompletions.task1Done) &&
        (taskNum === 2 ? true : updatedCompletions.task2Done);
    const { count: taskCompleteCount } = await supabase_1.supabaseAdmin
        .from('xp_events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('reason', ['task1_complete', 'task2_complete']);
    if ((taskCompleteCount ?? 0) === 1) {
        await badgeService.checkAndAwardActionBadges(userId, { event: 'first_task' });
    }
    if (roomId) {
        const today = new Date().toISOString().split('T')[0];
        const { data: roomLog } = await supabase_1.supabaseAdmin
            .from('room_daily_log')
            .select('tasks_done, xp_earned, started_at')
            .eq('room_id', roomId)
            .eq('user_id', userId)
            .eq('date', today)
            .maybeSingle();
        const newTasksDoneCount = (roomLog?.tasks_done || 0) + 1;
        await supabase_1.supabaseAdmin
            .from('room_daily_log')
            .upsert({
            room_id: roomId,
            user_id: userId,
            date: today,
            tasks_done: newTasksDoneCount,
            xp_earned: (roomLog?.xp_earned || 0) + totalXp,
            started_at: roomLog?.started_at || new Date().toISOString(),
        }, { onConflict: 'room_id,user_id,date' });
        if (newTasksDoneCount === 3) {
            const isFirst = await roomService.checkAndSetFirstFinish(roomId, userId);
            if (isFirst) {
                const firstFinishLevelUp = await xpService.awardXp({
                    userId,
                    amount: 25,
                    reason: 'room_first_finish',
                    roomId,
                });
                totalXp += 25;
                levelUpEvent = levelUpEvent ?? firstFinishLevelUp;
                await logContribution(userId, 'room_win', 2.0);
                await supabase_1.supabaseAdmin.from('room_events').insert({
                    room_id: roomId,
                    user_id: userId,
                    event_type: 'first_finish',
                    metadata: { xp_awarded: 25 },
                });
            }
        }
        await roomService.checkAndAwardAllComplete(roomId);
    }
    const plan = await getActivePlan(userId);
    if (plan?.id && typeof plan.id === 'string') {
        isPerfectDay = await checkAndHandlePerfectDay(userId, plan.id, dayNumber, roomId);
        if (isPerfectDay) {
            totalXp += xp_service_1.XP.FULL_DAY_COMPLETE;
        }
    }
    if (levelUpEvent) {
        await logContribution(userId, 'level_up', 0);
    }
    return {
        xp_awarded: totalXp,
        xpAwarded: totalXp,
        already_done: false,
        both_tasks_done: bothDone,
        levelUp: levelUpEvent,
        isPerfectDay,
    };
}
// ─── POST /api/mission/submit-practice ───────────────────────────────────────
async function submitPractice(userId, planId, dayNumber, passed, submittedCode, errorType, hintUsed, roomId) {
    // Count previous attempts this day
    const { count } = await supabase_1.supabaseAdmin
        .from('practice_attempts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('plan_id', planId)
        .eq('day_number', dayNumber);
    const attemptCount = (count || 0) + 1;
    const { data: attempt, error } = await supabase_1.supabaseAdmin
        .from('practice_attempts')
        .insert({
        user_id: userId,
        plan_id: planId,
        day_number: dayNumber,
        passed,
        hint_used: hintUsed || false,
        attempt_count: attemptCount,
        error_type: errorType || null,
        submitted_code: submittedCode || null,
    })
        .select('id')
        .single();
    if (error)
        throw new Error(`DB error saving attempt: ${error.message}`);
    let xpAwarded = 0;
    let levelUpEvent = null;
    let isPerfectDay = false;
    if (passed) {
        // FIX: Practice completion now captures level-up payload and returns it in response.
        const practiceLevelUp = await xpService.awardXp({
            userId,
            amount: xp_service_1.XP.PRACTICE_SOLVED,
            reason: 'practice_solved',
            taskId: `day_${dayNumber}_practice`,
            roomId,
        });
        xpAwarded = xp_service_1.XP.PRACTICE_SOLVED;
        levelUpEvent = practiceLevelUp ?? null;
        if (!hintUsed) {
            const noHintLevelUp = await xpService.awardXp({
                userId,
                amount: xp_service_1.XP.NO_HINT_BONUS,
                reason: 'no_hint_bonus',
                roomId,
            });
            xpAwarded += xp_service_1.XP.NO_HINT_BONUS;
            levelUpEvent = levelUpEvent ?? noHintLevelUp;
            await badgeService.checkAndAwardActionBadges(userId, { event: 'solve_no_hint' });
        }
        await logContribution(userId, 'practice_solved', 1.0);
        const practiceCount = await getPracticeCount(userId);
        await badgeService.checkAndAwardActionBadges(userId, {
            event: 'practice_count',
            count: practiceCount,
        });
        isPerfectDay = await checkAndHandlePerfectDay(userId, planId, dayNumber, roomId);
        if (roomId) {
            const today = new Date().toISOString().split('T')[0];
            const { data: roomLog } = await supabase_1.supabaseAdmin
                .from('room_daily_log')
                .select('tasks_done, xp_earned, started_at')
                .eq('room_id', roomId)
                .eq('user_id', userId)
                .eq('date', today)
                .maybeSingle();
            const newTasksDoneCount = (roomLog?.tasks_done || 0) + 1;
            await supabase_1.supabaseAdmin
                .from('room_daily_log')
                .upsert({
                room_id: roomId,
                user_id: userId,
                date: today,
                tasks_done: newTasksDoneCount,
                xp_earned: (roomLog?.xp_earned || 0) + xpAwarded,
                started_at: roomLog?.started_at || new Date().toISOString(),
            }, { onConflict: 'room_id,user_id,date' });
            if (newTasksDoneCount === 3) {
                const isFirst = await roomService.checkAndSetFirstFinish(roomId, userId);
                if (isFirst) {
                    const firstFinishLevelUp = await xpService.awardXp({
                        userId,
                        amount: 25,
                        reason: 'room_first_finish',
                        roomId,
                    });
                    xpAwarded += 25;
                    levelUpEvent = levelUpEvent ?? firstFinishLevelUp;
                    await logContribution(userId, 'room_win', 2.0);
                    await supabase_1.supabaseAdmin.from('room_events').insert({
                        room_id: roomId,
                        user_id: userId,
                        event_type: 'first_finish',
                        metadata: { xp_awarded: 25 },
                    });
                }
            }
            await roomService.checkAndAwardAllComplete(roomId);
        }
        if (levelUpEvent) {
            await logContribution(userId, 'level_up', 0);
        }
    }
    return {
        xp_awarded: xpAwarded,
        xpAwarded,
        passed,
        attempt_id: attempt.id,
        levelUp: levelUpEvent,
        isPerfectDay,
    };
}
// ─── Streak helpers ───────────────────────────────────────────────────────────
/**
 * Increment streak if the user hasn't been active yet today.
 * Also checks for 7-day freeze recharge and streak milestones.
 */
async function updateStreak(userId) {
    const { data: prefs } = await supabase_1.supabaseAdmin
        .from('user_preferences')
        .select('streak_count, longest_streak, last_active_date, freeze_count, freeze_last_used')
        .eq('user_id', userId)
        .single();
    if (!prefs)
        return 0;
    const p = prefs;
    const today = new Date().toISOString().split('T')[0];
    // Already active today — no double-increment
    if (p.last_active_date === today)
        return p.streak_count;
    const newStreak = p.streak_count + 1;
    const newLongest = Math.max(newStreak, p.longest_streak || 0);
    // Freeze recharge: if 7 consecutive days of normal activity since last freeze use
    let newFreezeCount = p.freeze_count;
    if (p.freeze_count === 0 && p.freeze_last_used) {
        const daysSinceFreeze = Math.floor((new Date(today).getTime() - new Date(p.freeze_last_used).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceFreeze >= 7)
            newFreezeCount = 1;
    }
    await supabase_1.supabaseAdmin
        .from('user_preferences')
        .update({
        streak_count: newStreak,
        longest_streak: newLongest,
        last_active_date: today,
        freeze_count: newFreezeCount,
    })
        .eq('user_id', userId);
    return newStreak;
}
// ─── POST /api/mission/busy-day ───────────────────────────────────────────────
async function busyDay(userId) {
    const { data: prefs } = await supabase_1.supabaseAdmin
        .from('user_preferences')
        .select('streak_count, freeze_count, last_active_date')
        .eq('user_id', userId)
        .single();
    if (!prefs)
        throw new Error('User preferences not found');
    const p = prefs;
    const today = new Date().toISOString().split('T')[0];
    const freezeAvailable = p.freeze_count > 0;
    const updates = { last_active_date: today };
    if (freezeAvailable) {
        updates.freeze_count = p.freeze_count - 1;
        updates.freeze_last_used = today;
        // Streak preserved — no increment, no break
    }
    else {
        // No freeze — streak breaks
        updates.streak_count = 0;
    }
    await supabase_1.supabaseAdmin.from('user_preferences').update(updates).eq('user_id', userId);
    const levelUpEvent = await xpService.awardXp({
        userId,
        amount: xp_service_1.XP.BUSY_DAY,
        reason: 'busy_day_task',
    });
    if (levelUpEvent) {
        await logContribution(userId, 'level_up', 0, today);
    }
    // FIX: Busy day now logs standardized solo_task contribution through shared helper.
    await logContribution(userId, 'solo_task', 0.5, today);
    return {
        xp_awarded: xp_service_1.XP.BUSY_DAY,
        xpAwarded: xp_service_1.XP.BUSY_DAY,
        levelUp: levelUpEvent ?? null,
        streak_preserved: freezeAvailable,
        freeze_used: freezeAvailable,
        freeze_remaining: freezeAvailable ? p.freeze_count - 1 : 0,
    };
}
// ─── POST /api/mission/skip-day ───────────────────────────────────────────────
async function skipDay(userId) {
    const { data: prefs } = await supabase_1.supabaseAdmin
        .from('user_preferences')
        .select('streak_count, freeze_count, last_active_date')
        .eq('user_id', userId)
        .single();
    if (!prefs)
        throw new Error('User preferences not found');
    const p = prefs;
    const today = new Date().toISOString().split('T')[0];
    const freezeAvailable = p.freeze_count > 0;
    const updates = { last_active_date: today };
    if (freezeAvailable) {
        updates.freeze_count = p.freeze_count - 1;
        updates.freeze_last_used = today;
    }
    else {
        updates.streak_count = 0;
    }
    await supabase_1.supabaseAdmin.from('user_preferences').update(updates).eq('user_id', userId);
    return {
        xp_awarded: 0,
        streak_preserved: freezeAvailable,
        freeze_used: freezeAvailable,
        freeze_remaining: freezeAvailable ? p.freeze_count - 1 : 0,
    };
}
/**
 * Return full streak status for the dashboard.
 * Includes last 7 days dot array: 'done' | 'frozen' | 'missed' | 'today'
 */
async function getStreakStatus(userId) {
    const { data: prefs } = await supabase_1.supabaseAdmin
        .from('user_preferences')
        .select('streak_count, longest_streak, freeze_count, freeze_last_used, last_active_date')
        .eq('user_id', userId)
        .single();
    if (!prefs)
        return null;
    const p = prefs;
    // Build ordered array of last 7 day strings (oldest → today)
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(todayDate);
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().split('T')[0]);
    }
    const todayStr = days[days.length - 1];
    const sevenDaysAgo = days[0];
    // Fetch any contribution_events in that range (tells us which days had activity)
    const { data: events } = await supabase_1.supabaseAdmin
        .from('contribution_events')
        .select('date')
        .eq('user_id', userId)
        .gte('date', sevenDaysAgo);
    const activeDates = new Set((events || []).map((e) => e.date));
    const frozenDate = p.freeze_last_used || null;
    const last7Days = days.map((date) => {
        let status;
        if (activeDates.has(date)) {
            status = 'done';
        }
        else if (date === frozenDate) {
            status = 'frozen';
        }
        else if (date === todayStr) {
            status = 'today';
        }
        else {
            status = 'missed';
        }
        return { date, status };
    });
    return {
        streak_count: p.streak_count,
        longest_streak: p.longest_streak,
        freeze_count: p.freeze_count,
        freeze_last_used: p.freeze_last_used || null,
        last_active_date: p.last_active_date || null,
        streak_safe: frozenDate === todayStr,
        last_7_days: last7Days,
    };
}
// ─── POST /api/mission/stuck ──────────────────────────────────────────────────
const STUCK_FALLBACK = 'Take a deep breath. Re-read the problem statement carefully. ' +
    'Try breaking it into smaller steps and solve each one independently. ' +
    'Check for any typos or off-by-one errors in your code.';
/**
 * Get a targeted micro-lesson for a stuck learner.
 */
async function getStuckHint(userId, planId, dayNumber, problem, topic) {
    // Fetch skill_tier
    const { data: prefs } = await supabase_1.supabaseAdmin
        .from('user_preferences')
        .select('skill_tier')
        .eq('user_id', userId)
        .single();
    const skillTier = prefs?.skill_tier ?? 'beginner';
    // Fetch last 3 practice attempts for context
    const { data: attempts } = await supabase_1.supabaseAdmin
        .from('practice_attempts')
        .select('passed, error_type')
        .eq('user_id', userId)
        .eq('plan_id', planId)
        .eq('day_number', dayNumber)
        .order('created_at', { ascending: false })
        .limit(3);
    const recentAttempts = (attempts || []);
    const errorTypes = recentAttempts
        .map((a) => a.error_type)
        .filter((t) => !!t);
    if (errorTypes.length === 0)
        errorTypes.push('unknown error');
    // Log the hint request as a practice_attempts row
    await supabase_1.supabaseAdmin.from('practice_attempts').insert({
        user_id: userId,
        plan_id: planId,
        day_number: dayNumber,
        passed: false,
        hint_used: true,
        attempt_count: recentAttempts.length + 1,
    });
    // Call Gemini Flash — fallback on quota/latency errors
    try {
        const microLesson = await (0, gemini_service_1.getMicroLesson)({
            topic,
            problem,
            errorTypes,
            skillTier,
        });
        return { micro_lesson: microLesson, fallback: false };
    }
    catch (err) {
        if ((0, gemini_service_1.isQuotaError)(err)) {
            return { micro_lesson: STUCK_FALLBACK, fallback: true };
        }
        throw err;
    }
}
