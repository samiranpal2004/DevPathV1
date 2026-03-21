# DevPath — Product Requirements Document
**Version 2.0 | Binary v2 Hackathon | KGEC | March 2026**
**Status: CONFIDENTIAL — INTERNAL USE ONLY**

---

## 1. Executive Summary

DevPath is a smart, adaptive daily coding coach that guides beginner programmers
through consistent daily practice in just 15–20 minutes a day. It is not a
course. It is not a problem bank. It is the completion engine that sits on top
of courses the user already has — turning passive watching into structured
daily action.

> **Positioning:** "We are not another coding platform. We are the system
> that makes sure you don't quit."

The product solves the single most common failure mode in self-taught
programming: people start, get overwhelmed, and quit within weeks. DevPath
removes decision fatigue by generating a daily mission from any YouTube video
or playlist using Gemini's native video understanding — not just titles, but
actual content. It pairs this with a competitive room system for battling
friends and a GitHub-style contribution heatmap that makes every coding action
permanently visible.

---

## 2. Problem Statement

### 2.1 The core failure loop

The majority of beginners follow the same arc: discover a YouTube tutorial →
buy a Udemy course → hit a roadblock → no platform notices → quit silently.

Existing platforms fail at three specific moments:

- **Content overload:** Thousands of problems, no daily structure. Beginners don't know where to start.
- **No time awareness:** Courses assume 2–3 hours/day. Real students have 45 minutes between classes.
- **No error intelligence:** Nobody detects when a learner keeps making the same mistake.
- **No social accountability:** Learning alone is harder. No platform makes competing with friends easy.

### 2.2 Market evidence

MOOC completion rates average 5–15%. The problem is not motivation — it is
structure, time, and accountability. DevPath addresses all three simultaneously.

---

## 3. Solution Overview

### 3.1 What DevPath is

A web application that gives each learner a personalised daily mission — two
small tasks and one practice problem — generated from any YouTube video or
playlist they paste in. Gemini watches the video and understands it, generating
tasks tied to actual content. Users can do this solo or inside a competitive
room with friends. Every action paints a square on a personal contribution board.

### 3.2 What DevPath is NOT

- Not another course library or problem set
- Not competing with Udemy, YouTube, or LeetCode
- A completion engine and consistency layer built on top of those platforms

### 3.3 Key differentiators

| Differentiator | How it works | Why it wins |
|---|---|---|
| Gemini video parser | Paste URL → Gemini watches → generates precise daily tasks | Tasks reflect actual video content, not just titles. Zero YouTube API quota risk. |
| Daily mission system | Every day: 2 tasks + 1 problem. Zero decision fatigue. | Removes #1 reason beginners quit: not knowing what to do today. |
| Real-life modes | Busy day (5 min), Skip day (freeze), Normal day (full) | Only platform that treats time as a first-class constraint. |
| Stuck detection | "I'm stuck" → Gemini → targeted micro-lesson | A teacher available at midnight. |
| Competitive rooms | 6-digit code, up to 10 friends, real-time race | Turns solo grinding into a team sport. |
| Contribution heatmap | GitHub-style grid, every action counted, 4 filter modes | Permanent proof of work. Motivates through visible progress. |
| Gamification toggle | 6 layers: XP, streaks, levels, badges, quests, social. All optional. | Works for gamers AND serious learners. |

---

## 4. Target Users

| Segment | Description | Core pain point |
|---|---|---|
| Primary | College students learning from YouTube/Udemy | No structure, quit within weeks |
| Primary | Beginners with zero prior experience | Overwhelmed, don't know what to do daily |
| Secondary | Busy learners (job + coding) | Motivation but no consistent time blocks |
| Secondary | Friend groups wanting to learn competitively | No platform supports this |
| Out of scope | Experienced devs (2+ years) | Already have structure |

---

## 5. Feature Specifications

### 5.1 Onboarding

**Goal:** Place the user into the system with a personalised plan in under 2 minutes.

Steps in order:
1. **Goal selection** — MERN Stack / Complete my course / Learn DSA 
2. **Time budget** — 15 minutes / 20 minutes / 30 minutes / Flexible
3. **Skill quiz** — 5 questions (according to goal selection if user selects MERN or DSA it should call gemini and ask 5 question and if Goal is course then it should ask for url there  should not be any question asking for course)
   - Result: Absolute Beginner / Familiar with Basics / Intermediate
