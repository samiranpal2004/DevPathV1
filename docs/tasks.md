# DevPath — Hackathon Build Checklist

**Event:** Binary v2 · KGEC · March 2026
**Target:** 14 hours for must-haves · then bonus features

Claude Code tip: Tell Claude to check off boxes as features are completed.
Example: "Mark the Gemini parser task as done in tasks.md"

---

## Phase 0 — Project setup (1 hour)

- [ ] Create GitHub repo `devpath`
- [ ] Init Next.js frontend: `npx create-next-app@latest frontend --typescript --eslint --tailwind --app`
- [ ] Init Node + Express backend: `mkdir backend && cd backend && npm init -y && npm install express cors dotenv`
- [ ] Add Tailwind CSS to frontend
- [ ] Create Supabase project (get URL + anon key)
- [ ] Create `.env` file with all API keys
- [ ] Add `.env` and `CLAUDE.local.md` to `.gitignore`
- [ ] Create folder structure: `docs/`, `.claude/commands/`
- [ ] Add all docs files to repo (PRD.md, architecture.md, db-schema.md, tasks.md)
- [ ] Run DB migrations (create all 13 tables from db-schema.md)
- [ ] First commit and push to GitHub
- [ ] Deploy frontend to Vercel (connect to repo, auto-deploy)
- [ ] Deploy backend to Railway (connect to repo)

---

## Phase 1 — Onboarding (2.5 hours)

### 1.1 Skill baseline quiz
- [ ] 5 hardcoded questions (variables, loops, functions, debugging, data structures)
- [ ] Score → map to skill_tier: beginner | familiar | intermediate
- [ ] Store tier in user_preferences table
- [ ] UI: progress bar showing question 1/5, 2/5, etc.

### 1.2 Goal + time selection
- [ ] Goal selector: Job prep | Complete my course | DSA | General
- [ ] Time selector: 15 min | 20 min | 30 min
- [ ] Store in user_preferences table
- [ ] Friendly copy: "We'll make sure each day fits in your time"

### 1.3 URL input (optional step)
- [ ] Text input for YouTube/Udemy URL
- [ ] "Skip — use a default plan" option visible
- [ ] Show loading state when URL is submitted ("Gemini is watching your video...")
- [ ] Error state if URL is invalid or private
- [ ] On success: show plan preview (first 3 days)

---

## Phase 2 — Gemini URL parser (2 hours)

### 2.1 Backend parser endpoint
- [x] `POST /api/onboarding/parse-url`
- [x] URL type detection (YouTube video / playlist / Udemy / fallback)
- [x] Gemini 1.5 Pro API call with video parser prompt
- [x] Parse and validate response JSON
- [x] Store result in daily_plans table
- [x] Cache: skip Gemini call if same URL already parsed for this user

### 2.2 Fallback chain
- [x] If Gemini fails → topic-name input shown
- [x] Topic → Gemini generates default curriculum
- [x] If Gemini quota hit → return pre-generated default JS/Python plan

### 2.3 Demo day cache
- [x] Run parser on Traversy Media JS playlist before event
- [ ] Confirm result stored in DB
- [ ] Test: endpoint returns instantly on second call (cache hit)

---

## Phase 3 — Daily mission (2 hours)

### 3.1 Mission display
- [x] `GET /api/mission/today` — returns current day checkpoint
- [ ] Task 1 card: title, description, duration badge, comprehension check (3 questions)
- [ ] Task 2 card: title, description, duration badge
- [ ] Practice problem card: title, description, difficulty badge, starter code

### 3.2 Monaco code editor
- [ ] Install Monaco: `npm install @monaco-editor/react`
- [ ] Editor renders with starter code pre-filled
- [ ] Language detection from task context (JavaScript / Python)
- [x] "Submit" button calls `POST /api/mission/submit-practice`
- [ ] Show pass/fail state after submission

### 3.3 Task completion
- [x] `POST /api/mission/complete-task` — marks task 1 or task 2 done
- [ ] XP animation: number flies up on screen when XP awarded
- [ ] Tick animation on task card when completed
- [ ] Progress indicator: "2 of 3 tasks done today"

### 3.4 Day modes
- [ ] "Busy today" button visible on mission screen
- [ ] Busy day → serves 5-minute micro-task (single question from Task 1)
- [ ] "Skip day" button (less prominent than Busy day)
- [x] Both use freeze_count (decrement + check)

---

## Phase 4 — Streak system (45 minutes)

- [ ] Streak count displayed on dashboard (large number, prominent)
- [x] Streak increments on any task completion before midnight
- [ ] Freeze count displayed ("1 freeze available")
- [x] "Streak safe" indicator shown when freeze was used
- [x] Day indicator dots: show last 7 days (green = done, grey = missed, blue = frozen)

---

## Phase 5 — Stuck detection (1.5 hours)

