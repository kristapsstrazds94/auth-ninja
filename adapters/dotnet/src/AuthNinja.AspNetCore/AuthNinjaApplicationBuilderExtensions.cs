using Microsoft.AspNetCore.Builder;

namespace AuthNinja.AspNetCore;

/// <summary>
/// HTTP pipeline registration for Auth-Ninja.
/// </summary>
public static class AuthNinjaApplicationBuilderExtensions
{
    /// <summary>
    /// Adds the Auth-Ninja middleware stub. Route handlers will be mapped in later tasks.
    /// </summary>
    public static IApplicationBuilder UseAuthNinja(this IApplicationBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);
        return app.UseMiddleware<AuthNinjaMiddleware>();
    }
}
