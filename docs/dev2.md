# DevPath Backend Tasks — Dev 2

Scope starts from **Phase 1** (Phase 0 already done). This file includes **backend-only** ownership for Dev 2.

## Ownership summary
- **Full ownership of Phases 6–9** (backend)
- Contribution heatmap backend + profile stats aggregation
- Daily sprint room backend + realtime support
- XP, levels, badges, and gamification profile APIs
- Demo polish and production-readiness checks for these phases

## Phase ownership
- Dev 2 owns **Phase 6, 7, 8, 9** completely.
- No phase from this file depends on Dev 1 deliverables.

## Phase-wise task breakdown

### Phase 6 — Contribution heatmap backend
- [ ] Implement/verify `contribution_events` → `contributions` trigger flow
- [ ] Implement `GET /api/heatmap/:user_id`
  - Return last 365 days, sorted ASC
  - Include `date`, `count`, `intensity`, `types`
- [ ] Provide profile stats query backend helpers
  - total contributions, current streak, longest streak, active days

### Phase 7 — Daily sprint rooms backend
- [ ] Implement `POST /api/rooms/create`
  - Generate unique 6-char uppercase alphanumeric room code
  - Persist room row (`daily_sprint` MVP path)
- [ ] Implement `POST /api/rooms/join`
  - Validate code, create `room_members` row
  - Return preview payload + join confirmation data
- [ ] Implement `GET /api/rooms/:id/leaderboard`
  - Read from `room_daily_log` + user profile fields
- [ ] Implement `GET /api/rooms/:id/feed`
  - Return last 10 events from `room_events`
- [ ] Implement `POST /api/rooms/:id/nudge/:user_id`
  - Write nudge event and enforce basic guardrails
- [ ] Wire Supabase Realtime publish/subscribe compatibility at DB/event layer
  - Ensure room updates emit from `room_daily_log` + `room_events`

### Phase 8 — XP + gamification backend
- [ ] Build XP event service (immutable)
  - Insert-only writes to `xp_events` (never mutate totals)
- [ ] Implement level check logic
  - Thresholds: 0, 200, 600, 1400, 3000
  - Trigger level-up event handling
- [ ] Implement idempotent badge award logic
  - Insert into `badges` with conflict-safe behavior
- [ ] Implement profile gamification endpoints
  - `GET /api/me/xp`
  - `GET /api/me/streak`
  - `GET /api/me/badges`
  - `GET /api/me/level`

### Phase 9 — Demo prep (Dev 2 owned backend items)
- [ ] Seed demo account data
  - room data + room events + room_daily_log realism
- [ ] Validate realtime in production deployment
  - Ensure fallback compatibility for polling endpoint consumers
- [ ] Confirm materialized view refresh path for XP totals is stable

## Backend deliverables expected from Dev 2
- [ ] Services: `xp`, `badges`, `rooms`, `heatmap`, contribution logger
- [ ] Routes: rooms + gamification + heatmap
- [ ] SQL/trigger verification scripts for contributions and XP materialized view
- [ ] Tests for room code uniqueness, leaderboard query, XP/level/badge logic
