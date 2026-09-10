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

public sealed class TwoFaEndpointTests : IAsyncLifetime
{
    private const string TestSecret = "test-secret-min-32-chars-long-!!";
    private const string TestPassword = "secure-password-1";
    private const string TestEmail = "twofa@test.local";

    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .Build();

    public async Task InitializeAsync() => await _postgres.StartAsync();

    public async Task DisposeAsync() => await _postgres.DisposeAsync();

    [Fact]
    public async Task TwoFaCycle_EnrollConfirmLoginVerify_CompletesSuccessfully()
    {
        using var host = await CreateHostAsync();
        var client = host.GetTestClient();

        var register = await PostJsonWithCsrfAsync(
            client,
            "/auth/register",
            new { email = TestEmail, password = TestPassword });
        var sessionToken = ExtractSessionCookie(register)!;

        var enroll = await PostJsonWithCsrfAndSessionAsync(client, "/auth/2fa/enroll", sessionToken, null);
        Assert.Equal(HttpStatusCode.OK, enroll.StatusCode);

        var enrollBody = await enroll.Content.ReadFromJsonAsync<JsonElement>();
        var secret = enrollBody.GetProperty("secret").GetString();
        Assert.False(string.IsNullOrEmpty(secret));
        Assert.True(enrollBody.GetProperty("otpauthUrl").GetString()?.StartsWith("otpauth://"));

        var code = TotpHelper.GenerateCode(secret!);
        var confirm = await PostJsonWithCsrfAndSessionAsync(
            client,
            "/auth/2fa/confirm",
            sessionToken,
            new { code });
        Assert.Equal(HttpStatusCode.OK, confirm.StatusCode);

        var confirmBody = await confirm.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(confirmBody.GetProperty("mfaEnabled").GetBoolean());
        Assert.Equal(10, confirmBody.GetProperty("backupCodes").GetArrayLength());

        await PostJsonWithCsrfAndSessionAsync(client, "/auth/logout", sessionToken, null);

        var login = await PostJsonWithCsrfAsync(
            client,
            "/auth/login",
            new { email = TestEmail, password = TestPassword });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);

        var loginBody = await login.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(loginBody.GetProperty("mfaRequired").GetBoolean());
        var loginToken = loginBody.GetProperty("loginToken").GetString();

        var verify = await PostJsonWithCsrfAsync(
            client,
            "/auth/2fa/verify",
            new { loginToken, code = TotpHelper.GenerateCode(secret!) });
        Assert.Equal(HttpStatusCode.OK, verify.StatusCode);

        var newSessionToken = ExtractSessionCookie(verify)!;
        var session = await GetSessionAsync(client, newSessionToken);
        Assert.Equal(HttpStatusCode.OK, session.StatusCode);

        var sessionBody = await session.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(sessionBody.GetProperty("user").GetProperty("mfaEnabled").GetBoolean());
    }

    [Fact]
    public async Task Enroll_WithoutSession_Returns401()
    {
        using var host = await CreateHostAsync();
        var client = host.GetTestClient();

        var csrf = await FetchCsrfTokenAsync(client);
        var request = new HttpRequestMessage(HttpMethod.Post, "/auth/2fa/enroll");
        request.Headers.Add(AuthConstants.CsrfHeaderName, csrf);

        var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Enroll_WhenAlreadyEnabled_Returns409()
    {
        using var host = await CreateHostAsync();
        var client = host.GetTestClient();

        var sessionToken = await RegisterAndEnableTwoFaAsync(client);

        var duplicate = await PostJsonWithCsrfAndSessionAsync(client, "/auth/2fa/enroll", sessionToken, null);
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);

        var body = await duplicate.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("FORBIDDEN", body.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Confirm_WithInvalidCode_Returns400()
    {
        using var host = await CreateHostAsync();
        var client = host.GetTestClient();

        var register = await PostJsonWithCsrfAsync(
            client,
            "/auth/register",
            new { email = "badcode@test.local", password = TestPassword });
        var sessionToken = ExtractSessionCookie(register)!;

        await PostJsonWithCsrfAndSessionAsync(client, "/auth/2fa/enroll", sessionToken, null);

        var confirm = await PostJsonWithCsrfAndSessionAsync(
            client,
            "/auth/2fa/confirm",
            sessionToken,
            new { code = "000000" });
        Assert.Equal(HttpStatusCode.BadRequest, confirm.StatusCode);

        var body = await confirm.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("MFA_INVALID", body.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Verify_WithExpiredLoginToken_Returns401()
    {
        using var host = await CreateHostAsync();
        var client = host.GetTestClient();

        var verify = await PostJsonWithCsrfAsync(
            client,
            "/auth/2fa/verify",
            new { loginToken = "invalid.token.value", code = "123456" });
        Assert.Equal(HttpStatusCode.Unauthorized, verify.StatusCode);
    }

    private async Task<string> RegisterAndEnableTwoFaAsync(HttpClient client)
    {
        var register = await PostJsonWithCsrfAsync(
            client,
            "/auth/register",
            new { email = TestEmail, password = TestPassword });
        var sessionToken = ExtractSessionCookie(register)!;

        var enroll = await PostJsonWithCsrfAndSessionAsync(client, "/auth/2fa/enroll", sessionToken, null);
        var secret = (await enroll.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("secret").GetString()!;

        await PostJsonWithCsrfAndSessionAsync(
            client,
            "/auth/2fa/confirm",
            sessionToken,
            new { code = TotpHelper.GenerateCode(secret) });

        return sessionToken;
    }

    private async Task<IHost> CreateHostAsync()
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

    private static async Task<HttpResponseMessage> GetSessionAsync(HttpClient client, string sessionToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/auth/session");
        request.Headers.Add("Cookie", $"{AuthConstants.SessionCookieName}={sessionToken}");
        return await client.SendAsync(request);
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
