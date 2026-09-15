# AuthNinja.AspNetCore

.NET 10 ASP.NET Core adapter — implements the same OpenAPI contract as `@auth-ninja/next`.

## Quick start

```csharp
using AuthNinja.AspNetCore;
using AuthNinja.AspNetCore.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddEnvironmentVariables();

builder.Services.AddAuthNinja(options => options.BindConfiguration(builder.Configuration));

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AuthNinjaDbContext>();
    await db.Database.MigrateAsync();
}

app.UseRouting();
app.UseAuthNinja();   // rate limit, CSRF, IP audit
app.MapAuthNinja();   // all auth endpoints

await app.RunAsync();
```

Place `AUTH_NINJA_*` variables in your API `.env` or user secrets. Set `AUTH_NINJA_BASE_URL` to the **browser-facing origin** (your Vite dev server). When the SPA calls the API directly, also set `AUTH_NINJA_CORS_ORIGINS`.

## Endpoints

`MapAuthNinja()` registers the full auth API under `/auth`:

| Route | Method | Description |
| --- | --- | --- |
| `/auth/register` | POST | Create account |
| `/auth/login` | POST | Sign in (may return MFA challenge) |
| `/auth/logout` | POST | Invalidate session |
| `/auth/session` | GET | Current user |
| `/auth/csrf` | GET | CSRF token |
| `/auth/password-reset/request` | POST | Request password reset |
| `/auth/password-reset/confirm` | POST | Confirm reset with token |
| `/auth/2fa/*` | various | TOTP enrollment, verify, backup codes |
| `/auth/passkeys/*` | various | WebAuthn register and login |

See [`packages/protocol/openapi.json`](../../packages/protocol/openapi.json) for request/response schemas.

## Database

EF Core entities mirror `@auth-ninja/next` Drizzle schema (`users`, `sessions`, `credentials`, `audit_events`, `password_reset_tokens`).

```bash
cd adapters/dotnet
export AUTH_NINJA_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/auth_ninja"
dotnet ef database update --project src/AuthNinja.AspNetCore/AuthNinja.AspNetCore.csproj
```

Migration integration tests use Testcontainers (Docker required).

## Build & test

```bash
cd adapters/dotnet
dotnet build AuthNinja.slnx
dotnet test AuthNinja.slnx
```

Full integration guide: [main README](../../README.md#integrate-dotnet) · Reference demo: [`demos/dotnet-spa/`](../../demos/dotnet-spa/)
