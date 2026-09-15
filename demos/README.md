# Demos

Throwaway UI for manual and E2E testing. **Not published to npm.**

| Demo | Stack | Port |
|------|-------|------|
| `next-fullstack/` | React + Next.js | 3000 |
| `dotnet-spa/` | React (Vite) + .NET API | 5174 |
| `e2e/` | Playwright vs Next demo | — |

## Run locally (monorepo contributors)

```bash
pnpm install
pnpm build
pnpm demo              # React + Next.js → http://localhost:3000
pnpm demo:dotnet       # React + .NET → http://localhost:5174 (API on :5280)
```

Each demo uses its own Postgres database on the shared E2E server (`auth_ninja_e2e_next` vs `auth_ninja_e2e_dotnet`) so Drizzle and EF Core migrations never conflict. You can run `pnpm demo` and `pnpm demo:dotnet` in any order.

If a demo fails after a previous run, free its ports / stop stale processes and retry:

```bash
pnpm --filter @auth-ninja/demo-e2e postgres:down   # optional — reset all demo databases
pnpm demo:dotnet
```

The demo runner auto-stops processes still listening on demo ports before starting.

E2E: copy `demos/e2e/.env.example` to `demos/e2e/.env`, then `pnpm --filter @auth-ninja/demo-e2e test`.

Consumers install headless packages only — copy **patterns** from demos via the [README integration guide](../README.md#integrate), not the demo UI itself.
