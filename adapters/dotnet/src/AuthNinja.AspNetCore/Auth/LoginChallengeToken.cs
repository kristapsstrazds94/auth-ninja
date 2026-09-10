using System.Security.Cryptography;
using System.Text;

namespace AuthNinja.AspNetCore.Auth;

internal static class LoginChallengeToken
{
    private const string Version = "v1";

    public static string Create(Guid userId, string secret, DateTimeOffset now)
    {
        var expiresAt = now.Add(AuthConstants.LoginChallengeTtl).ToUnixTimeMilliseconds();
        var payload = $"{Version}.{userId}.{expiresAt}";
        var signature = Sign(secret, payload);
        return $"{payload}.{signature}";
    }

    public static Guid? Verify(string token, string secret, DateTimeOffset now)
    {
        var parts = token.Split('.');
        if (parts.Length != 4)
        {
            return null;
        }

        var version = parts[0];
        var userIdRaw = parts[1];
        var expiresAtRaw = parts[2];
        var signature = parts[3];

        if (version != Version ||
            string.IsNullOrEmpty(userIdRaw) ||
            string.IsNullOrEmpty(expiresAtRaw) ||
            string.IsNullOrEmpty(signature))
        {
            return null;
        }

        if (!long.TryParse(expiresAtRaw, out var expiresAtMs) || expiresAtMs <= now.ToUnixTimeMilliseconds())
        {
            return null;
        }

        if (!Guid.TryParse(userIdRaw, out var userId))
        {
            return null;
        }

        var payload = $"{version}.{userIdRaw}.{expiresAtRaw}";
        var expected = Sign(secret, payload);

        var actualBytes = Encoding.UTF8.GetBytes(signature);
        var expectedBytes = Encoding.UTF8.GetBytes(expected);
        if (actualBytes.Length != expectedBytes.Length ||
            !CryptographicOperations.FixedTimeEquals(actualBytes, expectedBytes))
        {
            return null;
        }

        return userId;
    }

    private static string Sign(string secret, string payload)
    {
        var key = Encoding.UTF8.GetBytes(secret);
        var data = Encoding.UTF8.GetBytes(payload);
        var hash = HMACSHA256.HashData(key, data);
        return Convert.ToBase64String(hash)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }
}
