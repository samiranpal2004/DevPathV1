# DevPath Backend Tasks — Dev 1

Scope starts from **Phase 1** (Phase 0 already done). This file includes **backend-only** ownership for Dev 1.

## Ownership summary
- **Full ownership of Phases 1–5** (backend)
- Onboarding + Gemini parsing + daily mission core
- Streak/freeze backend logic for day modes
- Stuck detection backend using Gemini Flash
- All supporting backend services/routes/tests for these phases

## Phase ownership
- Dev 1 owns **Phase 1, 2, 3, 4, 5** completely.
- No phase from this file depends on Dev 2 deliverables.

## Phase-wise task breakdown

### Phase 1 — Onboarding
- [x] Implement `POST /api/onboarding/quiz-result`
  - Accept 5-question result
  - Map score to `skill_tier` (`beginner | familiar | intermediate`)
  - Persist in `user_preferences`
- [x] Implement `POST /api/onboarding/preferences`
  - Save `goal` (`job | course | dsa | general`)
  - Save `daily_time_minutes` (`15 | 20 | 30`)
- [x] Implement backend validation for `POST /api/onboarding/parse-url` input
  - Return invalid/private URL error states cleanly for frontend handling
- [x] Implement `GET /api/onboarding/plan-preview`
  - Return first 3 checkpoints from generated/default plan

### Phase 2 — Gemini URL parser
- [x] Build `POST /api/onboarding/parse-url`
  - URL type detection (`youtube_video`, `youtube_playlist`, `udemy`, fallback)
  - Call Gemini **`gemini-1.5-pro`** only
  - Parse and validate strict JSON response
  - Store plan in `daily_plans`
- [x] Add per-user caching for parsed URL plan
  - If same URL already parsed for same user, return cached plan immediately
- [x] Fallback chain
  - If parse fails: topic input path (topic-based curriculum generation)
  - If quota fails: return default pre-generated JS/Python plan
- [x] Add demo-day precache script/path
  - Parse Traversy Media JS playlist and confirm DB cache hit on second call

### Phase 3 — Daily mission
- [x] Implement `GET /api/mission/today`
  - Resolve active plan and current day checkpoint
  - Return Task 1, Task 2, Practice payload
- [x] Implement `POST /api/mission/complete-task`
  - Mark Task 1/Task 2 completion state
  - Trigger XP event write for mission actions
  - Trigger contribution event write
- [x] Implement `POST /api/mission/submit-practice`
  - Save attempt in `practice_attempts`
  - Set pass/fail response
  - Trigger XP/contribution on pass
- [x] Implement day mode APIs
  - `POST /api/mission/busy-day`
  - `POST /api/mission/skip-day`

### Phase 4 — Streak system
- [x] Implement streak increment logic on valid daily activity
- [x] Implement freeze handling (`freeze_count` use + checks)
- [x] Implement freeze recharge rule (7-day normal activity)
- [x] Expose streak status data required by mission/dashboard APIs

### Phase 5 — Stuck detection
- [x] Implement `POST /api/mission/stuck`
  - Collect context: problem + topic + last 3 attempts + `skill_tier`
  - Call Gemini **`gemini-1.5-flash`** only
  - Return targeted micro-lesson text
- [x] Persist hint usage
  - Log `hint_used = true` in `practice_attempts` flow
- [x] Add graceful fallback for Flash quota/latency errors

## Backend deliverables expected from Dev 1
- [x] Routes for onboarding + parser + mission + stuck + day modes
- [x] Services for Gemini parser/stuck and mission progression
- [x] Streak/freeze logic implementation for Phase 4
- [x] Request validation schemas for all Phase 1–5 endpoints
- [x] Unit/integration tests for parse-url, mission-today, submit-practice, stuck, busy/skip
