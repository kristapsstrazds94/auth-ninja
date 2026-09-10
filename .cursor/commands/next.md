---
description: Pick and implement the next Auth-Ninja task from docs/TASKS.md
---

Read **only** `docs/TASKS.md` to pick. Do not read other docs unless the chosen task requires it.

Choose **one** ID that can continue **now**:

1. Skip if any **Depends** ID is not `done`.
2. Skip if status is `done` or `blocked`.
3. Prefer the lowest ID in the earliest incomplete phase.
4. Phase 0 is complete — start at **1.0** unless a lower phase row is still open.

State briefly:
- Chosen ID and why
- Skipped candidates and why

Then implement **only** that ID using `.cursor/skills/implement-auth-task/SKILL.md`.

## Finish (same chat — do not wait for `/verify`)

1. Self-check against `.cursor/rules/auth-ninja-security.mdc`.
2. Set this ID in `docs/TASKS.md` to `in progress` if it was `not started`. **Never set `done` in this step.**
3. Print test commands for packages you changed. Never `pnpm test` at repo root unless the task touches all packages.
4. Commit subject in a `text` fence: `task {ID}: {imperative summary ≤72 chars}`. Do not `git commit` unless asked.
5. One line: reply **`tests passed`** when green. **Stop.**

## When the user replies `tests passed`

1. Set `docs/TASKS.md` to **`done`** (or **`blocked`** if leftover waits on a later ID).
2. Confirm in one short line. **Stop.** Do not start another ID.

When the user pastes **failures**: fix only those, reprint commands, wait again. Do not set `done`.
