/**
 * Mission service — Phase 3
 *
 * Handles daily mission retrieval, task completion, practice submission,
 * and day modes (busy/skip).
 */
import { supabaseAdmin } from '../lib/supabase';
import { awardXp, XP } from './xp.service';
import { getMicroLesson, isQuotaError } from './gemini.service';

// ─── Day calculation ──────────────────────────────────────────────────────────

/**
 * Calculate which day of the plan the user is on.
 * Day 1 = start_date, Day 2 = start_date + 1, etc.
 */
export function calculateCurrentDay(startDate: string | Date): number {
    const startStr = typeof startDate === 'string'
        ? startDate
        : startDate.toISOString().split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];
    const diffMs = new Date(todayStr).getTime() - new Date(startStr).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays + 1);
}

// ─── Active plan ──────────────────────────────────────────────────────────────

export async function getActivePlan(userId: string): Promise<Record<string, unknown> | null> {
    const { data } = await supabaseAdmin
        .from('daily_plans')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('generated_at', { ascending: false })
        .limit(1)
        .single();
    return (data as Record<string, unknown>) || null;
}

// ─── Task completion tracking (via xp_events) ─────────────────────────────────

interface TodayCompletions {
    task1Done: boolean;
    task2Done: boolean;
    fullDayDone: boolean;
}

/**
 * Check which tasks are already completed today.
 */
async function getTodayCompletions(userId: string): Promise<TodayCompletions> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data } = await supabaseAdmin
        .from('xp_events')
        .select('reason')
        .eq('user_id', userId)
        .in('reason', ['task1_complete', 'task2_complete', 'full_day_complete'])
        .gte('created_at', todayStart.toISOString());

    const reasons = ((data || []) as { reason: string }[]).map((r) => r.reason);
    return {
        task1Done: reasons.includes('task1_complete'),
        task2Done: reasons.includes('task2_complete'),
        fullDayDone: reasons.includes('full_day_complete'),
    };
}

// ─── GET /api/mission/today ───────────────────────────────────────────────────

/**
 * Build today's mission from the user's active plan.
 */
export async function getTodayMission(userId: string): Promise<Record<string, unknown> | null> {
    const [plan, prefs] = await Promise.all([
        getActivePlan(userId),
        supabaseAdmin
            .from('user_preferences')
            .select('*')
            .eq('user_id', userId)
            .single()
            .then(({ data }) => data as Record<string, unknown> | null),
    ]);

    if (!plan || !prefs) return null;

    const dayNum = calculateCurrentDay(prefs['start_date'] as string);
    const totalDays = plan['total_days'] as number;

    if (dayNum > totalDays) {
        // Plan completed — mark it done
        await supabaseAdmin
            .from('daily_plans')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', plan['id']);
        return { plan_completed: true, total_days: totalDays };
    }

    const checkpoints = Array.isArray(plan['checkpoints']) ? (plan['checkpoints'] as Record<string, unknown>[]) : [];
    const checkpoint = checkpoints[dayNum - 1] || checkpoints[checkpoints.length - 1];

    const completions = await getTodayCompletions(userId);

    return {
        plan_id: plan['id'],
        day_number: dayNum,
        total_days: totalDays,
        title: checkpoint['title'],
        concepts: checkpoint['concepts'] || [],
        task1: { ...(checkpoint['task1'] as object), done: completions.task1Done },
        task2: { ...(checkpoint['task2'] as object), done: completions.task2Done },
        practice: checkpoint['practice'],
        streak_count: prefs['streak_count'],
        freeze_count: prefs['freeze_count'],
        tasks_done_today: [completions.task1Done, completions.task2Done].filter(Boolean).length,
    };
}

// ─── POST /api/mission/complete-task ─────────────────────────────────────────

