import { Router, type Request, type Response } from 'express';
import { XpService } from '../services/xp.service';
import { BadgeService } from '../services/badge.service';
import { HeatmapService } from '../services/heatmap.service';
import { RoomService } from '../services/room.service';
import { supabaseAdmin } from '../lib/supabase';
import { evaluateCode, isQuotaError } from '../services/gemini.service';

const router = Router();
const xpService = new XpService();
const badgeService = new BadgeService();
const heatmapService = new HeatmapService();
const roomService = new RoomService();

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if all 3 tasks are complete for today by examining XP events
 */
async function checkPerfectDay(userId: string, planId: string, date: string): Promise<boolean> {
  const dateStart = new Date(date);
  dateStart.setHours(0, 0, 0, 0);
  const dateEnd = new Date(dateStart.getTime() + 24 * 60 * 60 * 1000);

  const { data: xpEvents } = await supabaseAdmin
    .from('xp_events')
    .select('reason')
    .eq('user_id', userId)
    .gte('created_at', dateStart.toISOString())
    .lt('created_at', dateEnd.toISOString());

  const reasons = (xpEvents || []).map((e) => e.reason);
  
  // Perfect day = both task_complete AND practice_solved on same day
  const hasTask = reasons.includes('task_complete');
  const hasPractice = reasons.includes('practice_solved');
  
  return hasTask && hasPractice;
}

/**
 * Update streak and detect milestone
 */
async function updateStreak(userId: string): Promise<{ newStreak: number; isMilestone: boolean }> {
  const prefs = await supabaseAdmin
    .from('user_preferences')
    .select('streak_count, longest_streak, last_active_date, freeze_last_used, freeze_count')
    .eq('user_id', userId)
    .single();

  if (!prefs.data) {
    return { newStreak: 1, isMilestone: false };
  }

  const today = new Date().toISOString().slice(0, 10);
  const lastActive = prefs.data.last_active_date as string | null;
  const currentStreak = (prefs.data.streak_count as number) || 0;
  const longestStreak = (prefs.data.longest_streak as number) || 0;
  const freezeLastUsed = prefs.data.freeze_last_used as string | null;
  const freezeCount = (prefs.data.freeze_count as number) || 1;

  let newStreak = currentStreak;
  let freezeNewCount = freezeCount;

  // Check if active today already
  if (lastActive === today) {
    return { newStreak, isMilestone: false };
  }

  // Determine streak change
  if (lastActive) {
    const lastDate = new Date(lastActive);
    const todayDate = new Date(today);
    const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      // Yesterday → increment streak
      newStreak = currentStreak + 1;
    } else if (diffDays > 1) {
      // Gap detected → reset streak
      newStreak = 1;
    }
  } else {
    // No prior activity → start at 1
    newStreak = 1;
  }

  // Check freeze recharge (7 days since last use)
  if (freezeLastUsed && freezeCount === 0) {
    const lastUsedDate = new Date(freezeLastUsed);
    const todayDate = new Date(today);
    const daysSinceUse = Math.floor((todayDate.getTime() - lastUsedDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceUse >= 7) {
      freezeNewCount = 1;
    }
  }

  // Update longest_streak if needed
  const newLongest = Math.max(longestStreak, newStreak);

  // Save updates
  await supabaseAdmin
    .from('user_preferences')
    .update({
      streak_count: newStreak,
      longest_streak: newLongest,
      last_active_date: today,
      freeze_count: freezeNewCount,
    })
    .eq('user_id', userId);

  // Check if milestone (7/30/100)
  const isMilestone = [7, 30, 100].includes(newStreak);

  return { newStreak, isMilestone };
}

interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

interface ApiSuccessBody<T> {
  success: true;
  data: T;
}

/**
 * Extract userId from Clerk auth middleware
 */
function extractUserId(req: Request): string | null {
  return req.userId;
}

/**
 * Send error response
 */
function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string
): Response<ApiErrorBody> {
  return res.status(statusCode).json({
    success: false,
    error: { code, message },
  });
}

/**
 * Send success response
 */
function sendSuccess<T>(res: Response, statusCode: number, data: T): Response<ApiSuccessBody<T>> {
  return res.status(statusCode).json({
    success: true,
    data,
  });
}

