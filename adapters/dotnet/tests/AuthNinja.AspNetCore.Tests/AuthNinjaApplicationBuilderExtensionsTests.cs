using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace AuthNinja.AspNetCore.Tests;

public sealed class AuthNinjaApplicationBuilderExtensionsTests
{
    [Fact]
    public async Task UseAuthNinja_AllowsRequestsThroughPipeline()
    {
        using var host = await new HostBuilder()
            .ConfigureWebHost(webBuilder =>
            {
                webBuilder
                    .UseTestServer()
                    .ConfigureServices(services =>
                    {
                        services.AddAuthNinja(options =>
                        {
                            options.Secret = "test-secret-min-32-chars-long-!!";
                            options.BaseUrl = "http://localhost:3000";
                            options.DatabaseUrl = "postgresql://localhost:5432/auth_ninja";
                        });
                    })
                    .Configure(app =>
                    {
                        app.UseAuthNinja();
                        app.Run(async context =>
                        {
                            context.Response.StatusCode = StatusCodes.Status200OK;
                            await context.Response.WriteAsync("ok");
                        });
                    });
            })
            .StartAsync();

        var client = host.GetTestClient();
        var response = await client.GetAsync("/");

        Assert.Equal(System.Net.HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("ok", await response.Content.ReadAsStringAsync());
    }
}
