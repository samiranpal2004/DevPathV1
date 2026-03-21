'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';

type Goal = 'job' | 'course' | 'dsa' | 'general';
type TimeOption = 15 | 20 | 30;

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

const GOALS: { value: Goal; label: string; description: string }[] = [
  { value: 'job', label: '🎯 MERN Stack / Job Prep', description: 'Prepare for technical interviews' },
  { value: 'course', label: '📚 Complete My Course', description: 'Finish a course I already started' },
  { value: 'dsa', label: '🧠 Learn DSA', description: 'Master data structures and algorithms' },
  { value: 'general', label: '🌱 General Learning', description: 'Build coding skills at my own pace' },
];

const TIME_OPTIONS: { value: TimeOption; label: string }[] = [
  { value: 15, label: '15 min — Quick daily habit' },
  { value: 20, label: '20 min — Balanced pace' },
  { value: 30, label: '30 min — Serious learner' },
];

const GOAL_LABELS: Record<Goal, string> = {
  job: 'MERN Stack / Job Prep',
  course: 'Complete My Course',
  dsa: 'Learn DSA',
  general: 'General Learning',
};

function goToDashboard() {
  window.location.href = '/dashboard';
}

export default function OnboardingPage() {
  const pathname = usePathname();
  const { getToken, isLoaded, isSignedIn } = useAuth();

  // Steps: 1 = Goal, 2 = Time, 3 = Quiz (dynamic) or URL (course)
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [timeOption, setTimeOption] = useState<TimeOption | null>(null);

  // Quiz state (for non-course goals)
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);

  // URL state (for course goal)
  const [courseUrl, setCourseUrl] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    async function checkOnboardingStatus() {
      try {
        const token = await getToken();
        if (!token) { setIsCheckingOnboarding(false); return; }

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        });

        if (!res.ok) { setIsCheckingOnboarding(false); return; }

        const data = await res.json();
        if (!data.data?.needsOnboarding && pathname === '/onboarding') {
          goToDashboard();
          return;
        }
      } catch {
        // continue to onboarding
      }
      setIsCheckingOnboarding(false);
    }

    void checkOnboardingStatus();
  }, [getToken, isLoaded, isSignedIn, pathname]);

  async function goToStep3() {
    if (!goal || !timeOption) return;

    if (goal === 'course') {
      // Course goal: skip quiz, go straight to URL input
      setStep(3);
      return;
    }

    // Other goals: fetch Gemini-generated questions
    setQuizLoading(true);
    setQuizError(null);
    setStep(3);

    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/onboarding/generate-quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ goal: GOAL_LABELS[goal] }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        if (body.error === 'quota_exceeded') {
          setQuizError('Gemini quota reached. Please try again shortly.');
        } else {
          setQuizError('Failed to load quiz. Please try again.');
        }
        setQuizLoading(false);
        return;
      }

      const data = await res.json() as { questions: QuizQuestion[] };
      setQuizQuestions(data.questions);
      setAnswers(Array(data.questions.length).fill(null));
      setCurrentQuestion(0);
    } catch {
      setQuizError('Failed to load quiz. Please try again.');
    }

    setQuizLoading(false);
  }

  function handleAnswer(optionIndex: number) {
    const updated = [...answers];
    updated[currentQuestion] = optionIndex;
    setAnswers(updated);

    if (currentQuestion < quizQuestions.length - 1) {
      setTimeout(() => setCurrentQuestion((q) => q + 1), 300);
    } else {
      setTimeout(() => void handleSubmitAfterQuiz(updated), 300);
    }
  }

  async function savePrefs(token: string) {
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    const syncRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/sync`, { method: 'POST', headers });
    if (!syncRes.ok) throw new Error('Failed to sync user');

    const preferencesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/onboarding/preferences`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ goal, daily_time_minutes: timeOption }),
    });
    if (!preferencesRes.ok) throw new Error('Failed to save preferences');
  }

  async function handleSubmitAfterQuiz(finalAnswers: (number | null)[]) {
    if (!goal || !timeOption) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) { setError('Authentication failed. Please sign in again.'); setIsSubmitting(false); return; }

      await savePrefs(token);

      const answersPayload = quizQuestions.map(
        (q, i) => finalAnswers[i] === q.correctIndex
      );

      const quizRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/onboarding/quiz-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ answers: answersPayload }),
      });
      if (!quizRes.ok) throw new Error('Failed to save quiz');

      const defaultTopics: Record<Goal, string> = {
        job: 'JavaScript interview preparation',
        course: 'JavaScript fundamentals',
        dsa: 'Data structures and algorithms',
        general: 'Python programming basics',
      };

      const topicRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/onboarding/parse-topic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ topic: defaultTopics[goal] }),
      });
      if (!topicRes.ok) throw new Error('Failed to generate plan');

      goToDashboard();
    } catch {
      setError('Something went wrong generating your plan. Please try again.');
      setIsSubmitting(false);
    }
  }

  async function handleCourseSubmit() {
    if (!goal || !timeOption) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) { setError('Authentication failed. Please sign in again.'); setIsSubmitting(false); return; }

      await savePrefs(token);

      const url = courseUrl.trim();
      if (url) {
        const parseRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/onboarding/parse-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ url }),
        });

        if (!parseRes.ok) {
          const body = await parseRes.json().catch(() => ({})) as { error?: string };
          if (body.error === 'unsupported_url') {
            setError("That URL isn't supported. Try a YouTube playlist or video link.");
          } else {
            setError("Couldn't parse that URL. Try a different one or skip to use a default plan.");
          }
          setIsSubmitting(false);
          return;
        }
      } else {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/onboarding/parse-topic`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ topic: 'JavaScript fundamentals' }),
        });
      }

      goToDashboard();
    } catch {
      setError('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  }

  async function handleCourseSkip() {
    if (!goal || !timeOption) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) { setError('Authentication failed.'); setIsSubmitting(false); return; }

      await savePrefs(token);

      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/onboarding/parse-topic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ topic: 'JavaScript fundamentals' }),
      });

      goToDashboard();
    } catch {
      setError('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  }

  if (isCheckingOnboarding) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-12">
        <p className="text-gray-400 text-sm">Loading onboarding...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Progress bar */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                s <= step ? 'bg-green-500' : 'bg-gray-800'
              }`}
            />
          ))}
        </div>

        {/* Step 1 — Goal selection */}
        {step === 1 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
            <h2 className="text-white font-bold text-xl mb-1">What&apos;s your goal?</h2>
            <p className="text-gray-400 text-sm mb-6">We&apos;ll build your daily plan around this.</p>

            <div className="flex flex-col gap-3 mb-8">
              {GOALS.map((g) => (
                <button
                  key={g.value}
                  onClick={() => setGoal(g.value)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-all duration-150 ${
                    goal === g.value
                      ? 'border-green-500 bg-green-500/10 text-white'
                      : 'border-gray-700 text-gray-300 hover:border-gray-600'
                  }`}
                >
                  <span className="font-medium">{g.label}</span>
                  <span className="block text-xs text-gray-500 mt-0.5">{g.description}</span>
                </button>
              ))}
            </div>

            <button
              disabled={!goal}
              onClick={() => setStep(2)}
              className="w-full py-3 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue →
            </button>
          </div>
        )}

        {/* Step 2 — Time budget */}
        {step === 2 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
            <h2 className="text-white font-bold text-xl mb-1">Daily time budget</h2>
            <p className="text-gray-400 text-sm mb-6">
              We&apos;ll make sure every day fits in this window.
            </p>

            <div className="flex flex-col gap-3 mb-8">
              {TIME_OPTIONS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTimeOption(t.value)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-all duration-150 ${
                    timeOption === t.value
                      ? 'border-green-500 bg-green-500/10 text-white'
                      : 'border-gray-700 text-gray-300 hover:border-gray-600'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="py-3 px-5 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 transition-colors text-sm"
              >
                ← Back
              </button>
              <button
                disabled={!timeOption}
                onClick={() => void goToStep3()}
                className="flex-1 py-3 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Quiz (non-course) */}
        {step === 3 && goal !== 'course' && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
            {quizLoading && (
              <div className="flex flex-col items-center py-8 gap-4">
                <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-400 text-sm">Personalising your skill quiz...</p>
              </div>
            )}

            {quizError && !quizLoading && (
              <div className="flex flex-col gap-4">
                <p className="text-red-400 text-sm">{quizError}</p>
                <button
                  onClick={() => void goToStep3()}
                  className="w-full py-3 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-500 transition-colors"
                >
                  Retry
                </button>
                <button
                  onClick={() => setStep(2)}
                  className="w-full py-3 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 transition-colors text-sm"
                >
                  ← Back
                </button>
              </div>
            )}

            {!quizLoading && !quizError && quizQuestions.length > 0 && (
              <>
                <p className="text-gray-400 text-sm mb-1">
                  Question {currentQuestion + 1} of {quizQuestions.length}
                </p>
                <h2 className="text-white font-semibold text-lg mb-6 whitespace-pre-line">
                  {quizQuestions[currentQuestion].question}
                </h2>
                <div className="flex flex-col gap-3">
                  {quizQuestions[currentQuestion].options.map((option, i) => (
                    <button
                      key={i}
                      onClick={() => handleAnswer(i)}
                      disabled={isSubmitting}
                      className="w-full text-left px-4 py-3 rounded-lg border border-gray-700 text-gray-300 hover:border-green-500 hover:text-white hover:bg-gray-800 transition-all duration-150 disabled:opacity-40"
                    >
                      {option}
                    </button>
                  ))}
                </div>
                {error && !isSubmitting && (
                  <p className="text-red-400 text-sm mt-4 text-center">{error}</p>
                )}
                {isSubmitting && (
                  <p className="text-gray-500 text-xs text-center mt-6">
                    Building your personalised plan...
                  </p>
                )}
                {!isSubmitting && !error && (
                  <p className="text-gray-600 text-xs mt-6 text-center">
                    This helps us personalise your daily plan
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Step 3 — URL input (course goal) */}
        {step === 3 && goal === 'course' && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
            <h2 className="text-white font-bold text-xl mb-1">Got a course? Paste it in.</h2>
            <p className="text-gray-400 text-sm mb-6">
              We&apos;ll build your 30-day plan from the actual video content. YouTube playlists work best.
            </p>

            <input
              type="url"
              value={courseUrl}
              onChange={(e) => setCourseUrl(e.target.value)}
              placeholder="https://youtube.com/playlist?list=..."
              className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition-colors mb-3"
            />

            <p className="text-gray-600 text-xs mb-8">
              Supports YouTube videos, playlists, and Udemy courses.
              You can also skip this and we&apos;ll build a default plan.
            </p>

            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

            <button
              onClick={() => void handleCourseSubmit()}
              disabled={isSubmitting}
              className="w-full py-3 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed mb-3"
            >
              {isSubmitting ? 'Building your plan...' : 'Start my daily plan →'}
            </button>

            <button
              onClick={() => void handleCourseSkip()}
              disabled={isSubmitting}
              className="w-full py-3 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 transition-colors text-sm"
            >
              Skip — use a default plan
            </button>

            {isSubmitting && courseUrl.trim() && (
              <p className="text-gray-500 text-xs text-center mt-4">
                Gemini is watching your video and building your plan… this takes a few seconds.
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