/**
 * GET /api/mission/today
 * Get today's mission from active plan
 */
router.get('/today', async (req: Request, res: Response): Promise<Response> => {
  const userId = extractUserId(req);

  if (!userId) {
    return sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
  }

  try {
    // eslint-disable-next-line global-require,@typescript-eslint/no-var-requires
    const { getTodayMission } = require('../../services/mission');

    const mission = await getTodayMission(userId);

    if (!mission) {
      return sendError(
        res,
        404,
        'NO_ACTIVE_PLAN',
        'No active plan found. Complete onboarding first.'
      );
    }

    return sendSuccess(res, 200, mission);
  } catch (error) {
    console.error('mission/today error:', error);
    return sendError(res, 500, 'INTERNAL_ERROR', "Failed to load today's mission");
  }
});

/**
 * POST /api/mission/complete-task
 * Mark task 1 or 2 complete for today with full gamification wiring
 */
router.post('/complete-task', async (req: Request, res: Response): Promise<Response> => {
  const userId = extractUserId(req);

  if (!userId) {
    return sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
  }

try {
  const { task_num, day_number, room_id } = req.body as {
    task_num?: unknown;
    day_number?: unknown;
    room_id?: unknown;
  };

  if (typeof task_num !== 'number' || ![1, 2].includes(task_num)) {
    return sendError(res, 400, 'INVALID_TASK', 'task_num must be 1 or 2');
  }

  if (typeof day_number !== 'number' || day_number < 1) {
    return sendError(res, 400, 'INVALID_DAY', 'day_number must be a positive number');
  }

  // eslint-disable-next-line global-require,@typescript-eslint/no-var-requires
  const { completeTask } = require('../../services/mission');

  const result = await completeTask(userId, task_num, day_number, room_id);

    // ─── FIX 2: Streak integrity ──────────────────────────────────────────
    const { newStreak, isMilestone } = await updateStreak(userId);
    const streakBonus = isMilestone ? 50 : 0;

    // ─── FIX 3: XP awards ─────────────────────────────────────────────────
    let totalXpAwarded = 20;
    let levelUpEvent = await xpService.awardXp({
      userId,
      amount: 20,
      reason: 'task_complete',
      taskId: `day_${day_number}_task_${task_num}`,
    });

    // Streak milestone bonus
    if (isMilestone && streakBonus > 0) {
      totalXpAwarded += streakBonus;
      const milestoneLevel = await xpService.awardXp({
        userId,
        amount: streakBonus,
        reason: 'streak_milestone',
      });
      if (milestoneLevel && !levelUpEvent) {
        levelUpEvent = milestoneLevel;
      }
    }

    // Streak daily bonus
    const dailyStreakBonus = await xpService.awardXp({
      userId,
      amount: 10,
      reason: 'streak_bonus',
    });
    totalXpAwarded += 10;
    if (dailyStreakBonus && !levelUpEvent) {
      levelUpEvent = dailyStreakBonus;
    }

    // ─── FIX 5: Contribution events ────────────────────────────────────────
    await heatmapService.logContributionEvent({
      userId,
      eventType: 'solo_task',
      delta: 1.0,
    });

    // Check for perfect day
    const planData = await supabaseAdmin
      .from('daily_plans')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    let isPerfectDay = false;
    if (planData.data) {
      isPerfectDay = await checkPerfectDay(userId, planData.data.id, new Date().toISOString().slice(0, 10));
      if (isPerfectDay) {
        await heatmapService.logContributionEvent({
          userId,
          eventType: 'perfect_day',
          delta: 0,
        });

        // Full day complete bonus XP
        const fullDayXp = await xpService.awardXp({
          userId,
          amount: 25,
          reason: 'full_day_complete',
        });
        totalXpAwarded += 25;
        if (fullDayXp && !levelUpEvent) {
          levelUpEvent = fullDayXp;
        }
      }
    }

    // ─── FIX 6: Badge triggers ────────────────────────────────────────────
    const awardedBadges = [];

    // First task badge
    const { data: firstTaskData } = await supabaseAdmin
      .from('xp_events')
      .select('id')
      .eq('user_id', userId)
      .eq('reason', 'task_complete')
      .maybeSingle();

    if (!firstTaskData) {
      const badge = await badgeService.checkAndAwardActionBadges(userId, { event: 'first_task' });
      awardedBadges.push(...badge);
    }

    // ─── FIX 4: Level-up detection ────────────────────────────────────────
    if (levelUpEvent) {
      await heatmapService.logContributionEvent({
        userId,
        eventType: 'level_up',
        delta: 0,
      });
    }

    // ─── FIX 5: Room leaderboard ──────────────────────────────────────────
    if (room_id && typeof room_id === 'string') {
      const today = new Date().toISOString().slice(0, 10);

      // Get current tasks done count
      const { data: roomLog } = await supabaseAdmin
        .from('room_daily_log')
        .select('tasks_done, xp_earned, started_at')
        .eq('room_id', room_id)
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle();

      const currentTasksDone = (roomLog?.tasks_done || 0) + 1;
      const currentXpEarned = (roomLog?.xp_earned || 0) + totalXpAwarded;
      const startedAt = roomLog?.started_at || new Date().toISOString();

      // Upsert room daily log
      await supabaseAdmin
        .from('room_daily_log')
        .upsert(
          {
            room_id,
            user_id: userId,
            date: today,
            tasks_done: currentTasksDone,
            xp_earned: currentXpEarned,
            started_at: startedAt,
          },
          { onConflict: 'room_id,user_id,date' }
        );

      // Insert room event
      await supabaseAdmin.from('room_events').insert({
        room_id,
        user_id: userId,
        event_type: 'task_complete',
        metadata: { task_num, xp_awarded: totalXpAwarded },
      });

      // Check first finish bonus
      if (currentTasksDone === 3) {
        const { data: existingPosition } = await supabaseAdmin
          .from('room_daily_log')
          .select('finish_position')
          .eq('room_id', room_id)
          .eq('date', today)
          .not('finish_position', 'is', null)
          .limit(1)
          .maybeSingle();

        if (!existingPosition) {
          // This user is first to finish
          await supabaseAdmin
            .from('room_daily_log')
            .update({ finish_position: 1 })
            .eq('room_id', room_id)
            .eq('user_id', userId)
            .eq('date', today);

          const firstFinishXp = await xpService.awardXp({
            userId,
            amount: 25,
            reason: 'room_first_finish',
            roomId: room_id,
          });
          totalXpAwarded += 25;
          if (firstFinishXp && !levelUpEvent) {
            levelUpEvent = firstFinishXp;
          }

          await supabaseAdmin.from('room_events').insert({
            room_id,
            user_id: userId,
            event_type: 'first_finish',
            metadata: { xp_awarded: 25 },
          });

          // Check if all members finished
          const { data: roomMembers } = await supabaseAdmin
            .from('room_members')
            .select('user_id')
            .eq('room_id', room_id);

          const memberCount = roomMembers?.length || 0;
          const { data: completedToday } = await supabaseAdmin
            .from('room_daily_log')
            .select('user_id')
            .eq('room_id', room_id)
            .eq('date', today)
            .eq('tasks_done', 3);

          const completedCount = completedToday?.length || 0;

          if (memberCount > 0 && memberCount === completedCount) {
            // Check if already fired
            const { data: alreadyFired } = await supabaseAdmin
              .from('room_events')
              .select('id')
              .eq('room_id', room_id)
              .eq('event_type', 'room_all_complete')
              .eq('date', today)
              .maybeSingle();

            if (!alreadyFired) {
              // Award +20 XP to all members
              if (roomMembers) {
                for (const member of roomMembers) {
                  await xpService.awardXp({
                    userId: member.user_id as string,
                    amount: 20,
                    reason: 'room_all_complete',
                    roomId: room_id,
                  });
                }
              }

              await supabaseAdmin.from('room_events').insert({
                room_id,
                user_id: userId,
                event_type: 'room_all_complete',
                metadata: { xp_awarded: 20 },
              });
            }
          }
        }
      }
    }

    // Build response
    const newXpProfile = await xpService.getUserXpProfile(userId);

    return sendSuccess(res, 200, {
      success: true,
      data: {
        tasksCompleted: 1,
        xpAwarded: totalXpAwarded,
        newTotalXp: newXpProfile.totalXp,
        newLevel: newXpProfile.level,
        levelUp: levelUpEvent || null,
        badgesAwarded: awardedBadges,
        streakCount: newStreak,
        isPerfectDay,
        ...result,
      },
    });
  } catch (error) {
    console.error('complete-task error:', error);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to complete task');
  }
});