export async function completeTask(
    userId: string,
    taskNum: number,
    _dayNumber: number,
): Promise<{ xp_awarded: number; already_done: boolean; both_tasks_done?: boolean }> {
    const reason = `task${taskNum}_complete`;

    // Idempotency: check if already done today
    const completions = await getTodayCompletions(userId);
    if (taskNum === 1 && completions.task1Done) {
        return { xp_awarded: 0, already_done: true };
    }
    if (taskNum === 2 && completions.task2Done) {
        return { xp_awarded: 0, already_done: true };
    }

    let totalXp = XP.TASK_COMPLETE;

    // Award task XP
    await awardXp(userId, XP.TASK_COMPLETE, reason);

    // Write contribution event
    await supabaseAdmin.from('contribution_events').insert({
        user_id: userId,
        date: new Date().toISOString().split('T')[0],
        event_type: 'solo_task',
        delta: 1.0,
    });

    // Update streak
    await updateStreak(userId);

    // Check if both tasks now done → award full day XP
    const updatedCompletions = await getTodayCompletions(userId);
    const bothDone =
        (taskNum === 1 ? true : updatedCompletions.task1Done) &&
        (taskNum === 2 ? true : updatedCompletions.task2Done);

    if (bothDone && !completions.fullDayDone) {
        await awardXp(userId, XP.FULL_DAY_COMPLETE, 'full_day_complete');
        totalXp += XP.FULL_DAY_COMPLETE;
    }

    return {
        xp_awarded: totalXp,
        already_done: false,
        both_tasks_done: bothDone,
    };
}

// ─── POST /api/mission/submit-practice ───────────────────────────────────────

