-- ================================================================
-- DevPath Weekly XP Fix (v004)
-- Fixes the materialized view to calculate week boundaries at query time
-- ================================================================

-- Drop and recreate the materialized view with correct week calculation
DROP MATERIALIZED VIEW IF EXISTS user_xp_totals CASCADE;

CREATE MATERIALIZED VIEW user_xp_totals AS
SELECT
    user_id,
    SUM(amount)                                          AS total_xp,
    SUM(CASE 
        WHEN date_trunc('week', created_at) = date_trunc('week', NOW())
        THEN amount ELSE 0 
    END)                                                 AS weekly_xp,
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

-- Recreate the refresh function and trigger
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
