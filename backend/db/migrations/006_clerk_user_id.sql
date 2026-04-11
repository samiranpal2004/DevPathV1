-- Clerk user IDs are strings like 'user_2abc123def'
-- not UUIDs. Alter user foreign key columns to TEXT.
-- Run only on fresh hackathon data before production users exist.

-- RLS policies depend on these columns, so drop policies first.
DO $$
DECLARE
	policy_rec RECORD;
BEGIN
	FOR policy_rec IN
		SELECT schemaname, tablename, policyname
		FROM pg_policies
		WHERE schemaname = 'public'
			AND tablename IN (
				'users',
				'user_preferences',
				'daily_plans',
				'practice_attempts',
				'xp_events',
				'badges',
				'rooms',
				'room_members',
				'room_daily_log',
				'room_events',
				'contribution_events',
				'contributions'
			)
	LOOP
		EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', policy_rec.policyname, policy_rec.schemaname, policy_rec.tablename);
	END LOOP;
END $$;

-- Materialized views depend on xp_events.user_id and must be dropped first.
-- They are recreated by later migrations (007_xp_system_setup.sql, 008_leaderboard.sql).
DROP MATERIALIZED VIEW IF EXISTS leaderboard_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS user_xp_totals CASCADE;

-- FK constraints referencing users.id must be dropped before type changes.
ALTER TABLE IF EXISTS user_preferences DROP CONSTRAINT IF EXISTS user_preferences_user_id_fkey;
ALTER TABLE IF EXISTS daily_plans DROP CONSTRAINT IF EXISTS daily_plans_user_id_fkey;
ALTER TABLE IF EXISTS practice_attempts DROP CONSTRAINT IF EXISTS practice_attempts_user_id_fkey;
ALTER TABLE IF EXISTS xp_events DROP CONSTRAINT IF EXISTS xp_events_user_id_fkey;
ALTER TABLE IF EXISTS badges DROP CONSTRAINT IF EXISTS badges_user_id_fkey;
ALTER TABLE IF EXISTS room_members DROP CONSTRAINT IF EXISTS room_members_user_id_fkey;
ALTER TABLE IF EXISTS room_daily_log DROP CONSTRAINT IF EXISTS room_daily_log_user_id_fkey;
ALTER TABLE IF EXISTS room_events DROP CONSTRAINT IF EXISTS room_events_user_id_fkey;
ALTER TABLE IF EXISTS contribution_events DROP CONSTRAINT IF EXISTS contribution_events_user_id_fkey;
ALTER TABLE IF EXISTS contributions DROP CONSTRAINT IF EXISTS contributions_user_id_fkey;
ALTER TABLE IF EXISTS rooms DROP CONSTRAINT IF EXISTS rooms_owner_id_fkey;

ALTER TABLE users ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE user_preferences ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE daily_plans ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE practice_attempts ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE xp_events ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE badges ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE room_members ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE room_daily_log ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE room_events ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE contribution_events ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE contributions ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE rooms ALTER COLUMN owner_id TYPE TEXT USING owner_id::text;

-- Recreate users-related foreign keys after type conversion.
ALTER TABLE user_preferences
	ADD CONSTRAINT user_preferences_user_id_fkey
	FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE daily_plans
	ADD CONSTRAINT daily_plans_user_id_fkey
	FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE practice_attempts
	ADD CONSTRAINT practice_attempts_user_id_fkey
	FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE xp_events
	ADD CONSTRAINT xp_events_user_id_fkey
	FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE badges
	ADD CONSTRAINT badges_user_id_fkey
	FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE room_members
	ADD CONSTRAINT room_members_user_id_fkey
	FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE room_daily_log
	ADD CONSTRAINT room_daily_log_user_id_fkey
	FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE room_events
	ADD CONSTRAINT room_events_user_id_fkey
	FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE contribution_events
	ADD CONSTRAINT contribution_events_user_id_fkey
	FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE contributions
	ADD CONSTRAINT contributions_user_id_fkey
	FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE rooms
	ADD CONSTRAINT rooms_owner_id_fkey
	FOREIGN KEY (owner_id) REFERENCES users(id);

