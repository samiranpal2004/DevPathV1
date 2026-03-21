-- ================================================================
-- Leaderboard support
-- Adds a leaderboard_stats materialized view joining users + xp_events
-- for fast global leaderboard queries with today_xp support.
-- ================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS leaderboard_stats AS
SELECT
  u.id                                                        AS user_id,
  u.display_name,
  u.username,
  u.avatar_url,
  COALESCE(SUM(x.amount), 0)                                  AS total_xp,
  COALESCE(SUM(
    CASE WHEN x.created_at >= date_trunc('week', NOW())
    THEN x.amount ELSE 0 END
  ), 0)                                                       AS weekly_xp,
  COALESCE(SUM(
    CASE WHEN x.created_at >= CURRENT_DATE
    THEN x.amount ELSE 0 END
  ), 0)                                                       AS today_xp,
  CASE
    WHEN COALESCE(SUM(x.amount), 0) >= 3000 THEN 5
    WHEN COALESCE(SUM(x.amount), 0) >= 1400 THEN 4
    WHEN COALESCE(SUM(x.amount), 0) >= 600  THEN 3
    WHEN COALESCE(SUM(x.amount), 0) >= 200  THEN 2
    ELSE 1
  END                                                         AS level,
  CASE
    WHEN COALESCE(SUM(x.amount), 0) >= 3000 THEN 'Architect'
    WHEN COALESCE(SUM(x.amount), 0) >= 1400 THEN 'Hacker'
    WHEN COALESCE(SUM(x.amount), 0) >= 600  THEN 'Builder'
    WHEN COALESCE(SUM(x.amount), 0) >= 200  THEN 'Coder'
    ELSE 'Rookie'
  END                                                         AS rank_name
FROM users u
LEFT JOIN xp_events x ON x.user_id = u.id
GROUP BY u.id, u.display_name, u.username, u.avatar_url;

-- Required for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS leaderboard_stats_user_id_idx ON leaderboard_stats(user_id);

-- Auto-refresh trigger on every XP insert
CREATE OR REPLACE FUNCTION refresh_leaderboard()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_stats;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop if exists to avoid duplicate trigger error
DROP TRIGGER IF EXISTS trg_refresh_leaderboard ON xp_events;

CREATE TRIGGER trg_refresh_leaderboard
AFTER INSERT ON xp_events
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_leaderboard();
