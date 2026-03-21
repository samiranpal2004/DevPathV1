-- ================================================================
-- DevPath Initial Schema (v1)
-- Dependency order preserved. All CREATE statements are idempotent.
-- ================================================================

-- ================================================================
-- 1. USERS
-- Core identity table. Minimal — all preferences in user_preferences.
-- ================================================================
CREATE TABLE IF NOT EXISTS users (
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
CREATE TABLE IF NOT EXISTS user_preferences (
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
CREATE TABLE IF NOT EXISTS daily_plans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    room_id         UUID,                        -- NULL for solo plans
    source_url      TEXT,                        -- the YouTube/Udemy URL
    source_type     TEXT CHECK (source_type IN ('youtube_video', 'youtube_playlist', 'udemy', 'topic', 'default')),
    title           TEXT NOT NULL,
    total_days      INTEGER NOT NULL,
    current_day     INTEGER DEFAULT 1,
    status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
    checkpoints     JSONB NOT NULL,              -- array of checkpoint objects
    generated_at    TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

-- ================================================================
-- 4. PRACTICE_ATTEMPTS
-- Every code submission. Powers stuck detection.
-- ================================================================
CREATE TABLE IF NOT EXISTS practice_attempts (
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

CREATE INDEX IF NOT EXISTS idx_practice_user_day ON practice_attempts(user_id, day_number);
CREATE INDEX IF NOT EXISTS idx_practice_error ON practice_attempts(user_id, error_type, passed);

-- ================================================================
-- 5. XP_EVENTS
-- Immutable log. Every XP award is a new row. NEVER update existing rows.
-- ================================================================
CREATE TABLE IF NOT EXISTS xp_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    amount      INTEGER NOT NULL,
    reason      TEXT NOT NULL,   -- e.g. 'task_complete', 'practice_solved', 'streak_bonus'
    task_id     UUID,            -- reference to which task/day triggered this
    room_id     UUID,            -- NULL for solo events
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xp_user ON xp_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_xp_weekly ON xp_events(user_id, created_at DESC);

-- ================================================================
-- 6. USER_XP_TOTALS (MATERIALIZED VIEW)
-- Precomputed totals for fast leaderboard queries.
-- Never write to this directly — it is refreshed by trigger.
-- ================================================================
DROP MATERIALIZED VIEW IF EXISTS user_xp_totals CASCADE;

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

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_xp_totals_user_id ON user_xp_totals(user_id);

-- Refresh on every XP insert
DROP FUNCTION IF EXISTS refresh_xp_totals() CASCADE;

CREATE OR REPLACE FUNCTION refresh_xp_totals()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_xp_totals;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_refresh_xp ON xp_events;
CREATE TRIGGER trg_refresh_xp
AFTER INSERT ON xp_events
FOR EACH STATEMENT EXECUTE FUNCTION refresh_xp_totals();

-- ================================================================
-- 7. BADGES
-- Permanent records. Idempotent — never awarded twice to same user.
-- ================================================================
CREATE TABLE IF NOT EXISTS badges (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    badge_key   TEXT NOT NULL,    -- e.g. 'week_warrior', 'pure_instinct'
    awarded_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, badge_key)   -- prevents duplicate awards
);

-- ================================================================
-- 8. ROOMS
-- Room definition. status drives the state machine.
-- ================================================================
CREATE TABLE IF NOT EXISTS rooms (
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

CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);

-- ================================================================
-- 9. ROOM_MEMBERS
-- Who is in which room. ELO for ranked mode.
-- ================================================================
CREATE TABLE IF NOT EXISTS room_members (
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
CREATE TABLE IF NOT EXISTS room_daily_log (
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

CREATE INDEX IF NOT EXISTS idx_room_daily_log ON room_daily_log(room_id, date);

-- ================================================================
-- 11. ROOM_EVENTS
-- Activity feed. Every notable action creates a row.
-- ================================================================
CREATE TABLE IF NOT EXISTS room_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id     UUID REFERENCES rooms(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES users(id),
    event_type  TEXT NOT NULL,   -- 'task_complete', 'practice_solved', 'first_finish',
                                 -- 'nudge_sent', 'nudge_success', 'room_streak_milestone'
    metadata    JSONB,           -- e.g. {"task_num": 2, "xp_awarded": 20}
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_room_events ON room_events(room_id, created_at DESC);

-- ================================================================
-- 12. CONTRIBUTION_EVENTS
-- Immutable log of every action that contributes to the heatmap.
-- ================================================================
CREATE TABLE IF NOT EXISTS contribution_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    date        DATE NOT NULL DEFAULT CURRENT_DATE,
    event_type  TEXT NOT NULL CHECK (event_type IN (
                    'solo_task', 'practice_solved', 'quest_complete',
                    'room_win', 'perfect_day', 'streak_milestone', 'level_up')),
    delta       NUMERIC(3,1) NOT NULL,   -- 1.0 for most, 2.0 for room_win, 0.5 for busy_day
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contrib_events ON contribution_events(user_id, date);

-- ================================================================
-- 13. CONTRIBUTIONS
-- One row per user per day. Aggregated from contribution_events.
-- This is what the heatmap actually reads (365 rows, fast).
-- ================================================================
CREATE TABLE IF NOT EXISTS contributions (
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    date        DATE NOT NULL,
    count       NUMERIC(5,1) DEFAULT 0,   -- total contribution value for the day
    intensity   INTEGER DEFAULT 0 CHECK (intensity BETWEEN 0 AND 5),
    types       JSONB DEFAULT '{"solo":0,"room":0,"quests":0}'::JSONB,
    PRIMARY KEY (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_contributions ON contributions(user_id, date);

-- Trigger: update contributions on every contribution_event insert
DROP FUNCTION IF EXISTS update_contributions() CASCADE;

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

DROP TRIGGER IF EXISTS trg_update_contributions ON contribution_events;
CREATE TRIGGER trg_update_contributions
AFTER INSERT ON contribution_events
FOR EACH ROW EXECUTE FUNCTION update_contributions();
