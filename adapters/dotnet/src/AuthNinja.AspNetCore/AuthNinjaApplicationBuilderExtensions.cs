using Microsoft.AspNetCore.Builder;

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
        return app.UseMiddleware<AuthNinjaMiddleware>();
    }
}
