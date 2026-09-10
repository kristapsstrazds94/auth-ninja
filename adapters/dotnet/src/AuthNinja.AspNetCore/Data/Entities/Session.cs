namespace AuthNinja.AspNetCore.Data.Entities;

public sealed class Session
{
    public Guid Id { get; set; }

    /// <summary>SHA-256 of the HttpOnly cookie value — never store the raw token.</summary>
    public required string TokenHash { get; set; }

    public Guid UserId { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset LastSeenAt { get; set; }

    public DateTimeOffset ExpiresAt { get; set; }

    public string? IpAddress { get; set; }

    public string? UserAgent { get; set; }

    public User User { get; set; } = null!;
}
