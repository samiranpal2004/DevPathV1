# DevPath — Daily Coding Coach

## Project overview
DevPath is a web app that turns any YouTube video or playlist URL into a
structured daily coding plan using Gemini's native video understanding.
Users get a daily mission (2 tasks + 1 practice problem), compete in rooms
with friends, and track all activity on a GitHub-style contribution heatmap.

Full PRD: @docs/PRD.md
Structural flow: @docs/architecture.md
Database schema: @docs/db-schema.md
Build checklist: @docs/tasks.md

---

## Tech stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Next + Tailwind CSS | in /frontend |
| Backend | Node.js + Express.js | in /backend |
| Database | PostgreSQL | via Supabase |
| AI — parser | Gemini 1.5 Pro | native YouTube video understanding |
| AI — stuck | Gemini 1.5 Flash | faster, cheaper for micro-lessons |
| Real-time | Supabase Realtime | room leaderboard live updates |
| Code editor | Monaco Editor | in-browser, same engine as VS Code |
| Auth | Supabase Auth | Google login + email |
| Frontend host | Vercel | auto-deploy from main branch |
| Backend host | Railway | free tier, deploy from /backend |

---

## Project structure

```
devpath/
├── CLAUDE.md
├── CLAUDE.local.md          # gitignored — personal notes only
├── .claude/
│   └── commands/            # custom slash commands
├── docs/
│   ├── PRD.md
│   ├── architecture.md
│   ├── db-schema.md
│   └── tasks.md
├── frontend/
│   ├── app/
│   │   ├── (routes)/
│   │   ├── api/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── onboarding/
│   │   ├── mission/
│   │   ├── editor/
│   │   ├── heatmap/
│   │   ├── rooms/
│   │   └── gamification/
│   ├── lib/
│   │   ├── api/             # all API calls here, never inline
│   │   └── utils/
│   ├── hooks/
│   └── package.json
└── backend/
    ├── server.js
    ├── routes/
    │   ├── parser.js        # Gemini URL parser
    │   ├── missions.js      # daily plan generation
    │   ├── rooms.js         # room CRUD + events
    │   ├── gamification.js  # XP, streaks, badges
    │   └── heatmap.js       # contribution aggregation
    ├── models/              # DB models
    ├── schemas/             # request validation schemas
    ├── services/
    │   ├── gemini.js        # all Gemini API calls
    │   └── realtime.js      # Supabase Realtime helpers
    └── package.json
```

---

## Key commands

```bash
# Frontend
cd frontend && npm install
cd frontend && npm run dev          # http://localhost:3000

# Backend
cd backend && npm install
cd backend && npm run dev  # http://localhost:8000

# Database
cd backend && npm run migrate           # run migrations
cd backend && npm run seed              # seed demo account

# Check types (frontend)
cd frontend && npm run typecheck

# Lint
cd frontend && npm run lint
cd backend && npm run lint
```

---

## Gemini API rules — read before touching any AI code

- Parser (video understanding): always use `gemini-1.5-pro`
- Stuck detection (quick responses): always use `gemini-1.5-flash`
- API key: load from env var `GEMINI_API_KEY` — never hardcode
- Free tier limit: 1,500 requests/day on Flash, 50/day on Pro
- Always handle quota errors with graceful fallback message
- Cache ALL parser results in DB after first successful call
- For demo day: pre-cache the Traversy Media JS playlist the night before

### Gemini parser prompt template (DO NOT change without discussing)
```
Watch this YouTube video: {url}
Return ONLY valid JSON with this structure:
{
  "title": "string",
  "total_duration_minutes": number,
  "checkpoints": [
    {
      "day": number,
      "title": "string",
      "concepts": ["string"],
      "task1": { "title": "string", "description": "string", "duration_minutes": number },
      "task2": { "title": "string", "description": "string", "duration_minutes": number },
      "practice": { "title": "string", "description": "string", "difficulty": "beginner|intermediate|advanced" }
    }
  ]
}
No explanation. No markdown. Only the JSON object.
```

---

## Database rules — critical

- XP is NEVER stored as a mutable counter
- Every XP award = a new row in `xp_events` table
- `user_xp_totals` is a materialized view — never write to it directly
- Badges: unique constraint on (user_id, badge_key) — idempotent, never award twice
- Contributions: one row per user per day, updated by trigger on every action
- Room codes: 6-character alphanumeric, uppercase, stored in `rooms.code`
- Never use YouTube Data API v3 — replaced entirely by Gemini
- Never use Udemy Affiliate API — deprecated January 1, 2025

---

## Coding conventions

- All API calls live in `frontend/lib/api/` — never fetch() inline in components
- All Gemini calls live in `backend/services/gemini.js` — never inline in routes
- Environment variables: `.env` in project root — never commit
- Error boundaries around every AI-powered component
- Loading states required for all Gemini calls (can take 3-5 seconds)
- Monaco editor: use `editor.getValue()` to extract code for evaluation
- Supabase Realtime: subscribe on room enter, unsubscribe on room leave
- Heatmap: query `contributions` table (aggregated), not `contribution_events`

---

## Current build phase
Hackathon MVP — Binary v2, KGEC, March 2026
See @docs/tasks.md for the full checklist with completion status.
