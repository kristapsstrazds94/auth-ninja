using Microsoft.Extensions.Configuration;

namespace AuthNinja.AspNetCore;

/// <summary>
/// Binds <see cref="AuthNinjaOptions"/> from <c>AUTH_NINJA_*</c> configuration keys.
/// </summary>
public static class AuthNinjaOptionsExtensions
{
    /// <summary>
    /// Reads Auth-Ninja settings from configuration (environment variables or appsettings).
    /// </summary>
    public static AuthNinjaOptions BindConfiguration(this AuthNinjaOptions options, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(options);
        ArgumentNullException.ThrowIfNull(configuration);

        options.Secret = ReadString(configuration, "AUTH_NINJA_SECRET") ?? options.Secret;
        options.BaseUrl = ReadString(configuration, "AUTH_NINJA_BASE_URL") ?? options.BaseUrl;
        options.DatabaseUrl = ReadString(configuration, "AUTH_NINJA_DATABASE_URL") ?? options.DatabaseUrl;

        if (TryReadPositiveInt(configuration, "AUTH_NINJA_SESSION_IDLE_MINUTES", out var sessionIdleMinutes))
        {
            options.SessionIdleMinutes = sessionIdleMinutes;
        }

        if (TryReadPositiveInt(configuration, "AUTH_NINJA_SESSION_ABSOLUTE_HOURS", out var sessionAbsoluteHours))
        {
            options.SessionAbsoluteHours = sessionAbsoluteHours;
        }

        if (TryReadPositiveInt(configuration, "AUTH_NINJA_LOCKOUT_MAX_ATTEMPTS", out var lockoutMaxAttempts))
        {
            options.LockoutMaxAttempts = lockoutMaxAttempts;
        }

        if (TryReadPositiveInt(configuration, "AUTH_NINJA_LOCKOUT_WINDOW_MINUTES", out var lockoutWindowMinutes))
        {
            options.LockoutWindowMinutes = lockoutWindowMinutes;
        }

        if (TryReadPositiveInt(configuration, "AUTH_NINJA_LOCKOUT_DURATION_MINUTES", out var lockoutDurationMinutes))
        {
            options.LockoutDurationMinutes = lockoutDurationMinutes;
        }

        if (TryReadBool(configuration, "AUTH_NINJA_REQUIRE_2FA", out var require2Fa))
        {
            options.Require2Fa = require2Fa;
        }

        var twoFaIssuer = ReadString(configuration, "AUTH_NINJA_2FA_ISSUER");
        if (twoFaIssuer is not null)
        {
            options.TwoFaIssuer = twoFaIssuer;
        }

        if (TryReadBool(configuration, "AUTH_NINJA_PASSKEYS_ENABLED", out var passkeysEnabled))
        {
            options.PasskeysEnabled = passkeysEnabled;
        }

        var passkeyRpId = ReadString(configuration, "AUTH_NINJA_PASSKEY_RP_ID");
        if (passkeyRpId is not null)
        {
            options.PasskeyRpId = passkeyRpId;
        }

        if (TryReadBool(configuration, "AUTH_NINJA_IP_AUDIT_ENABLED", out var ipAuditEnabled))
        {
            options.IpAuditEnabled = ipAuditEnabled;
        }

        var allowlist = ReadString(configuration, "AUTH_NINJA_IP_ALLOWLIST");
        if (allowlist is not null)
        {
            options.IpAllowlist = allowlist
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        }

        if (TryReadBool(configuration, "AUTH_NINJA_CSRF_ENABLED", out var csrfEnabled))
        {
            options.CsrfEnabled = csrfEnabled;
        }

        if (TryReadPositiveInt(configuration, "AUTH_NINJA_API_RATE_LIMIT", out var apiRateLimitPerMinute))
        {
            options.ApiRateLimitPerMinute = apiRateLimitPerMinute;
        }

        options.RedisUrl = ReadString(configuration, "AUTH_NINJA_REDIS_URL") ?? options.RedisUrl;

        return options;
    }

    private static string? ReadString(IConfiguration configuration, string key)
    {
        var value = configuration[key];
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return value.Trim();
    }

    private static bool TryReadPositiveInt(IConfiguration configuration, string key, out int value)
    {
        value = default;
        var raw = ReadString(configuration, key);
        if (raw is null || !int.TryParse(raw, out var parsed) || parsed <= 0)
        {
            return false;
        }

        value = parsed;
        return true;
    }

    private static bool TryReadBool(IConfiguration configuration, string key, out bool value)
    {
        value = default;
        var raw = ReadString(configuration, key);
        if (raw is null)
        {
            return false;
        }

        if (raw.Equals("true", StringComparison.OrdinalIgnoreCase) || raw == "1")
        {
            value = true;
            return true;
        }

        if (raw.Equals("false", StringComparison.OrdinalIgnoreCase) || raw == "0")
        {
            value = false;
            return true;
        }

        return false;
    }
}
