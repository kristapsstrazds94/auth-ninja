using AuthNinja.AspNetCore.Auth;

namespace AuthNinja.AspNetCore.Tests;

public sealed class PasswordHasherTests
{
    private const string TestPassword = "secure-password-1";

    [Fact]
    public void HashPassword_ReturnsArgon2idPhcString()
    {
        var hash = PasswordHasher.HashPassword(TestPassword);

        Assert.StartsWith("$argon2id$", hash);
    }

    [Fact]
    public void HashPassword_ProducesDistinctSalts()
    {
        var first = PasswordHasher.HashPassword(TestPassword);
        var second = PasswordHasher.HashPassword(TestPassword);

        Assert.NotEqual(first, second);
    }

    [Fact]
    public void VerifyPassword_AcceptsMatchingPassword()
    {
        var hash = PasswordHasher.HashPassword(TestPassword);

        Assert.True(PasswordHasher.VerifyPassword(TestPassword, hash));
    }

    [Fact]
    public void VerifyPassword_RejectsWrongPassword()
    {
        var hash = PasswordHasher.HashPassword(TestPassword);

        Assert.False(PasswordHasher.VerifyPassword("wrong-password-value", hash));
    }

    [Fact]
    public void VerifyPassword_RejectsEmptyInputs()
    {
        var hash = PasswordHasher.HashPassword(TestPassword);

        Assert.False(PasswordHasher.VerifyPassword("", hash));
        Assert.False(PasswordHasher.VerifyPassword(TestPassword, ""));
    }
}
