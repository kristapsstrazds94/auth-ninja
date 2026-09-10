namespace AuthNinja.AspNetCore.Auth;

internal static class AuthConstants
{
    public const string DefaultAuthPathPrefix = "/auth";

    public const string SessionCookieName = "auth_session";

    public const string CsrfHeaderName = "X-CSRF-Token";

    public static readonly TimeSpan CsrfTokenTtl = TimeSpan.FromHours(1);

    public static readonly TimeSpan LoginChallengeTtl = TimeSpan.FromMinutes(5);

    public static readonly TimeSpan WebAuthnChallengeTtl = TimeSpan.FromMinutes(5);
}
