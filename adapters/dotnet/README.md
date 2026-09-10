# AuthNinja.AspNetCore

.NET 10 ASP.NET Core adapter — implements the same OpenAPI contract as `@auth-ninja/next`.

Implemented via `/next` tasks in phase 4 (`docs/TASKS.md`).

```csharp
builder.Services.AddAuthNinja(options => options.BindConfiguration(builder.Configuration));
app.UseAuthNinja();
```

## Build & test

```bash
cd adapters/dotnet
dotnet build AuthNinja.slnx
dotnet test AuthNinja.slnx
```