- [ ] "I'm stuck" button on practice problem card
- [x] `POST /api/mission/stuck`
- [x] Backend: collect context (problem + topic + last 3 attempts + skill_tier)
- [x] Gemini 1.5 Flash call with targeted micro-lesson prompt
- [ ] Display micro-lesson inline below the problem (don't replace the editor)
- [x] Log hint_used = true in practice_attempts
- [ ] Loading state while Gemini responds ("Getting you unstuck...")
- [ ] Store pre-seeded demo: 3 failed attempts for JS closures on demo account

---

## Phase 6 — Contribution heatmap (1.5 hours)

### 6.1 Data layer
- [ ] contribution_events table trigger working (test with a manual insert)
- [ ] contributions table updating correctly on trigger fire
- [ ] `GET /api/heatmap/:user_id` endpoint returning 365 days

### 6.2 Heatmap component
- [ ] 53 columns × 7 rows grid
- [ ] Green intensity: 5 shades based on `intensity` column (0–4)
- [ ] Special colours: purple (perfect_day), gold (streak_milestone), orange (room_win), blue (level_up)
- [ ] Hover tooltip: date + contribution count + breakdown
- [ ] Month labels above grid (Jan, Feb, ... Dec)
- [ ] Day labels on left (Mon, Wed, Fri)
- [ ] Legend below grid (Less → More, with special colour dots)

### 6.3 Filter buttons
- [ ] 4 filter buttons: All | Solo | Room | Quests
- [ ] Filter repains grid in real time (no refetch — use cached data + `types` JSON)
- [ ] Active filter highlighted

### 6.4 Stats panel
- [ ] Total contributions (last 365 days)
- [ ] Current streak
- [ ] Longest streak
- [ ] Active days

---

## Phase 7 — Daily sprint room (2 hours)

### 7.1 Room creation
- [ ] `POST /api/rooms/create` — generates 6-digit code
- [ ] Room creation UI: name input + type selector (just daily_sprint for MVP)
- [ ] Show created room code large on screen
- [ ] "Share on WhatsApp" link: `https://wa.me/?text=Join+my+DevPath+room:+devpath.app/join/KGEC42`
- [ ] Copy code button

### 7.2 Room joining
- [ ] `/join/[code]` route in frontend (Next App Router)
- [ ] `POST /api/rooms/join` — validates code, creates room_members row
- [ ] Room preview shown before confirming join (members, type, day)
- [ ] Redirect to room dashboard after joining

### 7.3 Live leaderboard
- [ ] `GET /api/rooms/:id/leaderboard` — current day standings
- [ ] Member rows: avatar + name + tasks_done/3 progress bar + XP earned
- [ ] Supabase Realtime: subscribe to `room_daily_log` changes on this room_id
- [ ] Fallback: poll `/api/rooms/:id/leaderboard` every 10 seconds if Realtime fails
- [ ] "Live" green dot indicator when Realtime is connected

### 7.4 Room activity feed
- [ ] Last 10 room_events displayed below leaderboard
- [ ] Each event: colored dot + description (e.g. "Aryan completed all 3 tasks · +25 XP")
- [ ] Nudge button: appears next to members who haven't started by default

---

## Phase 8 — XP + gamification (30 minutes)

- [ ] Gamification toggle in user settings (ON by default)
- [ ] XP bar in top nav: shows current XP and progress to next level
- [ ] Level badge in profile: Rookie | Coder | Builder | Hacker | Architect
- [ ] XP awarded on every relevant action (hook into existing completion endpoints)
- [ ] Level-up check after every XP award (compare old vs new level)

---

## Phase 9 — Polish before demo (1 hour)

- [ ] Loading spinners on all Gemini calls (3–8 second waits)
- [ ] Error boundaries on all AI-powered components
- [ ] Mobile-responsive layout check (judges may view on phone)
- [ ] Demo account fully seeded (run `npm run seed --prefix backend -- --demo`)
- [ ] Pre-cache Traversy Media JS playlist (`npm run precache --prefix backend -- <url>`)
- [ ] Test full demo flow end-to-end at least twice
- [ ] Confirm Supabase Realtime works in production (not just localhost)
- [ ] Confirm Gemini Flash responds in <3 seconds for stuck detection

---

## Bonus features (if time remains after Phase 9)

- [ ] Speed duel room type (1v1 live timer)
- [ ] Streak freeze visual indicator (snowflake on calendar)
- [ ] Badge unlock animation (confetti on award)
- [ ] Daily quest board (3 rotating quests)
- [ ] Shareable streak card (Canvas API → PNG download)
- [ ] Weekly leaderboard (opt-in, Level 5+)
- [ ] Recovery window UI (24h catch-up prompt)
- [ ] Study buddy system (match + shared streak view)

---

## Post-hackathon roadmap

- [ ] Month 1: Mobile-responsive polish + email daily reminders + 50 beta users
- [ ] Month 2: All 6 room types + full badge system + daily quests + 500 users
- [ ] Month 3: Shareable profile cards + ranked arena + first paid tier ($9/month)
- [ ] Month 4: Cohort mode for bootcamps + institution licensing
- [ ] Month 6: Mobile app (React Native)

---

## Build order recommendation

If starting fresh with 14 hours:

```
Hour 0-1:   Phase 0 (project setup + DB migrations)
Hour 1-3:   Phase 1 + Phase 2 (onboarding + Gemini parser) ← most complex
Hour 3-5:   Phase 3 (daily mission + Monaco editor)
Hour 5-6:   Phase 4 + Phase 5 (streak + stuck detection)
Hour 6-8:   Phase 7 (rooms — most impressive for demo)
Hour 8-9.5: Phase 6 (heatmap — visual wow factor)
Hour 9.5-10: Phase 8 (XP + gamification toggle)
Hour 10-11: Phase 9 (demo prep + polish)
Hour 11-14: Bonus features in priority order
```
