'use client';

import { useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import dynamic from 'next/dynamic';
import type { editor } from 'monaco-editor';

// Load Monaco only on client — SSR breaks it
const Editor = dynamic(
  () => import('@monaco-editor/react').then((m) => m.default),
  { ssr: false, loading: () => <EditorSkeleton /> }
);

function EditorSkeleton() {
  return (
    <div className="w-full h-[380px] bg-[#1e1e1e] flex items-center justify-center">
      <div className="flex items-center gap-2 text-white/30 text-sm">
        <span className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
        Loading editor…
      </div>
    </div>
  );
}

const LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'go', label: 'Go' },
];

const STARTERS: Record<string, string> = {
  javascript: '// Write your solution here\n\n',
  typescript: '// Write your solution here\n\n',
  python: '# Write your solution here\n\n',
  java: 'public class Solution {\n    public static void main(String[] args) {\n        // Write your solution here\n    }\n}\n',
  cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your solution here\n    return 0;\n}\n',
  go: 'package main\n\nimport "fmt"\n\nfunc main() {\n    // Write your solution here\n    fmt.Println("Hello")\n}\n',
};

export interface EvalResult {
  passed: boolean;
  score: number;
  feedback: string;
  hints: string[];
  xpAwarded: number;
  newTotalXp: number;
}

interface Props {
  taskKey: 'task1' | 'task2' | 'practice';
  taskTitle: string;
  taskDescription: string;
  planId: string;
  dayNumber: number;
  roomId?: string | null;
  onSuccess: (xp: number) => void;
  onClose: () => void;
}

export function CodeEditor({
  taskKey, taskTitle, taskDescription, planId, dayNumber, roomId, onSuccess, onClose,
}: Props) {
  const { getToken } = useAuth();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const codeRef = useRef<string>(STARTERS['javascript'] ?? '');

  const [language, setLanguage] = useState('javascript');
  const [editorKey, setEditorKey] = useState(0); // remount editor on language change
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<EvalResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleLanguageChange(lang: string) {
    const current = codeRef.current.trim();
    const isStarter = Object.values(STARTERS).map((s) => s.trim()).includes(current);
    if (!current || isStarter) {
      codeRef.current = STARTERS[lang] ?? '';
      setEditorKey((k) => k + 1); // force remount with new default value
    }
    setLanguage(lang);
  }

  function handleEditorMount(ed: editor.IStandaloneCodeEditor) {
    editorRef.current = ed;
    // Listen for content changes via the model, not onChange prop (avoids React re-render lag)
    ed.onDidChangeModelContent(() => {
      codeRef.current = ed.getValue();
    });
    // Auto-focus so user can type immediately
    ed.focus();
  }

  async function handleSubmit() {
    const code = editorRef.current?.getValue() ?? codeRef.current;
    if (!code.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setResult(null);
    setError(null);

    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/mission/evaluate-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          code,
          language,
          task_title: taskTitle,
          task_description: taskDescription,
          plan_id: planId,
          day_number: dayNumber,
          task_key: taskKey,
          room_id: roomId ?? undefined,
        }),
      });

      if (res.status === 429) { setError('Gemini quota reached. Try again in a moment.'); return; }
      if (!res.ok) { setError('Evaluation failed. Please try again.'); return; }

      const data = await res.json() as { data: EvalResult };
      setResult(data.data);
      if (data.data.passed) onSuccess(data.data.xpAwarded);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    // Backdrop — clicking outside closes modal
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Modal — NO overflow-hidden so Monaco events aren't blocked */}
      <div className="w-full max-w-4xl bg-[#1e1e1e] rounded-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: '92vh' }}>

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-center gap-4 px-5 py-4 bg-[#252526] rounded-t-2xl border-b border-white/5 shrink-0">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold tracking-widest text-white/30 uppercase mb-0.5">
              {taskKey === 'practice' ? 'Practice' : taskKey === 'task1' ? 'Task 1' : 'Task 2'}
            </p>
            <h3 className="text-white font-semibold text-sm truncate">{taskTitle}</h3>
          </div>

          {/* Language picker */}
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="text-xs font-medium bg-[#3c3c3c] text-white/80 border border-white/10 rounded-md px-3 py-1.5 focus:outline-none focus:border-white/30 cursor-pointer"
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>

          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* ── Task brief ─────────────────────────────────────── */}
        <div className="px-5 py-3 bg-[#2d2d2d] border-b border-white/5 shrink-0">
          <p className="text-white/50 text-xs leading-relaxed">{taskDescription}</p>
        </div>

        {/* ── Monaco editor — explicit pixel height, no overflow-hidden ── */}
        <div className="shrink-0" style={{ height: '380px' }}>
          <Editor
            key={editorKey}
            height={380}
            language={language}
            defaultValue={codeRef.current}
            onMount={handleEditorMount}
            theme="vs-dark"
            options={{
              fontSize: 14,
              lineHeight: 22,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              padding: { top: 14, bottom: 14 },
              fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
              fontLigatures: true,
              cursorBlinking: 'smooth',
              renderLineHighlight: 'gutter',
              tabSize: 2,
              wordWrap: 'on',
              automaticLayout: true, // reflow on container resize
              scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
            }}
          />
        </div>

        {/* ── Result ─────────────────────────────────────────── */}
        {result && (
          <div className={`px-5 py-4 border-t border-white/5 shrink-0 ${result.passed ? 'bg-green-950/50' : 'bg-amber-950/30'}`}>
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${result.passed ? 'bg-green-500/20' : 'bg-amber-500/20'}`}>
                <span className={`material-symbols-outlined text-base ${result.passed ? 'text-green-400' : 'text-amber-400'}`}>
                  {result.passed ? 'check_circle' : 'info'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold mb-1 ${result.passed ? 'text-green-400' : 'text-amber-400'}`}>
                  {result.passed ? `Passed — +${result.xpAwarded} XP earned` : `Score: ${result.score}/100 — Keep going`}
                </p>
                <p className="text-white/55 text-xs leading-relaxed">{result.feedback}</p>
                {result.hints.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {result.hints.map((hint, i) => (
                      <li key={i} className="text-xs text-amber-300/70 flex gap-1.5">
                        <span className="shrink-0 mt-0.5">→</span>
                        <span>{hint}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {result.passed && (
                <button
                  onClick={onClose}
                  className="shrink-0 text-xs font-semibold text-green-400 border border-green-500/30 rounded-full px-4 py-1.5 hover:bg-green-500/10 transition-colors"
                >
                  Done ✓
                </button>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="px-5 py-3 border-t border-white/5 bg-red-950/30 shrink-0">
            <p className="text-red-400 text-xs flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">error</span>
              {error}
            </p>
          </div>
        )}

        {/* ── Footer ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3 bg-[#252526] rounded-b-2xl border-t border-white/5 shrink-0">
          <span className="text-white/25 text-xs">
            {taskKey === 'practice' ? '+30 XP on pass' : '+20 XP on pass'}
          </span>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="text-xs text-white/40 hover:text-white/70 transition-colors">
              Cancel
            </button>
            <button
              onClick={() => void handleSubmit()}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 rounded-full bg-primary text-on-primary text-xs font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                  Evaluating…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">send</span>
                  Submit
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