/**
 * POST /api/mission/submit-practice
 * Submit code solution with full gamification wiring
 */
router.post('/submit-practice', async (req: Request, res: Response): Promise<Response> => {
  const userId = extractUserId(req);

  if (!userId) {
    return sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
  }

  try {
    const {
      plan_id,
      day_number,
      passed,
      submitted_code,
      error_type,
      hint_used,
      room_id,
    } = req.body as {
      plan_id?: unknown;
      day_number?: unknown;
      passed?: unknown;
      submitted_code?: unknown;
      error_type?: unknown;
      hint_used?: unknown;
      room_id?: unknown;
    };

    if (typeof plan_id !== 'string') {
      return sendError(res, 400, 'INVALID_PLAN', 'plan_id must be a string');
    }

    if (typeof day_number !== 'number' || day_number < 1) {
      return sendError(res, 400, 'INVALID_DAY', 'day_number must be a positive number');
    }

    if (typeof passed !== 'boolean') {
      return sendError(res, 400, 'INVALID_PASSED', 'passed must be a boolean');
    }

    // eslint-disable-next-line global-require,@typescript-eslint/no-var-requires
    const { submitPractice } = require('../../services/mission');

    const result = await submitPractice(
      userId,
      plan_id,
      day_number,
      passed,
      submitted_code,
      error_type,
      hint_used
    );

    let totalXpAwarded = 0;
    let levelUpEvent = null;
    const awardedBadges = [];

    if (passed) {
      // ─── FIX 3: XP awards for practice ─────────────────────────────────
      totalXpAwarded = 30;
      levelUpEvent = await xpService.awardXp({
        userId,
        amount: 30,
        reason: 'practice_solved',
        taskId: `day_${day_number}_practice`,
      });

      // No hint bonus
      const hintBoolean = typeof hint_used === 'boolean' ? hint_used : false;
      if (!hintBoolean) {
        totalXpAwarded += 15;
        const noHintXp = await xpService.awardXp({
          userId,
          amount: 15,
          reason: 'no_hint_bonus',
        });
        if (noHintXp && !levelUpEvent) {
          levelUpEvent = noHintXp;
        }

        const noHintBadge = await badgeService.checkAndAwardActionBadges(userId, {
          event: 'solve_no_hint',
        });
        awardedBadges.push(...noHintBadge);
      }

      // ─── FIX 5: Contribution events ────────────────────────────────────
      await heatmapService.logContributionEvent({
        userId,
        eventType: 'practice_solved',
        delta: 1.0,
      });

      // ─── FIX 6: Badge triggers ────────────────────────────────────────
      // First practice solved
      const { data: firstPracticeData } = await supabaseAdmin
        .from('practice_attempts')
        .select('id')
        .eq('user_id', userId)
        .eq('passed', true)
        .maybeSingle();

      if (!firstPracticeData) {
        const badge = await badgeService.checkAndAwardActionBadges(userId, {
          event: 'first_practice_solved',
        });
        awardedBadges.push(...badge);
      }

      // Practice count milestone check
      const { count: practiceCount } = await supabaseAdmin
        .from('practice_attempts')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .eq('passed', true);

      if (practiceCount !== null) {
        const badge = await badgeService.checkAndAwardActionBadges(userId, {
          event: 'practice_count',
          count: practiceCount,
        });
        awardedBadges.push(...badge);
      }

      // ─── FIX 4: Level-up detection ────────────────────────────────────
      if (levelUpEvent) {
        await heatmapService.logContributionEvent({
          userId,
          eventType: 'level_up',
          delta: 0,
        });
      }

      // ─── FIX 7: Perfect day detection ──────────────────────────────────
      const planData = await supabaseAdmin
        .from('daily_plans')
        .select('id')
        .eq('id', plan_id)
        .eq('user_id', userId)
        .single();

      let isPerfectDay = false;
      if (planData.data) {
        isPerfectDay = await checkPerfectDay(
          userId,
          plan_id,
          new Date().toISOString().slice(0, 10)
        );
        if (isPerfectDay) {
          await heatmapService.logContributionEvent({
            userId,
            eventType: 'perfect_day',
            delta: 0,
          });
        }
      }

      // ─── FIX 5: Room daily log if in room ──────────────────────────────
      if (room_id && typeof room_id === 'string') {
        const today = new Date().toISOString().slice(0, 10);

        const { data: roomLog } = await supabaseAdmin
          .from('room_daily_log')
          .select('tasks_done, xp_earned, started_at')
          .eq('room_id', room_id)
          .eq('user_id', userId)
          .eq('date', today)
          .maybeSingle();

        const currentTasksDone = (roomLog?.tasks_done || 0) + 1;
        const currentXpEarned = (roomLog?.xp_earned || 0) + totalXpAwarded;
        const startedAt = roomLog?.started_at || new Date().toISOString();

        await supabaseAdmin
          .from('room_daily_log')
          .upsert(
            {
              room_id,
              user_id: userId,
              date: today,
              tasks_done: currentTasksDone,
              xp_earned: currentXpEarned,
              started_at: startedAt,
            },
            { onConflict: 'room_id,user_id,date' }
          );

        await supabaseAdmin.from('room_events').insert({
          room_id,
          user_id: userId,
          event_type: 'practice_solved',
          metadata: { xp_awarded: totalXpAwarded },
        });
      }
    }

    // Build response
    const newXpProfile = await xpService.getUserXpProfile(userId);

    return sendSuccess(res, 200, {
      success: true,
      data: {
        xpAwarded: totalXpAwarded,
        newTotalXp: newXpProfile.totalXp,
        newLevel: newXpProfile.level,
        levelUp: levelUpEvent || null,
        badgesAwarded: awardedBadges,
        ...result,
      },
    });
  } catch (error) {
    console.error('submit-practice error:', error);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to submit practice');
  }
});

