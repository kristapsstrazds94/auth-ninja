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

public sealed class PasskeyEndpointTests : IAsyncLifetime
{
    private const string TestSecret = "test-secret-min-32-chars-long-!!";
    private const string TestPassword = "secure-password-1";

    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .Build();

    public async Task InitializeAsync() => await _postgres.StartAsync();

    public async Task DisposeAsync() => await _postgres.DisposeAsync();

    [Fact]
    public async Task RegisterBegin_WithoutSession_Returns401()
    {
        using var host = await CreateHostAsync();
        var client = host.GetTestClient();

        var csrf = await FetchCsrfTokenAsync(client);
        var request = new HttpRequestMessage(HttpMethod.Post, "/auth/passkeys/register/begin");
        request.Headers.Add(AuthConstants.CsrfHeaderName, csrf);

        var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task RegisterBegin_WithSession_ReturnsWebAuthnOptions()
    {
        using var host = await CreateHostAsync();
        var client = host.GetTestClient();
        var sessionToken = await RegisterAsync(client, "passkey@test.local");

        var response = await PostJsonWithCsrfAndSessionAsync(
            client,
            "/auth/passkeys/register/begin",
            sessionToken,
            null);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.TryGetProperty("options", out var options));
        Assert.True(options.TryGetProperty("challenge", out _));
    }

    [Fact]
    public async Task ListPasskeys_WithSession_ReturnsEmptyList()
    {
        using var host = await CreateHostAsync();
        var client = host.GetTestClient();
        var sessionToken = await RegisterAsync(client, "list@test.local");

        var request = new HttpRequestMessage(HttpMethod.Get, "/auth/passkeys");
        request.Headers.Add("Cookie", $"{AuthConstants.SessionCookieName}={sessionToken}");

        var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(0, body.GetProperty("passkeys").GetArrayLength());
    }

    [Fact]
    public async Task LoginBegin_WithUnknownEmail_ReturnsDiscoverableOptions()
    {
        using var host = await CreateHostAsync();
        var client = host.GetTestClient();

        var unknown = await PostJsonWithCsrfAsync(
            client,
            "/auth/passkeys/login/begin",
            new { email = "missing@test.local" });
        var discoverable = await PostJsonWithCsrfAsync(client, "/auth/passkeys/login/begin", new { });
        var withoutBody = await PostJsonWithCsrfAsync(client, "/auth/passkeys/login/begin", null);

        Assert.Equal(HttpStatusCode.OK, unknown.StatusCode);
        Assert.Equal(HttpStatusCode.OK, discoverable.StatusCode);
        Assert.Equal(HttpStatusCode.OK, withoutBody.StatusCode);
    }

    [Fact]
    public async Task RegisterFinish_WithInvalidChallenge_Returns400()
    {
        using var host = await CreateHostAsync();
        var client = host.GetTestClient();
        var sessionToken = await RegisterAsync(client, "finish@test.local");

        var response = await PostJsonWithCsrfAndSessionAsync(
            client,
            "/auth/passkeys/register/finish",
            sessionToken,
            new
            {
                response = new
                {
                    id = "test-cred",
                    rawId = "test-cred",
                    type = "public-key",
                    response = new
                    {
                        clientDataJSON = Convert.ToBase64String(
                            System.Text.Encoding.UTF8.GetBytes(
                                """{"type":"webauthn.create","challenge":"invalid","origin":"http://localhost:3000"}""")),
                        attestationObject = "invalid",
                    },
                },
            });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task DeletePasskey_WhenMissing_Returns404()
    {
        using var host = await CreateHostAsync();
        var client = host.GetTestClient();
        var sessionToken = await RegisterAsync(client, "delete@test.local");

        var csrf = await FetchCsrfTokenAsync(client);
        var request = new HttpRequestMessage(HttpMethod.Delete, "/auth/passkeys/missing-credential-id");
        request.Headers.Add("Cookie", $"{AuthConstants.SessionCookieName}={sessionToken}");
        request.Headers.Add(AuthConstants.CsrfHeaderName, csrf);

        var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task RegisterBegin_WhenPasskeysDisabled_Returns403()
    {
        using var host = await CreateHostAsync(passkeysEnabled: false);
        var client = host.GetTestClient();
        var sessionToken = await RegisterAsync(client, "disabled@test.local");

        var response = await PostJsonWithCsrfAndSessionAsync(
            client,
            "/auth/passkeys/register/begin",
            sessionToken,
            null);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    private async Task<IHost> CreateHostAsync(bool passkeysEnabled = true)
    {
        var connectionString = _postgres.GetConnectionString();

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
                        options.PasskeysEnabled = passkeysEnabled;
                        options.PasskeyRpId = "localhost";
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

    private static async Task<string> RegisterAsync(HttpClient client, string email)
    {
        var response = await PostJsonWithCsrfAsync(
            client,
            "/auth/register",
            new { email, password = TestPassword });
        return ExtractSessionCookie(response)
            ?? throw new InvalidOperationException("Missing session cookie.");
    }

    private static async Task<string> FetchCsrfTokenAsync(HttpClient client)
    {
        var response = await client.GetAsync("/auth/csrf");
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("token").GetString()
            ?? throw new InvalidOperationException("Missing CSRF token.");
    }

    private static async Task<HttpResponseMessage> PostJsonWithCsrfAsync(HttpClient client, string path, object? body)
    {
        var csrf = await FetchCsrfTokenAsync(client);
        var request = new HttpRequestMessage(HttpMethod.Post, path);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
            request.Content.Headers.ContentType = new MediaTypeHeaderValue("application/json");
        }

        request.Headers.Add(AuthConstants.CsrfHeaderName, csrf);
        return await client.SendAsync(request);
    }

    private static async Task<HttpResponseMessage> PostJsonWithCsrfAndSessionAsync(
        HttpClient client,
        string path,
        string sessionToken,
        object? body)
    {
        var csrf = await FetchCsrfTokenAsync(client);
        var request = new HttpRequestMessage(HttpMethod.Post, path);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
            request.Content.Headers.ContentType = new MediaTypeHeaderValue("application/json");
        }

        request.Headers.Add("Cookie", $"{AuthConstants.SessionCookieName}={sessionToken}");
        request.Headers.Add(AuthConstants.CsrfHeaderName, csrf);
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
