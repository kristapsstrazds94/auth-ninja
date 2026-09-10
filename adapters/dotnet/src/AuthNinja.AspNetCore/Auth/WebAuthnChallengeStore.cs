using Fido2NetLib;

namespace AuthNinja.AspNetCore.Auth;

internal enum WebAuthnChallengeKind
{
    Register,
    Login,
}

internal sealed class StoredWebAuthnChallenge
{
    public required WebAuthnChallengeKind Kind { get; init; }

    public Guid? UserId { get; init; }

    public required DateTimeOffset ExpiresAt { get; init; }

    public CredentialCreateOptions? CreateOptions { get; init; }

    public AssertionOptions? AssertionOptions { get; init; }
}

internal sealed class InMemoryWebAuthnChallengeStore
{
    private readonly Dictionary<string, StoredWebAuthnChallenge> _entries = new();

    public void Set(
        string challenge,
        WebAuthnChallengeKind kind,
        Guid? userId,
        TimeSpan ttl,
        DateTimeOffset now,
        CredentialCreateOptions? createOptions = null,
        AssertionOptions? assertionOptions = null)
    {
        _entries[challenge] = new StoredWebAuthnChallenge
        {
            Kind = kind,
            UserId = userId,
            ExpiresAt = now.Add(ttl),
            CreateOptions = createOptions,
            AssertionOptions = assertionOptions,
        };
    }

    public StoredWebAuthnChallenge? Consume(string challenge, WebAuthnChallengeKind kind, DateTimeOffset now)
    {
        if (!_entries.TryGetValue(challenge, out var entry))
        {
            return null;
        }

        _entries.Remove(challenge);

        if (entry.Kind != kind || now > entry.ExpiresAt)
        {
            return null;
        }

        return entry;
    }
}
