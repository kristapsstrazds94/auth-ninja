using System.Security.Cryptography;
using System.Text;

namespace AuthNinja.AspNetCore.Auth;

internal static class CsrfToken
{
    private const int MinLength = 32;

    public static string Generate(string secret, DateTimeOffset now)
    {
        var nonce = Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();
        var expiresAt = now.Add(AuthConstants.CsrfTokenTtl).ToUnixTimeMilliseconds();
        var payload = $"{nonce}.{expiresAt}";
        var signature = Sign(secret, payload);
        var token = $"{payload}.{signature}";

        if (token.Length < MinLength)
        {
            throw new InvalidOperationException("CSRF token shorter than minimum length.");
        }

        return token;
    }

    public static bool Verify(string secret, string? token, DateTimeOffset now)
    {
        if (string.IsNullOrEmpty(token) || token.Length < MinLength)
        {
            return false;
        }

        var parts = token.Split('.');
        if (parts.Length != 3)
        {
            return false;
        }

        var nonce = parts[0];
        var expiresAtRaw = parts[1];
        var signature = parts[2];

        if (string.IsNullOrEmpty(nonce) || string.IsNullOrEmpty(expiresAtRaw) || string.IsNullOrEmpty(signature))
        {
            return false;
        }

        if (!long.TryParse(expiresAtRaw, out var expiresAtMs) || now.ToUnixTimeMilliseconds() > expiresAtMs)
        {
            return false;
        }

        var payload = $"{nonce}.{expiresAtRaw}";
        var expected = Sign(secret, payload);
        return FixedTimeEqualsUtf8(signature, expected);
    }

    private static string Sign(string secret, string payload)
    {
        var key = Encoding.UTF8.GetBytes(secret);
        var data = Encoding.UTF8.GetBytes(payload);
        var hash = HMACSHA256.HashData(key, data);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private static bool FixedTimeEqualsUtf8(string a, string b)
    {
        var aBytes = Encoding.UTF8.GetBytes(a);
        var bBytes = Encoding.UTF8.GetBytes(b);
        return aBytes.Length == bBytes.Length && CryptographicOperations.FixedTimeEquals(aBytes, bBytes);
    }
}
