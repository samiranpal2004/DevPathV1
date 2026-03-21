import 'dotenv/config';

import { supabaseAdmin } from '../lib/supabase';

const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_PLAN_ID = '00000000-0000-0000-0000-000000000101';
const TRAVERSY_SOURCE_URL = 'https://www.youtube.com/playlist?list=PLillGF-RfqbYhQsN5WMXy6VsDMKGadrJ-';

type Difficulty = 'beginner' | 'familiar' | 'intermediate';

interface PlanCheckpoint {
  day: number;
  title: string;
  concepts: string[];
  task1: {
    title: string;
    description: string;
    duration_minutes: number;
    timestamp: string;
  };
  task2: {
    title: string;
    description: string;
    duration_minutes: number;
  };
  practice: {
    title: string;
    description: string;
    starter_code: string;
    test_cases: string[];
    difficulty: Difficulty;
  };
}

function buildDetailedDays(): PlanCheckpoint[] {
  const day1: PlanCheckpoint = {
    day: 1,
    title: 'Variables and Data Types',
    concepts: ['var/let/const', 'primitive types', 'typeof operator', 'reassignment rules'],
    task1: {
      title: 'Refactor var to let/const',
      description: 'Rewrite a short script from var-heavy style to modern let/const and explain each choice.',
      duration_minutes: 18,
      timestamp: '00:03:20',
    },
    task2: {
      title: 'Type inspector mini-table',
      description: 'Create a tiny script that prints value and typeof for strings, numbers, booleans, null, and undefined.',
      duration_minutes: 15,
    },
    practice: {
      title: 'Input type detective',
      description: 'Write a function that returns a clean type label for any input (handle null correctly).',
      starter_code: 'function detectType(value) {\n  // TODO\n}\n',
      test_cases: [
        'detectType(42) -> "number"',
        'detectType(null) -> "null"',
        'detectType("devpath") -> "string"',
      ],
      difficulty: 'beginner',
    },
  };

  const day2: PlanCheckpoint = {
    day: 2,
    title: 'Functions and Scope',
    concepts: ['function declaration', 'function expression', 'block scope', 'global vs local scope'],
    task1: {
      title: 'Convert declarations and expressions',
      description: 'Implement the same utility as declaration, expression, and arrow function to compare behavior.',
      duration_minutes: 20,
      timestamp: '00:12:10',
    },
    task2: {
      title: 'Scope tracing exercise',
      description: 'Read a nested scope snippet and annotate which variables are accessible at each level.',
      duration_minutes: 15,
    },
    practice: {
      title: 'Safe counter factory',
      description: 'Build a counter using closure so count is private and can only be changed via returned methods.',
      starter_code:
        'function createCounter() {\n  let count = 0;\n  return {\n    increment() {\n      // TODO\n    },\n    get() {\n      // TODO\n    }\n  };\n}\n',
      test_cases: ['counter.get() starts at 0', 'counter.increment() updates count', 'count is not directly accessible'],
      difficulty: 'familiar',
    },
  };

  const day3: PlanCheckpoint = {
    day: 3,
    title: 'Arrays and Loops',
    concepts: ['array basics', 'push/pop/map/filter', 'for loop', 'forEach loop'],
    task1: {
      title: 'Loop conversion challenge',
      description: 'Take one for-loop solution and rewrite it with forEach and map where appropriate.',
      duration_minutes: 18,
      timestamp: '00:24:45',
    },
    task2: {
      title: 'Method drill: map + filter',
      description: 'Use map and filter together to transform a list of scores into pass labels.',
      duration_minutes: 16,
    },
    practice: {
      title: 'Top scorer report',
      description: 'Given an array of student-score objects, return sorted names of students with score >= 80.',
      starter_code: 'function topScorers(items) {\n  // TODO\n}\n',
      test_cases: ['Returns [] for empty input', 'Returns names sorted alphabetically', 'Excludes scores below 80'],
      difficulty: 'familiar',
    },
  };

  return [day1, day2, day3];
}

function buildPlaceholderDay(day: number): PlanCheckpoint {
  const difficulty: Difficulty = day < 10 ? 'beginner' : day < 20 ? 'familiar' : 'intermediate';

  return {
    day,
    title: `JavaScript Sprint Day ${day}`,
    concepts: ['core revision', 'hands-on coding', 'practice problem'],
    task1: {
      title: `Core concept review ${day}`,
      description: 'Review the assigned concept clip and summarize one practical takeaway in your own words.',
      duration_minutes: 15,
      timestamp: '00:00:00',
    },
    task2: {
      title: `Guided coding task ${day}`,
      description: 'Implement a small coding exercise tied to today\'s topic and run through edge cases.',
      duration_minutes: 20,
    },
    practice: {
      title: `Practice checkpoint ${day}`,
      description: 'Solve one focused practice problem and note one bug you fixed while solving it.',
      starter_code: 'function solve(input) {\n  // TODO\n}\n',
      test_cases: ['Handles basic input', 'Handles edge case input'],
      difficulty,
    },
  };
}

function buildThirtyDayPlan(): PlanCheckpoint[] {
  const checkpoints = buildDetailedDays();

  for (let day = 4; day <= 30; day += 1) {
    checkpoints.push(buildPlaceholderDay(day));
  }

  return checkpoints;
}

async function run(): Promise<void> {
  console.log('🧠 Checking demo plan cache...');

  const { data: existingPlans, error: lookupError } = await supabaseAdmin
    .from('daily_plans')
    .select('id')
    .eq('user_id', DEMO_USER_ID)
    .ilike('source_url', '%traversy%')
    .limit(1);

  if (lookupError) {
    throw new Error(`Failed to check existing plan cache: ${lookupError.message}`);
  }

  if (existingPlans && existingPlans.length > 0) {
    console.log('Cache hit — already cached');
    return;
  }

  const checkpoints = buildThirtyDayPlan();

  const { error: insertError } = await supabaseAdmin.from('daily_plans').upsert(
    {
      id: DEMO_PLAN_ID,
      user_id: DEMO_USER_ID,
      source_url: TRAVERSY_SOURCE_URL,
      source_type: 'youtube_playlist',
      title: 'JavaScript Crash Course — 30 Day DevPath Plan',
      total_days: 30,
      current_day: 1,
      status: 'active',
      checkpoints,
      generated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  if (insertError) {
    throw new Error(`Failed to cache demo daily plan: ${insertError.message}`);
  }

  console.log('Plan cached successfully — demo is ready');
}

run()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown precache error';
    console.error(`❌ Precache failed: ${message}`);
    process.exit(1);
  });
