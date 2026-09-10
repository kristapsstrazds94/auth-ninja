using Microsoft.AspNetCore.Http;

namespace AuthNinja.AspNetCore.Http;

internal static class RequestMeta
{
    public static string GetIpAddress(HttpContext context) =>
        context.Connection.RemoteIpAddress?.ToString() ?? "0.0.0.0";

    public static string? GetUserAgent(HttpContext context) =>
        context.Request.Headers.UserAgent.ToString() is { Length: > 0 } ua ? ua : null;
}
