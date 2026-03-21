-- ================================================================
-- DevPath Schema Verification Script
-- Run this in the Supabase SQL Editor to verify all objects were created
-- Expected result: 25 rows total (all ✅)
-- ================================================================

-- CHECK 1: All 12 tables exist
SELECT table_name, 'TABLE' as object_type, '✅' as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'users', 'user_preferences', 'daily_plans', 'practice_attempts',
    'xp_events', 'badges', 'rooms', 'room_members',
    'room_daily_log', 'room_events', 'contribution_events', 'contributions'
  )

UNION ALL

-- CHECK 2: Materialized view exists
SELECT matviewname as table_name, 'MATVIEW' as object_type, '✅' as status
FROM pg_matviews
WHERE schemaname = 'public'
  AND matviewname = 'user_xp_totals'

UNION ALL

-- CHECK 3: All triggers exist
SELECT trigger_name as table_name, 'TRIGGER' as object_type, '✅' as status
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN ('trg_refresh_xp', 'trg_update_contributions')

UNION ALL

-- CHECK 4: All indexes exist (including unique index on matview)
SELECT indexname as table_name, 'INDEX' as object_type, '✅' as status
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_practice_user_day', 'idx_practice_error',
    'idx_xp_user', 'idx_xp_weekly',
    'idx_user_xp_totals_user_id',
    'idx_rooms_code', 'idx_room_daily_log',
    'idx_room_events', 'idx_contrib_events', 'idx_contributions'
  )

ORDER BY object_type, table_name;

-- ================================================================
-- EXPECTED RESULT: 25 rows
-- • 12 tables
-- • 1 materialized view (user_xp_totals)
-- • 2 triggers (trg_refresh_xp, trg_update_contributions)
-- • 10 indexes
--
-- If you see fewer than 25 rows, check which objects are missing above.
-- ================================================================
