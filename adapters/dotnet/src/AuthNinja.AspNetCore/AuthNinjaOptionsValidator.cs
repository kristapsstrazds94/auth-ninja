using Microsoft.Extensions.Options;

namespace AuthNinja.AspNetCore;

internal sealed class AuthNinjaOptionsValidator : IValidateOptions<AuthNinjaOptions>
{
    public ValidateOptionsResult Validate(string? name, AuthNinjaOptions options)
    {
        var failures = new List<string>();

        if (string.IsNullOrWhiteSpace(options.Secret))
        {
            failures.Add("AUTH_NINJA_SECRET is required.");
        }
        else if (AuthNinjaSecretValidation.IsWeakSecret(options.Secret))
        {
            failures.Add("AUTH_NINJA_SECRET is too weak — use at least 32 random characters.");
        }

        if (string.IsNullOrWhiteSpace(options.BaseUrl))
        {
            failures.Add("AUTH_NINJA_BASE_URL is required.");
        }
        else if (!Uri.TryCreate(options.BaseUrl, UriKind.Absolute, out _))
        {
            failures.Add("AUTH_NINJA_BASE_URL must be a valid URL.");
        }

        if (string.IsNullOrWhiteSpace(options.DatabaseUrl))
        {
            failures.Add("AUTH_NINJA_DATABASE_URL is required.");
        }

        if (options.SessionIdleMinutes <= 0)
        {
            failures.Add("SessionIdleMinutes must be positive.");
        }

        if (options.SessionAbsoluteHours <= 0)
        {
            failures.Add("SessionAbsoluteHours must be positive.");
        }

        if (options.LockoutMaxAttempts <= 0)
        {
            failures.Add("LockoutMaxAttempts must be positive.");
        }

        if (options.LockoutWindowMinutes <= 0)
        {
            failures.Add("LockoutWindowMinutes must be positive.");
        }

        if (options.LockoutDurationMinutes <= 0)
        {
            failures.Add("LockoutDurationMinutes must be positive.");
        }

        if (string.IsNullOrWhiteSpace(options.TwoFaIssuer))
        {
            failures.Add("TwoFaIssuer is required.");
        }

        if (string.IsNullOrWhiteSpace(options.PasskeyRpId))
        {
            failures.Add("PasskeyRpId is required.");
        }

        if (options.ApiRateLimitPerMinute <= 0)
        {
            failures.Add("ApiRateLimitPerMinute must be positive.");
        }

        if (!string.IsNullOrWhiteSpace(options.RedisUrl) &&
            !Uri.TryCreate(options.RedisUrl, UriKind.Absolute, out _))
        {
            failures.Add("RedisUrl must be a valid URL when set.");
        }

        return failures.Count == 0
            ? ValidateOptionsResult.Success
            : ValidateOptionsResult.Fail(failures);
    }
}