/**
 * POST /api/mission/busy-day
 * Register a busy day (uses 1 freeze, awards partial XP)
 */
router.post('/busy-day', async (req: Request, res: Response): Promise<Response> => {
  const userId = extractUserId(req);

  if (!userId) {
    return sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
  }

  try {
    // ─── FIX 2: Freeze guard ──────────────────────────────────────────────
    const prefs = await supabaseAdmin
      .from('user_preferences')
      .select('freeze_count')
      .eq('user_id', userId)
      .single();

    if (!prefs.data || (prefs.data.freeze_count as number) === 0) {
      return sendError(res, 400, 'NO_FREEZE_AVAILABLE', 'No streak freeze available. Complete a task to protect your streak.');
    }

    // eslint-disable-next-line global-require,@typescript-eslint/no-var-requires
    const { busyDay } = require('../../services/mission');

    const result = await busyDay(userId);

    // Update freeze and streak
    const { newStreak } = await updateStreak(userId);

    await supabaseAdmin
      .from('user_preferences')
      .update({
        freeze_count: 0,
        freeze_last_used: new Date().toISOString().slice(0, 10),
      })
      .eq('user_id', userId);

    // ─── FIX 3: XP award ──────────────────────────────────────────────────
    const xpAwarded = 5;
    const levelUpEvent = await xpService.awardXp({
      userId,
      amount: xpAwarded,
      reason: 'busy_day_task',
    });

    // ─── FIX 5: Contribution event ─────────────────────────────────────────
    await heatmapService.logContributionEvent({
      userId,
      eventType: 'solo_task',
      delta: 0.5,
    });

    const newXpProfile = await xpService.getUserXpProfile(userId);

    return sendSuccess(res, 200, {
      success: true,
      data: {
        xpAwarded,
        newTotalXp: newXpProfile.totalXp,
        newLevel: newXpProfile.level,
        levelUp: levelUpEvent || null,
        streakCount: newStreak,
        freezeUsed: true,
        ...result,
      },
    });
  } catch (error) {
    console.error('busy-day error:', error);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to register busy day');
  }
});

