using AuthNinja.AspNetCore.Data;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace AuthNinja.AspNetCore.Tests;

public sealed class AuthNinjaServiceCollectionExtensionsTests
{
    [Fact]
    public async Task AddAuthNinja_RegistersValidatedOptions()
    {
        using var host = Host.CreateDefaultBuilder()
            .ConfigureServices(services =>
            {
                services.AddAuthNinja(options =>
                {
                    options.Secret = "test-secret-min-32-chars-long-!!";
                    options.BaseUrl = "http://localhost:3000";
                    options.DatabaseUrl = "postgresql://localhost:5432/auth_ninja";
                });
            })
            .Build();

        await host.StartAsync();

        var options = host.Services.GetRequiredService<IOptions<AuthNinjaOptions>>().Value;
        Assert.Equal("http://localhost:3000", options.BaseUrl);

        await using (var scope = host.Services.CreateAsyncScope())
        {
            Assert.NotNull(scope.ServiceProvider.GetService<AuthNinjaDbContext>());
        }

        await host.StopAsync();
    }

    [Fact]
    public async Task AddAuthNinja_ValidateOnStart_RejectsInvalidConfiguration()
    {
        using var host = Host.CreateDefaultBuilder()
            .ConfigureServices(services =>
            {
                services.AddAuthNinja(options =>
                {
                    options.Secret = "short";
                    options.BaseUrl = "http://localhost:3000";
                    options.DatabaseUrl = "postgresql://localhost:5432/auth_ninja";
                });
            })
            .Build();

        await Assert.ThrowsAsync<OptionsValidationException>(() => host.StartAsync());
    }
}
