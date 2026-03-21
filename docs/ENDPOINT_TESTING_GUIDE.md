# DevPath — Endpoint Testing Guide
> Generated after MVP audit.
> Last updated: March 21, 2026
> MVP Readiness: 76%

---

## How to use this guide
- Base URL local: `http://localhost:3000`
- Base URL production: `https://your-railway-url.railway.app`
- All endpoints that need a user ID use header: `x-user-id: <uuid>`
- Demo user ID: `00000000-0000-0000-0000-000000000001`
- Demo room code: `KGEC42`
- Tool recommendation: use curl examples provided OR import into Postman/Thunder Client

---

## Section 1 — Health check
Test that the server is alive before anything else.

### GET /health
**What it tests:** Express app boot + route registration.

**curl:**
```bash
curl -X GET http://localhost:3000/health
```

**Expected response (200):**
```json
{
  "status": "ok"
}
```

**What a failure means:**
- `404`: wrong base URL or reverse proxy path
- `5xx`: backend not running, crashed, or deployment misconfigured

---

## Section 2 — Onboarding endpoints
Cover: quiz result, preferences save, URL parse, plan preview

### [POST] /api/onboarding/quiz-result — ✅ Done
**What this tests:** Skill quiz scoring and `user_preferences.skill_tier` upsert.

**Request:**
```bash
curl -X POST http://localhost:3000/api/onboarding/quiz-result \
  -H "Content-Type: application/json" \
  -H "x-user-id: 00000000-0000-0000-0000-000000000001" \
  -d '{
    "answers": [true, false, true, false, true]
  }'
```

**Expected response (200):**
```json
{
  "skill_tier": "familiar",
  "score": 3,
  "message": "Skill tier set to familiar"
}
```

**Expected error cases:**
| Scenario | Status | Error code |
|---|---|---|
| Missing `x-user-id` | 401 | Unauthorized |
| `answers` missing / not length 5 | 400 | Validation failed |

**MVP status:** ✅ Done

---

### [POST] /api/onboarding/preferences — ✅ Done
**What this tests:** Goal + time preference persistence.

**Request:**
```bash
curl -X POST http://localhost:3000/api/onboarding/preferences \
  -H "Content-Type: application/json" \
  -H "x-user-id: 00000000-0000-0000-0000-000000000001" \
  -d '{
    "goal": "course",
    "daily_time_minutes": 20
  }'
```

**Expected response (200):**
```json
{
  "goal": "course",
  "daily_time_minutes": 20,
  "message": "Preferences saved"
}
```

**Expected error cases:**
| Scenario | Status | Error code |
|---|---|---|
| Missing `x-user-id` | 401 | Unauthorized |
| Invalid `goal` or time | 400 | Validation failed |

**MVP status:** ✅ Done

---

### [POST] /api/onboarding/parse-url — ⚠️ Partial
**What this tests:** Gemini URL parser flow + cache + fallback + plan storage.

**Request:**
```bash
curl -X POST http://localhost:3000/api/onboarding/parse-url \
  -H "Content-Type: application/json" \
  -H "x-user-id: 00000000-0000-0000-0000-000000000001" \
  -d '{
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "fallback_topic": "javascript basics"
  }'
```

**Expected response (200):**
```json
{
  "plan_id": "00000000-0000-0000-0000-000000000101",
  "title": "JavaScript Crash Course — 30 Day DevPath Plan",
  "total_days": 30,
  "source_type": "youtube_video",
  "from_cache": false,
  "fallback": null,
  "preview_checkpoints": [
    {
      "day": 1,
      "title": "Variables and Data Types"
    }
  ]
}
```

**Expected error cases:**
| Scenario | Status | Error code |
|---|---|---|
| Invalid URI format | 400 | Validation failed |
| Unsupported URL source | 422 | unsupported_url |
| Gemini/service failure | 500 | Failed to parse URL |

**MVP status:** ⚠️ Partial

**If ⚠️ or ❌:** Parser service writes/reads `daily_plans.cache_key`, but the tracked SQL migrations do not define this column; cache behavior is therefore environment-dependent unless DB drift has already been patched.

---

### [POST] /api/onboarding/parse-topic — ✅ Done
**What this tests:** Topic-only curriculum generation fallback.