4. **Course URL (optional)** — YouTube playlist or single video URL
   - If provided: Gemini parses it → generates day plan according to the video content(if topic is easy then it can be covered in 1 day and if it is hard then according to the hardness)
   - If not: system uses goal to generate a default curriculum
5. **Plan preview** — Show first 3 days before user commits
  Flow -> Goal Selection -> time budget -> skill question/url paste -> planing
### 5.2 Gemini video parser pipeline

**This is the technical backbone. Replaces YouTube Data API v3 entirely.**

**Step 1 — URL detection**
Regex classifier identifies source type: YouTube single video, YouTube playlist,
Udemy course page, or topic-name fallback.

**Step 2 — Gemini video comprehension**
YouTube URL passed directly to Gemini 1.5 Pro. Gemini returns:
- Exact concepts explained (with timestamps)
- Code demonstrated
- Assumed prerequisites
- What the viewer can do after watching

No YouTube Data API quota consumed. Free tier: 1,500 requests/day.

**Step 3 — Structured curriculum generation**
Gemini comprehension JSON → second Gemini prompt → structured daily plan.
Groups into 15–20 minute daily blocks, infers difficulty progression,
generates Task 1, Task 2, and one practice problem per checkpoint.

**Step 4 — Cache and store**
Generated plan stored in `daily_plans` table as JSON.
**Demo day rule:** Pre-cache the Traversy Media JavaScript playlist the night
before. Show cached result instantly — zero latency risk.

**Supported sources:**
- `youtube.com/playlist?list=XXXX` — YouTube playlist
- `youtube.com/watch?v=XXXX` — YouTube single video
- `udemy.com/course/XXXX` — Udemy course (topic-name fallback if blocked)
- Manual topic name — if URL parsing fails

**Deprecated — do not use:**
- YouTube Data API v3 (replaced by Gemini)
- Udemy Affiliate API v2.0 (discontinued January 1, 2025)

### 5.3 Daily mission system

Every day the user opens the app, they see exactly what to do. No browsing,
no choosing, no decision fatigue.

**Daily mission structure:**
- **Task 1:** Core concept for today (~10 minutes) — watch checkpoint clip + 3-question comprehension check
- **Task 2:** Reinforcement activity (~5 minutes) — mini coding exercise in Monaco editor
- **Practice problem:** One coding challenge matched to today's topic (~10 minutes)

**Day modes:**

| Mode | What happens | Streak | XP |
|---|---|---|---|
| Normal day | Full mission: Task 1 + Task 2 + Practice | +1 | Up to 95 XP |
| Busy day | Single 5-minute micro-task only | Preserved (uses 1 freeze) | +5 XP |
| Skip day | No task, freeze used | Preserved (uses 1 freeze) | 0 XP |
| Perfect day | All 3 components in one session | +1 + milestone check | 1.2× multiplier |

### 5.4 Stuck detection

**Hackathon v1 — self-report trigger:**
"I'm stuck" button on every practice problem → sends problem context +
user's current topic + last 3 attempt results to Gemini 1.5 Flash →
returns targeted micro-lesson specific to the exact error pattern.

**Post-launch — automatic pattern detection:**
Track error submissions per concept. If user fails 3 consecutive problems on
the same topic type, automatically inject micro-lesson without requiring the
user to ask. Requires `practice_attempts` table with `error_type` column.

### 5.5 Room system

Rooms transform the solo daily mission into a competitive team experience.
Every room member gets the same daily plan and races to complete it.

**Creating a room:**
1. Choose room type
2. Name the room (e.g. "KGEC DSA Squad")
3. Set rules (topic, duration, max members, private/public)
4. Receive 6-digit code (e.g. KGEC42)
5. Share link: `devpath.app/join/KGEC42`

**Joining a room:**
1. Enter 6-digit code
2. Preview room (type, members, standings)
3. Accept → plan syncs to room curriculum
4. Live race begins

**Room types:**

