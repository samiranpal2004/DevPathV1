# DevPath Backend — Developer Guide

## 1. What this backend does (2-3 sentences, plain English)
DevPath backend provides the core game mechanics for learning progress: XP, levels, badges, room races, and contribution heatmaps. It exposes REST APIs over Express, stores all state in Supabase Postgres, and uses DB-side triggers/materialized views to keep leaderboard and heatmap reads fast. It also ships demo/prep scripts so the hackathon flow can be seeded and verified quickly.

## 2. Project structure
Below is the backend tree with one-line purpose notes for each file/directory currently present.

```text
backend/
├── .env                                  # Local runtime secrets (not committed)
├── .env.example                          # Template of required environment variables
├── DEMO_CHECKLIST.md                     # Pre-demo manual validation checklist
├── package.json                          # NPM scripts, runtime dependencies, dev tooling
├── package-lock.json                     # Exact dependency lockfile
├── tsconfig.json                         # TypeScript compiler config for src -> dist
├── dist/                                 # Compiled JS output (generated)
├── node_modules/                         # Installed packages (generated)
├── db/
│   ├── SETUP.md                          # Step-by-step Supabase setup + migration guide
│   ├── verify-schema-objects.sql         # SQL verification for tables/view/triggers/indexes
│   ├── verify-schema.ts                  # Programmatic schema/realtime verification script
│   ├── migrations/
│   │   ├── 001_initial_schema.sql        # Core schema: 13 tables + mat view + triggers
│   │   └── 002_rls_policies.sql          # Row Level Security policies for all data tables
│   └── backend/
│       └── db/
│           └── migrations/
│               └── 001_initial_schema.sql # Duplicate nested migration copy (legacy/accidental path)
└── src/
    ├── server.ts                         # Process entrypoint: loads env and starts Express server
    ├── app.ts                            # Express app wiring: middleware, routes, 404 handler
    ├── lib/
    │   └── supabase.ts                   # Supabase admin client bootstrap + env validation
    ├── config/
    │   └── xp.config.ts                  # XP reward map, level thresholds/ranks, pure XP helpers
    ├── types/
    │   ├── gamification.types.ts         # XP, badge, streak, level-up contracts
    │   ├── heatmap.types.ts              # Heatmap response/day/stats contracts
    │   └── room.types.ts                 # Room, member, feed, leaderboard, payload contracts
    ├── utils/
    │   └── roomCode.ts                   # 6-char room code generator excluding O/0/I/1
    ├── services/
    │   ├── xp.service.ts                 # XP event writes, profile reads, streak milestone checks
    │   ├── badge.service.ts              # Idempotent badge award + retrieval + trigger mapping
    │   ├── heatmap.service.ts            # 365-day heatmap build + contribution event logging
    │   └── room.service.ts               # Room lifecycle, membership, leaderboard, feed, nudges
    ├── routes/
    │   ├── gamification.routes.ts        # /api/me/* endpoints for XP/streak/badges/level
    │   ├── heatmap.routes.ts             # /api/heatmap/:userId endpoint
    │   └── room.routes.ts                # /api/rooms/* room CRUD/join/feed/leaderboard/nudge
    └── scripts/
        ├── seed-demo.ts                  # Seeds demo users, XP, badges, room data, attempts
        ├── precache-demo-plan.ts         # Inserts prebuilt 30-day plan cache for demo user
        ├── production-check.ts           # Runs 8 production-readiness checks
        └── test-realtime.html            # Browser utility to manually verify realtime events
```

## 3. Tech stack and why

