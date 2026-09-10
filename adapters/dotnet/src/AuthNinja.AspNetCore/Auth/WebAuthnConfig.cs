namespace AuthNinja.AspNetCore.Auth;

internal static class WebAuthnConfig
{
    public static string Origin(AuthNinjaOptions options) =>
        new Uri(options.BaseUrl!).GetLeftPart(UriPartial.Authority);

    public static string RpName(AuthNinjaOptions options) => options.TwoFaIssuer;

    public static string RpId(AuthNinjaOptions options) => options.PasskeyRpId;

    public static byte[] UuidToUserHandle(Guid userId)
    {
        var hex = userId.ToString("N");
        var bytes = new byte[16];

        for (var i = 0; i < 16; i++)
        {
            bytes[i] = Convert.ToByte(hex.Substring(i * 2, 2), 16);
        }

        return bytes;
    }

    public static Fido2NetLib.Fido2Configuration ToFido2Configuration(AuthNinjaOptions options) =>
        new()
        {
            ServerDomain = options.PasskeyRpId,
            ServerName = options.TwoFaIssuer,
            Origins = new HashSet<string> { Origin(options) },
            TimestampDriftTolerance = 300_000,
        };
}
