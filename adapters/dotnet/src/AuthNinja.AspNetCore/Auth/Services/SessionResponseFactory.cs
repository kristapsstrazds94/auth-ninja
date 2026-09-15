using AuthNinja.AspNetCore.Auth.Models;
using AuthNinja.AspNetCore.Data;
using AuthNinja.AspNetCore.Data.Entities;
using AuthNinja.AspNetCore.Data.Enums;
using Microsoft.EntityFrameworkCore;

namespace AuthNinja.AspNetCore.Auth.Services;

internal static class SessionResponseFactory
{
    public static async Task<SessionResponse> CreateAsync(
        AuthNinjaDbContext db,
        User user,
        CancellationToken cancellationToken = default)
    {
        var hasPasskeys = await db.Credentials
            .AsNoTracking()
            .AnyAsync(
                c => c.UserId == user.Id && c.Type == CredentialType.Passkey,
                cancellationToken);

        return new SessionResponse
        {
            User = new UserDto
            {
                Id = user.Id.ToString(),
                Email = user.Email,
                MfaEnabled = user.MfaEnabled,
                PasskeysEnabled = hasPasskeys,
            },
        };
    }
}