**Request:**
```bash
curl -X POST http://localhost:3000/api/onboarding/parse-topic \
  -H "Content-Type: application/json" \
  -H "x-user-id: 00000000-0000-0000-0000-000000000001" \
  -d '{
    "topic": "javascript arrays"
  }'
```

**Expected response (200):**
```json
{
  "plan_id": "00000000-0000-0000-0000-000000000101",
  "title": "JavaScript Crash Course — 30 Day DevPath Plan",
  "total_days": 30,
  "source_type": "topic",
  "fallback": null,
  "preview_checkpoints": [
    {
      "day": 1,
      "title": "Variables and Data Types"
    }
  ]
}
```

**Expected error cases:**
| Scenario | Status | Error code |
|---|---|---|
| Missing topic | 400 | Validation failed |
| Missing `x-user-id` | 401 | Unauthorized |

**MVP status:** ✅ Done

---

### [GET] /api/onboarding/plan-preview — ✅ Done
**What this tests:** Active plan retrieval + first 3-day preview.

**Request:**
```bash
curl -X GET http://localhost:3000/api/onboarding/plan-preview \
  -H "x-user-id: 00000000-0000-0000-0000-000000000001"
```

**Expected response (200):**
```json
{
  "plan_id": "00000000-0000-0000-0000-000000000101",
  "title": "JavaScript Crash Course — 30 Day DevPath Plan",
  "total_days": 30,
  "preview_checkpoints": [
    { "day": 1, "title": "Variables and Data Types" },
    { "day": 2, "title": "Functions and Scope" },
    { "day": 3, "title": "Arrays and Loops" }
  ]
}
```

**Expected error cases:**
| Scenario | Status | Error code |
|---|---|---|
| No active plan | 404 | no_active_plan |
| Missing `x-user-id` | 401 | Unauthorized |

**MVP status:** ✅ Done

---

## Section 3 — Daily mission endpoints
Cover every route under /api/mission/

### [GET] /api/mission/today — ✅ Done
**What this tests:** Current mission assembly from active plan + completion flags.

**Request:**
```bash
curl -X GET http://localhost:3000/api/mission/today \
  -H "x-user-id: 00000000-0000-0000-0000-000000000001"
```

**Expected response (200):**
```json
{
  "plan_id": "00000000-0000-0000-0000-000000000101",
  "day_number": 1,
  "total_days": 30,
  "title": "Variables and Data Types",
  "concepts": ["var/let/const", "primitive types"],
  "task1": { "title": "Refactor var to let/const", "done": false },
  "task2": { "title": "Type inspector mini-table", "done": false },
  "practice": { "title": "Input type detective", "difficulty": "beginner" },
  "streak_count": 12,
  "freeze_count": 1,
  "tasks_done_today": 0
}
```

**Expected error cases:**
| Scenario | Status | Error code |
|---|---|---|
| Missing `x-user-id` | 401 | Unauthorized |
| No active plan/preferences | 404 | no_active_plan |

**MVP status:** ✅ Done

---

### [POST] /api/mission/complete-task — ✅ Done
**What this tests:** Task completion, XP insert, streak update, contribution logging, room hooks.

**Request:**
```bash
curl -X POST http://localhost:3000/api/mission/complete-task \
  -H "Content-Type: application/json" \
  -H "x-user-id: 00000000-0000-0000-0000-000000000001" \
  -d '{
    "task_num": 1,
    "day_number": 1,
    "room_id": "00000000-0000-0000-0000-000000000042"
  }'
```

**Expected response (200):**
```json
{
  "xp_awarded": 20,
  "xpAwarded": 20,
  "already_done": false,
  "both_tasks_done": false,
  "levelUp": null,
  "isPerfectDay": false
}
```

**Expected error cases:**
| Scenario | Status | Error code |
|---|---|---|
| `task_num` not 1/2 | 400 | Validation failed |
| Invalid/missing body fields | 400 | Validation failed |
| Missing `x-user-id` | 401 | Unauthorized |

**MVP status:** ✅ Done

---

### [POST] /api/mission/submit-practice — ✅ Done
**What this tests:** Practice attempt logging, passed/failed handling, XP, badges, perfect day checks.

