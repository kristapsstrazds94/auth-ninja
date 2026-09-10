using AuthNinja.AspNetCore.Auth;
using AuthNinja.AspNetCore.Auth.Models;
using AuthNinja.AspNetCore.Auth.Services;
using AuthNinja.AspNetCore.Http;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Options;

namespace AuthNinja.AspNetCore.Endpoints;

internal static class PasskeyEndpointRouteBuilderExtensions
{
    internal static IEndpointRouteBuilder MapAuthNinjaPasskeys(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/auth/passkeys");

        group.MapPost("/register/begin", RegisterBeginAsync);
        group.MapPost("/register/finish", RegisterFinishAsync);
        group.MapPost("/login/begin", LoginBeginAsync);
        group.MapPost("/login/finish", LoginFinishAsync);
        group.MapGet("", ListAsync);
        group.MapDelete("/{credentialId}", DeleteAsync);

        return endpoints;
    }

    private static async Task<IResult> RegisterBeginAsync(
        HttpContext context,
        PasskeyService passkeys,
        CancellationToken cancellationToken)
    {
        try
        {
            var token = SessionCookie.Parse(context.Request);
            var body = await passkeys.RegisterBeginAsync(token, DateTimeOffset.UtcNow, cancellationToken);
            return AuthHttpResults.Json(body, StatusCodes.Status200OK);
        }
        catch (AuthNinjaException ex)
        {
            return AuthHttpResults.Error(ex);
        }
    }

    private static async Task<IResult> RegisterFinishAsync(
        HttpContext context,
        WebAuthnFinishRequest request,
        PasskeyService passkeys,
        CancellationToken cancellationToken)
    {
        try
        {
            var token = SessionCookie.Parse(context.Request);
            var body = await passkeys.RegisterFinishAsync(
                token,
                request,
                DateTimeOffset.UtcNow,
                cancellationToken);
            return AuthHttpResults.Json(body, StatusCodes.Status201Created);
        }
        catch (AuthNinjaException ex)
        {
            return AuthHttpResults.Error(ex);
        }
    }

    private static async Task<IResult> LoginBeginAsync(
        PasskeyLoginBeginRequest request,
        PasskeyService passkeys,
        CancellationToken cancellationToken)
    {
        try
        {
            var body = await passkeys.LoginBeginAsync(request, DateTimeOffset.UtcNow, cancellationToken);
            return AuthHttpResults.Json(body, StatusCodes.Status200OK);
        }
        catch (AuthNinjaException ex)
        {
            return AuthHttpResults.Error(ex);
        }
    }

    private static async Task<IResult> LoginFinishAsync(
        HttpContext context,
        WebAuthnFinishRequest request,
        PasskeyService passkeys,
        IOptions<AuthNinjaOptions> options,
        CancellationToken cancellationToken)
    {
        try
        {
            var now = DateTimeOffset.UtcNow;
            var existingToken = SessionCookie.Parse(context.Request);
            var (body, session) = await passkeys.LoginFinishAsync(
                request,
                existingToken,
                RequestMeta.GetIpAddress(context),
                RequestMeta.GetUserAgent(context),
                now,
                cancellationToken);

            return AuthHttpResults.WithSessionCookie(options, context, body, StatusCodes.Status200OK, session.Token);
        }
        catch (AuthNinjaException ex)
        {
            return AuthHttpResults.Error(ex);
        }
    }

    private static async Task<IResult> ListAsync(
        HttpContext context,
        PasskeyService passkeys,
        CancellationToken cancellationToken)
    {
        try
        {
            var token = SessionCookie.Parse(context.Request);
            var body = await passkeys.ListAsync(token, DateTimeOffset.UtcNow, cancellationToken);
            return AuthHttpResults.Json(body, StatusCodes.Status200OK);
        }
        catch (AuthNinjaException ex)
        {
            return AuthHttpResults.Error(ex);
        }
    }

    private static async Task<IResult> DeleteAsync(
        HttpContext context,
        string credentialId,
        PasskeyService passkeys,
        CancellationToken cancellationToken)
    {
        try
        {
            var token = SessionCookie.Parse(context.Request);
            await passkeys.DeleteAsync(token, credentialId, DateTimeOffset.UtcNow, cancellationToken);
            return Results.StatusCode(StatusCodes.Status204NoContent);
        }
        catch (AuthNinjaException ex)
        {
            return AuthHttpResults.Error(ex);
        }
    }
}
