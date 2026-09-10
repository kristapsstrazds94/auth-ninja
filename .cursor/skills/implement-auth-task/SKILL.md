---
name: implement-auth-task
description: >-
  Implements an Auth-Ninja task from docs/TASKS.md using the fixed
  implement-test-handoff protocol. Use when the user runs /next, /task,
  or asks to implement a numbered task ID.
---

# Implement an Auth-Ninja task

## Test handoff (required)

Two turns in the **same chat**:

1. **Implement turn** — Code + tests (write only). Set `docs/TASKS.md` to `in progress`. End with test commands and commit subject. **Stop.** Do not run tests. Do not set `done`.
2. **`tests passed` turn** — User ran commands and replied **`tests passed`**. Set `docs/TASKS.md` to **`done`**. Confirm in one line. **Stop.**

If the user pastes failures: fix only those, reprint commands, wait again.

**Implement-turn output (keep short):** task ID, copy-paste test commands, commit subject in a `text` fence, one line asking for **`tests passed`**.

```
Task: <id>
- [ ] 1. Load exit criteria from docs/TASKS.md
- [ ] 2. Confirm dependencies are done
- [ ] 3. Read existing code in target packages
- [ ] 4. Plan files to touch
- [ ] 5. Implement (security rules apply)
- [ ] 6. Write tests — do not run them
- [ ] 7. Print commands and stop
```

## 1. Load the task

Read `docs/TASKS.md` for this ID only. Capture: **ID**, **depends on**, **done when**, **likely paths** from `AGENTS.md`.

If unknown ID, stop.

## 2. Dependencies

If a dependency is not `done`, stop and name blockers. Do not implement another task's scope.

## 3. Read before write

Inspect owning package as it exists. Match naming, error codes, test style. Reuse `@auth-ninja/core` — do not duplicate validation.

## 4. Layer order by phase

| Phase | Typical order |
| --- | --- |
| 1 Core | protocol → config → crypto → errors |
| 2 React | fetch client → hooks (no UI components) |
| 3 Next | schema → routes → middleware → integration tests |
| 4 .NET | scaffold → EF schema → endpoints → middleware |
| 5 CLI | commands building on adapters |
| 6 Demo | pages in `demos/` only |
| 7 Release | CI gates, docs, publish |

Only touch layers the **Done when** line requires.

## 5. Security (always)

Follow `.cursor/rules/auth-ninja-security.mdc`:

- HttpOnly cookies for sessions
- Argon2id for passwords
- Generic login/register errors
- No secrets in logs or client bundle
- Update OpenAPI when adding endpoints
- No UI in `packages/react`

## 6. Tests

Write tests in the same change. Minimum:

- Happy path for new behavior
- One negative or security case (invalid input, lockout, CSRF, etc.)

Use Vitest in TS packages, xUnit in .NET.

## 7. Test commands by package

```bash
# Core
pnpm --filter @auth-ninja/core test
pnpm --filter @auth-ninja/core typecheck

# Protocol
pnpm --filter @auth-ninja/protocol test

# React
pnpm --filter @auth-ninja/react test

# Next
pnpm --filter @auth-ninja/next test

# CLI
pnpm --filter auth-ninja test

# Full build (when cross-package)
pnpm build
```

Adjust to only packages you changed.

## 8. Commit message format

```
task {ID}: {imperative summary}
```

Examples:
- `task 1.3: add Argon2id password hash and verify`
- `task 3.2: implement register and login route handlers`

Do not commit unless the user asks.