**Request:**
```bash
curl -X POST http://localhost:3000/api/mission/submit-practice \
  -H "Content-Type: application/json" \
  -H "x-user-id: 00000000-0000-0000-0000-000000000001" \
  -d '{
    "plan_id": "00000000-0000-0000-0000-000000000101",
    "day_number": 1,
    "passed": true,
    "submitted_code": "function detectType(v){return typeof v;}",
    "error_type": null,
    "hint_used": false,
    "room_id": "00000000-0000-0000-0000-000000000042"
  }'
```

**Expected response (200):**
```json
{
  "xp_awarded": 45,
  "xpAwarded": 45,
  "passed": true,
  "attempt_id": "00000000-0000-0000-0000-000000009999",
  "levelUp": null,
  "isPerfectDay": false
}
```

**Expected error cases:**
| Scenario | Status | Error code |
|---|---|---|
| Invalid UUID `plan_id` | 400 | Validation failed |
| Missing required fields | 400 | Validation failed |
| Missing `x-user-id` | 401 | Unauthorized |

**MVP status:** ✅ Done

---

### [POST] /api/mission/busy-day — ⚠️ Partial
**What this tests:** Busy-day flow, freeze usage, mini XP award.

**Request:**
```bash
curl -X POST http://localhost:3000/api/mission/busy-day \
  -H "Content-Type: application/json" \
  -H "x-user-id: 00000000-0000-0000-0000-000000000001" \
  -d '{}'
```

**Expected response (200):**
```json
{
  "xp_awarded": 5,
  "xpAwarded": 5,
  "levelUp": null,
  "streak_preserved": true,
  "freeze_used": true,
  "freeze_remaining": 0
}
```

**Expected error cases:**
| Scenario | Status | Error code |
|---|---|---|
| Missing `x-user-id` | 401 | Unauthorized |
| Missing user preferences | 500 | Failed to register busy day |

**MVP status:** ⚠️ Partial

**If ⚠️ or ❌:** Current mounted route does not enforce `NO_FREEZE_AVAILABLE`; with `freeze_count = 0` it returns success and breaks streak instead of returning the PRD-style guard error.

---

### [POST] /api/mission/skip-day — ⚠️ Partial
**What this tests:** Skip-day flow, freeze usage without XP.

**Request:**
```bash
curl -X POST http://localhost:3000/api/mission/skip-day \
  -H "Content-Type: application/json" \
  -H "x-user-id: 00000000-0000-0000-0000-000000000001" \
  -d '{}'
```

**Expected response (200):**
```json
{
  "xp_awarded": 0,
  "streak_preserved": true,
  "freeze_used": true,
  "freeze_remaining": 0
}
```

**Expected error cases:**
| Scenario | Status | Error code |
|---|---|---|
| Missing `x-user-id` | 401 | Unauthorized |
| Missing user preferences | 500 | Failed to register skip day |

**MVP status:** ⚠️ Partial

**If ⚠️ or ❌:** Same freeze guard gap as busy-day; behavior differs from strict guardrail expectation.

---

### [POST] /api/mission/stuck — ✅ Done
**What this tests:** Gemini Flash stuck helper + fallback lesson + hint attempt logging.

**Request:**
```bash
curl -X POST http://localhost:3000/api/mission/stuck \
  -H "Content-Type: application/json" \
  -H "x-user-id: 00000000-0000-0000-0000-000000000001" \
  -d '{
    "plan_id": "00000000-0000-0000-0000-000000000101",
    "day_number": 1,
    "problem": "Write a function that returns unique values",
    "topic": "arrays"
  }'
```

**Expected response (200):**
```json
{
  "micro_lesson": "...targeted 3-step guidance...",
  "fallback": false
}
```

**Expected error cases:**
| Scenario | Status | Error code |
|---|---|---|
| Missing fields / invalid body | 400 | Validation failed |
| Missing `x-user-id` | 401 | Unauthorized |

**MVP status:** ✅ Done

---

