# DevPath — Database Schema

**Database:** PostgreSQL (hosted on Supabase)
**Total tables:** 13
**Critical rule:** XP is NEVER a mutable counter.
Every XP award is a new row in `xp_events`. Never update a running total directly.

---

## Table dependency order (create in this order)

1. users
2. user_preferences
3. daily_plans
4. practice_attempts
5. xp_events
6. user_xp_totals (materialized view — after xp_events)
7. badges
8. rooms
9. room_members
10. room_daily_log
11. room_events
12. contribution_events
13. contributions (after contribution_events)

---

## Full SQL

```sql
-- ================================================================
-- 1. USERS
-- Core identity table. Minimal — all preferences in user_preferences.
-- ================================================================
CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email               TEXT UNIQUE NOT NULL,
    display_name        TEXT NOT NULL,
    username            TEXT UNIQUE,             -- for public profile URL
    avatar_url          TEXT,
    gamification_on     BOOLEAN DEFAULT TRUE,    -- toggle for gamification UI
    leaderboard_opt_in  BOOLEAN DEFAULT FALSE,   -- never forced
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 2. USER_PREFERENCES
-- Onboarding data + streak tracking. One row per user.
-- ================================================================
CREATE TABLE user_preferences (
    user_id             UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    skill_tier          TEXT CHECK (skill_tier IN ('beginner', 'familiar', 'intermediate')),
    goal                TEXT CHECK (goal IN ('job', 'course', 'dsa', 'general')),
    daily_time_minutes  INTEGER DEFAULT 20,      -- 15 | 20 | 30
    streak_count        INTEGER DEFAULT 0,
    longest_streak      INTEGER DEFAULT 0,
    freeze_count        INTEGER DEFAULT 1,       -- max 1 at a time, recharges after 7 days
    freeze_last_used    DATE,
    last_active_date    DATE,
    start_date          DATE DEFAULT CURRENT_DATE,
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 3. DAILY_PLANS
-- The generated curriculum. Stored as JSON after Gemini parse.
-- One plan per user (or per room + user). Reused across days.
-- ================================================================
CREATE TABLE daily_plans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    room_id         UUID,                        -- NULL for solo plans
    source_url      TEXT,                        -- the YouTube/Udemy URL
    source_type     TEXT CHECK (source_type IN ('youtube_video', 'youtube_playlist', 'udemy', 'topic', 'default')),
    title           TEXT NOT NULL,
    total_days      INTEGER NOT NULL,
    current_day     INTEGER DEFAULT 1,
    status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
    checkpoints     JSONB NOT NULL,              -- array of checkpoint objects (see shape below)
    generated_at    TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

-- checkpoints JSON shape:
-- [
--   {
--     "day": 1,
--     "title": "Variables and Data Types",
--     "concepts": ["var", "let", "const", "typeof"],
--     "task1": {
--       "title": "Watch: Variables explained",
--       "description": "...",
--       "duration_minutes": 10,
--       "timestamp": "0:00"
--     },
--     "task2": {
--       "title": "Exercise: Declare 5 variables",
--       "description": "...",
--       "duration_minutes": 5
--     },
--     "practice": {
--       "title": "Fix the broken code",
--       "description": "...",
--       "starter_code": "...",
--       "test_cases": ["..."],
--       "difficulty": "beginner"
--     }
--   }
-- ]

-- ================================================================
-- 4. PRACTICE_ATTEMPTS
-- Every code submission. Powers stuck detection.
-- ================================================================
CREATE TABLE practice_attempts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    plan_id         UUID REFERENCES daily_plans(id),
    day_number      INTEGER NOT NULL,
    passed          BOOLEAN NOT NULL,
    hint_used       BOOLEAN DEFAULT FALSE,       -- pressed "I'm stuck"
    auto_hint       BOOLEAN DEFAULT FALSE,       -- auto-triggered (v2)
    attempt_count   INTEGER DEFAULT 1,
    error_type      TEXT,                        -- e.g. "scope_error", "type_error", "logic_error"
    submitted_code  TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_practice_user_day ON practice_attempts(user_id, day_number);
CREATE INDEX idx_practice_error ON practice_attempts(user_id, error_type, passed);

-- ================================================================
-- 5. XP_EVENTS
-- Immutable log. Every XP award is a new row. NEVER update existing rows.
-- ================================================================
CREATE TABLE xp_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    amount      INTEGER NOT NULL,
    reason      TEXT NOT NULL,   -- e.g. 'task_complete', 'practice_solved', 'streak_bonus'
    task_id     UUID,            -- reference to which task/day triggered this
    room_id     UUID,            -- NULL for solo events
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_xp_user ON xp_events(user_id, created_at DESC);
CREATE INDEX idx_xp_weekly ON xp_events(user_id, created_at)
    WHERE created_at >= date_trunc('week', NOW());

-- ================================================================
-- 6. USER_XP_TOTALS (MATERIALIZED VIEW)
-- Precomputed totals for fast leaderboard queries.
-- Never write to this directly — it is refreshed by trigger.
-- ================================================================
CREATE MATERIALIZED VIEW user_xp_totals AS
SELECT
    user_id,
    SUM(amount)                                          AS total_xp,
    SUM(CASE WHEN created_at >= date_trunc('week', NOW())
             THEN amount ELSE 0 END)                     AS weekly_xp,
    date_trunc('week', NOW())                            AS week_start,
    CASE
        WHEN SUM(amount) >= 3000 THEN 5
        WHEN SUM(amount) >= 1400 THEN 4
        WHEN SUM(amount) >= 600  THEN 3
        WHEN SUM(amount) >= 200  THEN 2
        ELSE 1
    END                                                  AS level
FROM xp_events
GROUP BY user_id;

CREATE UNIQUE INDEX ON user_xp_totals(user_id);

-- Refresh on every XP insert
CREATE OR REPLACE FUNCTION refresh_xp_totals()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_xp_totals;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_refresh_xp
AFTER INSERT ON xp_events
FOR EACH STATEMENT EXECUTE FUNCTION refresh_xp_totals();

-- ================================================================
-- 7. BADGES
-- Permanent records. Idempotent — never awarded twice to same user.
-- ================================================================
CREATE TABLE badges (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    badge_key   TEXT NOT NULL,    -- e.g. 'week_warrior', 'pure_instinct'
    awarded_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, badge_key)   -- prevents duplicate awards
);

-- Valid badge_key values:
-- first_step, problem_solver, course_linked,
-- week_warrior, on_fire, legend,
-- life_happens, comeback_kid, real_life_learner,
-- pure_instinct, pattern_hunter,
-- room_champion, speed_demon

-- ================================================================
-- 8. ROOMS
-- Room definition. status drives the state machine.
-- ================================================================
CREATE TABLE rooms (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            TEXT UNIQUE NOT NULL,        -- 6-char, e.g. KGEC42
    name            TEXT NOT NULL,
    type            TEXT NOT NULL CHECK (type IN (
                        'daily_sprint', 'speed_duel', '30_day_challenge',
                        'topic_battle', 'cohort', 'ranked_arena')),
    owner_id        UUID REFERENCES users(id),
    topic           TEXT,                        -- for topic_battle type
    plan_id         UUID REFERENCES daily_plans(id),  -- shared curriculum
    max_members     INTEGER DEFAULT 10,
    status          TEXT DEFAULT 'pending' CHECK (status IN (
                        'pending', 'active', 'completed', 'archived')),
    is_private      BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    ends_at         TIMESTAMPTZ                  -- NULL for daily_sprint (never ends)
);

CREATE INDEX idx_rooms_code ON rooms(code);

-- ================================================================
-- 9. ROOM_MEMBERS
-- Who is in which room. ELO for ranked mode.
-- ================================================================
CREATE TABLE room_members (
    room_id         UUID REFERENCES rooms(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_at       TIMESTAMPTZ DEFAULT NOW(),
    elo_rating      INTEGER DEFAULT 1000,         -- for ranked_arena only
    total_room_xp   INTEGER DEFAULT 0,            -- XP earned within this room
    PRIMARY KEY (room_id, user_id)
);

-- ================================================================
-- 10. ROOM_DAILY_LOG
-- Daily race results. One row per member per room per day.
-- This is what the live leaderboard reads.
-- ================================================================
CREATE TABLE room_daily_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id         UUID REFERENCES rooms(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    date            DATE NOT NULL DEFAULT CURRENT_DATE,
    tasks_done      INTEGER DEFAULT 0,           -- 0, 1, 2, or 3
    xp_earned       INTEGER DEFAULT 0,
    finish_position INTEGER,                     -- 1 = first to finish all 3
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    UNIQUE (room_id, user_id, date)
);

CREATE INDEX idx_room_daily_log ON room_daily_log(room_id, date);

-- ================================================================
-- 11. ROOM_EVENTS
-- Activity feed. Every notable action creates a row.
-- ================================================================
CREATE TABLE room_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id     UUID REFERENCES rooms(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES users(id),
    event_type  TEXT NOT NULL,   -- 'task_complete', 'practice_solved', 'first_finish',
                                 -- 'nudge_sent', 'nudge_success', 'room_streak_milestone'
    metadata    JSONB,           -- e.g. {"task_num": 2, "xp_awarded": 20}
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_room_events ON room_events(room_id, created_at DESC);

-- ================================================================
-- 12. CONTRIBUTION_EVENTS
-- Immutable log of every action that contributes to the heatmap.
-- ================================================================
CREATE TABLE contribution_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    date        DATE NOT NULL DEFAULT CURRENT_DATE,
    event_type  TEXT NOT NULL CHECK (event_type IN (
                    'solo_task', 'practice_solved', 'quest_complete',
                    'room_win', 'perfect_day', 'streak_milestone', 'level_up')),
    delta       NUMERIC(3,1) NOT NULL,   -- 1.0 for most, 2.0 for room_win, 0.5 for busy_day
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contrib_events ON contribution_events(user_id, date);

-- ================================================================
-- 13. CONTRIBUTIONS
-- One row per user per day. Aggregated from contribution_events.
-- This is what the heatmap actually reads (365 rows, fast).
-- ================================================================
CREATE TABLE contributions (
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    date        DATE NOT NULL,
    count       NUMERIC(5,1) DEFAULT 0,   -- total contribution value for the day
    intensity   INTEGER DEFAULT 0 CHECK (intensity BETWEEN 0 AND 5),
    types       JSONB DEFAULT '{"solo":0,"room":0,"quests":0}'::JSONB,
    PRIMARY KEY (user_id, date)
);

CREATE INDEX idx_contributions ON contributions(user_id, date);

-- Trigger: update contributions on every contribution_event insert
CREATE OR REPLACE FUNCTION update_contributions()
RETURNS TRIGGER AS $$
DECLARE
    new_count NUMERIC;
BEGIN
    INSERT INTO contributions (user_id, date, count, intensity, types)
    VALUES (NEW.user_id, NEW.date, NEW.delta, 1, 
            jsonb_build_object(
                'solo',   CASE WHEN NEW.event_type = 'solo_task' THEN NEW.delta ELSE 0 END,
                'room',   CASE WHEN NEW.event_type = 'room_win' THEN NEW.delta ELSE 0 END,
                'quests', CASE WHEN NEW.event_type = 'quest_complete' THEN NEW.delta ELSE 0 END
            ))
    ON CONFLICT (user_id, date) DO UPDATE SET
        count     = contributions.count + NEW.delta,
        intensity = CASE
            WHEN (contributions.count + NEW.delta) = 0    THEN 0
            WHEN (contributions.count + NEW.delta) <= 2   THEN 1
            WHEN (contributions.count + NEW.delta) <= 4   THEN 2
            WHEN (contributions.count + NEW.delta) <= 7   THEN 3
            WHEN (contributions.count + NEW.delta) <= 9   THEN 4
            ELSE 5
        END,
        types = jsonb_set(
            jsonb_set(
                jsonb_set(
                    contributions.types,
                    '{solo}',
                    to_jsonb((contributions.types->>'solo')::numeric + 
                             CASE WHEN NEW.event_type = 'solo_task' THEN NEW.delta ELSE 0 END)
                ),
                '{room}',
                to_jsonb((contributions.types->>'room')::numeric + 
                         CASE WHEN NEW.event_type = 'room_win' THEN NEW.delta ELSE 0 END)
            ),
            '{quests}',
            to_jsonb((contributions.types->>'quests')::numeric + 
                     CASE WHEN NEW.event_type = 'quest_complete' THEN NEW.delta ELSE 0 END)
        );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_contributions
AFTER INSERT ON contribution_events
FOR EACH ROW EXECUTE FUNCTION update_contributions();
```