/**
 * POST /api/mission/skip-day
 * Skip the current day (uses 1 freeze)
 */
router.post('/skip-day', async (req: Request, res: Response): Promise<Response> => {
  const userId = extractUserId(req);

  if (!userId) {
    return sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
  }

  try {
    // ─── FIX 2: Freeze guard ──────────────────────────────────────────────
    const prefs = await supabaseAdmin
      .from('user_preferences')
      .select('freeze_count')
      .eq('user_id', userId)
      .single();

    if (!prefs.data || (prefs.data.freeze_count as number) === 0) {
      return sendError(res, 400, 'NO_FREEZE_AVAILABLE', 'No streak freeze available. Complete a task to protect your streak.');
    }

    // eslint-disable-next-line global-require,@typescript-eslint/no-var-requires
    const { skipDay } = require('../../services/mission');

    const result = await skipDay(userId);

    // Update freeze
    await supabaseAdmin
      .from('user_preferences')
      .update({
        freeze_count: 0,
        freeze_last_used: new Date().toISOString().slice(0, 10),
      })
      .eq('user_id', userId);

    return sendSuccess(res, 200, {
      success: true,
      data: {
        freezeUsed: true,
        ...result,
      },
    });
  } catch (error) {
    console.error('skip-day error:', error);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to register skip day');
  }
});

