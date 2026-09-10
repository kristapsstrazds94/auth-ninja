---
description: Implement a specific Auth-Ninja task by ID (e.g. /task 1.2)
---

The user named a task ID. Parse it from the message (e.g. `1.2`, `3.4`, `6.1`).

1. Read that row in `docs/TASKS.md` only.
2. If the ID is unknown, stop and list valid IDs from the current phase.
3. If dependencies are not `done`, stop and name the blockers — do not implement blocked work.
4. Implement using `.cursor/skills/implement-auth-task/SKILL.md`.

Follow the same **Finish** and **`tests passed`** protocol as `.cursor/commands/next.md`.
