using AuthNinja.AspNetCore.Data.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace AuthNinja.AspNetCore.Data;

/// <summary>Design-time factory for EF Core CLI migrations.</summary>
public sealed class AuthNinjaDbContextFactory : IDesignTimeDbContextFactory<AuthNinjaDbContext>
{
    public AuthNinjaDbContext CreateDbContext(string[] args)
    {
        var raw = Environment.GetEnvironmentVariable("AUTH_NINJA_DATABASE_URL")
            ?? "Host=localhost;Database=auth_ninja;Username=postgres;Password=postgres";
        var connectionString = PostgreSqlConnectionString.Normalize(raw);

        var optionsBuilder = new DbContextOptionsBuilder<AuthNinjaDbContext>();
        optionsBuilder.UseNpgsql(connectionString, npgsql =>
        {
            npgsql.MigrationsAssembly(typeof(AuthNinjaDbContext).Assembly.GetName().Name);
            npgsql.MapEnum<AuditEventType>("audit_event_type");
            npgsql.MapEnum<CredentialType>("credential_type");
        });

        return new AuthNinjaDbContext(optionsBuilder.Options);
    }
}
