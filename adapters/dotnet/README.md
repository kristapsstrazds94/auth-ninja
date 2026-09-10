# AuthNinja.AspNetCore

.NET 10 ASP.NET Core adapter — implements the same OpenAPI contract as `@auth-ninja/next`.

Implemented via `/next` tasks in phase 4 (`docs/TASKS.md`).

```csharp
builder.Services.AddAuthNinja(options => options.BindConfiguration(builder.Configuration));
app.UseAuthNinja();
```

## Database

EF Core entities mirror `@auth-ninja/next` Drizzle schema (`users`, `sessions`, `credentials`, `audit_events`).

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
