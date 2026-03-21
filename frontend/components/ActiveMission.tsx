'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { CodeEditor } from './CodeEditor';
import { useActiveRoom } from '@/hooks/useActiveRoom';

interface Task {
  title: string;
  description: string;
  duration_minutes: number;
  done: boolean;
}

interface Practice {
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

interface MissionData {
  plan_id: string;
  day_number: number;
  total_days: number;
  title: string;
  concepts: string[];
  task1: Task;
  task2: Task;
  practice: Practice;
  streak_count: number;
  freeze_count: number;
  tasks_done_today: number;
}

type TaskKey = 'task1' | 'task2' | 'practice';

const DIFFICULTY_LABEL: Record<string, string> = {
  beginner: '10 min',
  intermediate: '15 min',
  advanced: '20 min',
};

export function ActiveMission() {
  const { getToken } = useAuth();
  const [mission, setMission] = useState<MissionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [noPlan, setNoPlan] = useState(false);
  const [editorOpen, setEditorOpen] = useState<TaskKey | null>(null);
  const [completedToday, setCompletedToday] = useState<Set<TaskKey>>(new Set());
  const [sessionXp, setSessionXp] = useState(0);
  const [xpPop, setXpPop] = useState<number | null>(null);

  const { activeRoom } = useActiveRoom();
  const apiBase = process.env.NEXT_PUBLIC_API_URL;

  const fetchMission = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${apiBase}/api/mission/today`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 404) { setNoPlan(true); return; }
      if (!res.ok) return;
      const data = await res.json() as MissionData;
      setMission(data);
      // Pre-populate already-done tasks from server
      const done = new Set<TaskKey>();
      if (data.task1.done) done.add('task1');
      if (data.task2.done) done.add('task2');
      setCompletedToday(done);
    } catch {
      // silently fail — show empty state
    } finally {
      setLoading(false);
    }
  }, [getToken, apiBase]);

  useEffect(() => { void fetchMission(); }, [fetchMission]);

  function showXpPop(xp: number) {
    setXpPop(xp);
    setTimeout(() => setXpPop(null), 1800);
  }

  function handleTaskSuccess(key: TaskKey, xp: number) {
    setCompletedToday((prev) => new Set([...prev, key]));
    setSessionXp((prev) => prev + xp);
    showXpPop(xp);
    setEditorOpen(null);
    // Notify navbar XP bar to refresh
    window.dispatchEvent(new CustomEvent('devpath:xp-changed'));
  }

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <section className="mt-12">
        <div className="bg-surface-container-lowest rounded-lg p-10 relative overflow-hidden animate-pulse">
          <div className="h-4 w-28 bg-surface-container-low rounded mb-4" />
          <div className="h-8 w-64 bg-surface-container-low rounded mb-10" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-6 p-6 bg-surface-container-low/40 rounded-lg mb-4">
              <div className="w-8 h-8 rounded-full bg-surface-container-low shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 bg-surface-container-low rounded" />
                <div className="h-3 w-56 bg-surface-container-low rounded" />
              </div>
              <div className="h-7 w-20 bg-surface-container-low rounded-full" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  // ── No plan state ──────────────────────────────────────────────────────────
  if (noPlan || !mission) {
    return null; // VideoMission above already prompts user to paste a URL
  }

  const allDone = completedTasks(mission, completedToday) === 3;
  const doneSoFar = completedTasks(mission, completedToday);

  return (
    <>
      <section className="mt-12">
        {/* ── Active Mission Card — full width ─────────────────────────────── */}
        <div className="bg-surface-container-lowest rounded-lg p-10 shadow-[0_20px_50px_rgba(63,72,73,0.04)] relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-tertiary to-tertiary-container opacity-50" />

          <div className="flex justify-between items-start mb-10 gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-bold tracking-widest text-tertiary uppercase">
                  Active Mission
                </span>
                <span className="text-xs text-on-surface-variant/50 bg-surface-container-low px-2 py-0.5 rounded-full">
                  Day {mission.day_number} of {mission.total_days}
                </span>
              </div>
              <h2 className="text-3xl font-bold text-on-background tracking-tight leading-tight">
                {mission.title}
              </h2>
              {mission.concepts.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {mission.concepts.slice(0, 4).map((c) => (
                    <span key={c} className="text-[10px] font-medium text-on-surface-variant/60 bg-surface-container-low px-2 py-0.5 rounded-full">
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <span className="text-sm font-medium text-on-surface-variant bg-surface-container-low px-4 py-2 rounded-full whitespace-nowrap">
                {doneSoFar}/3 done
              </span>
              {sessionXp > 0 && (
                <div className="relative">
                  <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">bolt</span>
                    +{sessionXp} XP
                  </span>
                  {xpPop !== null && (
                    <span className="absolute -top-6 right-0 text-xs font-bold text-primary animate-bounce pointer-events-none whitespace-nowrap">
                      +{xpPop} XP
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {/* Task 1 */}
            <MissionTaskRow
              label="Task 1"
              title={mission.task1.title}
              description={mission.task1.description}
              badge={`${mission.task1.duration_minutes} min`}
              badgeClass="text-primary-container bg-primary-fixed"
              xp={20}
              done={completedToday.has('task1')}
              onOpen={() => setEditorOpen('task1')}
            />

            {/* Task 2 */}
            <MissionTaskRow
              label="Task 2"
              title={mission.task2.title}
              description={mission.task2.description}
              badge={`${mission.task2.duration_minutes} min`}
              badgeClass="text-primary-container bg-primary-fixed"
              xp={20}
              done={completedToday.has('task2')}
              onOpen={() => setEditorOpen('task2')}
            />

            {/* Practice */}
            <div className="relative">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-tertiary rounded-l-lg" />
              <MissionTaskRow
                label="Practice"
                title={mission.practice.title}
                description={mission.practice.description}
                badge={mission.practice.difficulty}
                badgeClass={
                  mission.practice.difficulty === 'beginner'
                    ? 'text-tertiary bg-tertiary-fixed'
                    : mission.practice.difficulty === 'intermediate'
                    ? 'text-amber-600 bg-amber-50'
                    : 'text-red-600 bg-red-50'
                }
                xp={30}
                done={completedToday.has('practice')}
                onOpen={() => setEditorOpen('practice')}
                indent
              />
            </div>
          </div>

          <div className="mt-12 flex justify-center">
            {allDone ? (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 text-primary font-bold text-lg">
                  <span className="material-symbols-outlined">emoji_events</span>
                  Session complete! +{sessionXp} XP earned
                </div>
                <p className="text-sm text-on-surface-variant">Come back tomorrow for Day {mission.day_number + 1}.</p>
              </div>
            ) : (
              <button
                onClick={() => {
                  if (!completedToday.has('task1')) setEditorOpen('task1');
                  else if (!completedToday.has('task2')) setEditorOpen('task2');
                  else setEditorOpen('practice');
                }}
                className="px-12 py-4 rounded-full bg-gradient-to-r from-primary to-primary-container text-on-primary font-bold text-lg shadow-lg hover:shadow-primary/20 active:scale-95 transition-all"
              >
                {doneSoFar === 0 ? 'Start Session' : 'Continue Session'}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Code editor modal */}
      {editorOpen && (
        <CodeEditor
          taskKey={editorOpen}
          taskTitle={
            editorOpen === 'task1' ? mission.task1.title :
            editorOpen === 'task2' ? mission.task2.title :
            mission.practice.title
          }
          taskDescription={
            editorOpen === 'task1' ? mission.task1.description :
            editorOpen === 'task2' ? mission.task2.description :
            mission.practice.description
          }
          planId={mission.plan_id}
          dayNumber={mission.day_number}
          roomId={activeRoom?.id}
          onSuccess={(xp) => handleTaskSuccess(editorOpen, xp)}
          onClose={() => setEditorOpen(null)}
        />
      )}
    </>
  );
}

// ── Helper ───────────────────────────────────────────────────────────────────

function completedTasks(mission: MissionData, done: Set<TaskKey>): number {
  let count = 0;
  if (mission.task1.done || done.has('task1')) count++;
  if (mission.task2.done || done.has('task2')) count++;
  if (done.has('practice')) count++;
  return count;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MissionTaskRow({
  label, title, description, badge, badgeClass, xp, done, onOpen, indent = false,
}: {
  label: string; title: string; description: string;
  badge: string; badgeClass: string; xp: number;
  done: boolean; onOpen: () => void; indent?: boolean;
}) {
  return (
    <div
      className={`flex items-center p-6 transition-all duration-300 rounded-lg group/item border ${
        done
          ? 'bg-primary/5 border-primary/10 cursor-default'
          : 'bg-surface-container-low/40 hover:bg-surface-container-low border-transparent cursor-pointer'
      } ${indent ? 'pl-8' : ''}`}
      onClick={!done ? onOpen : undefined}
    >
      {/* Circle indicator */}
      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center mr-6 shrink-0 transition-colors ${
        done
          ? 'border-primary bg-primary'
          : 'border-primary-container/30 group-hover/item:border-primary'
      }`}>
        {done
          ? <span className="material-symbols-outlined text-on-primary text-base">check</span>
          : <span className="material-symbols-outlined text-primary text-base scale-0 group-hover/item:scale-100 transition-transform">check</span>
        }
      </div>

      {/* Text */}
      <div className="flex-grow min-w-0">
        <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-wider block mb-0.5">
          {label}
        </span>
        <h3 className={`font-bold text-on-background ${done ? 'line-through text-on-surface-variant' : ''}`}>
          {title}
        </h3>
        <p className="text-sm text-on-surface-variant mt-0.5 line-clamp-1">{description}</p>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3 shrink-0 ml-4">
        <span className={`text-xs font-bold px-3 py-1 rounded-full capitalize ${badgeClass}`}>
          {badge}
        </span>
        <span className="text-xs font-semibold text-primary/60 w-10 text-right">+{xp}</span>
        <button
          onClick={(e) => { e.stopPropagation(); if (!done) onOpen(); }}
          disabled={done}
          className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full transition-all ${
            done
              ? 'bg-primary/10 text-primary cursor-default'
              : 'bg-primary text-on-primary hover:opacity-90 active:scale-95'
          }`}
        >
          {done ? 'Done' : (
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

