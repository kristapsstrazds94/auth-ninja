using AuthNinja.AspNetCore.Http;
using AuthNinja.AspNetCore.Middleware;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace AuthNinja.AspNetCore;

/// <summary>
/// Guards auth API requests: rate limit, IP audit hook, and CSRF validation.
/// </summary>
internal sealed class AuthNinjaMiddleware(
    RequestDelegate next,
    IOptions<AuthNinjaOptions> options,
    InMemoryRateLimiter rateLimiter,
    IServiceScopeFactory scopeFactory)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var guardResult = await AuthApiGuard.TryGuardAsync(
            context,
            options.Value,
            rateLimiter,
            scopeFactory,
            cancellationToken: context.RequestAborted);

        if (guardResult is not null)
        {
            await AuthHttpResults.WriteErrorAsync(
                context,
                guardResult.Error,
                guardResult.RetryAfterSeconds);
            return;
        }

        await next(context);
    }
}