| Technology | What it's used for | Where in the code |
|---|---|---|
| Node.js + TypeScript | Backend runtime and typed service/router architecture | `backend/src/**`, `backend/tsconfig.json` |
| Express 5 | HTTP server, routing, middleware | `backend/src/app.ts`, `backend/src/routes/*.ts` |
| Supabase JS (`@supabase/supabase-js`) | DB access via service-role client | `backend/src/lib/supabase.ts`, all services/scripts |
| PostgreSQL (Supabase) | Persistent storage for users, XP, rooms, heatmap events | `backend/db/migrations/001_initial_schema.sql` |
| PL/pgSQL triggers | Automatic aggregate updates (XP totals, contributions) | `refresh_xp_totals()`, `update_contributions()` in migration 001 |
| Materialized view | Fast precomputed XP totals for profile/leaderboard reads | `user_xp_totals` in migration 001 |
| Row Level Security | DB-level access control by role/user | `backend/db/migrations/002_rls_policies.sql` |
| `pg` client | Direct SQL check for publication membership | `backend/src/scripts/production-check.ts` |
| Nodemon | Local hot-reload dev server | `backend/package.json` (`npm run dev`) |
| ts-node | Execute TS scripts without prebuild | `seed:demo`, `precache`, `check:prod` scripts |

## 4. Database overview

### 13 persistent data objects
The migration defines **12 tables + 1 materialized view** (commonly counted as 13 persistent data objects):

1. `users` — Core identity/profile row per user.
2. `user_preferences` — Onboarding settings + streak/freeze state.
3. `daily_plans` — Generated learning plan JSON and current day/status.
4. `practice_attempts` — Each coding submission attempt for analysis/stuck logic.
5. `xp_events` — Immutable XP award log (one row per XP grant).
6. `badges` — Badge grants with unique (`user_id`, `badge_key`) idempotency.
7. `rooms` — Room metadata (code, type, owner, status, limits).
8. `room_members` — Membership + room-specific stats (`elo_rating`, `total_room_xp`).
9. `room_daily_log` — Daily per-room per-user race progress/finish info.
10. `room_events` — Activity feed events for room timeline/realtime feed.
11. `contribution_events` — Immutable contribution event stream for heatmap.
12. `contributions` — Aggregated one-row-per-day heatmap source table.
13. `user_xp_totals` (materialized view) — Precomputed XP totals/weekly XP/level per user.

### `user_xp_totals` materialized view
`user_xp_totals` precomputes `total_xp`, `weekly_xp`, `week_start`, and derived level per user from `xp_events`. It exists to avoid expensive `SUM` scans over the full XP event log on every profile/leaderboard request.

### Two DB triggers
- `trg_refresh_xp` (AFTER INSERT ON `xp_events`, statement-level) → runs `refresh_xp_totals()` and refreshes materialized view `user_xp_totals` concurrently.
- `trg_update_contributions` (AFTER INSERT ON `contribution_events`, row-level) → runs `update_contributions()` to upsert/update `contributions` count, intensity, and per-type totals.

### Why `xp_events` is insert-only and never updated
XP is treated as an immutable audit trail: every award is a new event row, never an in-place counter edit. This prevents accidental XP loss/race conditions, preserves full reward history, and allows deterministic recomputation of totals/levels from source-of-truth events.

## 5. How data flows — the 4 core pipelines

### Pipeline 1: XP award flow
⚠️ Partial — needs completion before demo

The codebase contains `XpService.awardXp()` but no exposed task-completion route in this repo yet (for example `/api/mission/complete-task` is not implemented here).

```text
User completes task (frontend / Dev 1 mission flow)
      ↓
Dev 1 backend mission endpoint (not present in this repo)
      ↓
XpService.awardXp({ userId, amount, reason, ... })
      ↓
INSERT into xp_events
      ↓
DB trigger trg_refresh_xp fires → REFRESH MATERIALIZED VIEW user_xp_totals
      ↓
XpService reads user_xp_totals and compares old level vs new level
      ↓
Level up? → returns LevelUpEvent (and caller can award badge)
No level up? → returns null
```

### Pipeline 2: Heatmap contribution flow
```text
User action (task solved / quest / room win)
      ↓
HeatmapService.logContributionEvent()
      ↓
INSERT into contribution_events
      ↓
DB trigger trg_update_contributions
      ↓
UPSERT into contributions (count + intensity + types JSON)
      ↓
GET /api/heatmap/:userId
      ↓
HeatmapService.getHeatmap() reads last 365 days from contributions
      ↓
Missing dates filled with zeros → frontend paints heatmap squares
```

### Pipeline 3: Room race flow
⚠️ Partial — needs completion before demo

