# DevPath Backend Demo Checklist

- [ ] Run `npm run seed:demo` — confirm no errors
- [ ] Run `npm run precache` — confirm "Plan cached successfully"
- [ ] Run `npm run check:prod` — confirm all 8 checks green
- [ ] Open `src/scripts/test-realtime.html` — confirm 🟢 Realtime connected
- [ ] Hit `GET /api/heatmap/DEMO_USER_ID` in browser — confirm 365 days returned
- [ ] Hit `GET /api/rooms/KGEC42_ROOM_ID/leaderboard` — confirm 3 members with correct standings
- [ ] Hit `GET /api/me/xp` with `x-user-id` header — confirm level 2, ~350 XP
- [ ] Hit `GET /api/me/badges` — confirm 6 badges returned
- [ ] Confirm Railway deployment is live (not localhost)
- [ ] Confirm Gemini Flash responds in <3 seconds (test the stuck endpoint)
- [ ] Do a full end-to-end demo dry run — time it (target: under 6 minutes)
