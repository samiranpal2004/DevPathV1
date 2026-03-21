import { api } from './client';

export type SkillTier = 'beginner' | 'familiar' | 'intermediate';
export type Goal = 'job' | 'course' | 'dsa' | 'general';

export interface QuizResultResponse {
  skill_tier: SkillTier;
  score: number;
  message: string;
}

export interface PreferencesResponse {
  goal: Goal;
  daily_time_minutes: number;
  message: string;
}

export interface Checkpoint {
  day: number;
  title: string;
  concepts: string[];
  task1: { title: string; description: string; duration_minutes: number; timestamp?: string };
  task2: { title: string; description: string; duration_minutes: number };
  practice: {
    title: string;
    description: string;
    starter_code?: string;
    test_cases?: string[];
    difficulty: 'beginner' | 'intermediate' | 'advanced';
  };
}

export interface ParseResponse {
  plan_id: string;
  title: string;
  total_days: number;
  source_type: string;
  from_cache?: boolean;
  fallback?: boolean;
  preview_checkpoints: Checkpoint[];
}

/** Step 1 — save quiz answers and get back the computed skill tier. */
export async function submitQuiz(answers: boolean[]): Promise<QuizResultResponse> {
  const res = await api.post('/api/onboarding/quiz-result', { answers });
  return res.data;
}

/** Step 2 — save goal and daily time budget. */
export async function savePreferences(
  goal: Goal,
  daily_time_minutes: number
): Promise<PreferencesResponse> {
  const res = await api.post('/api/onboarding/preferences', { goal, daily_time_minutes });
  return res.data;
}

/** Step 3a — parse a YouTube/Udemy URL with Gemini. */
export async function parseUrl(
  url: string,
  fallback_topic?: string
): Promise<ParseResponse> {
  const res = await api.post('/api/onboarding/parse-url', { url, fallback_topic });
  return res.data;
}

/** Step 3b — generate a curriculum from a topic name (fallback path). */
export async function parseTopic(topic: string): Promise<ParseResponse> {
  const res = await api.post('/api/onboarding/parse-topic', { topic });
  return res.data;
}

/** Step 4 — get first 3 days of the active plan for the preview screen. */
export async function getPlanPreview(): Promise<ParseResponse> {
  const res = await api.get('/api/onboarding/plan-preview');
  return res.data;
}
