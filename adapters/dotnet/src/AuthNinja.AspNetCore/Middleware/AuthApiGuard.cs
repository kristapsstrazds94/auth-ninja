using AuthNinja.AspNetCore.Auth;
using AuthNinja.AspNetCore.Auth.Services;
using AuthNinja.AspNetCore.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;

namespace AuthNinja.AspNetCore.Middleware;

internal static class AuthApiGuard
{
    private const int RateLimitWindowMs = 60_000;

    public static async Task<AuthApiGuardResult?> TryGuardAsync(
        HttpContext context,
        AuthNinjaOptions config,
        InMemoryRateLimiter rateLimiter,
        IServiceScopeFactory scopeFactory,
        string pathPrefix = AuthConstants.DefaultAuthPathPrefix,
        DateTimeOffset? now = null,
        CancellationToken cancellationToken = default)
    {
        var pathname = context.Request.Path.Value ?? string.Empty;
        if (!AuthApiPaths.IsAuthApiPath(pathname, pathPrefix))
        {
            return null;
        }

        var nowOffset = now ?? DateTimeOffset.UtcNow;
        var nowMs = nowOffset.ToUnixTimeMilliseconds();
        var ipAddress = RequestMeta.GetIpAddress(context);

        var rateLimit = rateLimiter.Check(ipAddress, config.ApiRateLimitPerMinute, RateLimitWindowMs, nowMs);
        if (!rateLimit.Allowed)
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var audit = scope.ServiceProvider.GetRequiredService<AuditService>();
            await IpAuditHook.RecordSuspiciousActivityAsync(config, audit, context, cancellationToken);

            return new AuthApiGuardResult(
                AuthErrors.Create(AuthErrorCode.RateLimited),
                rateLimit.RetryAfterSeconds);
        }

        await using (var scope = scopeFactory.CreateAsyncScope())
        {
            var audit = scope.ServiceProvider.GetRequiredService<AuditService>();
            var ipAudit = await IpAuditHook.RunAsync(config, audit, context, cancellationToken);
            if (ipAudit.Blocked)
            {
                return new AuthApiGuardResult(AuthErrors.Create(AuthErrorCode.Forbidden));
            }
        }

        if (config.CsrfEnabled &&
            AuthApiPaths.RequiresCsrfProtection(context.Request.Method, pathname, pathPrefix))
        {
            var csrfHeader = context.Request.Headers[AuthConstants.CsrfHeaderName].ToString();
            if (!CsrfToken.Verify(config.Secret ?? string.Empty, csrfHeader, nowOffset))
            {
                return new AuthApiGuardResult(AuthErrors.Create(AuthErrorCode.CsrfInvalid));
            }
        }

        return null;
    }
}

internal sealed class AuthApiGuardResult(AuthNinjaException error, int? retryAfterSeconds = null)
{
    public AuthNinjaException Error { get; } = error;

    public int? RetryAfterSeconds { get; } = retryAfterSeconds;
}
