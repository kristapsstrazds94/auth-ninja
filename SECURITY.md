# Security Policy

Auth-Ninja handles credentials and sessions. Treat misconfigurations as security incidents.

## Supported versions

| Version | Supported |
|---------|-----------|
| 0.0.x   | Development only — not production-ready |

## Reporting a vulnerability

Email your security contact (configure before public release). Do **not** open public GitHub issues for exploitable vulnerabilities.

Include:
- Description and impact
- Steps to reproduce
- Affected package/version

## Secure deployment checklist

- [ ] `AUTH_NINJA_SECRET` is ≥ 32 random bytes, stored in a secret manager
- [ ] HTTPS everywhere; `Secure` cookies enabled
- [ ] Redis enabled in production for distributed lockout/rate limits
- [ ] CSRF enabled (`AUTH_NINJA_CSRF_ENABLED=true`)
- [ ] Run `auth-ninja doctor` before deploy
- [ ] Never log passwords, TOTP seeds, session IDs, or recovery codes

## Threat model (summary)

See `docs/THREAT-MODEL.md` (task 1.0) for the full model. Key threats: credential stuffing, session hijacking, CSRF, user enumeration, passkey origin confusion.