### Full mission flow test (end to end)
1. GET today’s mission
```bash
curl -X GET http://localhost:3000/api/mission/today \
  -H "x-user-id: 00000000-0000-0000-0000-000000000001"
```
2. Complete task 1
```bash
curl -X POST http://localhost:3000/api/mission/complete-task \
  -H "Content-Type: application/json" \
  -H "x-user-id: 00000000-0000-0000-0000-000000000001" \
  -d '{"task_num":1,"day_number":1,"room_id":"00000000-0000-0000-0000-000000000042"}'
```
3. Complete task 2
```bash
curl -X POST http://localhost:3000/api/mission/complete-task \
  -H "Content-Type: application/json" \
  -H "x-user-id: 00000000-0000-0000-0000-000000000001" \
  -d '{"task_num":2,"day_number":1,"room_id":"00000000-0000-0000-0000-000000000042"}'
```
4. Submit practice (passing solution)
```bash
curl -X POST http://localhost:3000/api/mission/submit-practice \
  -H "Content-Type: application/json" \
  -H "x-user-id: 00000000-0000-0000-0000-000000000001" \
  -d '{"plan_id":"00000000-0000-0000-0000-000000000101","day_number":1,"passed":true,"submitted_code":"function detectType(v){return typeof v;}","error_type":null,"hint_used":false,"room_id":"00000000-0000-0000-0000-000000000042"}'
```
5. Verify XP increased
```bash
curl -X GET http://localhost:3000/api/me/xp \
  -H "x-user-id: 00000000-0000-0000-0000-000000000001"
```
6. Verify streak incremented
```bash
curl -X GET http://localhost:3000/api/me/streak \
  -H "x-user-id: 00000000-0000-0000-0000-000000000001"
```
7. Verify heatmap updated
```bash
curl -X GET http://localhost:3000/api/heatmap/00000000-0000-0000-0000-000000000001
```

---

## Section 4 — Heatmap endpoints
Cover: GET /api/heatmap/:userId

### [GET] /api/heatmap/:userId — ✅ Done
**What this tests:** Aggregated 365-day contributions, intensity, stats, and breakdown.

**Request:**
```bash
curl -X GET http://localhost:3000/api/heatmap/00000000-0000-0000-0000-000000000001
```

**Expected response (200):**
```json
{
  "userId": "00000000-0000-0000-0000-000000000001",
  "days": [
    {
      "date": "2026-03-21",
      "count": 2,
      "intensity": 1,
      "types": {
        "solo": 2,
        "room": 0,
        "quests": 0
      }
    }
  ],
  "stats": {
    "totalContributions": 24,
    "currentStreak": 12,
    "longestStreak": 12,
    "activeDays": 12
  },
  "breakdown": {
    "solo": 22,
    "room": 0,
    "quests": 2
  }
}
```

**Expected error cases:**
| Scenario | Status | Error code |
|---|---|---|
| Invalid UUID in path | 400 | BadRequest |
| User not found | 404 | USER_NOT_FOUND |
| Internal query failure | 500 | INTERNAL_ERROR |

**MVP status:** ✅ Done

---

### Heatmap data verification SQL
```sql
-- 1) Raw event log for demo user
SELECT date, event_type, delta, created_at
FROM contribution_events
WHERE user_id = '00000000-0000-0000-0000-000000000001'
ORDER BY date DESC, created_at DESC
LIMIT 50;

-- 2) Aggregated heatmap rows the API reads
SELECT date, count, intensity, types
FROM contributions
WHERE user_id = '00000000-0000-0000-0000-000000000001'
  AND date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY date DESC;

-- 3) Ensure perfect day / level-up markers are represented in types math
SELECT date,
       (types->>'solo')::numeric AS solo,
       (types->>'room')::numeric AS room,
       (types->>'quests')::numeric AS quests,
       count,
       intensity
FROM contributions
WHERE user_id = '00000000-0000-0000-0000-000000000001'
ORDER BY date DESC
LIMIT 20;
```

---

## Section 5 — Room endpoints
Cover all 5 room routes.

### [POST] /api/rooms/create — ✅ Done
**What this tests:** Room creation, unique code generation, owner auto-membership.

**Request:**
```bash
curl -X POST http://localhost:3000/api/rooms/create \
  -H "Content-Type: application/json" \
  -d '{
    "ownerId": "00000000-0000-0000-0000-000000000001",
    "name": "KGEC DSA Squad",
    "type": "daily_sprint",
    "maxMembers": 10,
    "isPrivate": true
  }'
```

