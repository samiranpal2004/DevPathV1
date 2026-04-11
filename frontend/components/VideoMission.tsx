'use client';

import { useEffect, useState, useCallback } from 'react';
import { CodeEditor } from './CodeEditor';
import {
  analyzeVideo as apiAnalyzeVideo,
  generatePlanFromQuiz,
  getAllPlans,
  activatePlan,
  getPlanProgress,
} from '@/lib/api/plans';
import { useActiveRoom } from '@/hooks/useActiveRoom';
import type {
  VideoAnalysis,
  QuizQuestion,
  PlanWithProgress,
  DayProgress,
} from '@/lib/api/plans';

interface Task {
  title: string;
  description: string;
  duration_minutes: number;
}

interface Practice {
  title: string;
  description: string;
  difficulty: string;
}

interface ActivePlanView {
  plan_id: string;
  title: string;
  total_days: number;
  checkpoints: Array<{
    day: number;
    title: string;
    concepts: string[];
    task1: Task;
    task2: Task;
    practice: Practice;
  }>;
}

type TaskKey = 'task1' | 'task2' | 'practice';

// Flow steps: 'url' → 'quiz' → 'generating' → 'plan'
type FlowStep = 'url' | 'quiz' | 'generating' | 'plan';

const DIFFICULTY_COLOR: Record<string, string> = {
  beginner: 'text-green-600 bg-green-50',
  intermediate: 'text-amber-600 bg-amber-50',
  advanced: 'text-red-600 bg-red-50',
};

const SKILL_LEVEL_LABEL: Record<string, { text: string; color: string }> = {
  beginner: { text: 'Beginner', color: 'text-green-600' },
  familiar: { text: 'Familiar', color: 'text-amber-600' },
  intermediate: { text: 'Intermediate', color: 'text-blue-600' },
};

