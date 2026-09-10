# AuthNinja.AspNetCore

.NET 8 ASP.NET Core adapter — implements the same OpenAPI contract as `@auth-ninja/next`.

Implemented via `/next` tasks in phase 4 (`docs/TASKS.md`).

```csharp
builder.Services.AddAuthNinja(options => options.BindConfiguration(builder.Configuration));
app.UseAuthNinja();
```
