---
description: Verify a task's acceptance criteria against current code
---

The user wants verification, not new features.

1. Read the task row in `docs/TASKS.md` (ID from message or ask).
2. Inspect the codebase for evidence each **Done when** criterion is met.
3. Output a checklist: met / partial / missing — with file references.
4. List test commands the user should run if not already green.

Do not implement missing work unless the user asks. Do not change task status.
