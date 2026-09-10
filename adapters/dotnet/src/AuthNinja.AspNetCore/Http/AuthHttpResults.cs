using System.Text.Json;
using System.Text.Json.Serialization;
using AuthNinja.AspNetCore.Auth;
using AuthNinja.AspNetCore.Auth.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;

namespace AuthNinja.AspNetCore.Http;

internal static class AuthHttpResults
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public static IResult Json(object body, int status) =>
        Results.Json(body, JsonOptions, statusCode: status);

    public static IResult Error(AuthNinjaException ex) =>
        Json(new ErrorResponse { Code = ToWireCode(ex.Code), Message = ex.Message }, ex.Status);

    public static IResult WithSessionCookie(
        IOptions<AuthNinjaOptions> options,
        HttpContext context,
        object body,
        int status,
        string sessionToken)
    {
        SessionCookie.Set(context.Response, options.Value, sessionToken);
        return Json(body, status);
    }

    public static IResult WithClearSessionCookie(
        IOptions<AuthNinjaOptions> options,
        HttpContext context,
        int status)
    {
        SessionCookie.Clear(context.Response, options.Value);
        return Results.StatusCode(status);
    }

    private static string ToWireCode(AuthErrorCode code) => code switch
    {
        AuthErrorCode.InvalidCredentials => "INVALID_CREDENTIALS",
        AuthErrorCode.AccountLocked => "ACCOUNT_LOCKED",
        AuthErrorCode.SessionExpired => "SESSION_EXPIRED",
        AuthErrorCode.MfaRequired => "MFA_REQUIRED",
        AuthErrorCode.MfaInvalid => "MFA_INVALID",
        AuthErrorCode.CsrfInvalid => "CSRF_INVALID",
        AuthErrorCode.RateLimited => "RATE_LIMITED",
        AuthErrorCode.Forbidden => "FORBIDDEN",
        AuthErrorCode.ValidationError => "VALIDATION_ERROR",
        _ => "VALIDATION_ERROR",
    };
}
