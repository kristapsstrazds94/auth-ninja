namespace AuthNinja.AspNetCore.Auth;

/// <summary>Password strength checks aligned with @auth-ninja/core zxcvbn defaults.</summary>
internal static class PasswordStrengthHelper
{
    private static readonly HashSet<string> WeakPasswords = new(StringComparer.Ordinal)
    {
        "password",
        "12345678",
        "qwerty123",
        "letmein1",
        "welcome1",
    };

    public static bool IsStrongEnough(string password, int minScore = 2)
    {
        if (password.Length < 8)
        {
            return false;
        }

        if (WeakPasswords.Contains(password))
        {
            return false;
        }

        var score = EstimateScore(password);
        return score >= minScore;
    }

    private static int EstimateScore(string password)
    {
        if (password.Length >= 20 && password.Contains('-', StringComparison.Ordinal))
        {
            return 4;
        }

        if (password.Length >= 16)
        {
            return 3;
        }

        var hasLower = password.Any(char.IsLower);
        var hasUpper = password.Any(char.IsUpper);
        var hasDigit = password.Any(char.IsDigit);
        var hasSymbol = password.Any(ch => !char.IsLetterOrDigit(ch));
        var variety = new[] { hasLower, hasUpper, hasDigit, hasSymbol }.Count(x => x);

        if (password.Length >= 12 && variety >= 3)
        {
            return 3;
        }

        if (password.Length >= 10 && variety >= 2)
        {
            return 2;
        }

        if (password.Length >= 8 && variety >= 2)
        {
            return 1;
        }

        return 0;
    }
}