-- Recreate RLS policies with auth.uid() cast to TEXT.
CREATE POLICY "users_select_own" ON users FOR SELECT
	USING (auth.uid()::text = id);

CREATE POLICY "users_update_own" ON users FOR UPDATE
	USING (auth.uid()::text = id)
	WITH CHECK (auth.uid()::text = id);

CREATE POLICY "user_prefs_select_own" ON user_preferences FOR SELECT
	USING (auth.uid()::text = user_id);

CREATE POLICY "user_prefs_insert_own" ON user_preferences FOR INSERT
	WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "user_prefs_update_own" ON user_preferences FOR UPDATE
	USING (auth.uid()::text = user_id)
	WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "user_prefs_delete_own" ON user_preferences FOR DELETE
	USING (auth.uid()::text = user_id);

CREATE POLICY "daily_plans_select_own" ON daily_plans FOR SELECT
	USING (auth.uid()::text = user_id);

CREATE POLICY "daily_plans_insert_own" ON daily_plans FOR INSERT
	WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "daily_plans_update_own" ON daily_plans FOR UPDATE
	USING (auth.uid()::text = user_id)
	WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "practice_select_own" ON practice_attempts FOR SELECT
	USING (auth.uid()::text = user_id);

CREATE POLICY "practice_insert_own" ON practice_attempts FOR INSERT
	WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "practice_update_own" ON practice_attempts FOR UPDATE
	USING (auth.uid()::text = user_id)
	WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "xp_events_insert_auth" ON xp_events FOR INSERT
	WITH CHECK (auth.role() = 'authenticated' AND auth.uid()::text = user_id);

CREATE POLICY "xp_events_select_own" ON xp_events FOR SELECT
	USING (auth.uid()::text = user_id);

CREATE POLICY "badges_select_own" ON badges FOR SELECT
	USING (auth.uid()::text = user_id);

CREATE POLICY "badges_insert_service" ON badges FOR INSERT
	WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "rooms_select_auth" ON rooms FOR SELECT
	USING (auth.role() = 'authenticated');

CREATE POLICY "rooms_insert_owner" ON rooms FOR INSERT
	WITH CHECK (auth.uid()::text = owner_id);

CREATE POLICY "rooms_update_owner" ON rooms FOR UPDATE
	USING (auth.uid()::text = owner_id)
	WITH CHECK (auth.uid()::text = owner_id);

CREATE POLICY "rooms_delete_owner" ON rooms FOR DELETE
	USING (auth.uid()::text = owner_id);

CREATE POLICY "room_members_select_own" ON room_members FOR SELECT
	USING (auth.uid()::text = user_id);

CREATE POLICY "room_members_insert_auth" ON room_members FOR INSERT
	WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "room_daily_log_select_members" ON room_daily_log FOR SELECT
	USING (
		EXISTS (
			SELECT 1 FROM room_members
			WHERE room_members.room_id = room_daily_log.room_id
				AND room_members.user_id = auth.uid()::text
		)
	);

CREATE POLICY "room_daily_log_insert_service" ON room_daily_log FOR INSERT
	WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "room_daily_log_update_service" ON room_daily_log FOR UPDATE
	USING (auth.role() = 'service_role')
	WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "room_events_select_members" ON room_events FOR SELECT
	USING (
		EXISTS (
			SELECT 1 FROM room_members
			WHERE room_members.room_id = room_events.room_id
				AND room_members.user_id = auth.uid()::text
		)
	);

CREATE POLICY "room_events_insert_service" ON room_events FOR INSERT
	WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "contribution_events_select_own" ON contribution_events FOR SELECT
	USING (auth.uid()::text = user_id);

CREATE POLICY "contribution_events_insert_service" ON contribution_events FOR INSERT
	WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "contributions_select_own" ON contributions FOR SELECT
	USING (auth.uid()::text = user_id);

CREATE POLICY "contributions_insert_service" ON contributions FOR INSERT
	WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "contributions_update_service" ON contributions FOR UPDATE
	USING (auth.role() = 'service_role')
	WITH CHECK (auth.role() = 'service_role');