/**
 * POST /api/mission/stuck
 * Get AI-powered hint for stuck practice problem
 */
router.post('/stuck', async (req: Request, res: Response): Promise<Response> => {
  const userId = extractUserId(req);

  if (!userId) {
    return sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
  }

  try {
    const { plan_id, day_number, problem, topic } = req.body as {
      plan_id?: unknown;
      day_number?: unknown;
      problem?: unknown;
      topic?: unknown;
    };

    if (typeof plan_id !== 'string') {
      return sendError(res, 400, 'INVALID_PLAN', 'plan_id must be a string');
    }

    if (typeof day_number !== 'number' || day_number < 1) {
      return sendError(res, 400, 'INVALID_DAY', 'day_number must be a positive number');
    }

    if (typeof problem !== 'string' || problem.trim().length === 0) {
      return sendError(res, 400, 'INVALID_PROBLEM', 'problem must be a non-empty string');
    }

    if (typeof topic !== 'string' || topic.trim().length === 0) {
      return sendError(res, 400, 'INVALID_TOPIC', 'topic must be a non-empty string');
    }

    // eslint-disable-next-line global-require,@typescript-eslint/no-var-requires
    const { getStuckHint } = require('../../services/mission');

    const result = await getStuckHint(userId, plan_id, day_number, problem, topic);

    return sendSuccess(res, 200, result);
  } catch (error) {
    console.error('mission/stuck error:', error);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to get hint');
  }
});

/**
 * POST /api/mission/evaluate-code
 * Gemini evaluates the submitted code against the task description.
 * Awards XP if passed.
 */
