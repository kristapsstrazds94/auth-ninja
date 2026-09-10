using AuthNinja.AspNetCore.Data.Enums;

namespace AuthNinja.AspNetCore.Data.Entities;

public sealed class Credential
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public CredentialType Type { get; set; }

    /// <summary>WebAuthn credential ID (base64url). Null for <see cref="CredentialType.TotpBackup"/>.</summary>
    public string? CredentialId { get; set; }

    /// <summary>COSE public key (base64). Null for <see cref="CredentialType.TotpBackup"/>.</summary>
    public string? PublicKey { get; set; }

    public int? Counter { get; set; }

    public string? Nickname { get; set; }

    /// <summary>JSON array of authenticator transports.</summary>
    public string? Transports { get; set; }

    /// <summary>Argon2id hash for single-use backup codes. Null for <see cref="CredentialType.Passkey"/>.</summary>
    public string? CodeHash { get; set; }

    public DateTimeOffset? ConsumedAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? LastUsedAt { get; set; }

    public User User { get; set; } = null!;
}