---

## Seed data for demo account

```sql
-- Run this to create the demo account for the hackathon presentation
-- Uses demo@devpath.app

-- Insert demo user (auth handled by Supabase Auth separately)
INSERT INTO user_preferences (user_id, skill_tier, goal, daily_time_minutes, streak_count, freeze_count)
VALUES (
    (SELECT id FROM users WHERE email = 'demo@devpath.app'),
    'beginner', 'course', 20, 12, 1
);

-- Pre-seed 3 failed practice attempts on JavaScript closures (for stuck detection demo)
INSERT INTO practice_attempts (user_id, plan_id, day_number, passed, hint_used, error_type)
SELECT
    (SELECT id FROM users WHERE email = 'demo@devpath.app'),
    (SELECT id FROM daily_plans WHERE user_id = (SELECT id FROM users WHERE email = 'demo@devpath.app') LIMIT 1),
    5, FALSE, FALSE, 'closure_scope_error'
FROM generate_series(1, 3);

-- Seed 12 days of streak contributions
INSERT INTO contribution_events (user_id, date, event_type, delta)
SELECT
    (SELECT id FROM users WHERE email = 'demo@devpath.app'),
    CURRENT_DATE - (12 - generate_series) ,
    'solo_task',
    2.0
FROM generate_series(1, 12);
```

