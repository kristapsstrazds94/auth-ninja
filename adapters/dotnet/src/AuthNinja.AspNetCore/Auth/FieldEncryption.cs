using System.Security.Cryptography;
using System.Text;

namespace AuthNinja.AspNetCore.Auth;

/// <summary>AES-256-GCM field encryption keyed from AUTH_NINJA_SECRET.</summary>
internal static class FieldEncryption
{
    private const string Version = "v1";
    private const int IvLength = 12;
    private const int KeyLength = 32;
    private const string ScryptSalt = "auth-ninja-field-encryption";

    public static string Encrypt(string plaintext, string secret)
    {
        if (plaintext.Length == 0)
        {
            throw new InvalidOperationException("Cannot encrypt empty field value");
        }

        var key = DeriveKey(secret);
        var iv = RandomNumberGenerator.GetBytes(IvLength);
        var plaintextBytes = Encoding.UTF8.GetBytes(plaintext);
        var ciphertext = new byte[plaintextBytes.Length];
        var tag = new byte[16];

        using var aes = new AesGcm(key, tag.Length);
        aes.Encrypt(iv, plaintextBytes, ciphertext, tag);

        var payload = new byte[iv.Length + ciphertext.Length + tag.Length];
        Buffer.BlockCopy(iv, 0, payload, 0, iv.Length);
        Buffer.BlockCopy(ciphertext, 0, payload, iv.Length, ciphertext.Length);
        Buffer.BlockCopy(tag, 0, payload, iv.Length + ciphertext.Length, tag.Length);

        return $"{Version}:{Base64UrlHelper.Encode(payload)}";
    }

    public static string Decrypt(string stored, string secret)
    {
        if (!stored.StartsWith($"{Version}:", StringComparison.Ordinal))
        {
            return stored;
        }

        var payload = Base64UrlHelper.Decode(stored[(Version.Length + 1)..]);
        if (payload.Length <= IvLength + 16)
        {
            throw new InvalidOperationException("Invalid encrypted field payload");
        }

        var iv = payload.AsSpan(0, IvLength);
        var tag = payload.AsSpan(payload.Length - 16, 16);
        var ciphertext = payload.AsSpan(IvLength, payload.Length - IvLength - 16);
        var plaintext = new byte[ciphertext.Length];

        using var aes = new AesGcm(DeriveKey(secret), tag.Length);
        aes.Decrypt(iv, ciphertext, tag, plaintext);

        return Encoding.UTF8.GetString(plaintext);
    }

    private static byte[] DeriveKey(string secret) =>
        Rfc2898DeriveBytes.Pbkdf2(
            secret,
            Encoding.UTF8.GetBytes(ScryptSalt),
            100_000,
            HashAlgorithmName.SHA256,
            KeyLength);
}