**Expected response (201):**
```json
{
  "success": true,
  "data": {
    "id": "00000000-0000-0000-0000-000000000042",
    "code": "KGEC42",
    "name": "KGEC DSA Squad",
    "type": "daily_sprint",
    "ownerId": "00000000-0000-0000-0000-000000000001",
    "maxMembers": 10,
    "status": "active",
    "isPrivate": true,
    "createdAt": "2026-03-21T10:00:00.000Z",
    "endsAt": null
  }
}
```

**Expected error cases:**
| Scenario | Status | Error code |
|---|---|---|
| Invalid `ownerId` | 400 | BAD_REQUEST |
| Invalid `type` | 400 | BAD_REQUEST |
| Code generation/DB failure | 500 | ROOM_CREATE_FAILED |

**MVP status:** ✅ Done

---

### [POST] /api/rooms/join — ✅ Done
**What this tests:** Room code validation + membership insert + preview response.

**Request:**
```bash
curl -X POST http://localhost:3000/api/rooms/join \
  -H "Content-Type: application/json" \
  -d '{
    "code": "KGEC42",
    "userId": "00000000-0000-0000-0000-000000000002"
  }'
```

**Expected response (200):**
```json
{
  "success": true,
  "data": {
    "room": {
      "id": "00000000-0000-0000-0000-000000000042",
      "code": "KGEC42",
      "name": "KGEC DSA Squad",
      "type": "daily_sprint"
    },
    "members": [],
    "todayStandings": []
  }
}
```

**Expected error cases:**
| Scenario | Status | Error code |
|---|---|---|
| Invalid code format | 400 | BAD_REQUEST |
| Room not found | 404 | ROOM_NOT_FOUND |
| Room full | 409 | ROOM_FULL |

**MVP status:** ✅ Done

---

### [GET] /api/rooms/:id/leaderboard — ✅ Done
**What this tests:** Current-day standings from `room_daily_log` + member profile joins.

**Request:**
```bash
curl -X GET http://localhost:3000/api/rooms/00000000-0000-0000-0000-000000000042/leaderboard
```

**Expected response (200):**
```json
{
  "success": true,
  "data": [
    {
      "userId": "00000000-0000-0000-0000-000000000002",
      "displayName": "Rohan",
      "avatarUrl": null,
      "tasksDone": 3,
      "xpEarned": 70,
      "finishPosition": 1,
      "startedAt": "2026-03-21T09:00:00.000Z",
      "completedAt": "2026-03-21T10:30:00.000Z"
    }
  ]
}
```

**Expected error cases:**
| Scenario | Status | Error code |
|---|---|---|
| Invalid room UUID | 400 | BAD_REQUEST |
| Query failure | 500 | ROOM_LEADERBOARD_QUERY_FAILED |

**MVP status:** ✅ Done

---

### [GET] /api/rooms/:id/feed — ✅ Done
**What this tests:** Last 10 `room_events` with display metadata.

**Request:**
```bash
curl -X GET http://localhost:3000/api/rooms/00000000-0000-0000-0000-000000000042/feed
```

**Expected response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "00000000-0000-0000-0000-000000003004",
      "roomId": "00000000-0000-0000-0000-000000000042",
      "userId": "00000000-0000-0000-0000-000000000001",
      "displayName": "Alex (Demo)",
      "eventType": "nudge_sent",
      "metadata": {
        "target_user_id": "00000000-0000-0000-0000-000000000003"
      },
      "createdAt": "2026-03-21T11:45:00.000Z"
    }
  ]
}
```

**Expected error cases:**
| Scenario | Status | Error code |
|---|---|---|
| Invalid room UUID | 400 | BAD_REQUEST |
| Query failure | 500 | ROOM_FEED_QUERY_FAILED |

**MVP status:** ✅ Done

---

### [POST] /api/rooms/:id/nudge/:userId — ✅ Done
**What this tests:** Member nudge flow + 6-hour cooldown protection.

**Request:**
```bash
curl -X POST http://localhost:3000/api/rooms/00000000-0000-0000-0000-000000000042/nudge/00000000-0000-0000-0000-000000000003 \
  -H "Content-Type: application/json" \
  -d '{
    "nudgerId": "00000000-0000-0000-0000-000000000001"
  }'
