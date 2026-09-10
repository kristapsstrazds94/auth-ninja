namespace AuthNinja.AspNetCore.Auth;

internal static class EmailNormalizer
{
    public static string Normalize(string email) => email.Trim().ToLowerInvariant();
}
