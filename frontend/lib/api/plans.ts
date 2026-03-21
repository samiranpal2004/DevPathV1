import { api } from './client';

export interface VideoAnalysis {
    topic: string;
    concepts: string[];
    difficulty_estimate: string;
    total_duration_minutes: number;
    summary: string;
}

export interface QuizQuestion {
    question: string;
    options: string[];
    correctIndex: number;
}

export interface AnalyzeVideoResponse {
    analysis: VideoAnalysis;
    questions: QuizQuestion[];
    source_type: string;
}

export interface DayProgress {
    task1: boolean;
    task2: boolean;
    practice: boolean;
}

export interface PlanWithProgress {
    id: string;
    title: string;
    source_url: string | null;
    source_type: string;
    total_days: number;
    current_day: number;
    status: string;
    generated_at: string;
    days_completed: number;
    day_progress: Record<number, DayProgress>;
    preview_checkpoints: Array<Record<string, unknown>>;
}

export interface GeneratePlanResponse {
    plan: Record<string, unknown>;
    skill_level: string;
    fallback: string | null;
}

/** Step 1: Analyze a video and get quiz questions. */
export async function analyzeVideo(url: string): Promise<AnalyzeVideoResponse> {
    const res = await api.post('/api/plans/analyze-video', { url });
    return res.data;
}

/** Step 2: Submit quiz answers, generate personalized plan. */
export async function generatePlanFromQuiz(
    url: string,
    analysis: VideoAnalysis,
    answers: boolean[],
    daily_time_minutes?: number,
): Promise<GeneratePlanResponse> {
    const res = await api.post('/api/plans/generate', {
        url,
        analysis,
        answers,
        daily_time_minutes,
    });
    return res.data;
}

/** Get all plans with progress. */
export async function getAllPlans(): Promise<PlanWithProgress[]> {
    const res = await api.get('/api/plans');
    return res.data.plans;
}

/** Activate a specific plan for daily missions. */
export async function activatePlan(planId: string): Promise<void> {
    await api.post(`/api/plans/${planId}/activate`);
}

export interface PlanProgressResponse {
    plan_id: string;
    total_days: number;
    days_completed: number;
    day_progress: Record<number, DayProgress>;
}

/** Get per-day completion status for a specific plan. */
export async function getPlanProgress(planId: string): Promise<PlanProgressResponse> {
    const res = await api.get(`/api/plans/${planId}/progress`);
    return res.data;
}
