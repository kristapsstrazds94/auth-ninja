namespace AuthNinja.AspNetCore;

/// <summary>
/// Normalizes <c>AUTH_NINJA_DATABASE_URL</c> for Npgsql (URI or key=value).
/// </summary>
internal static class PostgreSqlConnectionString
{
    /// <summary>
    /// Returns an Npgsql-compatible connection string.
    /// </summary>
    public static string Normalize(string databaseUrl)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(databaseUrl);
        var trimmed = databaseUrl.Trim();

        if (!trimmed.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) &&
            !trimmed.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
        {
            return trimmed;
        }

        if (!Uri.TryCreate(trimmed, UriKind.Absolute, out var uri))
        {
            throw new ArgumentException("Invalid PostgreSQL URI in AUTH_NINJA_DATABASE_URL.", nameof(databaseUrl));
        }

        var userInfo = uri.UserInfo;
        string? username = null;
        string? password = null;

        if (!string.IsNullOrEmpty(userInfo))
        {
            var separator = userInfo.IndexOf(':');
            if (separator >= 0)
            {
                username = Uri.UnescapeDataString(userInfo[..separator]);
                password = Uri.UnescapeDataString(userInfo[(separator + 1)..]);
            }
            else
            {
                username = Uri.UnescapeDataString(userInfo);
            }
        }

        var database = uri.AbsolutePath.TrimStart('/');
        if (string.IsNullOrEmpty(database))
        {
            throw new ArgumentException(
                "PostgreSQL URI must include a database name in AUTH_NINJA_DATABASE_URL.",
                nameof(databaseUrl));
        }

        var parts = new List<string>
        {
            $"Host={uri.Host}",
            $"Port={(uri.Port > 0 ? uri.Port : 5432)}",
            $"Database={database}",
        };

        if (!string.IsNullOrEmpty(username))
        {
            parts.Add($"Username={username}");
        }

        if (!string.IsNullOrEmpty(password))
        {
            parts.Add($"Password={password}");
        }

        return string.Join(';', parts);
    }
}
