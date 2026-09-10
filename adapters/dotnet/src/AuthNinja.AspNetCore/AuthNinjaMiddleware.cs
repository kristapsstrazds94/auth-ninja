using Microsoft.AspNetCore.Http;

namespace AuthNinja.AspNetCore;

/// <summary>
/// Placeholder middleware registered by <see cref="AuthNinjaApplicationBuilderExtensions.UseAuthNinja"/>.
/// Endpoint wiring lands in later adapter tasks.
/// </summary>
internal sealed class AuthNinjaMiddleware(RequestDelegate next)
{
    public Task InvokeAsync(HttpContext context) => next(context);
}
