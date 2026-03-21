# DevPath — System Architecture & Structural Flow

## Overview

DevPath has 9 layers from user entry to database persistence.
Every user action — solo or inside a room — flows through this architecture.

```
USER ENTRY
    │
    ▼
LAYER 1: Entry points (3 paths)
    │
    ▼
LAYER 2: Gemini video parser pipeline (4 steps)
    │
    ▼
LAYER 3: Daily mission generator
    │
    ├──────────────────────┐
    ▼                      ▼
LAYER 4: Day modes    LAYER 5: Stuck detection
    │                      │
    └──────────┬───────────┘
               ▼
LAYER 6: Room system (6 types)
               │
               ▼
LAYER 7: Gamification engine (6 sub-layers)
               │
               ▼
LAYER 8: Contribution heatmap (personal profile)
               │
               ▼
LAYER 9: PostgreSQL persistence
```

---

## Layer 1 — Entry points

Three distinct paths into the system. All converge at the daily mission.

### Path A — New learner
```
Sign up (Google / email)
    → 5-question skill quiz
    → Placed into tier: Beginner | Familiar | Intermediate
    → Goal selection: Job prep | Complete my course | DSA | General
    → Time budget: 15 | 20 | 30 min/day
    → (Optional) Paste YouTube/Udemy URL
    → Plan preview (first 3 days shown)
    → Daily mission begins
```

### Path B — Returning user
```
Log in
    → Today's daily mission displayed immediately
    → No configuration needed
    → Streak status shown (current count, freeze available?)
    → Room leaderboard visible if in an active room
```

### Path C — Room invite
```
Receive 6-digit code (KGEC42) via WhatsApp/link
    → Visit devpath.app/join/KGEC42
    → Preview room (type, current members, standings)
    → Accept invite
    → room_members row created
    → User's daily plan syncs to room curriculum
    → Live race begins
```

---

## Layer 2 — Gemini video parser pipeline

**This replaces YouTube Data API v3 entirely.**
Gemini natively understands YouTube videos — no transcript extraction needed.

### Step 2.1 — URL detection
```javascript
// Regex classifier
const YOUTUBE_PLAYLIST = /youtube\.com\/playlist\?list=([A-Za-z0-9_-]+)/;
const YOUTUBE_VIDEO = /youtube\.com\/watch\?v=([A-Za-z0-9_-]+)/;
const YOUTUBE_SHORT = /youtu\.be\/([A-Za-z0-9_-]+)/;
const UDEMY_COURSE = /udemy\.com\/course\/([a-z0-9-]+)/;
// If none match → topic-name fallback
```

### Step 2.2 — Gemini video comprehension
```
URL → Gemini 1.5 Pro API
Model: gemini-1.5-pro
Input: YouTube URL (direct — no preprocessing)
Output: JSON with concepts, timestamps, code examples, prerequisites

NOTE: Gemini can only process public YouTube videos.
Unlisted or age-gated → trigger topic-name fallback.
```

### Step 2.3 — Structured curriculum generation
```
Gemini comprehension JSON
    → Second Gemini call (gemini-1.5-pro)
    → Prompt: "Group into 15-20 min daily blocks,
               infer difficulty progression,
               generate Task1 + Task2 + practice problem per checkpoint"
    → Returns: structured daily_plan JSON (see DB schema for shape)
```

### Step 2.4 — Cache and store
```
Generated plan → daily_plans table (status: "generated")
Cache key: hash(url + user_id + skill_tier)
On cache hit: return stored plan immediately (0 latency)
On cache miss: trigger Gemini parse (3-8 seconds)

DEMO DAY RULE: Pre-run parse for Traversy Media JS playlist.
Store result the night before. Demo shows instant result.
```

### Fallback chain
```
YouTube URL parse success?
    YES → proceed
    NO  → Udemy URL parse?
              YES → extract section titles → Gemini structures them
              NO  → Show "Enter topic name" input
                        → Gemini generates default curriculum for topic
```

---

## Layer 3 — Daily mission generator

Queries the user's current position in their `daily_plans` JSON
and serves the correct day's checkpoint.

### Mission components
```
Task 1: Core concept (~10 min)
├── Checkpoint clip from video (linked timestamp)
├── AI-generated concept summary (2-3 sentences)
└── 3-question comprehension check

Task 2: Reinforcement activity (~5 min)
├── Mini coding exercise
├── Runs in Monaco editor (in-browser)
└── Expected output shown for self-verification

Practice problem: (~10 min)
├── Coding challenge matched to today's topic
├── Difficulty: based on user's skill_tier + attempt history
├── Monaco editor with test cases
└── "I'm stuck" button → Layer 5 (stuck detection)
```

