using AuthNinja.AspNetCore.Data.Enums;
using AuthNinja.AspNetCore.Data.Models;

namespace AuthNinja.AspNetCore.Data.Entities;

public sealed class AuditEvent
{
    public Guid Id { get; set; }

    public AuditEventType Type { get; set; }

    public DateTimeOffset OccurredAt { get; set; }

    public required string IpAddress { get; set; }

    public string? UserAgent { get; set; }

    public Guid? UserId { get; set; }

    public AuditEventPayload Payload { get; set; } = new();

    public User? User { get; set; }
}
