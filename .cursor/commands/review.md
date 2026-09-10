---
description: Security-focused review of recent Auth-Ninja changes
---

Review uncommitted or recent changes with an auth-security lens.

Check against `.cursor/rules/auth-ninja-security.mdc` and `AGENTS.md` hard rules:

- Session storage (HttpOnly cookies only)
- Password hashing (Argon2id)
- Generic error messages (no user enumeration)
- CSRF, rate limiting, lockout
- No secrets in logs or client bundle
- Constant-time comparisons for secrets
- OpenAPI updated if endpoints changed
- No UI components added to `packages/react`

Output: severity-ordered findings (critical / high / medium / low). Suggest fixes but do not implement unless asked.