| Type | Format | Players | Build phase |
|---|---|---|---|
| Daily sprint | Same mission, first to finish wins. Resets midnight. | 2–10 | Hackathon MVP |
| Speed duel | 1v1, same problem, live timer, first passing solution wins | 2 only | Hackathon bonus |
| 30-day challenge | Fixed 30-day plan, final leaderboard wins | 2–10 | Post-hackathon |
| Topic battle | Owner picks topic, all get AI-generated tasks | 2–10 | Post-hackathon |
| Cohort mode | Instructor-led, admin dashboard, up to 50 | Up to 50 | v2 |
| Ranked arena | Public matchmaking, ELO, weekly seasons. Level 4+ only | Public | v2 |

**Room XP events:**

| Event | XP |
|---|---|
| First in room to complete daily mission | +25 room bonus |
| Entire room completes on same day | +20 all members |
| Room 7-day streak (all members active) | +50 all members |
| Win a speed duel | +30 + ELO up |
| Nudge a dormant member who then completes | +10 assist bonus |

### 5.6 Gamification system (6 layers)

**Gamification toggle:** When OFF — XP accumulates silently, streak shows as
plain "days active", badges and leaderboard hidden, no animations. Data never lost.

**Layer 1 — XP engine (immutable event log)**

| Action | XP | Trigger |
|---|---|---|
| Complete daily task | +20 | Core loop |
| Solve practice problem | +30 | Mastery |
| Complete full day plan | +25 | Finishing |
| Daily streak bonus | +10 | Compounding |
| Solve without hints (bonus) | +15 | Variable reward |
| Busy day mini task | +5 | Showing up |
| Revisit weak topic | +10 | Growth mindset |
| Complete daily quest | +20–40 | Bonus loop |
| First in room to finish | +25 | Competition |
| Win speed duel | +30 | Head-to-head |
| 7-day streak milestone | +50 | Loss aversion payoff |

**Layer 2 — Levels and ranks**

| Level | Rank | XP | Unlocks |
|---|---|---|---|
| 1 | Rookie | 0 | Basic daily missions |
| 2 | Coder | 200 (~7 days) | Harder practice problems |
| 3 | Builder | 600 (~3 weeks) | Mini-project challenges |
| 4 | Hacker | 1,400 (~2 months) | Algorithm challenge mode |
| 5 | Architect | 3,000 (~6 months) | Leaderboard + mentor mode |

**Layer 3 — Streak system**
- Streak increments when any task is completed before midnight
- 1 freeze available at a time. Recharges after 7 days.
- Recovery window: 7+ day streak broken without freeze → 24h to catch up. One per 30 days.
- Milestones: 7, 14, 30, 100 days → full-screen animation + badge + bonus XP

**Layer 4 — Badges (permanent, never lost)**

| Badge | Trigger | Category |
|---|---|---|
| First step | Complete first task | First action |
| Problem solver | Solve first practice problem | First action |
| Course linked | Parse first URL | First action |
| Week warrior | 7-day streak | Streak milestone |
| On fire | 30-day streak | Streak milestone |
| Legend | 100-day streak | Streak milestone |
| Life happens | First streak freeze | Behaviour reward |
| Comeback kid | Return after 3+ day gap | Behaviour reward |
| Real life learner | Busy day used 5 times | Behaviour reward |
| Pure instinct | Solve without hints | Skill badge |
| Pattern hunter | Solve 25 problems | Volume milestone |
| Room champion | Win daily sprint 3 times | Room badge |
| Speed demon | Win 5 speed duels | Room badge |

**Layer 5 — Daily quests**
Bonus missions on top of daily plan. Reset every midnight. Optional.

| Quest | Description | XP |
|---|---|---|
| Speed run | Complete full plan in <18 min | +35 |
| No hints challenge | Solve practice without "I'm stuck" | +40 |
| Double or nothing | 2 extra problems from yesterday | +60 |
| Early bird | Complete mission before 9:00 AM | +25 |
| Streak defender | Complete any task before 11:59 PM | +20 |
| Teach it back | Write 3-sentence explanation (Level 3+) | +30 |

**Layer 6 — Social layer**
- Weekly leaderboard: opt-in, Level 5+. Top 10 by weekly XP. Resets Monday.
- Study buddy: accountability pairs. +10 XP if both complete same day.
- Shareable streak cards: generated at 7, 14, 30 days. Designed for WhatsApp/Instagram.
- Room activity feed: live stream of actions. Nudge button for dormant members.

