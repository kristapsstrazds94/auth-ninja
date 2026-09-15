namespace AuthNinja.AspNetCore;

/// <summary>
/// Auth-Ninja configuration for ASP.NET Core hosts. Mirrors <c>@auth-ninja/core</c> settings.
/// </summary>
public sealed class AuthNinjaOptions
{
    public const string SectionName = "AuthNinja";

    public string? Secret { get; set; }

    public string? BaseUrl { get; set; }

    public string? DatabaseUrl { get; set; }

    public int SessionIdleMinutes { get; set; } = 15;

    public int SessionAbsoluteHours { get; set; } = 8;

    public int LockoutMaxAttempts { get; set; } = 5;

    public int LockoutWindowMinutes { get; set; } = 15;

    public int LockoutDurationMinutes { get; set; } = 30;

    public bool Require2Fa { get; set; }

    public string TwoFaIssuer { get; set; } = "AuthNinja";

    public bool PasskeysEnabled { get; set; } = true;

    public string PasskeyRpId { get; set; } = "localhost";

    public bool IpAuditEnabled { get; set; } = true;

    public string[]? IpAllowlist { get; set; }

    public bool CsrfEnabled { get; set; } = true;

    public int ApiRateLimitPerMinute { get; set; } = 100;

    public string? RedisUrl { get; set; }

    /// <summary>Allowed browser origins for cross-origin SPA + API dev (comma-separated env).</summary>
    public string[]? CorsOrigins { get; set; }

    /// <summary>Minimum password strength score (0–4). Default 2.</summary>
    public int PasswordMinScore { get; set; } = 2;
}
