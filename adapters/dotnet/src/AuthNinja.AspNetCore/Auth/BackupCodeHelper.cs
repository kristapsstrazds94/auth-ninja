using System.Security.Cryptography;
using System.Text;

namespace AuthNinja.AspNetCore.Auth;

internal static class BackupCodeHelper
{
    public const int DefaultCount = 10;
    public const int CodeLength = 10;

    private const string Alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    public static string Normalize(string code) =>
        code.Trim().ToUpperInvariant().Replace("-", "", StringComparison.Ordinal);

    public static string[] Generate(int count = DefaultCount)
    {
        if (count < 1)
        {
            throw AuthErrors.Create(AuthErrorCode.ValidationError, "Backup code count must be positive.");
        }

        var codes = new HashSet<string>(StringComparer.Ordinal);

        while (codes.Count < count)
        {
            codes.Add(GenerateOne());
        }

        return [.. codes];
    }

    public static string[] HashCodes(IEnumerable<string> codes) =>
        codes.Select(code =>
        {
            var normalized = Normalize(code);
            if (normalized.Length is < 8 or > 32)
            {
                throw AuthErrors.Create(AuthErrorCode.ValidationError);
            }

            return PasswordHasher.HashPassword(normalized);
        }).ToArray();

    public static bool Verify(string code, string codeHash)
    {
        if (code.Length == 0 || codeHash.Length == 0)
        {
            return false;
        }

        var normalized = Normalize(code);
        if (normalized.Length is < 8 or > 32)
        {
            return false;
        }

        return PasswordHasher.VerifyPassword(normalized, codeHash);
    }

    private static string GenerateOne()
    {
        var bytes = RandomNumberGenerator.GetBytes(CodeLength);
        var builder = new StringBuilder(CodeLength);

        foreach (var b in bytes)
        {
            builder.Append(Alphabet[b % Alphabet.Length]);
        }

        return builder.ToString();
    }
}
