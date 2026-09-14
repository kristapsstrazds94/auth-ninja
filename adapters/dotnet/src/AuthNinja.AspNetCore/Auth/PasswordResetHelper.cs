using System.Security.Cryptography;
using System.Text;

namespace AuthNinja.AspNetCore.Auth;

internal static class PasswordResetHelper
{
    public const int TokenTtlSeconds = 3600;

    public static string GenerateToken() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');

    public static string HashToken(string token)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToBase64String(hash).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }
}
