-- ================================================================
-- DevPath RLS Policies Migration
-- 002_rls_policies.sql
-- 
-- Enables Row Level Security on all 12 tables with fine-grained access control.
-- Rules enforced at DB level before any application code runs.
-- ================================================================

-- ================================================================
-- STEP 1: Enable RLS on all tables
-- ================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_daily_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE contribution_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- RULE 2: USERS — users can only read/write their own profile
-- ================================================================

DROP POLICY IF EXISTS "users_select_own" ON users;
CREATE POLICY "users_select_own" ON users FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_update_own" ON users;
CREATE POLICY "users_update_own" ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ================================================================
-- RULE 2: USER_PREFERENCES — read/write own preferences only
-- ================================================================

DROP POLICY IF EXISTS "user_prefs_select_own" ON user_preferences;
CREATE POLICY "user_prefs_select_own" ON user_preferences FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_prefs_insert_own" ON user_preferences;
CREATE POLICY "user_prefs_insert_own" ON user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_prefs_update_own" ON user_preferences;
CREATE POLICY "user_prefs_update_own" ON user_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_prefs_delete_own" ON user_preferences;
CREATE POLICY "user_prefs_delete_own" ON user_preferences FOR DELETE
  USING (auth.uid() = user_id);

-- ================================================================
-- RULE 2: DAILY_PLANS — users can only read/write their own daily plans
-- ================================================================

DROP POLICY IF EXISTS "daily_plans_select_own" ON daily_plans;
CREATE POLICY "daily_plans_select_own" ON daily_plans FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "daily_plans_insert_own" ON daily_plans;
CREATE POLICY "daily_plans_insert_own" ON daily_plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "daily_plans_update_own" ON daily_plans;
CREATE POLICY "daily_plans_update_own" ON daily_plans FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ================================================================
-- RULE 2: PRACTICE_ATTEMPTS — read/write own attempts only
-- ================================================================

DROP POLICY IF EXISTS "practice_select_own" ON practice_attempts;
CREATE POLICY "practice_select_own" ON practice_attempts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "practice_insert_own" ON practice_attempts;
CREATE POLICY "practice_insert_own" ON practice_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "practice_update_own" ON practice_attempts;
CREATE POLICY "practice_update_own" ON practice_attempts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ================================================================
-- RULE 3: XP_EVENTS — INSERT only (immutable audit trail)
--         NO UPDATE, NO DELETE policies. Ever.
-- ================================================================

DROP POLICY IF EXISTS "xp_events_insert_auth" ON xp_events;
CREATE POLICY "xp_events_insert_auth" ON xp_events FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

DROP POLICY IF EXISTS "xp_events_select_own" ON xp_events;
CREATE POLICY "xp_events_select_own" ON xp_events FOR SELECT
  USING (auth.uid() = user_id);

-- ================================================================
-- RULE 8: BADGES — users read own badges, service_role awards only
-- ================================================================

DROP POLICY IF EXISTS "badges_select_own" ON badges;
CREATE POLICY "badges_select_own" ON badges FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "badges_insert_service" ON badges;
CREATE POLICY "badges_insert_service" ON badges FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ================================================================
-- RULE 5: ROOMS — any authenticated user can read,
--         only owner (room_host_id) can update/delete
-- ================================================================

DROP POLICY IF EXISTS "rooms_select_auth" ON rooms;
CREATE POLICY "rooms_select_auth" ON rooms FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "rooms_insert_owner" ON rooms;
CREATE POLICY "rooms_insert_owner" ON rooms FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "rooms_update_owner" ON rooms;
CREATE POLICY "rooms_update_owner" ON rooms FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "rooms_delete_owner" ON rooms;
CREATE POLICY "rooms_delete_owner" ON rooms FOR DELETE
  USING (auth.uid() = owner_id);

-- ================================================================
-- RULE 6: ROOM_MEMBERS — members read own memberships,
--         authenticated users can INSERT (join a room)
-- ================================================================

DROP POLICY IF EXISTS "room_members_select_own" ON room_members;
CREATE POLICY "room_members_select_own" ON room_members FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "room_members_insert_auth" ON room_members;
CREATE POLICY "room_members_insert_auth" ON room_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ================================================================
-- RULE 7: ROOM_DAILY_LOG — all room members can read,
--         backend service_role writes (via trigger)
-- ================================================================

DROP POLICY IF EXISTS "room_daily_log_select_members" ON room_daily_log;
CREATE POLICY "room_daily_log_select_members" ON room_daily_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_members.room_id = room_daily_log.room_id
        AND room_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "room_daily_log_insert_service" ON room_daily_log;
CREATE POLICY "room_daily_log_insert_service" ON room_daily_log FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "room_daily_log_update_service" ON room_daily_log;
CREATE POLICY "room_daily_log_update_service" ON room_daily_log FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ================================================================
-- RULE 7: ROOM_EVENTS — all room members can read,
--         backend service_role writes (via trigger/API)
-- ================================================================

DROP POLICY IF EXISTS "room_events_select_members" ON room_events;
CREATE POLICY "room_events_select_members" ON room_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_members.room_id = room_events.room_id
        AND room_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "room_events_insert_service" ON room_events;
CREATE POLICY "room_events_insert_service" ON room_events FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ================================================================
-- RULE 4: CONTRIBUTION_EVENTS — readable by owner,
--         writable ONLY via service_role (trigger writes these)
-- ================================================================

DROP POLICY IF EXISTS "contribution_events_select_own" ON contribution_events;
CREATE POLICY "contribution_events_select_own" ON contribution_events FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "contribution_events_insert_service" ON contribution_events;
CREATE POLICY "contribution_events_insert_service" ON contribution_events FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ================================================================
-- RULE 4: CONTRIBUTIONS — readable by owner,
--         writable ONLY via service_role (materialized view updates via trigger)
-- ================================================================

DROP POLICY IF EXISTS "contributions_select_own" ON contributions;
CREATE POLICY "contributions_select_own" ON contributions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "contributions_insert_service" ON contributions;
CREATE POLICY "contributions_insert_service" ON contributions FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "contributions_update_service" ON contributions;
CREATE POLICY "contributions_update_service" ON contributions FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ================================================================
-- End of RLS Policies Migration
-- ================================================================
-- 
-- VERIFICATION QUERY (run in Supabase SQL editor):
-- 
-- SELECT tablename, policyname, cmd, roles
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, cmd;
-- 
-- Expected: ~41 policies across 12 tables
-- • Each table has ENABLE ROW LEVEL SECURITY
-- • xp_events: INSERT + SELECT only (NO UPDATE/DELETE)
-- • badges, contributions, contribution_events: service_role writes only
-- • room_daily_log, room_events: room member reads, service_role writes
-- • rooms: public read, owner update
-- 
-- ================================================================
