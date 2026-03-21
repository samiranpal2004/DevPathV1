-- ================================================================
-- XP System Setup
-- Run this in Supabase SQL Editor to enable XP tracking.
-- Safe to run multiple times (all statements are idempotent).
-- ================================================================

-- Drop materialized view FIRST so columns can be altered
DROP MATERIALIZED VIEW IF EXISTS user_xp_totals CASCADE;

-- Ensure xp_events table exists
CREATE TABLE IF NOT EXISTS xp_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     TEXT NOT NULL,
    amount      INTEGER NOT NULL,
    reason      TEXT NOT NULL,
    task_id     TEXT,            -- changed from UUID to TEXT for flexibility
    room_id     TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xp_user ON xp_events(user_id, created_at DESC);

-- If task_id is still UUID type from old migration, alter it to TEXT
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'xp_events' AND column_name = 'task_id' AND data_type = 'uuid'
    ) THEN
        ALTER TABLE xp_events ALTER COLUMN task_id TYPE TEXT;
    END IF;
END $$;

-- If user_id is still UUID type, alter it to TEXT (Clerk IDs are strings)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'xp_events' AND column_name = 'user_id' AND data_type = 'uuid'
    ) THEN
        ALTER TABLE xp_events ALTER COLUMN user_id TYPE TEXT;
    END IF;
END $$;

-- Ensure badges table exists
CREATE TABLE IF NOT EXISTS badges (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     TEXT NOT NULL,
    badge_key   TEXT NOT NULL,
    awarded_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, badge_key)
);

-- Ensure contribution_events table exists
CREATE TABLE IF NOT EXISTS contribution_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     TEXT NOT NULL,
    date        DATE NOT NULL DEFAULT CURRENT_DATE,
    event_type  TEXT NOT NULL,
    delta       NUMERIC(3,1) NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contrib_events ON contribution_events(user_id, date);

-- Ensure contributions table exists
CREATE TABLE IF NOT EXISTS contributions (
    user_id     TEXT NOT NULL,
    date        DATE NOT NULL,
    count       NUMERIC(5,1) DEFAULT 0,
    intensity   INTEGER DEFAULT 0,
    types       JSONB DEFAULT '{"solo":0,"room":0,"quests":0}'::JSONB,
    PRIMARY KEY (user_id, date)
);

-- Disable RLS on these tables so the service role key can read/write
ALTER TABLE xp_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE contribution_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (backend uses service_role key)
DO $$
BEGIN
    -- xp_events
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'xp_events' AND policyname = 'service_role_all_xp') THEN
        CREATE POLICY service_role_all_xp ON xp_events FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    -- badges
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'badges' AND policyname = 'service_role_all_badges') THEN
        CREATE POLICY service_role_all_badges ON badges FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    -- contribution_events
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contribution_events' AND policyname = 'service_role_all_contrib_events') THEN
        CREATE POLICY service_role_all_contrib_events ON contribution_events FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    -- contributions
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contributions' AND policyname = 'service_role_all_contributions') THEN
        CREATE POLICY service_role_all_contributions ON contributions FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;

-- ================================================================
-- Materialized View for fast XP queries
-- ================================================================
DROP MATERIALIZED VIEW IF EXISTS user_xp_totals CASCADE;

CREATE MATERIALIZED VIEW user_xp_totals AS
SELECT
    user_id,
    SUM(amount)                                          AS total_xp,
    SUM(CASE WHEN created_at >= date_trunc('week', NOW())
             THEN amount ELSE 0 END)                     AS weekly_xp,
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

-- Auto-refresh trigger
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
-- Contribution trigger
-- ================================================================
CREATE OR REPLACE FUNCTION update_contributions()
RETURNS TRIGGER AS $$
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
