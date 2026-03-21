Build the $ARGUMENTS feature for DevPath.

Context to follow (in order):
1) @docs/dev1.md (primary source of truth for your scope)
2) @docs/db-schema.md (for all DB writes/queries)
3) @docs/architecture.md and @docs/PRD.md (behavior + product intent)

Hard scope guardrails:
- Work only on Dev 1 backend scope (Phase 1–5): onboarding, parser, mission, streak/freeze, stuck detection.
- Stack is Node.js + Express only (no Python/FastAPI code).
- Keep Gemini model usage strict:
	- parser/curriculum: gemini-1.5-pro
	- stuck/micro-lesson: gemini-1.5-flash

Implementation requirements:
- Add/update route handlers, services, and validation schemas needed by the feature.
- Reuse existing DB rules (XP immutable via xp_events, contribution writes via contribution_events).
- Add or update tests relevant to the changed endpoints/logic.

Completion requirements:
- Mark completed checkbox(es) in @docs/dev1.md.
- If a matching line exists in @docs/tasks.md, mark it done there too.
- Run backend checks/tests and include a short summary of results.