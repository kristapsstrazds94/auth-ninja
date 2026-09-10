using AuthNinja.AspNetCore.Auth.Lockout;
using AuthNinja.AspNetCore.Auth.Services;
using AuthNinja.AspNetCore.Data;
using AuthNinja.AspNetCore.Data.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;

namespace AuthNinja.AspNetCore;

/// <summary>
/// Dependency injection registration for Auth-Ninja.
/// </summary>
public static class AuthNinjaServiceCollectionExtensions
{
    /// <summary>
    /// Registers Auth-Ninja options, services, and database context.
    /// </summary>
    public static IServiceCollection AddAuthNinja(
        this IServiceCollection services,
        Action<AuthNinjaOptions>? configure = null)
    {
        ArgumentNullException.ThrowIfNull(services);

        var optionsBuilder = services.AddOptions<AuthNinjaOptions>();
        if (configure is not null)
        {
            optionsBuilder.Configure(configure);
        }

        optionsBuilder.ValidateOnStart();

        services.TryAddEnumerable(
            ServiceDescriptor.Singleton<IValidateOptions<AuthNinjaOptions>, AuthNinjaOptionsValidator>());

        services.AddDbContext<AuthNinjaDbContext>((sp, dbOptions) =>
        {
            var authOptions = sp.GetRequiredService<IOptions<AuthNinjaOptions>>().Value;
            if (string.IsNullOrWhiteSpace(authOptions.DatabaseUrl))
            {
                throw new InvalidOperationException("AUTH_NINJA_DATABASE_URL is required for AuthNinjaDbContext.");
            }

            dbOptions.UseNpgsql(authOptions.DatabaseUrl, npgsql =>
            {
                npgsql.MigrationsAssembly(typeof(AuthNinjaDbContext).Assembly.GetName().Name);
                npgsql.MapEnum<AuditEventType>("audit_event_type");
                npgsql.MapEnum<CredentialType>("credential_type");
            });
        });

        services.AddSingleton<ILockoutStore, InMemoryLockoutStore>();
        services.AddScoped<LockoutEngine>();
        services.AddScoped<SessionService>();
        services.AddScoped<AuditService>();
        services.AddScoped<AuthService>();

        return services;
    }
}
