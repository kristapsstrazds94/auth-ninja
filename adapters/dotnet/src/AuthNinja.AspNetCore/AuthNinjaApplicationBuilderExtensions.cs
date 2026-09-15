using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace AuthNinja.AspNetCore;

/// <summary>
/// HTTP pipeline registration for Auth-Ninja.
/// </summary>
public static class AuthNinjaApplicationBuilderExtensions
{
    /// <summary>
    /// Adds Auth-Ninja middleware (rate limit, CSRF, IP audit). Call <c>MapAuthNinja()</c> to register endpoints.
    /// </summary>
    public static IApplicationBuilder UseAuthNinja(this IApplicationBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        var authOptions = app.ApplicationServices.GetRequiredService<IOptions<AuthNinjaOptions>>().Value;
        if (authOptions.CorsOrigins is { Length: > 0 })
        {
            app.UseCors(AuthNinjaCorsPolicy.Name);
        }

        return app.UseMiddleware<AuthNinjaMiddleware>();
    }
}
