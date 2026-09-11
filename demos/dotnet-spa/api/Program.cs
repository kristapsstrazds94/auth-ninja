using AuthNinja.AspNetCore;
using AuthNinja.AspNetCore.Data;
using AuthNinja.AspNetCore.Endpoints;
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
app.UseAuthNinja();
app.MapAuthNinja();

await app.RunAsync();

public partial class Program;
