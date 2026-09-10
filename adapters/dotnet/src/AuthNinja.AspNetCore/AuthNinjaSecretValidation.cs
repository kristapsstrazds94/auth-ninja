namespace AuthNinja.AspNetCore;

internal static class AuthNinjaSecretValidation
{
    private static readonly string[] WeakSecretPlaceholders =
    [
        "changeme",
        "change-me",
        "your-secret-here",
        "replace-me",
        "secret",
        "password",
        "auth-ninja-secret",
    ];

    internal static bool IsWeakSecret(string secret)
    {
        if (secret.Length < 32)
        {
            return true;
        }

        var normalized = secret.Trim().ToLowerInvariant();

        if (WeakSecretPlaceholders.Contains(normalized))
        {
            return true;
        }

        if (secret.All(c => c == secret[0]))
        {
            return true;
        }

        if (secret.Distinct().Count() < 8)
        {
            return true;
        }

        const string sequential =
            "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

        for (var start = 0; start < sequential.Length; start++)
        {
            var pattern = string.Empty;
            while (pattern.Length < secret.Length)
            {
                pattern += sequential[start..];
            }

            if (secret == pattern[..secret.Length])
            {
                return true;
            }
        }

        return false;
    }
}
