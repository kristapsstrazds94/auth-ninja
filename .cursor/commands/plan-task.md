---
description: Plan an Auth-Ninja task without writing code
---

The user wants a plan only — **no code changes**.

1. Read the task row in `docs/TASKS.md` (from user message or ask for ID).
2. Read existing code in likely paths (`AGENTS.md` stack table).
3. Output:
   - Task ID and acceptance criteria
   - Dependency check
   - Files to create/modify
   - Security considerations (from `auth-ninja-security` rule)
   - Test plan (happy + negative cases)
   - Estimated scope (S/M/L)

Do not edit files. Do not run builds. Stop after the plan.
