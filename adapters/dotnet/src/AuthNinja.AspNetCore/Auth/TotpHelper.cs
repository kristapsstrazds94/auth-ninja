using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using OtpNet;

namespace AuthNinja.AspNetCore.Auth;

internal static class TotpHelper
{
    public const int Digits = 6;
    public const int PeriodSeconds = 30;
    public const int Window = 1;

    private static readonly Regex CodePattern = new("^[0-9]{6}$", RegexOptions.CultureInvariant);

    public static string GenerateSecret()
    {
        var key = KeyGeneration.GenerateRandomKey(20);
        return Base32Encoding.ToString(key);
    }

    public static string BuildOtpAuthUrl(string secret, string issuer, string accountName)
    {
        var encodedIssuer = Uri.EscapeDataString(issuer);
        var encodedAccount = Uri.EscapeDataString(accountName);
        return $"otpauth://totp/{encodedIssuer}:{encodedAccount}?secret={secret}&issuer={encodedIssuer}&digits={Digits}&period={PeriodSeconds}";
    }

    public static bool VerifyCode(string secret, string code, int window = Window)
    {
        if (!CodePattern.IsMatch(code) || string.IsNullOrEmpty(secret))
        {
            return false;
        }

        try
        {
            var key = Base32Encoding.ToBytes(secret);
            var totp = new Totp(key, step: PeriodSeconds, totpSize: Digits, mode: OtpHashMode.Sha1);
            return totp.VerifyTotp(code, out _, new VerificationWindow(window, window));
        }
        catch
        {
            return false;
        }
    }

    /// <summary>Generate the current TOTP code (testing only).</summary>
    internal static string GenerateCode(string secret)
    {
        var key = Base32Encoding.ToBytes(secret);
        var totp = new Totp(key, step: PeriodSeconds, totpSize: Digits, mode: OtpHashMode.Sha1);
        return totp.ComputeTotp();
    }
}
