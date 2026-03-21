-- Clerk user IDs are strings like 'user_2abc123def'
-- not UUIDs. Alter user foreign key columns to TEXT.
-- Run only on fresh hackathon data before production users exist.

ALTER TABLE users ALTER COLUMN id TYPE TEXT;
ALTER TABLE user_preferences ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE daily_plans ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE practice_attempts ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE xp_events ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE badges ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE room_members ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE room_daily_log ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE room_events ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE contribution_events ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE contributions ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE rooms ALTER COLUMN owner_id TYPE TEXT;