export async function submitPractice(
    userId: string,
    planId: string,
    dayNumber: number,
    passed: boolean,
    submittedCode: string | null,
    errorType: string | null,
    hintUsed: boolean,
): Promise<{ xp_awarded: number; passed: boolean; attempt_id: string }> {
    // Count previous attempts this day
    const { count } = await supabaseAdmin
        .from('practice_attempts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('plan_id', planId)
        .eq('day_number', dayNumber);

    const attemptCount = (count || 0) + 1;

    const { data: attempt, error } = await supabaseAdmin
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

    if (error) throw new Error(`DB error saving attempt: ${error.message}`);

    let xpAwarded = 0;

    if (passed) {
        const xpReason = hintUsed ? 'practice_solved' : 'practice_solved_no_hint';
        const xpAmount = hintUsed ? XP.PRACTICE_SOLVED : XP.PRACTICE_SOLVED + XP.NO_HINT_BONUS;
        await awardXp(userId, xpAmount, xpReason);
        xpAwarded = xpAmount;

        // Contribution event for solving
        await supabaseAdmin.from('contribution_events').insert({
            user_id: userId,
            date: new Date().toISOString().split('T')[0],
            event_type: 'practice_solved',
            delta: 1.0,
        });
    }

    return { xp_awarded: xpAwarded, passed, attempt_id: (attempt as { id: string }).id };
}

// ─── Streak helpers ───────────────────────────────────────────────────────────

/**
 * Increment streak if the user hasn't been active yet today.
 * Also checks for 7-day freeze recharge and streak milestones.
 */
async function updateStreak(userId: string): Promise<void> {
    const { data: prefs } = await supabaseAdmin
        .from('user_preferences')
        .select('streak_count, longest_streak, last_active_date, freeze_count, freeze_last_used')
        .eq('user_id', userId)
        .single();

    if (!prefs) return;

    const p = prefs as {
        streak_count: number;
        longest_streak: number;
        last_active_date: string | null;
        freeze_count: number;
        freeze_last_used: string | null;
    };

    const today = new Date().toISOString().split('T')[0];

    // Already active today — no double-increment
    if (p.last_active_date === today) return;

    const newStreak = p.streak_count + 1;
    const newLongest = Math.max(newStreak, p.longest_streak || 0);

    // Freeze recharge: if 7 consecutive days of normal activity since last freeze use
    let newFreezeCount = p.freeze_count;
    if (p.freeze_count === 0 && p.freeze_last_used) {
        const daysSinceFreeze = Math.floor(
            (new Date(today).getTime() - new Date(p.freeze_last_used).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceFreeze >= 7) newFreezeCount = 1;
    }

    await supabaseAdmin
        .from('user_preferences')
        .update({
            streak_count: newStreak,
            longest_streak: newLongest,
            last_active_date: today,
            freeze_count: newFreezeCount,
        })
        .eq('user_id', userId);

    // Streak milestone XP: 7, 14, 30, 100 days
    const milestones = [7, 14, 30, 100];
    if (milestones.includes(newStreak)) {
        await awardXp(userId, 50, 'streak_milestone');
    } else {
        await awardXp(userId, XP.STREAK_BONUS, 'streak_bonus');
    }
}

// ─── POST /api/mission/busy-day ───────────────────────────────────────────────

export async function busyDay(userId: string): Promise<{
    xp_awarded: number;
    streak_preserved: boolean;
    freeze_used: boolean;
    freeze_remaining: number;
}> {
    const { data: prefs } = await supabaseAdmin
        .from('user_preferences')
        .select('streak_count, freeze_count, last_active_date')
        .eq('user_id', userId)
        .single();

    if (!prefs) throw new Error('User preferences not found');

    const p = prefs as { streak_count: number; freeze_count: number; last_active_date: string | null };
    const today = new Date().toISOString().split('T')[0];
    const freezeAvailable = p.freeze_count > 0;

    const updates: Partial<{
        last_active_date: string;
        freeze_count: number;
        freeze_last_used: string;
        streak_count: number;
    }> = { last_active_date: today };

    if (freezeAvailable) {
        updates.freeze_count = p.freeze_count - 1;
        updates.freeze_last_used = today;
        // Streak preserved — no increment, no break
    } else {
        // No freeze — streak breaks
        updates.streak_count = 0;
    }

    await supabaseAdmin.from('user_preferences').update(updates).eq('user_id', userId);

    // Award busy day XP
    await awardXp(userId, XP.BUSY_DAY, 'busy_day');

    // Write contribution (half intensity)
    await supabaseAdmin.from('contribution_events').insert({
        user_id: userId,
        date: today,
        event_type: 'solo_task',
        delta: 0.5,
    });

    return {
        xp_awarded: XP.BUSY_DAY,
        streak_preserved: freezeAvailable,
        freeze_used: freezeAvailable,
        freeze_remaining: freezeAvailable ? p.freeze_count - 1 : 0,
    };
}

// ─── POST /api/mission/skip-day ───────────────────────────────────────────────

export async function skipDay(userId: string): Promise<{
    xp_awarded: number;
    streak_preserved: boolean;
    freeze_used: boolean;
    freeze_remaining: number;
}> {
    const { data: prefs } = await supabaseAdmin
        .from('user_preferences')
        .select('streak_count, freeze_count, last_active_date')
        .eq('user_id', userId)
        .single();

    if (!prefs) throw new Error('User preferences not found');

    const p = prefs as { streak_count: number; freeze_count: number; last_active_date: string | null };
    const today = new Date().toISOString().split('T')[0];
    const freezeAvailable = p.freeze_count > 0;

    const updates: Partial<{
        last_active_date: string;
        freeze_count: number;
        freeze_last_used: string;
        streak_count: number;
    }> = { last_active_date: today };

    if (freezeAvailable) {
        updates.freeze_count = p.freeze_count - 1;
        updates.freeze_last_used = today;
    } else {
        updates.streak_count = 0;
    }

    await supabaseAdmin.from('user_preferences').update(updates).eq('user_id', userId);

    return {
        xp_awarded: 0,
        streak_preserved: freezeAvailable,
        freeze_used: freezeAvailable,
        freeze_remaining: freezeAvailable ? p.freeze_count - 1 : 0,
    };
}

// ─── GET /api/me/streak ───────────────────────────────────────────────────────

interface DayStatus {
    date: string;
    status: 'done' | 'frozen' | 'today' | 'missed';
}

interface StreakStatus {
    streak_count: number;
    longest_streak: number;
    freeze_count: number;
    freeze_last_used: string | null;
    last_active_date: string | null;
    streak_safe: boolean;
    last_7_days: DayStatus[];
}

/**
 * Return full streak status for the dashboard.
 * Includes last 7 days dot array: 'done' | 'frozen' | 'missed' | 'today'
 */
export async function getStreakStatus(userId: string): Promise<StreakStatus | null> {
    const { data: prefs } = await supabaseAdmin
        .from('user_preferences')
        .select('streak_count, longest_streak, freeze_count, freeze_last_used, last_active_date')
        .eq('user_id', userId)
        .single();

    if (!prefs) return null;

    const p = prefs as {
        streak_count: number;
        longest_streak: number;
        freeze_count: number;
        freeze_last_used: string | null;
        last_active_date: string | null;
    };

    // Build ordered array of last 7 day strings (oldest → today)
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(todayDate);
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().split('T')[0]);
    }

    const todayStr = days[days.length - 1];
    const sevenDaysAgo = days[0];

    // Fetch any contribution_events in that range (tells us which days had activity)
    const { data: events } = await supabaseAdmin
        .from('contribution_events')
        .select('date')
        .eq('user_id', userId)
        .gte('date', sevenDaysAgo);

    const activeDates = new Set(((events || []) as { date: string }[]).map((e) => e.date));
    const frozenDate = p.freeze_last_used || null;

    const last7Days: DayStatus[] = days.map((date) => {
        let status: DayStatus['status'];
        if (activeDates.has(date)) {
            status = 'done';
        } else if (date === frozenDate) {
            status = 'frozen';
        } else if (date === todayStr) {
            status = 'today';
        } else {
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

const STUCK_FALLBACK =
    'Take a deep breath. Re-read the problem statement carefully. ' +
    'Try breaking it into smaller steps and solve each one independently. ' +
    'Check for any typos or off-by-one errors in your code.';

/**
 * Get a targeted micro-lesson for a stuck learner.
 */
export async function getStuckHint(
    userId: string,
    planId: string,
    dayNumber: number,
    problem: string,
    topic: string,
): Promise<{ micro_lesson: string; fallback: boolean }> {
    // Fetch skill_tier
    const { data: prefs } = await supabaseAdmin
        .from('user_preferences')
        .select('skill_tier')
        .eq('user_id', userId)
        .single();

    if (!prefs) throw new Error('User preferences not found');

    const p = prefs as { skill_tier: string };

    // Fetch last 3 practice attempts for context
    const { data: attempts } = await supabaseAdmin
        .from('practice_attempts')
        .select('passed, error_type')
        .eq('user_id', userId)
        .eq('plan_id', planId)
        .eq('day_number', dayNumber)
        .order('created_at', { ascending: false })
        .limit(3);

    const recentAttempts = (attempts || []) as { passed: boolean; error_type: string | null }[];
    const errorTypes = recentAttempts
        .map((a) => a.error_type)
        .filter((t): t is string => !!t);

    if (errorTypes.length === 0) errorTypes.push('unknown error');

    // Log the hint request as a practice_attempts row
    await supabaseAdmin.from('practice_attempts').insert({
        user_id: userId,
        plan_id: planId,
        day_number: dayNumber,
        passed: false,
        hint_used: true,
        attempt_count: recentAttempts.length + 1,
    });

    // Call Gemini Flash — fallback on quota/latency errors
    try {
        const microLesson = await getMicroLesson({
            topic,
            problem,
            errorTypes,
            skillTier: p.skill_tier || 'beginner',
        });
        return { micro_lesson: microLesson, fallback: false };
    } catch (err) {
        if (isQuotaError(err)) {
            return { micro_lesson: STUCK_FALLBACK, fallback: true };
        }
        throw err;
    }
}
