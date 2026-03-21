Execute all pending backend items for Dev 1 Phase $ARGUMENTS from @docs/dev1.md.

Rules:
- Work phase-by-phase, task-by-task.
- Follow Node.js + Express architecture.
- Use `gemini-1.5-pro` only for parser/curriculum work.
- Use `gemini-1.5-flash` only for stuck-detection micro-lessons.
- Keep XP and contribution writes consistent with @docs/db-schema.md rules.

For each completed item:
- implement code
- add/update tests
- check off item in @docs/dev1.md

Before finishing:
- run backend checks/tests
- provide a concise progress report with:
  - completed items
  - remaining items
  - blockers (if any)
