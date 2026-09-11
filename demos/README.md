# Demos

Throwaway UI for manual and E2E testing. **Not published to npm.**

| Demo | Stack | Task |
|------|-------|------|
| `vite-react/` | Vite + React SPA | 6.1 |
| `next-fullstack/` | Next.js full-stack | 6.2 |
| `dotnet-spa/` | React SPA + .NET API | 6.3 |
| `e2e/` | Playwright vs Next demo | 6.4 |

Start with `pnpm dlx auth-ninja demo` once task 6.5 is done.

E2E: copy `demos/e2e/.env.example` to `demos/e2e/.env`, then `pnpm --filter @auth-ninja/demo-e2e test`. If your Postgres URL fails, the runner auto-starts Docker Compose (dynamic port). Stuck port/container: `pnpm --filter @auth-ninja/demo-e2e postgres:down` then retry.

Consumers install headless packages only — copy patterns from demos, not the demo UI itself.
