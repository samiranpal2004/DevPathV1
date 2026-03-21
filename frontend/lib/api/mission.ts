import { api } from './client';
import type { Checkpoint } from './onboarding';

export interface TodayMission {
  day_number: number;
  plan_id: string;
  checkpoint: Checkpoint;
  tasks_completed: number[];
  practice_solved: boolean;
}

export interface TaskCompleteResponse {
  xp_awarded: number;
  total_xp: number;
  streak_count: number;
  message: string;
}

export interface PracticeSubmitResponse {
  passed: boolean;
  xp_awarded: number;
  hint_triggered?: boolean;
  message: string;
}

export interface StuckHintResponse {
  hint: string;
  steps: string[];
}

export interface DayModeResponse {
  freeze_count: number;
  streak_count: number;
  message: string;
}

/** Load today's mission. */
export async function getTodayMission(): Promise<TodayMission> {
  const res = await api.get('/api/mission/today');
  return res.data;
}

/** Mark task 1 or task 2 as complete. */
export async function completeTask(
  task_num: 1 | 2,
  day_number: number,
  room_id?: string
): Promise<TaskCompleteResponse> {
  const res = await api.post('/api/mission/complete-task', { task_num, day_number, room_id });
  return res.data;
}

/** Submit a practice attempt. */
export async function submitPractice(payload: {
  plan_id: string;
  day_number: number;
  passed: boolean;
  submitted_code: string | null;
  error_type: string | null;
  hint_used: boolean;
  room_id?: string;
}): Promise<PracticeSubmitResponse> {
  const res = await api.post('/api/mission/submit-practice', payload);
  return res.data;
}

/** Trigger Gemini stuck-detection micro-lesson. */
export async function getStuckHint(payload: {
  plan_id: string;
  day_number: number;
  problem: string;
  topic: string;
}): Promise<StuckHintResponse> {
  const res = await api.post('/api/mission/stuck', payload);
  return res.data;
}

/** Activate busy-day mode (5-min micro-task, uses 1 freeze). */
export async function activateBusyDay(): Promise<DayModeResponse> {
  const res = await api.post('/api/mission/busy-day');
  return res.data;
}

/** Activate skip-day mode (0 XP, uses 1 freeze). */
export async function activateSkipDay(): Promise<DayModeResponse> {
  const res = await api.post('/api/mission/skip-day');
  return res.data;
}