export function VideoMission() {
  // Flow state
  const [flowStep, setFlowStep] = useState<FlowStep>('url');
  const [url, setUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quiz state (step 2)
  const [analysis, setAnalysis] = useState<VideoAnalysis | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  // Plan state (step 3)
  const [activePlan, setActivePlan] = useState<ActivePlanView | null>(null);
  const [skillLevel, setSkillLevel] = useState<string | null>(null);
  const [currentDay, setCurrentDay] = useState(1);
  const [allDayProgress, setAllDayProgress] = useState<Record<number, DayProgress>>({});

  // Saved plans
  const [savedPlans, setSavedPlans] = useState<PlanWithProgress[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  // Active room
  const { activeRoom } = useActiveRoom();

  // Task/editor state
  const [completedTasks, setCompletedTasks] = useState<Set<TaskKey>>(new Set());
  const [totalXp, setTotalXp] = useState(0);
  const [xpPop, setXpPop] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState<TaskKey | null>(null);

  // ── Load saved plans on mount ────────────────────────────────────────────
  const loadPlans = useCallback(async () => {
    try {
      setLoadingPlans(true);
      const plans = await getAllPlans();
      setSavedPlans(plans);
    } catch {
      // silently fail
    } finally {
      setLoadingPlans(false);
    }
  }, []);

  useEffect(() => { void loadPlans(); }, [loadPlans]);

  // ── Load progress for the active plan and apply to completed tasks ─────
  const loadProgress = useCallback(async (planId: string, day: number) => {
    try {
      const progress = await getPlanProgress(planId);
      setAllDayProgress(progress.day_progress);

      // Apply completion status for the current day
      const dayProg = progress.day_progress[day];
      if (dayProg) {
        const done = new Set<TaskKey>();
        if (dayProg.task1) done.add('task1');
        if (dayProg.task2) done.add('task2');
        if (dayProg.practice) done.add('practice');
        setCompletedTasks(done);
      }
    } catch {
      // non-critical
    }
  }, []);

  // Reload progress when the active plan or day changes
  useEffect(() => {
    if (activePlan?.plan_id && flowStep === 'plan') {
      void loadProgress(activePlan.plan_id, currentDay);
    }
  }, [activePlan?.plan_id, currentDay, flowStep, loadProgress]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  function showXpPop(amount: number) {
    setXpPop(amount);
    setTimeout(() => setXpPop(null), 1800);
  }

  function handleTaskSuccess(taskKey: TaskKey, xp: number) {
    setCompletedTasks((prev) => new Set([...prev, taskKey]));
    setTotalXp((prev) => prev + xp);
    showXpPop(xp);
    setEditorOpen(null);
    window.dispatchEvent(new CustomEvent('devpath:xp-changed'));
  }

  function resetFlow() {
    setFlowStep('url');
    setUrl('');
    setAnalysis(null);
    setQuestions([]);
    setCurrentQuestion(0);
    setAnswers([]);
    setSelectedOption(null);
    setActivePlan(null);
    setSkillLevel(null);
    setCurrentDay(1);
    setCompletedTasks(new Set());
    setTotalXp(0);
    setError(null);
  }

  // ── Step 1: Analyze video ────────────────────────────────────────────────

  async function handleAnalyze() {
    const trimmed = url.trim();
    if (!trimmed || isAnalyzing) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const result = await apiAnalyzeVideo(trimmed);
      setAnalysis(result.analysis);
      setQuestions(result.questions);
      setAnswers(Array(result.questions.length).fill(null));
      setCurrentQuestion(0);
      setSelectedOption(null);
      setFlowStep('quiz');
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: {
          data?: {
            error?: string;
            message?: string;
            category?: string;
          };
        };
      };
      if (axiosErr.response?.data?.error === 'non_educational_content') {
        const category = axiosErr.response?.data?.category ?? 'This video';
        setError(
          `❌ "${category}" isn't supported. DevPath only works with coding and tech tutorials. Try a programming course or tutorial instead.`
        );
      } else if (axiosErr.response?.data?.error === 'unsupported_url') {
        setError("That URL isn't supported. Try a YouTube video or playlist link.");
      } else if (axiosErr.response?.data?.error === 'quota_exceeded') {
        setError('Gemini quota reached. Please try again later.');
      } else {
        setError(axiosErr.response?.data?.message ?? 'Failed to analyze video. Please try again.');
      }
    } finally {
      setIsAnalyzing(false);
    }
  }

  // ── Step 2: Handle quiz answers ──────────────────────────────────────────

  function handleQuizAnswer(optionIndex: number) {
    setSelectedOption(optionIndex);

    const updated = [...answers];
    updated[currentQuestion] = optionIndex;
    setAnswers(updated);

    // Auto-advance after brief delay
    setTimeout(() => {
      setSelectedOption(null);
      if (currentQuestion < questions.length - 1) {
        setCurrentQuestion((q) => q + 1);
      } else {
        // All answered — generate plan
        void handleGeneratePlan(updated);
      }
    }, 500);
  }

  async function handleGeneratePlan(finalAnswers: (number | null)[]) {
    if (!analysis) return;
    setFlowStep('generating');
    setError(null);

    // Convert answers to boolean (correct/incorrect)
    const boolAnswers = questions.map(
      (q, i) => finalAnswers[i] === q.correctIndex
    );

    try {
      const result = await generatePlanFromQuiz(url.trim(), analysis, boolAnswers);
      const plan = result.plan as {
        id: string;
        title: string;
        total_days: number;
        checkpoints: ActivePlanView['checkpoints'];
      };

      setSkillLevel(result.skill_level);
      setActivePlan({
        plan_id: plan.id,
        title: plan.title,
        total_days: plan.total_days,
        checkpoints: plan.checkpoints,
      });
      setCurrentDay(1);
      setCompletedTasks(new Set());
      setTotalXp(0);
      setFlowStep('plan');

      // Refresh saved plans list
      void loadPlans();
    } catch {
      setError('Failed to generate your plan. Please try again.');
      setFlowStep('url');
    }
  }

  // ── Open a saved plan ────────────────────────────────────────────────────

  async function handleOpenPlan(plan: PlanWithProgress) {
    setActivePlan({
      plan_id: plan.id,
      title: plan.title,
      total_days: plan.total_days,
      checkpoints: plan.preview_checkpoints as ActivePlanView['checkpoints'],
    });
    setCurrentDay(1);
    setCompletedTasks(new Set());
    setTotalXp(0);
    setSkillLevel(null);
    setFlowStep('plan');

    // Activate this plan for daily missions
    try {
      await activatePlan(plan.id);
      void loadPlans();
    } catch {
      // non-critical
    }
  }

  // ── Current day's checkpoint ─────────────────────────────────────────────

  const checkpoint = activePlan?.checkpoints?.[currentDay - 1];
  const allDone = activePlan && completedTasks.size === 3;

  return (
    <>
      <section className="mt-16">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-on-background tracking-tight">Learn from a Video</h2>
            <p className="text-sm text-on-surface-variant mt-0.5">
              Paste a YouTube link — we&apos;ll assess your level, then build a personalised plan.
            </p>
          </div>
          {totalXp > 0 && (
            <div className="relative flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full">
              <span className="material-symbols-outlined text-primary text-base">bolt</span>
              <span className="text-sm font-bold text-primary">+{totalXp} XP earned</span>
              {xpPop !== null && (
                <span className="absolute -top-7 right-2 text-sm font-bold text-primary animate-bounce pointer-events-none">
                  +{xpPop} XP
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── STEP 1: URL Input ──────────────────────────────────────────── */}
        {flowStep === 'url' && (
          <div className="bg-surface-container-lowest rounded-lg p-6 shadow-sm border border-outline-variant/10 mb-6">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-xl">
                  link
                </span>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); setError(null); }}
                  onKeyDown={(e) => e.key === 'Enter' && void handleAnalyze()}
                  placeholder="https://youtube.com/watch?v=... or playlist link"
                  disabled={isAnalyzing}
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-surface-container-low border border-outline-variant/20 text-on-background placeholder-on-surface-variant/30 text-sm focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-60"
                />
              </div>
              <button
                onClick={() => void handleAnalyze()}
                disabled={!url.trim() || isAnalyzing}
                className="px-6 py-3 rounded-lg bg-primary text-on-primary font-semibold text-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
              >
                {isAnalyzing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-on-primary/40 border-t-on-primary rounded-full animate-spin" />
                    Analyzing…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">auto_awesome</span>
                    Analyze
                  </>
                )}
              </button>
            </div>

            {isAnalyzing && (
              <p className="text-xs text-on-surface-variant/60 mt-3 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                Gemini is watching your video and preparing skill questions — this takes a few seconds…
              </p>
            )}
            {error && (
              <p className="text-sm text-error mt-3 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">error</span>
                {error}
              </p>
            )}
          </div>
        )}

        {/* ── STEP 2: Quiz ───────────────────────────────────────────────── */}
        {flowStep === 'quiz' && analysis && questions.length > 0 && (
          <div className="bg-surface-container-lowest rounded-lg shadow-sm border border-outline-variant/10 overflow-hidden mb-6">
            {/* Video topic header */}
            <div className="px-8 pt-8 pb-4 border-b border-outline-variant/10">
              <span className="text-xs font-bold tracking-widest text-tertiary uppercase mb-1 block">
                Skill Check
              </span>
              <h3 className="text-xl font-bold text-on-background">{analysis.topic}</h3>
              <p className="text-sm text-on-surface-variant mt-1">
                {analysis.summary}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {analysis.concepts.slice(0, 6).map((c) => (
                  <span key={c} className="text-[10px] font-medium text-on-surface-variant/60 bg-surface-container-low px-2 py-0.5 rounded-full">
                    {c}
                  </span>
                ))}
              </div>
            </div>

            {/* Quiz questions */}
            <div className="px-8 py-8">
              {/* Progress bar */}
              <div className="flex gap-1.5 mb-6">
                {questions.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                      i <= currentQuestion ? 'bg-primary' : 'bg-surface-container-low'
                    }`}
                  />
                ))}
              </div>

              <p className="text-xs font-medium text-on-surface-variant/50 mb-2">
                Question {currentQuestion + 1} of {questions.length}
              </p>
              <h4 className="text-lg font-semibold text-on-background mb-6 whitespace-pre-line">
                {questions[currentQuestion].question}
              </h4>

              <div className="flex flex-col gap-3">
                {questions[currentQuestion].options.map((option, i) => {
                  const isSelected = selectedOption === i;
                  const isCorrect = selectedOption !== null && i === questions[currentQuestion].correctIndex;
                  const isWrong = isSelected && !isCorrect;

                  return (
                    <button
                      key={i}
                      onClick={() => selectedOption === null && handleQuizAnswer(i)}
                      disabled={selectedOption !== null}
                      className={`w-full text-left px-5 py-3.5 rounded-lg border transition-all duration-200 text-sm ${
                        isCorrect && selectedOption !== null
                          ? 'border-green-500 bg-green-500/10 text-green-700'
                          : isWrong
                          ? 'border-red-400 bg-red-400/10 text-red-600'
                          : 'border-outline-variant/20 text-on-background hover:border-primary/50 hover:bg-surface-container-low'
                      } disabled:cursor-default`}
                    >
                      <span className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-bold ${
                          isCorrect && selectedOption !== null
                            ? 'border-green-500 bg-green-500 text-white'
                            : isWrong
                            ? 'border-red-400 bg-red-400 text-white'
                            : 'border-outline-variant/30 text-on-surface-variant/50'
                        }`}>
                          {String.fromCharCode(65 + i)}
                        </span>
                        {option}
                      </span>
                    </button>
                  );
                })}
              </div>

              <p className="text-on-surface-variant/40 text-xs mt-6 text-center">
                This helps us build a plan that matches your current level.
              </p>
            </div>

            {/* Back button */}
            <div className="px-8 pb-6">
              <button
                onClick={resetFlow}
                className="text-sm text-on-surface-variant/50 hover:text-on-surface-variant transition-colors"
              >
                ← Back to URL input
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2.5: Generating plan ──────────────────────────────────── */}
        {flowStep === 'generating' && (
          <div className="bg-surface-container-lowest rounded-lg p-12 shadow-sm border border-outline-variant/10 mb-6">
            <div className="flex flex-col items-center gap-5">
              <div className="w-12 h-12 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
              <div className="text-center">
                <h3 className="text-lg font-bold text-on-background mb-1">Building your personalised plan</h3>
                <p className="text-sm text-on-surface-variant">
                  Tailoring tasks based on your skill level and the video content…
                </p>
              </div>
            </div>
            {error && (
              <p className="text-sm text-error mt-6 text-center flex items-center justify-center gap-1.5">
                <span className="material-symbols-outlined text-base">error</span>
                {error}
              </p>
            )}
          </div>
        )}

        {/* ── STEP 3: Plan View (day-wise) ───────────────────────────────── */}
        {flowStep === 'plan' && activePlan && checkpoint && (
          <div className="bg-surface-container-lowest rounded-lg shadow-sm border border-outline-variant/10 overflow-hidden mb-6">
            {/* Plan header */}
            <div className="px-8 pt-8 pb-4 border-b border-outline-variant/10">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-xs font-bold tracking-widest text-primary uppercase">
                      Your Plan
                    </span>
                    <span className="text-xs text-on-surface-variant/50 bg-surface-container-low px-2 py-0.5 rounded-full">
                      {activePlan.total_days} days
                    </span>
                    {skillLevel && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-container-low ${SKILL_LEVEL_LABEL[skillLevel]?.color ?? ''}`}>
                        Level: {SKILL_LEVEL_LABEL[skillLevel]?.text ?? skillLevel}
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-on-background">{activePlan.title}</h3>
                </div>
                <button
                  onClick={resetFlow}
                  className="text-sm font-medium text-primary hover:underline whitespace-nowrap"
                >
                  + New video
                </button>
              </div>

              {/* Day selector */}
              <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                {Array.from({ length: Math.min(activePlan.total_days, 15) }, (_, i) => i + 1).map((day) => {
                  const dp = allDayProgress[day];
                  const dayDone = dp && dp.task1 && dp.task2 && dp.practice;
                  return (
                    <button
                      key={day}
                      onClick={() => setCurrentDay(day)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 ${
                        day === currentDay
                          ? 'bg-primary text-on-primary'
                          : dayDone
                          ? 'bg-green-500/10 text-green-600 border border-green-500/20'
                          : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-highest'
                      }`}
                    >
                      {dayDone && day !== currentDay && (
                        <span className="material-symbols-outlined text-xs">check</span>
                      )}
                      Day {day}
                    </button>
                  );
                })}
                {activePlan.total_days > 15 && (
                  <span className="text-xs text-on-surface-variant/40 self-center px-2">
                    +{activePlan.total_days - 15} more
                  </span>
                )}
              </div>
            </div>

            {/* Day title */}
            <div className="px-8 pt-6 pb-2">
              <h4 className="text-sm font-bold text-on-surface-variant/60 uppercase tracking-wider">
                Day {currentDay}: {checkpoint.title}
              </h4>
              {checkpoint.concepts?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {checkpoint.concepts.map((c) => (
                    <span key={c} className="text-[10px] font-medium text-on-surface-variant/60 bg-surface-container-low px-2 py-0.5 rounded-full">
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Tasks */}
            <div className="px-8 py-4 space-y-4">
              <TaskRow
                label="Task 1"
                title={checkpoint.task1.title}
                description={checkpoint.task1.description}
                badge={`${checkpoint.task1.duration_minutes} min`}
                badgeClass="text-primary-container bg-primary-fixed"
                xp={20}
                done={completedTasks.has('task1')}
                onOpen={() => setEditorOpen('task1')}
              />
              <TaskRow
                label="Task 2"
                title={checkpoint.task2.title}
                description={checkpoint.task2.description}
                badge={`${checkpoint.task2.duration_minutes} min`}
                badgeClass="text-primary-container bg-primary-fixed"
                xp={20}
                done={completedTasks.has('task2')}
                onOpen={() => setEditorOpen('task2')}
              />
              <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-tertiary rounded-l-lg" />
                <TaskRow
                  label="Practice"
                  title={checkpoint.practice.title}
                  description={checkpoint.practice.description}
                  badge={checkpoint.practice.difficulty}
                  badgeClass={DIFFICULTY_COLOR[checkpoint.practice.difficulty] ?? 'text-on-surface-variant bg-surface-container-low'}
                  xp={30}
                  done={completedTasks.has('practice')}
                  onOpen={() => setEditorOpen('practice')}
                  indent
                />
              </div>
            </div>

            {/* Completion banner */}
            {allDone && (
              <div className="mx-8 mb-8 p-6 bg-primary/5 rounded-lg flex items-center gap-4 border border-primary/10">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary">emoji_events</span>
                </div>
                <div>
                  <p className="font-bold text-on-background">Day {currentDay} complete!</p>
                  <p className="text-sm text-on-surface-variant">
                    You earned <span className="font-bold text-primary">+{totalXp} XP</span>.
                    {currentDay < activePlan.total_days && ' Move to the next day when ready.'}
                  </p>
                </div>
                {currentDay < activePlan.total_days && (
                  <button
                    onClick={() => { setCurrentDay((d) => d + 1); setCompletedTasks(new Set()); setTotalXp(0); }}
                    className="ml-auto text-sm font-semibold text-primary hover:underline whitespace-nowrap"
                  >
                    Day {currentDay + 1} →
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Saved Plans List ───────────────────────────────────────────── */}
        {savedPlans.length > 0 && flowStep === 'url' && (
          <div className="mt-8">
            <h3 className="text-sm font-bold text-on-surface-variant/50 uppercase tracking-widest mb-4">
              Your Plans
            </h3>
            <div className="grid gap-3">
              {savedPlans.map((plan) => (
                <div
                  key={plan.id}
                  onClick={() => void handleOpenPlan(plan)}
                  className="bg-surface-container-lowest rounded-lg p-5 shadow-sm border border-outline-variant/10 hover:border-primary/20 cursor-pointer transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-on-background text-sm truncate">{plan.title}</h4>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          plan.status === 'active'
                            ? 'bg-green-500/10 text-green-600'
                            : plan.status === 'completed'
                            ? 'bg-primary/10 text-primary'
                            : 'bg-surface-container-low text-on-surface-variant/50'
                        }`}>
                          {plan.status}
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant/50">
                        {plan.days_completed}/{plan.total_days} days completed
                        {plan.source_url && (
                          <> &middot; {plan.source_type?.replace('_', ' ')}</>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {/* Progress bar */}
                      <div className="w-24 h-1.5 bg-surface-container-low rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${plan.total_days > 0 ? (plan.days_completed / plan.total_days) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="material-symbols-outlined text-on-surface-variant/30 group-hover:text-primary transition-colors text-xl">
                        arrow_forward
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading state for saved plans */}
        {loadingPlans && savedPlans.length === 0 && flowStep === 'url' && (
          <div className="mt-8">
            <div className="bg-surface-container-lowest rounded-lg p-5 animate-pulse">
              <div className="h-4 w-32 bg-surface-container-low rounded mb-2" />
              <div className="h-3 w-48 bg-surface-container-low rounded" />
            </div>
          </div>
        )}
      </section>

      {/* Code editor modal */}
      {editorOpen && activePlan && checkpoint && (
        <CodeEditor
          taskKey={editorOpen}
          taskTitle={
            editorOpen === 'task1' ? checkpoint.task1.title :
            editorOpen === 'task2' ? checkpoint.task2.title :
            checkpoint.practice.title
          }
          taskDescription={
            editorOpen === 'task1' ? checkpoint.task1.description :
            editorOpen === 'task2' ? checkpoint.task2.description :
            checkpoint.practice.description
          }
          planId={activePlan.plan_id}
          dayNumber={currentDay}
          roomId={activeRoom?.id}
          onSuccess={(xp) => handleTaskSuccess(editorOpen, xp)}
          onClose={() => setEditorOpen(null)}
        />
      )}
    </>
  );
}

// ─── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({
  label, title, description, badge, badgeClass, xp, done, onOpen, indent = false,
}: {
  label: string;
  title: string;
  description: string;
  badge: string;
  badgeClass: string;
  xp: number;
  done: boolean;
  onOpen: () => void;
  indent?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-5 p-5 rounded-lg transition-all duration-200 border ${
        done
          ? 'bg-primary/5 border-primary/10'
          : 'bg-surface-container-low/40 hover:bg-surface-container-low border-transparent'
      } ${indent ? 'pl-6' : ''}`}
    >
      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
        done ? 'border-primary bg-primary' : 'border-primary-container/30'
      }`}>
        {done && <span className="material-symbols-outlined text-on-primary text-base">check</span>}
      </div>

      <div className="flex-1 min-w-0">
        <span className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-wider block mb-0.5">
          {label}
        </span>
        <h4 className={`font-semibold text-sm ${done ? 'text-on-surface-variant line-through' : 'text-on-background'}`}>
          {title}
        </h4>
        <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-2">{description}</p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${badgeClass}`}>
          {badge}
        </span>
        <span className="text-xs font-bold text-primary/70 w-12 text-right">+{xp} XP</span>
        <button
          onClick={onOpen}
          disabled={done}
          className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full transition-all ${
            done
              ? 'bg-primary/10 text-primary cursor-default'
              : 'bg-primary text-on-primary hover:opacity-90 active:scale-95'
          }`}
        >
          {done ? (
            'Done'
          ) : (
            <>
              <span className="material-symbols-outlined text-sm">code</span>
              Write Code
            </>
          )}
        </button>
      </div>
    </div>
  );
}
