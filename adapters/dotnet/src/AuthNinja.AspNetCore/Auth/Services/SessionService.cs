using AuthNinja.AspNetCore.Auth.Models;
using AuthNinja.AspNetCore.Data;
using AuthNinja.AspNetCore.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace AuthNinja.AspNetCore.Auth.Services;

internal sealed class SessionService(AuthNinjaDbContext db, IOptions<AuthNinjaOptions> options)
{
    private readonly AuthNinjaOptions _options = options.Value;

    public async Task<CreatedSession> CreateAsync(
        Guid userId,
        string? ipAddress,
        string? userAgent,
        DateTimeOffset now,
        CancellationToken cancellationToken = default)
    {
        var token = SessionToken.Generate();
        var tokenHash = SessionToken.Hash(token);
        var expiresAt = now.AddHours(_options.SessionAbsoluteHours);

        var session = new Session
        {
            TokenHash = tokenHash,
            UserId = userId,
            LastSeenAt = now,
            ExpiresAt = expiresAt,
            IpAddress = ipAddress,
            UserAgent = userAgent,
        };

        db.Sessions.Add(session);
        await db.SaveChangesAsync(cancellationToken);

        return new CreatedSession
        {
            Token = token,
            SessionId = session.Id,
            ExpiresAt = expiresAt,
        };
    }

    public async Task<(Session Session, User User)> ResolveAsync(
        string? token,
        DateTimeOffset now,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(token))
        {
            throw AuthErrors.Create(AuthErrorCode.SessionExpired);
        }

        var tokenHash = SessionToken.Hash(token);
        var row = await db.Sessions
            .Include(s => s.User)
            .Where(s => s.TokenHash == tokenHash)
            .FirstOrDefaultAsync(cancellationToken);

        if (row is null)
        {
            throw AuthErrors.Create(AuthErrorCode.SessionExpired);
        }

        if (now >= row.ExpiresAt)
        {
            db.Sessions.Remove(row);
            await db.SaveChangesAsync(cancellationToken);
            throw AuthErrors.Create(AuthErrorCode.SessionExpired);
        }

        var idleLimit = TimeSpan.FromMinutes(_options.SessionIdleMinutes);
        if (now - row.LastSeenAt > idleLimit)
        {
            db.Sessions.Remove(row);
            await db.SaveChangesAsync(cancellationToken);
            throw AuthErrors.Create(AuthErrorCode.SessionExpired);
        }

        return (row, row.User);
    }

    public async Task TouchAsync(Guid sessionId, DateTimeOffset now, CancellationToken cancellationToken = default)
    {
        await db.Sessions
            .Where(s => s.Id == sessionId)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(s => s.LastSeenAt, now),
                cancellationToken);
    }

    public async Task InvalidateAsync(string? token, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(token))
        {
            return;
        }

        var tokenHash = SessionToken.Hash(token);
        await db.Sessions
            .Where(s => s.TokenHash == tokenHash)
            .ExecuteDeleteAsync(cancellationToken);
    }

    public async Task<CreatedSession> RotateAsync(
        Guid userId,
        string? existingToken,
        string? ipAddress,
        string? userAgent,
        DateTimeOffset now,
        CancellationToken cancellationToken = default)
    {
        await InvalidateAsync(existingToken, cancellationToken);
        return await CreateAsync(userId, ipAddress, userAgent, now, cancellationToken);
    }

    public async Task InvalidateAllForUserAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        await db.Sessions
            .Where(s => s.UserId == userId)
            .ExecuteDeleteAsync(cancellationToken);
    }
}
