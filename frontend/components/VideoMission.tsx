'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';

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

interface ParsedPlan {
  plan_id: string;
  title: string;
  task1: Task;
  task2: Task;
  practice: Practice;
}

type TaskKey = 'task1' | 'task2' | 'practice';

const DIFFICULTY_COLOR: Record<string, string> = {
  beginner: 'text-green-600 bg-green-50',
  intermediate: 'text-amber-600 bg-amber-50',
  advanced: 'text-red-600 bg-red-50',
};

export function VideoMission() {
  const { getToken } = useAuth();
  const [url, setUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [plan, setPlan] = useState<ParsedPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completedTasks, setCompletedTasks] = useState<Set<TaskKey>>(new Set());
  const [totalXp, setTotalXp] = useState(0);
  const [submittingTask, setSubmittingTask] = useState<TaskKey | null>(null);
  const [xpPop, setXpPop] = useState<number | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL;

  function showXpPop(amount: number) {
    setXpPop(amount);
    setTimeout(() => setXpPop(null), 1800);
  }

  async function analyzeVideo() {
    const trimmed = url.trim();
    if (!trimmed || isAnalyzing) return;

    setIsAnalyzing(true);
    setError(null);
    setPlan(null);
    setCompletedTasks(new Set());
    setTotalXp(0);

    try {
      const token = await getToken();
      const res = await fetch(`${apiBase}/api/onboarding/parse-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: trimmed }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setError(
          body.error === 'unsupported_url'
            ? "That URL isn't supported. Try a YouTube video or playlist link."
            : 'Failed to analyze video. Please try again.'
        );
        return;
      }

      const data = await res.json() as {
        plan_id: string;
        title: string;
        preview_checkpoints: Array<{
          task1: Task;
          task2: Task;
          practice: Practice;
        }>;
      };

      const checkpoint = data.preview_checkpoints?.[0];
      if (!checkpoint) {
        setError('No tasks found in this video.');
        return;
      }

      setPlan({
        plan_id: data.plan_id,
        title: data.title,
        task1: checkpoint.task1,
        task2: checkpoint.task2,
        practice: checkpoint.practice,
      });
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function completeTask(key: 'task1' | 'task2') {
    if (!plan || completedTasks.has(key) || submittingTask) return;
    setSubmittingTask(key);

    try {
      const token = await getToken();
      const res = await fetch(`${apiBase}/api/mission/complete-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ task_num: key === 'task1' ? 1 : 2, day_number: 1 }),
      });

      if (res.ok) {
        const data = await res.json() as { data?: { xpAwarded?: number } };
        const xp = data.data?.xpAwarded ?? 20;
        setTotalXp((prev) => prev + xp);
        showXpPop(xp);
        setCompletedTasks((prev) => new Set([...prev, key]));
      }
    } catch {
      // silently ignore — button stays clickable
    } finally {
      setSubmittingTask(null);
    }
  }

  async function completePractice() {
    if (!plan || completedTasks.has('practice') || submittingTask) return;
    setSubmittingTask('practice');

    try {
      const token = await getToken();
      const res = await fetch(`${apiBase}/api/mission/submit-practice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan_id: plan.plan_id, day_number: 1, passed: true }),
      });

      if (res.ok) {
        const data = await res.json() as { data?: { xpAwarded?: number } };
        const xp = data.data?.xpAwarded ?? 30;
        setTotalXp((prev) => prev + xp);
        showXpPop(xp);
        setCompletedTasks((prev) => new Set([...prev, 'practice']));
      }
    } catch {
      // silently ignore
    } finally {
      setSubmittingTask(null);
    }
  }

  const allDone = plan && completedTasks.size === 3;

  return (
    <section className="mt-16">
      {/* Section header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-on-background tracking-tight">Learn from a Video</h2>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Paste any YouTube link — Gemini breaks it into tasks you can complete for XP.
          </p>
        </div>
        {totalXp > 0 && (
          <div className="relative flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full">
            <span className="material-symbols-outlined text-primary text-base">bolt</span>
            <span className="text-sm font-bold text-primary">+{totalXp} XP earned</span>
            {xpPop !== null && (
              <span className="absolute -top-6 right-0 text-sm font-bold text-primary animate-bounce">
                +{xpPop} XP
              </span>
            )}
          </div>
        )}
      </div>

      {/* URL input card */}
      <div className="bg-surface-container-lowest rounded-lg p-6 shadow-sm border border-outline-variant/10 mb-6">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-xl">
              link
            </span>
            <input
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && void analyzeVideo()}
              placeholder="https://youtube.com/watch?v=... or playlist link"
              disabled={isAnalyzing}
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-surface-container-low border border-outline-variant/20 text-on-background placeholder-on-surface-variant/30 text-sm focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-60"
            />
          </div>
          <button
            onClick={() => void analyzeVideo()}
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
            Gemini is watching your video and generating tasks — this takes a few seconds…
          </p>
        )}

        {error && (
          <p className="text-sm text-error mt-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base">error</span>
            {error}
          </p>
        )}
      </div>

      {/* Tasks */}
      {plan && (
        <div className="bg-surface-container-lowest rounded-lg shadow-sm border border-outline-variant/10 overflow-hidden">
          {/* Plan header */}
          <div className="px-8 pt-8 pb-4 border-b border-outline-variant/10">
            <span className="text-xs font-bold tracking-widest text-primary uppercase mb-1 block">
              Video Tasks
            </span>
            <h3 className="text-xl font-bold text-on-background">{plan.title}</h3>
            <p className="text-sm text-on-surface-variant mt-1">
              Complete all 3 tasks to earn your XP for this video.
            </p>
          </div>

          <div className="px-8 py-6 space-y-4">
            {/* Task 1 */}
            <TaskCard
              label="Task 1"
              title={plan.task1.title}
              description={plan.task1.description}
              badge={`${plan.task1.duration_minutes} min`}
              badgeClass="text-primary-container bg-primary-fixed"
              xp={20}
              done={completedTasks.has('task1')}
              loading={submittingTask === 'task1'}
              onComplete={() => void completeTask('task1')}
            />

            {/* Task 2 */}
            <TaskCard
              label="Task 2"
              title={plan.task2.title}
              description={plan.task2.description}
              badge={`${plan.task2.duration_minutes} min`}
              badgeClass="text-primary-container bg-primary-fixed"
              xp={20}
              done={completedTasks.has('task2')}
              loading={submittingTask === 'task2'}
              onComplete={() => void completeTask('task2')}
            />

            {/* Practice */}
            <div className="relative">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-tertiary rounded-l-lg" />
              <TaskCard
                label="Practice"
                title={plan.practice.title}
                description={plan.practice.description}
                badge={plan.practice.difficulty}
                badgeClass={DIFFICULTY_COLOR[plan.practice.difficulty] ?? 'text-on-surface-variant bg-surface-container-low'}
                xp={30}
                done={completedTasks.has('practice')}
                loading={submittingTask === 'practice'}
                onComplete={() => void completePractice()}
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
                <p className="font-bold text-on-background">Session complete!</p>
                <p className="text-sm text-on-surface-variant">
                  You earned <span className="font-bold text-primary">+{totalXp} XP</span> from this video. Paste another link to keep going.
                </p>
              </div>
              <button
                onClick={() => {
                  setPlan(null);
                  setUrl('');
                  setCompletedTasks(new Set());
                  setTotalXp(0);
                }}
                className="ml-auto text-sm font-semibold text-primary hover:underline whitespace-nowrap"
              >
                New video →
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ─── Sub-component ────────────────────────────────────────────────────────────

function TaskCard({
  label,
  title,
  description,
  badge,
  badgeClass,
  xp,
  done,
  loading,
  onComplete,
  indent = false,
}: {
  label: string;
  title: string;
  description: string;
  badge: string;
  badgeClass: string;
  xp: number;
  done: boolean;
  loading: boolean;
  onComplete: () => void;
  indent?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-5 p-5 rounded-lg transition-all duration-200 ${
        done
          ? 'bg-primary/5 border border-primary/10'
          : 'bg-surface-container-low/40 hover:bg-surface-container-low border border-transparent'
      } ${indent ? 'pl-6' : ''}`}
    >
      {/* Check circle */}
      <div
        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
          done ? 'border-primary bg-primary' : 'border-primary-container/30'
        }`}
      >
        {done && (
          <span className="material-symbols-outlined text-on-primary text-base">check</span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <span className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-wider block mb-0.5">
          {label}
        </span>
        <h4 className={`font-semibold text-sm ${done ? 'text-on-surface-variant line-through' : 'text-on-background'}`}>
          {title}
        </h4>
        <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-2">{description}</p>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3 shrink-0">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${badgeClass}`}>
          {badge}
        </span>
        <span className="text-xs font-bold text-primary/70 w-12 text-right">+{xp} XP</span>
        <button
          onClick={onComplete}
          disabled={done || loading}
          className={`text-xs font-semibold px-4 py-2 rounded-full transition-all ${
            done
              ? 'bg-primary/10 text-primary cursor-default'
              : 'bg-primary text-on-primary hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed'
          }`}
        >
          {loading ? (
            <span className="w-3.5 h-3.5 border-2 border-on-primary/40 border-t-on-primary rounded-full animate-spin block" />
          ) : done ? (
            'Done'
          ) : (
            'Complete'
          )}
        </button>
      </div>
    </div>
  );
}
