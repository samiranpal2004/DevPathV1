'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';

type Goal = 'job' | 'course' | 'dsa' | 'general';
type TimeOption = 15 | 20 | 30;

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
}

const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: 'What will this print?\n\nlet x = 5;\nconsole.log(typeof x);',
    options: ['5', '"number"', '"integer"', 'undefined'],
    correctIndex: 1,
  },
  {
    id: 2,
    question: 'Which loop runs at least once even if the condition is false?',
    options: ['for', 'while', 'do...while', 'forEach'],
    correctIndex: 2,
  },
  {
    id: 3,
    question: 'What does a function return if no return statement is given?',
    options: ['0', 'null', 'undefined', 'false'],
    correctIndex: 2,
  },
  {
    id: 4,
    question: 'Which of these is NOT a valid way to find a bug?',
    options: [
      'console.log()',
      'Using a debugger',
      'Deleting the code',
      'Reading error messages',
    ],
    correctIndex: 2,
  },
  {
    id: 5,
    question: 'Which data structure uses key-value pairs?',
    options: ['Array', 'Object/Map', 'Stack', 'Queue'],
    correctIndex: 1,
  },
];

const GOALS: { value: Goal; label: string; description: string }[] = [
  { value: 'job', label: '🎯 Get a Job', description: 'Prepare for technical interviews' },
  { value: 'course', label: '📚 Finish My Course', description: 'Complete a course I already started' },
  { value: 'dsa', label: '🧠 Master DSA', description: 'Learn data structures and algorithms' },
  { value: 'general', label: '🌱 General Learning', description: 'Build coding skills at my own pace' },
];

const TIME_OPTIONS: { value: TimeOption; label: string }[] = [
  { value: 15, label: '15 min — Quick daily habit' },
  { value: 20, label: '20 min — Balanced pace' },
  { value: 30, label: '30 min — Serious learner' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [answers, setAnswers] = useState<(number | null)[]>(
    Array(QUIZ_QUESTIONS.length).fill(null)
  );
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [timeOption, setTimeOption] = useState<TimeOption | null>(null);
  const [courseUrl, setCourseUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    async function checkOnboardingStatus() {
      try {
        const token = await getToken();
        if (!token) {
          setIsCheckingOnboarding(false);
          return;
        }

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          setIsCheckingOnboarding(false);
          return;
        }

        const data = await res.json();

        if (!data.data?.needsOnboarding && pathname === '/onboarding') {
          router.push('/dashboard');
          return;
        }
      } catch {
        setIsCheckingOnboarding(false);
        return;
      }

      setIsCheckingOnboarding(false);
    }

    void checkOnboardingStatus();
  }, [getToken, isLoaded, isSignedIn, pathname, router]);

  function handleAnswer(optionIndex: number) {
    const updated = [...answers];
    updated[currentQuestion] = optionIndex;
    setAnswers(updated);

    if (currentQuestion < QUIZ_QUESTIONS.length - 1) {
      setTimeout(() => setCurrentQuestion((q) => q + 1), 300);
    } else {
      setTimeout(() => setStep(2), 300);
    }
  }

  async function handleSubmit() {
    if (!goal || !timeOption) return;
    setIsSubmitting(true);
    setError(null);

    const answersPayload = QUIZ_QUESTIONS.map(
      (question, index) => answers[index] === question.correctIndex
    );

    try {
      const token = await getToken();
      if (!token) {
        setError('Authentication failed. Please sign in again.');
        setIsSubmitting(false);
        return;
      }

      const quizRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/onboarding/quiz-result`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            answers: answersPayload,
          }),
        }
      );

      if (!quizRes.ok) {
        throw new Error('Failed to save quiz');
      }

      const preferencesRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/onboarding/preferences`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            goal,
            daily_time_minutes: timeOption,
          }),
        }
      );

      if (!preferencesRes.ok) {
        throw new Error('Failed to save preferences');
      }

      if (courseUrl.trim()) {
        const parseRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/onboarding/parse-url`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ url: courseUrl.trim() }),
          }
        );

        if (!parseRes.ok) {
          throw new Error('Failed to parse course URL');
        }
      }

      router.push('/dashboard');
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

        {step === 1 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
            <p className="text-gray-400 text-sm mb-1">
              Question {currentQuestion + 1} of {QUIZ_QUESTIONS.length}
            </p>
            <h2 className="text-white font-semibold text-lg mb-6 whitespace-pre-line">
              {QUIZ_QUESTIONS[currentQuestion].question}
            </h2>
            <div className="flex flex-col gap-3">
              {QUIZ_QUESTIONS[currentQuestion].options.map((option, i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  className="w-full text-left px-4 py-3 rounded-lg border border-gray-700 text-gray-300 hover:border-green-500 hover:text-white hover:bg-gray-800 transition-all duration-150"
                >
                  {option}
                </button>
              ))}
            </div>
            <p className="text-gray-600 text-xs mt-6 text-center">
              This helps us personalise your daily plan
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
            <h2 className="text-white font-bold text-xl mb-1">What&apos;s your goal?</h2>
            <p className="text-gray-400 text-sm mb-6">
              We&apos;ll build your daily plan around this.
            </p>

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
                  <span className="block text-xs text-gray-500 mt-0.5">
                    {g.description}
                  </span>
                </button>
              ))}
            </div>

            <h2 className="text-white font-bold text-xl mb-1">Daily time budget</h2>
            <p className="text-gray-400 text-sm mb-4">
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

            <button
              disabled={!goal || !timeOption}
              onClick={() => setStep(3)}
              className="w-full py-3 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue →
            </button>
          </div>
        )}

        {step === 3 && (
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
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full py-3 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed mb-3"
            >
              {isSubmitting ? 'Setting up your plan...' : 'Start my daily plan →'}
            </button>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full py-3 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 transition-colors text-sm"
            >
              Skip — use a default plan
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