### 5.7 Personal contribution heatmap

Lives on every user's personal profile page — NOT inside a room.
Shows all activity (solo + room) in one unified view.

**Grid:** 53 weeks × 7 days = 371 cells. Last 365 days.

**Contribution values:**

| Action | Count | Square colour |
|---|---|---|
| Complete a daily task | +1 | Green (intensity 0–4) |
| Solve a practice problem | +1 | Green |
| Complete a daily quest | +1 | Green |
| Win a room battle | +2 | Orange (special) |
| Perfect day (all 3 tasks) | Intensity 5 | Purple (special) |
| Streak milestone day | Intensity 5 | Gold (special) |
| Level-up day | Intensity 5 | Blue (special) |
| Busy day mini task | +0.5 | Light green (half intensity) |

**Filter modes (repaint grid in real time):**
- All activity
- Solo missions only
- Room battles only
- Quests only

**Stats panel below grid:**
- Total contributions (last 365 days)
- Current streak
- Longest streak
- Active days

**Shareable profile card:** Generated via Canvas API.
Shows avatar, rank, contributions, streak, XP, 90-day mini heatmap.
Public URL: `devpath.app/u/username`

---

## 6. Non-functional requirements

- **Gemini parser latency:** Target <8 seconds. Cache result immediately.
- **Room leaderboard update:** Target <2 seconds via Supabase Realtime.
- **Heatmap query:** Target <500ms. Query aggregated `contributions` table, not events.
- **Mobile:** Responsive design required. Monaco editor degrades gracefully on mobile.
- **Offline:** Show cached daily plan if no connection. Sync on reconnect.

---

## 7. Success Metrics (day 30 targets)

| Metric | Target | Why |
|---|---|---|
| Day 7 retention | >50% | Habit formation window |
| Day 30 retention | >25% | Beats edtech benchmark of 10–15% |
| Avg session length | 15–20 min | Product promise validation |
| Streak freeze usage | >30% of DAU | Shows streak engagement |
| Gemini parse success | >85% | Core feature reliability |
| Stuck → continued | >60% | Validates stuck detection value |
| Room creation rate | >20% of DAU | Social layer adoption |
| Heatmap share rate | >5% of milestone users | Viral coefficient |

---

## 8. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Gemini latency too high during demo | High | Pre-cache Traversy Media playlist night before |
| Gemini free tier quota exhausted | High | Cache all results. Use Flash for testing, Pro for real parses only. |
| Room real-time feels laggy | Medium | Supabase Realtime. Fallback: 10-second polling. |
| Judges ask: different from Duolingo? | Medium | "Duolingo builds its own curriculum. We work with the course you already bought." |
| Skill quiz feels like a test | Medium | Frame as "help us personalise your plan". Progress indicator. Under 2 minutes. |
| Stuck detection demo falls flat | Medium | Pre-seed demo account with 3 failed attempts on JS closures. |
| Gamification feels childish | Low | Demo ON, immediately show toggle, explain both user types. |

---

## 9. Hackathon Demo Script

**Opening (30 sec)**
"Every one of us has started a coding course and not finished it. Not because
we weren't smart enough. But because nobody told us what to do today. That is
what DevPath does."

**Act 1 — Onboarding (90 sec)**
Live 5-question quiz. Goal + time selection.
"The platform now knows exactly where this person is."

**Act 2 — Gemini parser (90 sec)**
Paste Traversy Media JS playlist URL (pre-cached).
"This person already bought this course. They never finished it. Now they have
a 30-day plan — built from the actual video content, not just the titles."

**Act 3 — Daily mission (60 sec)**
Show Day 1. Complete Task 1 live. XP animates. Streak ticks to 1.
"This is 15 minutes. That is the entire daily commitment."

**Act 4 — Stuck detection (60 sec)**
Press "I'm stuck" on practice problem. Gemini micro-lesson appears.
"When you're stuck at midnight, there is no teacher to call. Now there is."

**Act 5 — Room invite (45 sec)**
Create daily sprint room. Show 6-digit code.
"Now I invite my friend. Same plan, same problem. We race."

**Closing (30 sec)**
"We are not a course. We are not a problem platform. We are the system that
makes sure you do not quit. Every single day, for fifteen minutes, we tell
you exactly what to do next."