```

**Expected response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Nudge sent."
  }
}
```

**Expected error cases:**
| Scenario | Status | Error code |
|---|---|---|
| Nudger not room member | 403 | NUDGER_NOT_MEMBER |
| Target not room member | 400 | TARGET_NOT_MEMBER |
| Cooldown active | 429 | NUDGE_COOLDOWN_ACTIVE |

**MVP status:** ✅ Done

---

### Full room race test (end to end)
1. Create room
```bash
curl -X POST http://localhost:3000/api/rooms/create \
  -H "Content-Type: application/json" \
  -d '{"ownerId":"00000000-0000-0000-0000-000000000001","name":"KGEC DSA Squad","type":"daily_sprint","maxMembers":10,"isPrivate":true}'
```
2. Join room as second user
```bash
curl -X POST http://localhost:3000/api/rooms/join \
  -H "Content-Type: application/json" \
  -d '{"code":"KGEC42","userId":"00000000-0000-0000-0000-000000000002"}'
```
3. Complete tasks as user 1 (with roomId in body)
```bash
curl -X POST http://localhost:3000/api/mission/complete-task \
  -H "Content-Type: application/json" \
  -H "x-user-id: 00000000-0000-0000-0000-000000000001" \
  -d '{"task_num":1,"day_number":1,"room_id":"00000000-0000-0000-0000-000000000042"}'
```
4. GET leaderboard — verify user 1 is ahead
```bash
curl -X GET http://localhost:3000/api/rooms/00000000-0000-0000-0000-000000000042/leaderboard
```
5. Complete all tasks as user 1
```bash
curl -X POST http://localhost:3000/api/mission/submit-practice \
  -H "Content-Type: application/json" \
  -H "x-user-id: 00000000-0000-0000-0000-000000000001" \
  -d '{"plan_id":"00000000-0000-0000-0000-000000000101","day_number":1,"passed":true,"submitted_code":"function detectType(v){return typeof v;}","error_type":null,"hint_used":false,"room_id":"00000000-0000-0000-0000-000000000042"}'
```
6. Verify first-finish XP bonus awarded
```bash
curl -X GET http://localhost:3000/api/me/xp \
  -H "x-user-id: 00000000-0000-0000-0000-000000000001"
```
7. GET feed — verify events appeared
```bash
curl -X GET http://localhost:3000/api/rooms/00000000-0000-0000-0000-000000000042/feed
```
8. Nudge user 2
```bash
curl -X POST http://localhost:3000/api/rooms/00000000-0000-0000-0000-000000000042/nudge/00000000-0000-0000-0000-000000000002 \
  -H "Content-Type: application/json" \
  -d '{"nudgerId":"00000000-0000-0000-0000-000000000001"}'
```
9. GET feed — verify nudge event appeared
```bash
curl -X GET http://localhost:3000/api/rooms/00000000-0000-0000-0000-000000000042/feed
```

---

## Section 6 — Gamification endpoints
Cover: /api/me/xp, /api/me/streak, /api/me/badges, /api/me/level

### [GET] /api/me/xp — ✅ Done
**What this tests:** XP profile from `user_xp_totals` + level metadata.

**Request:**
```bash
curl -X GET http://localhost:3000/api/me/xp \
  -H "x-user-id: 00000000-0000-0000-0000-000000000001"
```

**Expected response (200):**
```json
{
  "success": true,
  "data": {
    "userId": "00000000-0000-0000-0000-000000000001",
    "totalXp": 350,
    "weeklyXp": 95,
    "level": 2,
    "rank": "Coder",
    "xpToNextLevel": 250,
    "progressPercent": 37.5,
    "gamificationOn": true
  }
}
```

**Expected error cases:**
| Scenario | Status | Error code |
|---|---|---|
| Missing/invalid UUID header | 400 | INVALID_USER_ID |
| Internal query failure | 500 | INTERNAL_ERROR |

**MVP status:** ✅ Done

---

### [GET] /api/me/streak — ⚠️ Partial
**What this tests:** Streak status for dashboard dots + freeze visibility.

**Request:**
```bash
curl -X GET http://localhost:3000/api/me/streak \
  -H "x-user-id: 00000000-0000-0000-0000-000000000001"
```