### Mission generation logic
```javascript
async function getTodayMission(userId) {
    const pref = await getUserPreferences(userId);
    const plan = await getActivePlan(userId);
    const dayNum = calculateCurrentDay(pref.start_date);
    const checkpoint = plan.checkpoints[dayNum - 1];
    return buildMission(checkpoint, pref.skill_tier);
}
```

---

## Layer 4 — Day modes

Determined by what the user does (or doesn't do) before midnight.

```
User opens app
    │
    ├── Completes all 3 tasks → NORMAL DAY
    │       Streak +1, up to 95 XP, perfect day check
    │
    ├── Presses "Busy today" → BUSY DAY
    │       Single 5-min micro-task served
    │       Streak preserved (uses 1 freeze)
    │       +5 XP awarded
    │
    ├── Presses "Skip day" → SKIP DAY
    │       No task required
    │       Streak preserved (uses 1 freeze)
    │       0 XP awarded
    │
    ├── Completes all 3 in one session → PERFECT DAY
    │       Streak +1, 1.2× XP multiplier applied to whole day
    │       "Perfect day" square on heatmap (purple)
    │
    └── Does nothing by midnight → MISSED DAY
            Streak broken (unless freeze available)
            Recovery window: if streak ≥7 days, 24h window to catch up
```

### Freeze mechanics
```
freeze_count starts at 1
Busy day or Skip day: freeze_count - 1 → streak preserved
freeze_count = 0: streak breaks on next Busy/Skip
Freeze recharges: freeze_count + 1 after 7 days of normal activity
Max freeze_count: 1 (only one freeze available at any time)
```

---

## Layer 5 — Stuck detection

### v1 (hackathon) — self-report
```
User presses "I'm stuck"
    │
    ├── Collect context:
    │       - problem_id and problem text
    │       - user's current topic (from daily_plans)
    │       - last 3 practice_attempts rows (passed, error_type)
    │       - skill_tier
    │
    └── Gemini 1.5 Flash call:
            Prompt: "The learner is stuck on {topic}. 
                     Problem: {problem}. 
                     Their recent errors: {error_types}.
                     Give a targeted 3-step micro-lesson 
                     that directly addresses their error pattern.
                     Do not solve the problem. Guide them."
            → Display micro-lesson inline
            → Log hint_used = true in practice_attempts
```

### v2 (post-hackathon) — automatic detection
```
On every practice_attempt save:
    Check: user_id + topic → last 3 attempts all failed?
        YES → auto-trigger micro-lesson (no button press needed)
              Inject into mission UI
              Log: auto_intervention = true
        NO  → continue normally
```

---

## Layer 6 — Room system

### Room state machine
```
PENDING (created, waiting for members)
    → ACTIVE (≥2 members, race in progress)
    → COMPLETED (room type duration elapsed OR all members finished)
    → ARCHIVED (30 days after completion)
```

### Daily sprint flow (MVP room type)
```
Midnight: room resets for new day
    → All members get same checkpoint from room's curriculum
    → Live leaderboard initialised (all 0%)
    → First member to complete Task 1 → leaderboard updates
    → First member to complete all 3 → +25 XP first-finish bonus
    → Real-time: Supabase channel broadcasts on room_daily_log INSERT
    → Activity feed: each completion event → room_events INSERT
    → Nudge: any member can nudge another if they haven't started by 8 PM
```

### Real-time architecture
```
Client (Next.js)
    → Supabase Realtime channel: `room:{room_id}`
    → Listens for: room_daily_log changes, room_events inserts
    → On event: update local leaderboard state (no refetch needed)
    → Fallback: if Realtime fails → poll every 10 seconds
```

### Room code generation
```javascript
import crypto from 'crypto';

function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from(crypto.randomBytes(6))
        .map((byte) => chars[byte % chars.length])
        .join('');
}
// e.g. KGEC42, AB7X91
// Store in rooms.code with UNIQUE constraint
```

---

## Layer 7 — Gamification engine

### XP flow
```
User completes an action
    → INSERT into xp_events (user_id, amount, reason, task_id, room_id)
    → Trigger: REFRESH MATERIALIZED VIEW user_xp_totals
    → Check: new total_xp crosses a level threshold?
              YES → level_up event → badge check → animation trigger
    → Check: streak milestone?
              YES → badge award → milestone XP bonus → share card prompt
    → Frontend polls /api/me/xp every 30s (or on action completion)
```

### Level-up trigger logic
```javascript
const LEVEL_THRESHOLDS = { 1: 0, 2: 200, 3: 600, 4: 1400, 5: 3000 };

function checkLevelUp(userId, oldXp, newXp) {
    for (const [level, threshold] of Object.entries(LEVEL_THRESHOLDS)) {
        if (oldXp < threshold && threshold <= newXp) {
            awardLevelUp(userId, Number(level));
            checkAndAwardBadges(userId, { event: 'level_up', level: Number(level) });
        }
    }
}
```

### Badge award logic (idempotent)
```javascript
async function awardBadge(userId, badgeKey) {
    // UNIQUE constraint on (user_id, badge_key) prevents duplicates
    await db.query(
        `
            INSERT INTO badges (user_id, badge_key, awarded_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (user_id, badge_key) DO NOTHING
        `,
        [userId, badgeKey]
    );
}
```

---

## Layer 8 — Contribution heatmap

### Data flow
```
Any user action (task complete, problem solve, quest done, room win)
    → INSERT into contribution_events (user_id, date, event_type, delta)
    → Trigger: UPSERT into contributions (user_id, date, count, intensity, types)
    → contributions.count += delta
    → contributions.intensity = calculate_intensity(count)
    → contributions.types (JSON) updated with event_type

Intensity scale:
    0 = no activity
    1 = 1-2 actions (lightest green)
    2 = 3-4 actions
    3 = 5-7 actions
    4 = 8+ actions (darkest green)
    5 = special day (purple/gold/orange/blue override)
```

### Heatmap query
```sql
-- Called once on profile page load
SELECT date, count, intensity, types
FROM contributions
WHERE user_id = $1
  AND date >= NOW() - INTERVAL '365 days'
ORDER BY date ASC;
-- Returns 365 rows max — fast, no joins needed
```

### Filter mode logic (frontend, no refetch)
```typescript
// All filter modes work on the same fetched data
// Just change which sub-count to use for intensity calculation
const getIntensity = (day: DayData, filter: FilterMode): number => {
  const val = filter === 'solo'   ? day.types.solo   :
              filter === 'room'   ? day.types.room   :
              filter === 'quests' ? day.types.quests :
              day.count;  // 'all' mode
  if (val <= 0) return 0;
  if (val <= 2) return 1;
  if (val <= 4) return 2;
  if (val <= 7) return 3;
  return 4;
};
```

---

## Layer 9 — PostgreSQL persistence

See @docs/db-schema.md for full table definitions.

### Write paths (what writes to what)
```
Task completion    → xp_events + daily_logs + contribution_events
Practice attempt   → practice_attempts + xp_events (if solved)
Streak update      → user_preferences.streak_count + xp_events (if milestone)
Badge award        → badges (idempotent INSERT)
Room event         → room_events + room_daily_log + xp_events
Contribution       → contribution_events → contributions (via trigger)
Level up           → user_xp_totals (materialized view refresh)
```

### Read paths (what the frontend queries)
```
Dashboard load     → daily_plans + user_preferences + user_xp_totals
Heatmap load       → contributions (365 rows, aggregated)
Room leaderboard   → room_daily_log JOIN users (real-time via Supabase)
Profile page       → users + user_xp_totals + badges + contributions
Leaderboard        → user_xp_totals (weekly_xp, opt-in only, Level 5+)
```

---

## API endpoint map

### Auth
```
POST /api/auth/signup
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

### Onboarding
```
POST /api/onboarding/quiz-result
POST /api/onboarding/preferences
POST /api/onboarding/parse-url    ← calls Gemini pipeline
GET  /api/onboarding/plan-preview
```

### Daily mission
```
GET  /api/mission/today
POST /api/mission/complete-task
POST /api/mission/submit-practice
POST /api/mission/stuck           ← calls Gemini Flash
POST /api/mission/busy-day
POST /api/mission/skip-day
```

### Rooms
```
POST /api/rooms/create
POST /api/rooms/join
GET  /api/rooms/:id/leaderboard
GET  /api/rooms/:id/feed
POST /api/rooms/:id/nudge/:user_id
```

### Gamification
```
GET  /api/me/xp
GET  /api/me/streak
GET  /api/me/badges
GET  /api/me/level
GET  /api/quests/today
POST /api/quests/:id/complete
```

### Heatmap
```
GET  /api/heatmap/:user_id        ← returns 365 contribution rows
GET  /api/profile/:username       ← public profile page data
```
