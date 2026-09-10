using AuthNinja.AspNetCore.Auth.Services;
using AuthNinja.AspNetCore.Http;
using Microsoft.AspNetCore.Http;

namespace AuthNinja.AspNetCore.Middleware;

internal static class IpAuditHook
{
    public static async Task<IpAuditHookResult> RunAsync(
        AuthNinjaOptions config,
        AuditService audit,
        HttpContext context,
        CancellationToken cancellationToken = default)
    {
        if (!config.IpAuditEnabled)
        {
            return new IpAuditHookResult(Blocked: false);
        }

        var ipAddress = RequestMeta.GetIpAddress(context);
        if (IsIpAllowed(ipAddress, config.IpAllowlist))
        {
            return new IpAuditHookResult(Blocked: false);
        }

        await audit.PersistIpAuditAsync(
            "allowlist_violation",
            ipAddress,
            RequestMeta.GetUserAgent(context),
            DateTimeOffset.UtcNow,
            cancellationToken);

        return new IpAuditHookResult(Blocked: true, Reason: "allowlist_violation");
    }

    public static async Task RecordSuspiciousActivityAsync(
        AuthNinjaOptions config,
        AuditService audit,
        HttpContext context,
        CancellationToken cancellationToken = default)
    {
        if (!config.IpAuditEnabled)
        {
            return;
        }

        await audit.PersistIpAuditAsync(
            "suspicious_activity",
            RequestMeta.GetIpAddress(context),
            RequestMeta.GetUserAgent(context),
            DateTimeOffset.UtcNow,
            cancellationToken);
    }

    private static bool IsIpAllowed(string ipAddress, string[]? allowlist) =>
        allowlist is not { Length: > 0 } || allowlist.Contains(ipAddress);
}

internal readonly record struct IpAuditHookResult(bool Blocked, string? Reason = null);
