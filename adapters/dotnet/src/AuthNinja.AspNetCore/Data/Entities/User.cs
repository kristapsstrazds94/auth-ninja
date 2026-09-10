namespace AuthNinja.AspNetCore.Data.Entities;

public sealed class User
{
    public Guid Id { get; set; }

    public required string Email { get; set; }

    public required string EmailNormalized { get; set; }

    public required string PasswordHash { get; set; }

    public string? TotpSecret { get; set; }

    public bool MfaEnabled { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public ICollection<Session> Sessions { get; set; } = [];

    public ICollection<Credential> Credentials { get; set; } = [];

    public ICollection<AuditEvent> AuditEvents { get; set; } = [];
}
