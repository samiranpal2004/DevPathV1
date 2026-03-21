# DevPath Supabase Setup Guide

**Status:** Hackathon MVP (March 2026)  
**Owner:** Dev 2 (Heatmap, Rooms, XP/Gamification, Demo Prep)  
**Database:** PostgreSQL hosted on Supabase  

This guide walks you through setting up Supabase and running all migrations to get DevPath's backend ready.

---

## 📋 Prerequisites

- [ ] Node.js 18+ installed
- [ ] A Supabase account (free tier is sufficient)
- [ ] Access to AWS region selector (you'll need Mumbai: ap-south-1)
- [ ] This repo cloned locally

---

## Step 1: Create Supabase Project

### 1.1 Create a new Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **"New Project"** (or create a new organization first)
3. Fill in:
   - **Project name:** `devpath-hackathon` (or similar)
   - **Database password:** Save this securely! You'll need it for DATABASE_URL
   - **Region:** Select **Asia Pacific / Mumbai (ap-south-1)**  
     ⚠️ **IMPORTANT:** Mumbai is crucial for latency from India

4. Click **"Create new project"** and wait ~2 minutes for provisioning

### 1.2 What success looks like

- ✅ Project dashboard loads
- ✅ You see a green checkmark next to "API" and "Database"
- ✅ URL format: `https://YOUR-PROJECT-ID.supabase.co`

---

## Step 2: Gather Your Credentials

### 2.1 Get SUPABASE_URL and SUPABASE_ANON_KEY

1. In the Supabase dashboard, go to **Settings → API**
2. Copy:
   - **Project URL** → Paste into `SUPABASE_URL`
   - **anon (public) key** under "Project API keys" → Paste into `SUPABASE_ANON_KEY`

### 2.2 Get SUPABASE_SERVICE_ROLE_KEY

1. Still in **Settings → API**
2. Scroll to **Project API keys** section
3. Find `service_role` key (labeled as "Secret")
4. Copy it → Paste into `SUPABASE_SERVICE_ROLE_KEY`

⚠️ **CRITICAL:** This key has full database access. Never commit it. Never expose to frontend.

### 2.3 Get DATABASE_URL (direct PostgreSQL connection)

1. Go to **Settings → Database**
2. Copy the **"Connection string"** (URI format)
3. It looks like: `postgresql://postgres:[password]@db.[project-id].supabase.co:5432/postgres`
4. Paste it into `DATABASE_URL`

### 2.4 Create your .env file

In your `backend/` folder:

```bash
cd backend
cp .env.example .env
```

Now edit `backend/.env` and fill in the values you copied:

```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
DATABASE_URL=postgresql://postgres:PASSWORD@db.your-project-id.supabase.co:5432/postgres
GEMINI_API_KEY=AIzaSy...  # You can leave this blank for now
NODE_ENV=development
PORT=8000
```

### 2.5 What success looks like

- ✅ `.env` file exists in `backend/`
- ✅ All 4 values are filled in (except GEMINI_API_KEY, which can be blank)
- ✅ File is in `.gitignore` (already is)

---

## Step 3: Run Database Migrations

### 3.1 Install migration runner

From the `backend/` directory:

```bash
npm install
```

This installs `@supabase/supabase-js` and other dependencies.

### 3.2 Run the first migration (schema creation)

You can run the migration in two ways:

#### Option A: Via Supabase SQL Editor (recommended for first time)

1. In Supabase dashboard, go to **SQL Editor**
2. Click **"New query"**
3. Open [backend/db/migrations/001_initial_schema.sql](backend/db/migrations/001_initial_schema.sql)
4. Copy the entire file content
5. Paste into the Supabase SQL editor
6. Click **"RUN"** (▶️ button, bottom right)
7. Wait ~15 seconds for all tables to be created
8. You should see: `SUCCESS: 13 statements executed, 0 errors`

#### Option B: Via direct database connection (psql)

If you prefer terminal:

```bash
psql $DATABASE_URL < backend/db/migrations/001_initial_schema.sql
```

### 3.3 What success looks like

- ✅ No error messages in Supabase SQL editor
- ✅ All 13 table names appear in the left sidebar under "Tables"
- ✅ `user_xp_totals` appears under "Views"

### 3.4 Run the second migration (RLS policies)

Once the first migration is complete:

1. Go to **SQL Editor** → **"New query"**
2. Open [backend/db/migrations/002_rls_policies.sql](backend/db/migrations/002_rls_policies.sql)
3. Copy the entire file content
4. Paste into the Supabase SQL editor
5. Click **"RUN"**
6. Wait ~10 seconds
7. You should see: `SUCCESS: X statements executed, 0 errors`

### 3.5 What success looks like

- ✅ No error messages
- ✅ RLS is now enabled on all tables (visible in **Settings → Authentication**)

---

## Step 4: Enable Supabase Realtime (on specific tables only)

### 4.1 Enable realtime for room_daily_log and room_events

1. In Supabase dashboard, go to **SQL Editor** → **"New query"**
2. Paste this SQL:

```sql
-- Enable realtime only on tables that need it
ALTER PUBLICATION supabase_realtime ADD TABLE room_daily_log;
ALTER PUBLICATION supabase_realtime ADD TABLE room_events;
```

3. Click **"RUN"**
4. You should see: `SUCCESS: 2 statements executed`

### 4.2 What success looks like

- ✅ No error messages
- ✅ Both tables are now enabled for real-time subscriptions
- ✅ Frontend can subscribe to live leaderboard updates

---

## Step 5: Verify the Setup

### 5.1 Install TypeScript dependencies (if not already done)

```bash
cd backend
npm install ts-node typescript tslib @types/node --save-dev
```

### 5.2 Run the verification script

```bash
npx ts-node db/verify-schema.ts
```

### 5.3 Expected output

```
🔍 DevPath Database Schema Verification

============================================

✅ Table: users
   ✅ Table exists

✅ Table: user_preferences
   ✅ Table exists

[... 11 more tables ...]

✅ Materialized View: user_xp_totals
   ✅ View exists and is readable

✅ Realtime: room_daily_log + room_events
   ✅ Both tables are accessible (ready for realtime)


✅ Triggers: trg_refresh_xp + trg_update_contributions
   ✅ Triggers assumed created (will error on ops if not)

============================================
Summary: 16/16 checks passed

✅ All checks passed! Database is ready.
```

### 5.4 What success looks like

- ✅ All 16 checks pass
- ✅ Script exits with code 0
- ✅ No ❌ icons in the output

**If any checks fail:**
- Read the error message carefully
- Most common issue: `.env` not loaded or credentials are wrong
- Re-check Step 2 (credentials)

---

## Step 6: (Optional) Create a Supabase Anon Client in Backend

For frontend to use anon key safely, you might want a helper. Create `backend/src/lib/supabase.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Use this client in frontend-facing code (respects RLS)
export const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Use this client ONLY in backend (bypasses RLS, server-only)
export const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);
```

---

## Critical Rules — Read Before Coding

### ⚠️ XP System

- **NEVER** make `xp_events` rows updatable or deletable via RLS
- **NEVER** write directly to `user_xp_totals` — it's a materialized view
- Every XP award = 1 new row in `xp_events` (immutable log)
- Triggers automatically refresh the view

### ⚠️ Heatmap / Contributions

- **NEVER** insert directly into `contributions`
- Always insert into `contribution_events` first
- Trigger automatically aggregates into `contributions`
- The heatmap query reads only `contributions` (365 rows, fast)

### ⚠️ API Keys

- `service_role` key: backend only, never expose to frontend
- `anon` key: safe for frontend (RLS enforces row-level access)
- Use `supabaseAdmin` in backend for admin operations
- Use `supabaseAnon` in frontend for user operations

### ⚠️ Realtime

- Only `room_daily_log` and `room_events` have realtime enabled
- Other tables won't broadcast changes — query manually
- Subscribe on room enter, unsubscribe on room leave

---

## Troubleshooting

### Issue: "SUPABASE_URL not set" when running verify-schema.ts

**Solution:**
1. Check that `.env` file exists in `backend/` folder
2. Run from `backend/` directory: `npx ts-node db/verify-schema.ts`
3. Check that `SUPABASE_URL` has no spaces or quotes

### Issue: "Table does not exist" in verification

**Solution:**
1. Check that migration 001 ran successfully
2. Go to Supabase dashboard → SQL Editor → "New query"
3. Run: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';`
4. If tables are missing, re-run the 001_initial_schema.sql migration

### Issue: RLS is preventing operations

**Solution:**
- Check that you're using the correct client:
  - Authenticate users for `supabaseAnon` (frontend)
  - Use `supabaseAdmin` for backend operations
- Verify RLS policies in Supabase dashboard → **Settings → Authentication → Policies**

### Issue: Realtime not working

**Solution:**
1. Verify realtime is enabled: see Step 4.2
2. Check that you're subscribed to correct table: `room_daily_log` or `room_events`
3. Check frontend console for subscription errors
4. Try refreshing the page

---

## What's Next?

Once verification passes:

1. **You (Dev 2)** can start building:
   - Room system backend (rooms, room_members, room_daily_log)
   - XP/gamification backend (xp_events, badges, levels)
   - Heatmap aggregation (contribution_events → contributions)
   - Demo prep (seed demo account data)

2. **Frontend team** can start building:
   - Supabase Auth integration (Google login)
   - Real-time leaderboard (subscribe to room_events, room_daily_log)
   - Heatmap visualization

3. **Both teams:**
   - Implement API routes that use `supabaseAdmin` client
   - Never expose service_role key
   - Test with `.env` values before deploying

---

## File Reference

All setup files are in this repo:

```
backend/
  .env.example              # Copy to .env and fill in
  db/
    migrations/
      001_initial_schema.sql    # Run first (all 13 tables)
      002_rls_policies.sql      # Run second (RLS policies)
    verify-schema.ts            # Run this to validate
```

---

## Questions?

Refer back to [docs/db-schema.md](../docs/db-schema.md) for the complete table definitions and constraints.

Happy coding! 🚀
