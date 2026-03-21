Write the Gemini integration for $ARGUMENTS in DevPath (Dev 1 backend scope).

Use @docs/dev1.md to determine where this belongs:
- `POST /api/onboarding/parse-url` → gemini-1.5-pro
- `POST /api/mission/stuck` → gemini-1.5-flash

Requirements:
- Load API key from `GEMINI_API_KEY` only.
- Keep Gemini calls in backend service layer (not inline in route handlers).
- Validate/parse model output strictly before persisting.
- Handle quota/latency errors with graceful fallback responses.
- Return consistent error shape for frontend handling.

After implementation:
- Add/update tests for success + quota-failure paths.
- Mark relevant checkbox(es) in @docs/dev1.md.