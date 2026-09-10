using Microsoft.AspNetCore.Http;

namespace AuthNinja.AspNetCore.Auth;

internal static class SessionCookie
{
    public static bool IsSecure(AuthNinjaOptions options) =>
        options.BaseUrl?.StartsWith("https://", StringComparison.OrdinalIgnoreCase) == true;

    public static void Set(HttpResponse response, AuthNinjaOptions options, string token)
    {
        response.Cookies.Append(
            AuthConstants.SessionCookieName,
            token,
            BuildOptions(options, TimeSpan.FromHours(options.SessionAbsoluteHours)));
    }

    public static void Clear(HttpResponse response, AuthNinjaOptions options)
    {
        response.Cookies.Delete(
            AuthConstants.SessionCookieName,
            new CookieOptions
            {
                Path = "/",
                HttpOnly = true,
                Secure = IsSecure(options),
                SameSite = SameSiteMode.Strict,
            });
    }

    public static string? Parse(HttpRequest request)
    {
        if (!request.Cookies.TryGetValue(AuthConstants.SessionCookieName, out var value) ||
            string.IsNullOrEmpty(value))
        {
            return null;
        }

        return value;
    }

    private static CookieOptions BuildOptions(AuthNinjaOptions options, TimeSpan maxAge) =>
        new()
        {
            Path = "/",
            HttpOnly = true,
            Secure = IsSecure(options),
            SameSite = SameSiteMode.Strict,
            MaxAge = maxAge,
        };
}
