using Microsoft.AspNetCore.WebUtilities;

namespace AuthNinja.AspNetCore.Auth;

internal static class Base64UrlHelper
{
    public static string Encode(byte[] data) => WebEncoders.Base64UrlEncode(data);

    public static byte[] Decode(string encoded) => WebEncoders.Base64UrlDecode(encoded);
}