router.post('/evaluate-code', async (req: Request, res: Response): Promise<Response> => {
  const userId = extractUserId(req);
  if (!userId) return sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');

  const { code, language, task_title, task_description, plan_id, day_number, task_key, room_id } =
    req.body as {
      code: string;
      language: string;
      task_title: string;
      task_description: string;
      plan_id: string;
      day_number: number;
      task_key: 'task1' | 'task2' | 'practice';
      room_id?: string;
    };

  if (typeof code !== 'string' || code.trim().length === 0)
    return sendError(res, 400, 'INVALID_CODE', 'code must be a non-empty string');
  if (typeof language !== 'string')
    return sendError(res, 400, 'INVALID_LANGUAGE', 'language is required');
  if (typeof task_title !== 'string' || typeof task_description !== 'string')
    return sendError(res, 400, 'INVALID_TASK', 'task_title and task_description are required');

  try {
    const evalResult = await evaluateCode(code, language, task_title, task_description);

    let xpAwarded = 0;
    let levelUpEvent = null;

    if (evalResult.passed) {
      // XP: 30 for practice key, 20 for task1/task2
      const xpAmount = task_key === 'practice' ? 30 : 20;
      xpAwarded = xpAmount;

      levelUpEvent = await xpService.awardXp({
        userId,
        amount: xpAmount,
        reason: task_key === 'practice' ? 'practice_solved' : 'task_complete',
        taskId: typeof day_number === 'number'
          ? `day_${day_number}_${String(task_key)}`
          : undefined,
      });

      await heatmapService.logContributionEvent({
        userId,
        eventType: task_key === 'practice' ? 'practice_solved' : 'solo_task',
        delta: 1.0,
      });

      // Log practice attempt if plan_id provided
      if (typeof plan_id === 'string' && typeof day_number === 'number') {
        await supabaseAdmin.from('practice_attempts').insert({
          user_id: userId,
          plan_id,
          day_number,
          passed: true,
          hint_used: false,
          submitted_code: code,
        });
      }

      // ── Room leaderboard update ──────────────────────────
      if (evalResult.passed && room_id) {
        try {
          const today = new Date().toISOString().split('T')[0];

          console.log(`[evaluate-code] room_id received: ${room_id}`);

          const { data: existingLog } = await supabaseAdmin
            .from('room_daily_log')
            .select('tasks_done, xp_earned, started_at')
            .eq('room_id', room_id)
            .eq('user_id', userId)
            .eq('date', today)
            .maybeSingle();

          const currentTasksDone = existingLog?.tasks_done ?? 0;
          const currentXp = existingLog?.xp_earned ?? 0;
          const newTasksDone = Math.min(currentTasksDone + 1, 3);
          const newXp = currentXp + xpAwarded;

          console.log(
            `[Room] Updating room_daily_log: ` +
              `user=${userId} room=${room_id} ` +
              `tasks=${newTasksDone}/3 xp=${newXp}`
          );

          const { error: upsertError } = await supabaseAdmin
            .from('room_daily_log')
            .upsert(
              {
                room_id,
                user_id: userId,
                date: today,
                tasks_done: newTasksDone,
                xp_earned: newXp,
                started_at: existingLog?.started_at ?? new Date().toISOString(),
              },
              { onConflict: 'room_id,user_id,date' }
            );

          if (upsertError) {
            console.error('[Room] room_daily_log upsert failed:', upsertError);
          } else {
            console.log('[Room] room_daily_log updated ✅');
          }

          const eventType = task_key === 'practice' ? 'practice_solved' : 'task_complete';

          const { error: eventError } = await supabaseAdmin
            .from('room_events')
            .insert({
              room_id,
              user_id: userId,
              event_type: eventType,
              metadata: {
                task_key,
                xp_awarded: xpAwarded,
                tasks_done: newTasksDone,
              },
            });

          if (eventError) {
            console.error('[Room] room_events insert failed:', eventError);
          } else {
            console.log(`[Room] Activity feed updated: ${eventType} ✅`);
          }

          if (newTasksDone === 3) {
            console.log('[Room] All 3 tasks done — checking first finish');

            const isFirst = await roomService.checkAndSetFirstFinish(room_id, userId);

            if (isFirst) {
              console.log('[Room] 🥇 First finish! +25 XP bonus');

              await supabaseAdmin.from('xp_events').insert({
                user_id: userId,
                amount: 25,
                reason: 'room_first_finish',
                room_id,
              });

              await supabaseAdmin.from('room_events').insert({
                room_id,
                user_id: userId,
                event_type: 'first_finish',
                metadata: { xp_awarded: 25 },
              });
            }

            await roomService.checkAndAwardAllComplete(room_id);
          }
        } catch (roomErr) {
          // Room failure must NEVER break the eval response
          console.error('[Room] evaluate-code room update failed:', roomErr);
        }
      }
      // ── End room update ──────────────────────────────────
    }

    const newXpProfile = await xpService.getUserXpProfile(userId);

    return sendSuccess(res, 200, {
      ...evalResult,
      xpAwarded,
      newTotalXp: newXpProfile.totalXp,
      newLevel: newXpProfile.level,
      levelUp: levelUpEvent ?? null,
    });
  } catch (err) {
    if (isQuotaError(err)) {
      return sendError(res, 429, 'QUOTA_EXCEEDED', 'Gemini quota reached. Try again shortly.');
    }
    console.error('evaluate-code error:', err);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to evaluate code');
  }
});

export default router;
