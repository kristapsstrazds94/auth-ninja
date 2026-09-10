using Microsoft.Extensions.Options;

namespace AuthNinja.AspNetCore.Tests;

public sealed class AuthNinjaSecretValidationTests
{
    [Fact]
    public void Validator_RejectsWeakSecret()
    {
        var validator = new AuthNinjaOptionsValidator();
        var result = validator.Validate(
            Options.DefaultName,
            new AuthNinjaOptions
            {
                Secret = "changeme",
                BaseUrl = "http://localhost:3000",
                DatabaseUrl = "postgresql://localhost:5432/auth_ninja",
            });

        Assert.False(result.Succeeded);
        Assert.NotNull(result.Failures);
        Assert.Contains(result.Failures, failure => failure.Contains("too weak", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void Validator_AcceptsStrongSecret()
    {
        var validator = new AuthNinjaOptionsValidator();
        var result = validator.Validate(
            Options.DefaultName,
            ValidOptions());

        Assert.True(result.Succeeded);
    }

    internal static AuthNinjaOptions ValidOptions() => new()
    {
        Secret = "test-secret-min-32-chars-long-!!",
        BaseUrl = "http://localhost:3000",
        DatabaseUrl = "postgresql://localhost:5432/auth_ninja",
    };
}
