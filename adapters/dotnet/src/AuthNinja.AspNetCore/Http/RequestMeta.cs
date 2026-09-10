using Microsoft.AspNetCore.Http;

namespace AuthNinja.AspNetCore.Http;

internal static class RequestMeta
{
    public static string GetIpAddress(HttpContext context)
    {
        var forwarded = context.Request.Headers["X-Forwarded-For"].ToString();
        if (!string.IsNullOrWhiteSpace(forwarded))
        {
            var first = forwarded.Split(',')[0].Trim();
            if (first.Length > 0)
            {
                return first;
            }
        }

        var realIp = context.Request.Headers["X-Real-IP"].ToString().Trim();
        if (realIp.Length > 0)
        {
            return realIp;
        }

        return context.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
    }

    public static string? GetUserAgent(HttpContext context) =>
        context.Request.Headers.UserAgent.ToString() is { Length: > 0 } ua ? ua : null;
}