Room creation/join/feed/leaderboard APIs are implemented. Actual live race updates depend on whoever writes `room_daily_log`/`room_events` during mission progress (not fully wired in these routes yet).

```text
Owner creates room
      ↓
POST /api/rooms/create
      ↓
RoomService.createRoom() → insert rooms + insert owner into room_members
      ↓
Members join with code
      ↓
POST /api/rooms/join
      ↓
RoomService.joinRoom() → insert room_members + insert room_events(member_joined)
      ↓
Clients fetch standings/feed
      ↓
GET /api/rooms/:id/leaderboard and GET /api/rooms/:id/feed
      ↓
Supabase Realtime subscription on room_daily_log + room_events
      ↓
Live leaderboard/feed updates in UI
```

### Pipeline 4: Stuck detection flow
⚠️ Partial — needs completion before demo

Gemini stuck detection endpoint is outside this backend slice. This repo provides supporting data (`practice_attempts` schema + seeded failing attempts), but no direct `/stuck` route/service call yet.

```text
User clicks "I'm stuck" (frontend / Dev 1 scope)
      ↓
Dev 1 endpoint calls Gemini 1.5 Flash (not in this backend routes)
      ↓
This backend stores/reads attempt context via practice_attempts table
      ↓
Gemini returns micro-lesson payload
      ↓
Frontend renders micro-lesson
```

## 6. API endpoint reference

| Method | Path | What it does | Request body/params | Response shape |
|---|---|---|---|---|
| GET | `/health` | Health probe | none | `{ status: "ok" }` |
| GET | `/api/heatmap/:userId` | Returns normalized 365-day heatmap payload | `params.userId` UUID | `HeatmapResponse` (`userId`, `days[365]`, `stats`, `breakdown`) |
| POST | `/api/rooms/create` | Creates active room and adds owner as first member | `{ ownerId, name, type, topic?, maxMembers?, isPrivate? }` | `{ success:true, data: Room }` |
| POST | `/api/rooms/join` | Joins user to room by code and returns room preview | `{ code, userId }` | `{ success:true, data: RoomPreview }` |
| GET | `/api/rooms/:id/leaderboard` | Gets today standings for all room members | `params.id` UUID | `{ success:true, data: LeaderboardEntry[] }` |
| GET | `/api/rooms/:id/feed` | Gets latest 10 room feed events | `params.id` UUID | `{ success:true, data: RoomFeedEvent[] }` |
| POST | `/api/rooms/:id/nudge/:userId` | Sends nudge from one member to another (6h cooldown) | `params.id` room UUID, `params.userId` target UUID, body `{ nudgerId }` | `{ success:true, data:{ message:"Nudge sent." } }` |
| GET | `/api/me/xp` | Returns full XP profile | header `x-user-id` UUID | `{ success:true, data: UserXpProfile }` |
| GET | `/api/me/streak` | Returns streak/freeze stats | header `x-user-id` UUID | `{ success:true, data: StreakProfile }` |
| GET | `/api/me/badges` | Returns user badges newest-first | header `x-user-id` UUID | `{ success:true, data: Badge[] }` |
| GET | `/api/me/level` | Returns level/rank progress subset | header `x-user-id` UUID | `{ success:true, data:{ level, rank, xpToNextLevel, progressPercent } }` |

Error envelope used by most routes: `{ success:false, error:{ code, message } }`.

## 7. Service layer — what each service owns

### `XpService`
- Owns: XP awarding (`awardXp`), XP profile projection, streak reads, streak milestone bonus.
- Never does: room CRUD, feed writes, heatmap aggregation.
- Calls: `supabaseAdmin` directly; lazily imports `BadgeService` in `checkAndAwardStreakBonus`.

### `BadgeService`
- Owns: badge grant idempotency and badge trigger-to-badge mapping.
- Never does: XP calculations, level math, room logic.
- Calls: `supabaseAdmin` only.

### `RoomService`
- Owns: room create/join, membership checks, leaderboard assembly, feed reads, nudge cooldown/events.
- Never does: XP total math, badge grants, heatmap shaping.
- Calls: `generateRoomCode()` utility + `supabaseAdmin` only.

