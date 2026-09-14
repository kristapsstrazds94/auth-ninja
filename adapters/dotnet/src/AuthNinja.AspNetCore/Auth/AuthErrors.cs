using Microsoft.AspNetCore.Http;

namespace AuthNinja.AspNetCore.Auth;

public enum AuthErrorCode
{
    InvalidCredentials,
    AccountLocked,
    SessionExpired,
    MfaRequired,
    MfaInvalid,
    CsrfInvalid,
    RateLimited,
    Forbidden,
    ValidationError,
}

public sealed class AuthNinjaException : Exception
{
    public AuthErrorCode Code { get; }

    public int Status { get; }

    public AuthNinjaException(AuthErrorCode code, string message, int status)
        : base(message)
    {
        Code = code;
        Status = status;
    }
}

public static class AuthErrors
{
    public static readonly IReadOnlyDictionary<AuthErrorCode, string> Messages =
        new Dictionary<AuthErrorCode, string>
        {
            [AuthErrorCode.InvalidCredentials] = "Invalid email or password.",
            [AuthErrorCode.AccountLocked] = "Too many failed attempts. Try again later.",
            [AuthErrorCode.SessionExpired] = "Session expired.",
            [AuthErrorCode.MfaRequired] = "Multi-factor authentication is required.",
            [AuthErrorCode.MfaInvalid] = "Invalid authentication code.",
            [AuthErrorCode.CsrfInvalid] = "Invalid CSRF token.",
            [AuthErrorCode.RateLimited] = "Too many requests.",
            [AuthErrorCode.Forbidden] = "Forbidden.",
            [AuthErrorCode.ValidationError] = "Invalid request.",
        };

    public static readonly IReadOnlyDictionary<AuthErrorCode, int> DefaultStatus =
        new Dictionary<AuthErrorCode, int>
        {
            [AuthErrorCode.InvalidCredentials] = StatusCodes.Status401Unauthorized,
            [AuthErrorCode.AccountLocked] = StatusCodes.Status423Locked,
            [AuthErrorCode.SessionExpired] = StatusCodes.Status401Unauthorized,
            [AuthErrorCode.MfaRequired] = StatusCodes.Status403Forbidden,
            [AuthErrorCode.MfaInvalid] = StatusCodes.Status400BadRequest,
            [AuthErrorCode.CsrfInvalid] = StatusCodes.Status403Forbidden,
            [AuthErrorCode.RateLimited] = StatusCodes.Status429TooManyRequests,
            [AuthErrorCode.Forbidden] = StatusCodes.Status403Forbidden,
            [AuthErrorCode.ValidationError] = StatusCodes.Status400BadRequest,
        };

    public static AuthNinjaException Create(AuthErrorCode code, string? message = null, int? status = null) =>
        new(code, message ?? Messages[code], status ?? DefaultStatus[code]);
}

public static class AuthGenericMessages
{
    public const string RegistrationFailed = "Unable to complete registration.";

    public const string PasswordResetRequested =
        "If an account exists for that email, reset instructions will be sent.";

    public const string PasswordResetFailed = "Unable to reset password.";

    public const string PasswordResetSuccess = "Password has been reset.";
}
