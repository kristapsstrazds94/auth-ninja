using AuthNinja.AspNetCore.Auth;

namespace AuthNinja.AspNetCore.Tests;

public sealed class TotpHelperTests
{
    [Fact]
    public void GenerateSecret_ReturnsBase32Secret()
    {
        var secret = TotpHelper.GenerateSecret();
        Assert.True(secret.Length >= 16);
    }

    [Fact]
    public void VerifyCode_AcceptsValidCode_RejectsInvalid()
    {
        var secret = TotpHelper.GenerateSecret();
        var code = TotpHelper.GenerateCode(secret);

        Assert.True(TotpHelper.VerifyCode(secret, code));
        Assert.False(TotpHelper.VerifyCode(secret, "000000"));
        Assert.False(TotpHelper.VerifyCode(secret, "abc"));
    }

    [Fact]
    public void BuildOtpAuthUrl_ContainsIssuerAndSecret()
    {
        var secret = TotpHelper.GenerateSecret();
        var url = TotpHelper.BuildOtpAuthUrl(secret, "AuthNinja", "user@test.local");

        Assert.StartsWith("otpauth://totp/", url);
        Assert.Contains(secret, url);
        Assert.Contains("AuthNinja", url);
    }
}
