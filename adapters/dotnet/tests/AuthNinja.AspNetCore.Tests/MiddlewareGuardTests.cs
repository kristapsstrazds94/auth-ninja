using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AuthNinja.AspNetCore.Auth;
using AuthNinja.AspNetCore.Data;
using AuthNinja.AspNetCore.Data.Enums;
using AuthNinja.AspNetCore.Endpoints;
using AuthNinja.AspNetCore.Middleware;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Testcontainers.PostgreSql;

namespace AuthNinja.AspNetCore.Tests;

public sealed class MiddlewareGuardTests : IAsyncLifetime
{
    private const string TestSecret = "test-secret-min-32-chars-long-!!";

    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .Build();

    public async Task InitializeAsync() => await _postgres.StartAsync();

    public async Task DisposeAsync() => await _postgres.DisposeAsync();

    [Fact]
    public async Task NonAuthPath_PassesThroughWithoutGuard()
    {
        using var host = await CreateHostAsync();
        var client = host.GetTestClient();

        var response = await client.GetAsync("/api/health");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task PostLogin_WithoutCsrf_Returns403()
    {
        using var host = await CreateHostAsync();
        var client = host.GetTestClient();

        var response = await client.PostAsJsonAsync("/auth/login", new { email = "a@test.local", password = "x" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("CSRF_INVALID", body.GetProperty("code").GetString());
    }

    [Fact]
    public async Task PostLogin_WithValidCsrf_PassesGuard()
    {
        using var host = await CreateHostAsync();
        var client = host.GetTestClient();
        var csrf = await FetchCsrfTokenAsync(client);

        var request = new HttpRequestMessage(HttpMethod.Post, "/auth/login")
        {
            Content = JsonContent.Create(new { email = "a@test.local", password = "x" }),
        };
        request.Headers.Add(AuthConstants.CsrfHeaderName, csrf);

        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetSession_DoesNotRequireCsrf()
    {
        using var host = await CreateHostAsync();
        var client = host.GetTestClient();

        var response = await client.GetAsync("/auth/session");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("SESSION_EXPIRED", body.GetProperty("code").GetString());
    }

    [Fact]
    public async Task RateLimitExceeded_Returns429WithRetryAfter()
    {
        using var host = await CreateHostAsync(options => options.ApiRateLimitPerMinute = 2);
        var client = host.GetTestClient();
        const string ip = "203.0.113.10";

        await SendWithIpAsync(client, HttpMethod.Get, "/auth/session", ip);
        await SendWithIpAsync(client, HttpMethod.Get, "/auth/session", ip);

        var blocked = await SendWithIpAsync(client, HttpMethod.Get, "/auth/session", ip);

        Assert.Equal(HttpStatusCode.TooManyRequests, blocked.StatusCode);
        Assert.True(blocked.Headers.Contains("Retry-After"));
        var body = await blocked.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("RATE_LIMITED", body.GetProperty("code").GetString());
    }

    [Fact]
    public async Task IpNotOnAllowlist_Returns403AndPersistsAudit()
    {
        using var host = await CreateHostAsync(options =>
        {
            options.IpAllowlist = ["198.51.100.1"];
            options.CsrfEnabled = false;
        });

        const string ip = "203.0.113.55";
        var client = host.GetTestClient();
        var response = await SendWithIpAsync(client, HttpMethod.Get, "/auth/session", ip);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("FORBIDDEN", body.GetProperty("code").GetString());

        await using var scope = host.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AuthNinjaDbContext>();
        var audits = await db.AuditEvents
            .Where(e => e.IpAddress == ip && e.Type == AuditEventType.Ip)
            .ToListAsync();

        Assert.Single(audits);
        Assert.Equal("allowlist_violation", audits[0].Payload?.Reason);
    }

    [Fact]
    public async Task RateLimitBreach_RecordsSuspiciousActivityAudit()
    {
        using var host = await CreateHostAsync(options =>
        {
            options.ApiRateLimitPerMinute = 1;
            options.CsrfEnabled = false;
        });

        const string ip = "203.0.113.77";
        var client = host.GetTestClient();

        await SendWithIpAsync(client, HttpMethod.Get, "/auth/csrf", ip);
        await SendWithIpAsync(client, HttpMethod.Get, "/auth/csrf", ip);

        await using var scope = host.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AuthNinjaDbContext>();
        var audits = await db.AuditEvents
            .Where(e => e.IpAddress == ip && e.Type == AuditEventType.Ip)
            .ToListAsync();

        Assert.Contains(audits, audit => audit.Payload?.Reason == "suspicious_activity");
    }

    [Fact]
    public void CsrfToken_IsAtLeast32Characters()
    {
        var token = CsrfToken.Generate(TestSecret, DateTimeOffset.UtcNow);
        Assert.True(token.Length >= 32);
    }

    private async Task<IHost> CreateHostAsync(Action<AuthNinjaOptions>? configure = null)
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
                        configure?.Invoke(options);
                    });
                });
                webBuilder.Configure(app =>
                {
                    using var scope = app.ApplicationServices.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<AuthNinjaDbContext>();
                    db.Database.Migrate();

                    app.UseRouting();
                    app.UseAuthNinja();
                    app.UseEndpoints(endpoints => endpoints.MapAuthNinja());
                });
            })
            .StartAsync();

        return host;
    }

    private static async Task<string> FetchCsrfTokenAsync(HttpClient client)
    {
        var response = await client.GetAsync("/auth/csrf");
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("token").GetString()
            ?? throw new InvalidOperationException("Missing CSRF token.");
    }

    private static async Task<HttpResponseMessage> SendWithIpAsync(
        HttpClient client,
        HttpMethod method,
        string path,
        string ip)
    {
        var request = new HttpRequestMessage(method, path);
        request.Headers.Add("X-Forwarded-For", ip);
        return await client.SendAsync(request);
    }
}
