using Microsoft.Extensions.Configuration;

namespace AuthNinja.AspNetCore.Tests;

public sealed class AuthNinjaOptionsExtensionsTests
{
    [Fact]
    public void BindConfiguration_MapsRequiredEnvVars()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["AUTH_NINJA_SECRET"] = "test-secret-min-32-chars-long-!!",
                ["AUTH_NINJA_BASE_URL"] = "http://localhost:3000",
                ["AUTH_NINJA_DATABASE_URL"] = "postgresql://localhost:5432/auth_ninja",
                ["AUTH_NINJA_SESSION_IDLE_MINUTES"] = "20",
                ["AUTH_NINJA_REQUIRE_2FA"] = "true",
                ["AUTH_NINJA_API_RATE_LIMIT"] = "50",
            })
            .Build();

        var options = new AuthNinjaOptions().BindConfiguration(configuration);

        Assert.Equal("test-secret-min-32-chars-long-!!", options.Secret);
        Assert.Equal("http://localhost:3000", options.BaseUrl);
        Assert.Equal("postgresql://localhost:5432/auth_ninja", options.DatabaseUrl);
        Assert.Equal(20, options.SessionIdleMinutes);
        Assert.True(options.Require2Fa);
        Assert.Equal(50, options.ApiRateLimitPerMinute);
    }

    [Fact]
    public void BindConfiguration_MapsCorsOrigins()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["AUTH_NINJA_CORS_ORIGINS"] = "http://localhost:5174,http://127.0.0.1:5174",
            })
            .Build();

        var options = new AuthNinjaOptions().BindConfiguration(configuration);

        Assert.Equal(["http://localhost:5174", "http://127.0.0.1:5174"], options.CorsOrigins);
    }
}
