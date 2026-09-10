using AuthNinja.AspNetCore.Endpoints;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace AuthNinja.AspNetCore.Tests.Support;

internal static class AuthTestHostFactory
{
    public const string TestSecret = "test-secret-min-32-chars-long-!!";

    public static async Task<IHost> CreateAsync(string connectionString)
    {
        return await new HostBuilder()
            .ConfigureWebHost(webBuilder =>
            {
                webBuilder.UseTestServer();
                webBuilder.ConfigureServices(services =>
                {
                    services.AddRouting();
                    services.AddAuthNinja(options =>
                    {
                        options.Secret = TestSecret;
                        options.BaseUrl = "http://localhost:3000";
                        options.DatabaseUrl = connectionString;
                        options.LockoutMaxAttempts = 3;
                    });
                });
                webBuilder.Configure(app =>
                {
                    using var scope = app.ApplicationServices.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<Data.AuthNinjaDbContext>();
                    db.Database.Migrate();

                    app.UseRouting();
                    app.UseAuthNinja();
                    app.UseEndpoints(endpoints => endpoints.MapAuthNinja());
                });
            })
            .StartAsync();
    }
}
