using AuthNinja.AspNetCore.Auth;

namespace AuthNinja.AspNetCore.Middleware;

internal static class AuthApiPaths
{
    /// <summary>State-changing routes that require CSRF when <see cref="AuthNinjaOptions.CsrfEnabled"/> is true.</summary>
    private static readonly string[] CsrfProtectedMethods =
    [
        "POST /auth/register",
        "POST /auth/login",
        "POST /auth/logout",
        "POST /auth/password-reset/request",
        "POST /auth/password-reset/confirm",
        "POST /auth/2fa/enroll",
        "POST /auth/2fa/confirm",
        "POST /auth/2fa/verify",
        "POST /auth/2fa/backup-codes",
        "DELETE /auth/2fa",
        "POST /auth/passkeys/register/begin",
        "POST /auth/passkeys/register/finish",
        "POST /auth/passkeys/login/begin",
        "POST /auth/passkeys/login/finish",
        "DELETE /auth/passkeys/{credentialId}",
    ];

    public static bool IsAuthApiPath(string pathname, string prefix = AuthConstants.DefaultAuthPathPrefix)
    {
        var normalized = NormalizePrefix(prefix);
        return pathname == normalized || pathname.StartsWith($"{normalized}/", StringComparison.Ordinal);
    }

    public static bool RequiresCsrfProtection(
        string method,
        string pathname,
        string prefix = AuthConstants.DefaultAuthPathPrefix)
    {
        var upperMethod = method.ToUpperInvariant();

        foreach (var endpoint in CsrfProtectedMethods)
        {
            var spaceIndex = endpoint.IndexOf(' ');
            var endpointMethod = endpoint[..spaceIndex];
            var endpointPath = endpoint[(spaceIndex + 1)..];

            if (upperMethod != endpointMethod)
            {
                continue;
            }

            var fullPath = ProtocolPathToPrefixPath(endpointPath, prefix);
            if (MatchRoutePath(pathname, fullPath))
            {
                return true;
            }
        }

        return false;
    }

    private static string NormalizePrefix(string prefix)
    {
        if (!prefix.StartsWith('/'))
        {
            prefix = $"/{prefix}";
        }

        return prefix.EndsWith('/') ? prefix[..^1] : prefix;
    }

    private static string ProtocolPathToPrefixPath(string protocolPath, string prefix)
    {
        var normalized = NormalizePrefix(prefix);
        var suffix = protocolPath.StartsWith("/auth", StringComparison.Ordinal)
            ? protocolPath["/auth".Length..]
            : protocolPath;
        return $"{normalized}{suffix}";
    }

    private static bool MatchRoutePath(string pathname, string pattern)
    {
        var pathSegments = pathname.Split('/', StringSplitOptions.RemoveEmptyEntries);
        var patternSegments = pattern.Split('/', StringSplitOptions.RemoveEmptyEntries);

        if (pathSegments.Length != patternSegments.Length)
        {
            return false;
        }

        for (var i = 0; i < patternSegments.Length; i++)
        {
            var segment = patternSegments[i];
            if (segment.StartsWith('{') && segment.EndsWith('}'))
            {
                continue;
            }

            if (segment != pathSegments[i])
            {
                return false;
            }
        }

        return true;
    }
}
