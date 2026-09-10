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
    /// Registers Auth-Ninja options and validation. Endpoints are added in later tasks.
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

        return services;
    }
}