**Expected response (200):**
```json
{
  "streak_count": 12,
  "longest_streak": 12,
  "freeze_count": 1,
  "freeze_last_used": null,
  "last_active_date": "2026-03-21",
  "streak_safe": false,
  "last_7_days": [
    { "date": "2026-03-15", "status": "done" }
  ]
}
```

**Expected error cases:**
| Scenario | Status | Error code |
|---|---|---|
| Missing `x-user-id` | 401 | Unauthorized |
| Preferences missing | 404 | preferences_not_found |

**MVP status:** ⚠️ Partial

**If ⚠️ or ❌:** Two separate streak route implementations exist (`/api/me` and `/api/me/*` stack), causing inconsistent response contracts and making the gamification route’s wrapped `/me/streak` effectively shadowed.

---

### [GET] /api/me/badges — ✅ Done
**What this tests:** Badge list retrieval (most recent first).

**Request:**
```bash
curl -X GET http://localhost:3000/api/me/badges \
  -H "x-user-id: 00000000-0000-0000-0000-000000000001"
```

**Expected response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "00000000-0000-0000-0000-000000001111",
      "userId": "00000000-0000-0000-0000-000000000001",
      "badgeKey": "first_step",
      "awardedAt": "2026-03-21T09:00:00.000Z"
    }
  ]
}
```

**Expected error cases:**
| Scenario | Status | Error code |
|---|---|---|
| Missing/invalid UUID header | 400 | INVALID_USER_ID |
| Internal failure | 500 | INTERNAL_ERROR |

**MVP status:** ✅ Done

---

### [GET] /api/me/level — ✅ Done
**What this tests:** Level/rank projection endpoint and progress computation.

**Request:**
```bash
curl -X GET http://localhost:3000/api/me/level \
  -H "x-user-id: 00000000-0000-0000-0000-000000000001"
```

**Expected response (200):**
```json
{
  "success": true,
  "data": {
    "level": 2,
    "rank": "Coder",
    "xpToNextLevel": 250,
    "progressPercent": 37.5,
    "gamificationOn": true
  }
}
```

**Expected error cases:**
| Scenario | Status | Error code |
|---|---|---|
| Missing/invalid UUID header | 400 | INVALID_USER_ID |
| Internal failure | 500 | INTERNAL_ERROR |

**MVP status:** ✅ Done

---

### XP pipeline verification
```sql
-- 1) xp_events has rows
SELECT id, user_id, amount, reason, room_id, created_at
FROM xp_events
WHERE user_id = '00000000-0000-0000-0000-000000000001'
ORDER BY created_at DESC
LIMIT 30;

-- 2) user_xp_totals materialized view shows correct total
SELECT user_id, total_xp, weekly_xp, level, week_start
FROM user_xp_totals
WHERE user_id = '00000000-0000-0000-0000-000000000001';

-- 3) Recompute expected level from total_xp (0/200/600/1400/3000)
SELECT user_id,
       total_xp,
       CASE
         WHEN total_xp >= 3000 THEN 5
         WHEN total_xp >= 1400 THEN 4
         WHEN total_xp >= 600 THEN 3
         WHEN total_xp >= 200 THEN 2
         ELSE 1
       END AS computed_level,
       level AS materialized_level
FROM user_xp_totals
WHERE user_id = '00000000-0000-0000-0000-000000000001';

-- 4) Weekly XP is not zero
SELECT user_id, weekly_xp
FROM user_xp_totals
WHERE user_id = '00000000-0000-0000-0000-000000000001'
  AND weekly_xp > 0;
