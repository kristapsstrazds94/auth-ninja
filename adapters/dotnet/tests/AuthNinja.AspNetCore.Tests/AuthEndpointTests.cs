using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using AuthNinja.AspNetCore.Auth;
using AuthNinja.AspNetCore.Endpoints;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Testcontainers.PostgreSql;

namespace AuthNinja.AspNetCore.Tests;

public sealed class AuthEndpointTests : IAsyncLifetime
{
    private const string TestSecret = "test-secret-min-32-chars-long-!!";
    private const string TestPassword = "secure-password-1";
    private const string TestEmail = "cycle@test.local";

    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .Build();

    public async Task InitializeAsync() => await _postgres.StartAsync();

    public async Task DisposeAsync() => await _postgres.DisposeAsync();

    [Fact]
    public async Task RegisterSessionLogout_CompletesBasicAuthLifecycle()
    {
        using var host = await CreateHostAsync();
        var client = host.GetTestClient();

        var register = await PostJsonAsync(client, "/auth/register", new { email = TestEmail, password = TestPassword });
        Assert.Equal(HttpStatusCode.Created, register.StatusCode);

        var sessionToken = ExtractSessionCookie(register);
        Assert.False(string.IsNullOrEmpty(sessionToken));

        var sessionRequest = new HttpRequestMessage(HttpMethod.Get, "/auth/session");
        sessionRequest.Headers.Add("Cookie", $"{AuthConstants.SessionCookieName}={sessionToken}");
        var session = await client.SendAsync(sessionRequest);
        Assert.Equal(HttpStatusCode.OK, session.StatusCode);

        var sessionBody = await session.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(sessionBody.GetProperty("authenticated").GetBoolean());
        Assert.Equal(TestEmail, sessionBody.GetProperty("user").GetProperty("email").GetString());

        var logoutRequest = new HttpRequestMessage(HttpMethod.Post, "/auth/logout");
        logoutRequest.Headers.Add("Cookie", $"{AuthConstants.SessionCookieName}={sessionToken}");
        var logout = await client.SendAsync(logoutRequest);
        Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);

        var expiredSessionRequest = new HttpRequestMessage(HttpMethod.Get, "/auth/session");
        expiredSessionRequest.Headers.Add("Cookie", $"{AuthConstants.SessionCookieName}={sessionToken}");
        var expiredSession = await client.SendAsync(expiredSessionRequest);
        Assert.Equal(HttpStatusCode.Unauthorized, expiredSession.StatusCode);

        var error = await expiredSession.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("SESSION_EXPIRED", error.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Login_WithInvalidCredentials_ReturnsGeneric401()
    {
        using var host = await CreateHostAsync();
        var client = host.GetTestClient();

        await PostJsonAsync(client, "/auth/register", new { email = TestEmail, password = TestPassword });

        var login = await PostJsonAsync(
            client,
            "/auth/login",
            new { email = TestEmail, password = "wrong-password-value" });

        Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);

        var body = await login.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("INVALID_CREDENTIALS", body.GetProperty("code").GetString());
        Assert.Equal("Invalid email or password.", body.GetProperty("message").GetString());
    }

    [Fact]
    public async Task Register_WithDuplicateEmail_ReturnsGeneric409()
    {
        using var host = await CreateHostAsync();
        var client = host.GetTestClient();

        var first = await PostJsonAsync(client, "/auth/register", new { email = TestEmail, password = TestPassword });
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);

        var duplicate = await PostJsonAsync(client, "/auth/register", new { email = TestEmail, password = TestPassword });
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);

        var body = await duplicate.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("VALIDATION_ERROR", body.GetProperty("code").GetString());
        Assert.Equal("Unable to complete registration.", body.GetProperty("message").GetString());
    }

    [Fact]
    public async Task Csrf_ReturnsTokenAtLeast32Chars()
    {
        using var host = await CreateHostAsync();
        var client = host.GetTestClient();

        var response = await client.GetAsync("/auth/csrf");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        var token = body.GetProperty("token").GetString();
        Assert.NotNull(token);
        Assert.True(token.Length >= 32);
    }

    [Fact]
    public async Task Register_WithInvalidBody_Returns400()
    {
        using var host = await CreateHostAsync();
        var client = host.GetTestClient();

        var response = await PostJsonAsync(client, "/auth/register", new { email = "not-an-email", password = "short" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private async Task<IHost> CreateHostAsync()
    {
        var connectionString = _postgres.GetConnectionString();

        var host = await new HostBuilder()
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
                    app.UseEndpoints(endpoints => endpoints.MapAuthNinja());
                });
            })
            .StartAsync();

        return host;
    }

    private static async Task<HttpResponseMessage> PostJsonAsync(HttpClient client, string path, object body)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, path)
        {
            Content = JsonContent.Create(body),
        };
        request.Content.Headers.ContentType = new MediaTypeHeaderValue("application/json");
        return await client.SendAsync(request);
    }

    private static string? ExtractSessionCookie(HttpResponseMessage response)
    {
        if (!response.Headers.TryGetValues("Set-Cookie", out var cookies))
        {
            return null;
        }

        var pattern = new Regex($"{AuthConstants.SessionCookieName}=([^;]+)");
        foreach (var cookie in cookies)
        {
            var match = pattern.Match(cookie);
            if (match.Success && match.Groups[1].Value.Length > 0)
            {
                return match.Groups[1].Value;
            }
        }

        return null;
    }
}
