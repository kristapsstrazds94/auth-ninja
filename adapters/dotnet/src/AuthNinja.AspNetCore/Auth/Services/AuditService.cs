using AuthNinja.AspNetCore.Data;
using AuthNinja.AspNetCore.Data.Entities;
using AuthNinja.AspNetCore.Data.Enums;
using AuthNinja.AspNetCore.Data.Models;

namespace AuthNinja.AspNetCore.Auth.Services;

internal sealed class AuditService(AuthNinjaDbContext db)
{
    public async Task PersistLoginAsync(
        string outcome,
        string ipAddress,
        string? userAgent,
        Guid? userId,
        DateTimeOffset now,
        CancellationToken cancellationToken = default)
    {
        db.AuditEvents.Add(new AuditEvent
        {
            Id = Guid.NewGuid(),
            Type = AuditEventType.Login,
            OccurredAt = now,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            UserId = userId,
            Payload = new AuditEventPayload { Outcome = outcome },
        });

        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task PersistLogoutAsync(
        Guid userId,
        string ipAddress,
        string? userAgent,
        DateTimeOffset now,
        CancellationToken cancellationToken = default)
    {
        db.AuditEvents.Add(new AuditEvent
        {
            Id = Guid.NewGuid(),
            Type = AuditEventType.Logout,
            OccurredAt = now,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            UserId = userId,
            Payload = new AuditEventPayload(),
        });

        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task PersistLockoutAsync(
        Guid userId,
        int attemptCount,
        string ipAddress,
        string? userAgent,
        DateTimeOffset? unlockAt,
        DateTimeOffset now,
        CancellationToken cancellationToken = default)
    {
        db.AuditEvents.Add(new AuditEvent
        {
            Id = Guid.NewGuid(),
            Type = AuditEventType.Lockout,
            OccurredAt = now,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            UserId = userId,
            Payload = new AuditEventPayload
            {
                AttemptCount = attemptCount,
                UnlockAt = unlockAt?.ToString("O"),
            },
        });

        await db.SaveChangesAsync(cancellationToken);
    }
}
