using System.Security.Cryptography;
using System.Text;
using Konscious.Security.Cryptography;

namespace AuthNinja.AspNetCore.Auth;

/// <summary>Argon2id password hashing — OWASP-aligned defaults matching @auth-ninja/core.</summary>
internal static class PasswordHasher
{
    private const int MemorySizeKb = 19456;
    private const int Iterations = 2;
    private const int Parallelism = 1;
    private const int SaltSize = 16;
    private const int HashSize = 32;

    public static string HashPassword(string password)
    {
        if (password.Length == 0)
        {
            throw AuthErrors.Create(AuthErrorCode.ValidationError, "Password must not be empty");
        }

        var salt = RandomNumberGenerator.GetBytes(SaltSize);
        var hash = HashBytes(Encoding.UTF8.GetBytes(password), salt);
        return FormatPhc(salt, hash);
    }

    private static readonly Lazy<string> DummyPasswordHash = new(() =>
        HashPassword("__auth_ninja_timing_dummy__"));

    public static bool VerifyPassword(string password, string passwordHash)
    {
        if (password.Length == 0 || passwordHash.Length == 0)
        {
            return false;
        }

        try
        {
            if (!TryParsePhc(passwordHash, out var salt, out var expectedHash))
            {
                return false;
            }

            var actualHash = HashBytes(Encoding.UTF8.GetBytes(password), salt);
            return CryptographicOperations.FixedTimeEquals(actualHash, expectedHash);
        }
        catch
        {
            return false;
        }
    }

    /// <summary>Always runs Argon2id to reduce login timing side channels.</summary>
    public static bool VerifyPasswordWithTimingProtection(string password, string? passwordHash)
    {
        var hashToVerify = passwordHash ?? DummyPasswordHash.Value;
        var matches = VerifyPassword(password, hashToVerify);
        return !string.IsNullOrEmpty(passwordHash) && matches;
    }

    private static byte[] HashBytes(byte[] password, byte[] salt)
    {
        var argon2 = new Argon2id(password)
        {
            Salt = salt,
            DegreeOfParallelism = Parallelism,
            MemorySize = MemorySizeKb,
            Iterations = Iterations,
        };

        return argon2.GetBytes(HashSize);
    }

    private static string FormatPhc(byte[] salt, byte[] hash)
    {
        return $"$argon2id$v=19$m={MemorySizeKb},t={Iterations},p={Parallelism}$" +
               $"{Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
    }

    private static bool TryParsePhc(string phc, out byte[] salt, out byte[] hash)
    {
        salt = [];
        hash = [];

        // PHC: $argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>
        var parts = phc.Split('$', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length < 5 || parts[0] != "argon2id")
        {
            return false;
        }

        try
        {
            salt = Convert.FromBase64String(parts[^2]);
            hash = Convert.FromBase64String(parts[^1]);
            return salt.Length > 0 && hash.Length > 0;
        }
        catch
        {
            return false;
        }
    }
}
