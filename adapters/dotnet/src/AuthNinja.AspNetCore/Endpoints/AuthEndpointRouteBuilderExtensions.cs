using AuthNinja.AspNetCore.Auth;
using AuthNinja.AspNetCore.Auth.Models;
using AuthNinja.AspNetCore.Auth.Services;
using AuthNinja.AspNetCore.Http;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace AuthNinja.AspNetCore.Endpoints;

/// <summary>Maps Auth-Ninja session endpoints matching the shared OpenAPI contract.</summary>
public static class AuthEndpointRouteBuilderExtensions
{
    /// <summary>Maps POST/GET /auth/* session and CSRF routes.</summary>
    public static IEndpointRouteBuilder MapAuthNinja(this IEndpointRouteBuilder endpoints)
    {
        ArgumentNullException.ThrowIfNull(endpoints);

        var group = endpoints.MapGroup("/auth");

        group.MapPost("/register", RegisterAsync);
        group.MapPost("/login", LoginAsync);
        group.MapPost("/logout", LogoutAsync);
        group.MapGet("/session", GetSessionAsync);
        group.MapGet("/csrf", GetCsrfAsync);

        return endpoints;
    }

    private static async Task<IResult> RegisterAsync(
        HttpContext context,
        RegisterRequest request,
        AuthService auth,
        IOptions<AuthNinjaOptions> options,
        CancellationToken cancellationToken)
    {
        try
        {
            var now = DateTimeOffset.UtcNow;
            var (body, session) = await auth.RegisterAsync(
                request,
                RequestMeta.GetIpAddress(context),
                RequestMeta.GetUserAgent(context),
                now,
                cancellationToken);

            return AuthHttpResults.WithSessionCookie(
                options,
                context,
                body,
                StatusCodes.Status201Created,
                session.Token);
        }
        catch (AuthNinjaException ex)
        {
            return AuthHttpResults.Error(ex);
        }
    }

    private static async Task<IResult> LoginAsync(
        HttpContext context,
        LoginRequest request,
        AuthService auth,
        IOptions<AuthNinjaOptions> options,
        CancellationToken cancellationToken)
    {
        try
        {
            var now = DateTimeOffset.UtcNow;
            var existingToken = SessionCookie.Parse(context.Request);
            var result = await auth.LoginAsync(
                request,
                existingToken,
                RequestMeta.GetIpAddress(context),
                RequestMeta.GetUserAgent(context),
                now,
                cancellationToken);

            return result switch
            {
                LoginSuccess success => AuthHttpResults.WithSessionCookie(
                    options,
                    context,
                    success.Body,
                    success.Status,
                    success.Session.Token),
                LoginMfaRequired mfa => AuthHttpResults.Json(mfa.Body, mfa.Status),
                LoginFailure failure => AuthHttpResults.Error(failure.Error),
                _ => AuthHttpResults.Error(AuthErrors.Create(AuthErrorCode.ValidationError)),
            };
        }
        catch (AuthNinjaException ex)
        {
            return AuthHttpResults.Error(ex);
        }
    }

    private static async Task<IResult> LogoutAsync(
        HttpContext context,
        AuthService auth,
        IOptions<AuthNinjaOptions> options,
        CancellationToken cancellationToken)
    {
        try
        {
            var token = SessionCookie.Parse(context.Request);
            await auth.LogoutAsync(
                token,
                RequestMeta.GetIpAddress(context),
                RequestMeta.GetUserAgent(context),
                DateTimeOffset.UtcNow,
                cancellationToken);

            return AuthHttpResults.WithClearSessionCookie(
                options,
                context,
                StatusCodes.Status204NoContent);
        }
        catch (AuthNinjaException ex)
        {
            return AuthHttpResults.Error(ex);
        }
    }

    private static async Task<IResult> GetSessionAsync(
        HttpContext context,
        AuthService auth,
        CancellationToken cancellationToken)
    {
        try
        {
            var token = SessionCookie.Parse(context.Request);
            var body = await auth.GetSessionAsync(token, DateTimeOffset.UtcNow, cancellationToken);
            return AuthHttpResults.Json(body, StatusCodes.Status200OK);
        }
        catch (AuthNinjaException ex)
        {
            return AuthHttpResults.Error(ex);
        }
    }

    private static IResult GetCsrfAsync(HttpContext context, AuthService auth)
    {
        var body = auth.GetCsrfToken(DateTimeOffset.UtcNow);
        return AuthHttpResults.Json(body, StatusCodes.Status200OK);
    }
}