```

---

## Section 7 — Edge cases and error handling
For each section above, list the edge cases that MUST work correctly for the demo:

| Endpoint | Edge case | Expected behavior |
|---|---|---|
| POST /api/onboarding/quiz-result | answers length != 5 | 400 with `Validation failed` |
| POST /api/onboarding/parse-url | unsupported provider URL | 422 with `unsupported_url` |
| GET /api/mission/today | no active plan | 404 `no_active_plan` |
| POST /api/mission/complete-task | task_num = 3 | 400 `Validation failed` |
| POST /api/mission/submit-practice | invalid plan_id UUID | 400 `Validation failed` |
| POST /api/mission/busy-day | freeze_count = 0 | 200 with `streak_preserved=false` (current behavior; not PRD guard) |
| POST /api/rooms/join | invalid code format | 400 `BAD_REQUEST` |
| POST /api/rooms/join | room full | 409 `ROOM_FULL` |
| POST /api/rooms/:id/nudge/:userId | repeat nudge within 6h | 429 `NUDGE_COOLDOWN_ACTIVE` |
| GET /api/heatmap/:userId | invalid UUID | 400 `BadRequest` |
| GET /api/me/xp | invalid x-user-id | 400 `INVALID_USER_ID` |
| GET /api/me/streak | missing x-user-id | 401 `Unauthorized` |

---

## Section 8 — Pre-demo smoke test sequence
The fastest possible test to confirm everything is working 5 minutes before the demo.

```bash
# 1. Server alive
curl -X GET http://localhost:3000/health

# 2. Demo user XP profile loads
curl -X GET http://localhost:3000/api/me/xp \
  -H "x-user-id: 00000000-0000-0000-0000-000000000001"

# 3. Streak payload loads
curl -X GET http://localhost:3000/api/me/streak \
  -H "x-user-id: 00000000-0000-0000-0000-000000000001"

# 4. Today mission loads
curl -X GET http://localhost:3000/api/mission/today \
  -H "x-user-id: 00000000-0000-0000-0000-000000000001"

# 5. Heatmap payload loads
curl -X GET http://localhost:3000/api/heatmap/00000000-0000-0000-0000-000000000001

# 6. Room join works for second user
curl -X POST http://localhost:3000/api/rooms/join \
  -H "Content-Type: application/json" \
  -d '{"code":"KGEC42","userId":"00000000-0000-0000-0000-000000000002"}'

# 7. Room leaderboard loads
curl -X GET http://localhost:3000/api/rooms/00000000-0000-0000-0000-000000000042/leaderboard

# 8. Room feed loads
curl -X GET http://localhost:3000/api/rooms/00000000-0000-0000-0000-000000000042/feed

# 9. Nudge endpoint accepts valid request
curl -X POST http://localhost:3000/api/rooms/00000000-0000-0000-0000-000000000042/nudge/00000000-0000-0000-0000-000000000003 \
  -H "Content-Type: application/json" \
  -d '{"nudgerId":"00000000-0000-0000-0000-000000000001"}'

# 10. Practice submit endpoint is alive
curl -X POST http://localhost:3000/api/mission/submit-practice \
  -H "Content-Type: application/json" \
  -H "x-user-id: 00000000-0000-0000-0000-000000000001" \
  -d '{"plan_id":"00000000-0000-0000-0000-000000000101","day_number":1,"passed":false,"submitted_code":"","error_type":"logic_error","hint_used":false,"room_id":"00000000-0000-0000-0000-000000000042"}'
```

---

## Section 9 — Known issues and workarounds
Based on the ⚠️ Partial items found in the Step 1 audit:

| Issue | Impact on demo | Workaround |
|---|---|---|
| Gemini parser cache relies on `daily_plans.cache_key` not present in tracked migrations | medium | Use pre-cached demo plan + `parse-topic` fallback if parse-url fails in fresh DB |
| Streak increment logic does not fully handle date-gap resets per PRD semantics | medium | For demo, use seeded streak user and avoid showing multi-day gap recovery logic |
| Busy/skip freeze guard differs from expected strict error behavior | medium | Do not demo busy/skip with exhausted freeze; keep `freeze_count=1` in demo seed |
| Milestone badges cover core streak milestones but not all PRD badge scenarios | low | Demo only implemented badge set (`first_step`, `problem_solver`, streak milestones) |
| Heatmap filter modes + stats panel are backend-supported but frontend wiring not verified here | medium | In demo, show API response and DB verification rather than relying on UI filters |
| `/api/me/streak` has duplicate route implementations with different response shapes | high | Standardize on current mounted `/api/me/streak` response (from `me.routes.ts`) in frontend/demo scripts |
| Realtime room streams have subscription helpers but end-to-end frontend subscription wiring is not proven in this audit | medium | Keep leaderboard/feed polling fallback active during demo |