### `HeatmapService`
- Owns: contribution event logging and 365-day heatmap payload assembly/backfill.
- Never does: room lifecycle, badge logic, XP level logic.
- Calls: `supabaseAdmin` only.

## 8. Key architectural decisions (and why)

- Immutable XP event log over mutable counter: event logs are safer under concurrency, auditable, and replayable; counters lose history and are easier to corrupt.
- Separate `contributions` from `contribution_events`: event log keeps full detail, while aggregate table gives fast read shape for heatmap UI (one row/day).
- Materialized view for leaderboard/profile reads: avoids summing large XP history on every request; DB precomputes totals once and serves fast reads.
- Room code charset excludes `O`, `0`, `I`, `1`: avoids visual ambiguity when users share codes verbally/screenshots.
- Realtime enabled only on `room_daily_log` and `room_events`: these are the only high-value live surfaces (leaderboard/feed); limiting scope reduces traffic/noise and simplifies subscription logic.

## 9. How to run the project locally

1. Clone + install:
   - `cd backend`
   - `npm install`
2. Set up `.env` (copy from `.env.example`):
   - Required to boot API: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - Required for `npm run check:prod`: `DATABASE_URL`
   - Required for realtime HTML test: `SUPABASE_ANON_KEY`
   - Used by broader DevPath stack (not this route set): `GEMINI_API_KEY`
   - Optional: `PORT` (default 8000), `NODE_ENV`
3. Run DB migrations (no migrate script in `package.json`):
   - Apply `backend/db/migrations/001_initial_schema.sql`
   - Apply `backend/db/migrations/002_rls_policies.sql`
4. Run seed script:
   - `npm run seed:demo`
5. Start dev server:
   - `npm run dev`
6. Test it works:
   - `GET http://localhost:8000/health`
   - `GET http://localhost:8000/api/heatmap/<USER_UUID>`

## 10. How to run the demo
Quick 5-step pre-demo routine (from `backend/DEMO_CHECKLIST.md`):

1. `npm run seed:demo` then `npm run precache`.
2. `npm run check:prod` and ensure all 8 checks pass.
3. Open `src/scripts/test-realtime.html` and confirm realtime connects.
4. Smoke-test key APIs: heatmap, room leaderboard, `/api/me/xp`, `/api/me/badges`.
5. Do one full timed dry-run (<6 minutes) on deployed backend (Railway), not localhost.

## 11. What Dev 2 owns vs what Dev 1 owns

### Dev 2 owns (backend)

**Routes**
- `src/routes/gamification.routes.ts`
- `src/routes/heatmap.routes.ts`
- `src/routes/room.routes.ts`

**Services**
- `src/services/xp.service.ts`
- `src/services/badge.service.ts`
- `src/services/room.service.ts`
- `src/services/heatmap.service.ts`

**Scripts**
- `src/scripts/seed-demo.ts`
- `src/scripts/precache-demo-plan.ts`
- `src/scripts/production-check.ts`
- `src/scripts/test-realtime.html`

### Dev 1 owns (frontend + other backend)
- Frontend UX/pages/components and frontend API integration.
- URL parser and Gemini model orchestration endpoints.
- Mission completion endpoint(s) that should call `XpService.awardXp()`.
- “I’m stuck” API flow (Gemini 1.5 Flash micro-lesson generation).
- Any parser/mission routes not present under this backend’s `src/routes/`.

## 12. Glossary

- XP event: One immutable record of XP gained for a specific reason.
- Contribution event: One action record that should affect heatmap activity.
- Intensity: 0–5 bucket indicating how active a day was on the heatmap.
- Room code: 6-character join code for rooms (human-friendly charset).
- Daily sprint: Room mode where members race through daily tasks.
- Materialized view: Stored query result refreshed by trigger for fast reads.
- Streak freeze: Buffer day users can use to protect a streak.
- Skill tier: User starting level (`beginner`, `familiar`, `intermediate`).
- Checkpoint: One day/unit in a generated learning plan with tasks/practice.
- Leaderboard entry: Per-user standing snapshot (tasks, XP, finish data) for a room/day.