---

## Common queries

```sql
-- Get user's current XP and level
SELECT total_xp, weekly_xp, level FROM user_xp_totals WHERE user_id = $1;

-- Get room leaderboard for today
SELECT u.display_name, rdl.tasks_done, rdl.xp_earned, rdl.finish_position
FROM room_daily_log rdl
JOIN users u ON rdl.user_id = u.id
WHERE rdl.room_id = $1 AND rdl.date = CURRENT_DATE
ORDER BY rdl.finish_position ASC NULLS LAST, rdl.tasks_done DESC;

-- Get heatmap data (365 days)
SELECT date, count, intensity, types
FROM contributions
WHERE user_id = $1 AND date >= NOW() - INTERVAL '365 days'
ORDER BY date ASC;

-- Check stuck detection trigger (3 consecutive fails on same error)
SELECT COUNT(*) FROM practice_attempts
WHERE user_id = $1 AND error_type = $2 AND passed = FALSE
  AND created_at >= NOW() - INTERVAL '7 days'
HAVING COUNT(*) >= 3;

-- Get weekly leaderboard (opt-in users, Level 5+ only)
SELECT u.display_name, u.username, t.weekly_xp, t.level
FROM user_xp_totals t
JOIN users u ON t.user_id = u.id
WHERE u.leaderboard_opt_in = TRUE AND t.level >= 5
ORDER BY t.weekly_xp DESC
LIMIT 10;
```
