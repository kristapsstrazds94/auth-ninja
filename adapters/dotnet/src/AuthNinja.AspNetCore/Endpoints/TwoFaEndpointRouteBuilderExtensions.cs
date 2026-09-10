using AuthNinja.AspNetCore.Auth;
using AuthNinja.AspNetCore.Auth.Models;
using AuthNinja.AspNetCore.Auth.Services;
using AuthNinja.AspNetCore.Http;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Options;

namespace AuthNinja.AspNetCore.Endpoints;

internal static class TwoFaEndpointRouteBuilderExtensions
{
    internal static IEndpointRouteBuilder MapAuthNinjaTwoFa(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/auth/2fa");

        group.MapPost("/enroll", EnrollAsync);
        group.MapPost("/confirm", ConfirmAsync);
        group.MapPost("/verify", VerifyAsync);
        group.MapPost("/backup-codes", RegenerateBackupCodesAsync);
        group.MapDelete("", DisableAsync);

        return endpoints;
    }

    private static async Task<IResult> EnrollAsync(
        HttpContext context,
        TwoFaService twoFa,
        CancellationToken cancellationToken)
    {
        try
        {
            var token = SessionCookie.Parse(context.Request);
            var body = await twoFa.EnrollAsync(token, DateTimeOffset.UtcNow, cancellationToken);
            return AuthHttpResults.Json(body, StatusCodes.Status200OK);
        }
        catch (AuthNinjaException ex)
        {
            return AuthHttpResults.Error(ex);
        }
    }

    private static async Task<IResult> ConfirmAsync(
        HttpContext context,
        TotpCodeRequest request,
        TwoFaService twoFa,
        CancellationToken cancellationToken)
    {
        try
        {
            var token = SessionCookie.Parse(context.Request);
            var body = await twoFa.ConfirmAsync(token, request, DateTimeOffset.UtcNow, cancellationToken);
            return AuthHttpResults.Json(body, StatusCodes.Status200OK);
        }
        catch (AuthNinjaException ex)
        {
            return AuthHttpResults.Error(ex);
        }
    }

    private static async Task<IResult> VerifyAsync(
        HttpContext context,
        TotpVerifyRequest request,
        TwoFaService twoFa,
        IOptions<AuthNinjaOptions> options,
        CancellationToken cancellationToken)
    {
        try
        {
            var now = DateTimeOffset.UtcNow;
            var existingToken = SessionCookie.Parse(context.Request);
            var (body, session) = await twoFa.VerifyLoginAsync(
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

    private static async Task<IResult> RegenerateBackupCodesAsync(
        HttpContext context,
        PasswordConfirmRequest request,
        TwoFaService twoFa,
        CancellationToken cancellationToken)
    {
        try
        {
            var token = SessionCookie.Parse(context.Request);
            var body = await twoFa.RegenerateBackupCodesAsync(
                token,
                request,
                DateTimeOffset.UtcNow,
                cancellationToken);
            return AuthHttpResults.Json(body, StatusCodes.Status200OK);
        }
        catch (AuthNinjaException ex)
        {
            return AuthHttpResults.Error(ex);
        }
    }

    private static async Task<IResult> DisableAsync(
        HttpContext context,
        [FromBody] Disable2faRequest request,
        TwoFaService twoFa,
        CancellationToken cancellationToken)
    {
        try
        {
            var token = SessionCookie.Parse(context.Request);
            await twoFa.DisableAsync(token, request, DateTimeOffset.UtcNow, cancellationToken);
            return Results.StatusCode(StatusCodes.Status204NoContent);
        }
        catch (AuthNinjaException ex)
        {
            return AuthHttpResults.Error(ex);
        }
    }
}
