using System.Text;
using System.Text.Json;
using AuthNinja.AspNetCore.Auth.Lockout;
using AuthNinja.AspNetCore.Auth.Models;
using AuthNinja.AspNetCore.Data;
using AuthNinja.AspNetCore.Data.Entities;
using AuthNinja.AspNetCore.Data.Enums;
using Fido2NetLib;
using Fido2NetLib.Objects;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace AuthNinja.AspNetCore.Auth.Services;

internal sealed class PasskeyService
{
    private static readonly JsonSerializerOptions FidoJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private readonly AuthNinjaDbContext _db;
    private readonly AuthNinjaOptions _options;
    private readonly SessionService _sessions;
    private readonly LockoutEngine _lockout;
    private readonly AuditService _audit;
    private readonly IFido2 _fido2;
    private readonly InMemoryWebAuthnChallengeStore _challenges;

    public PasskeyService(
        AuthNinjaDbContext db,
        IOptions<AuthNinjaOptions> options,
        SessionService sessions,
        LockoutEngine lockout,
        AuditService audit,
        IFido2 fido2,
        InMemoryWebAuthnChallengeStore challenges)
    {
        _db = db;
        _options = options.Value;
        _sessions = sessions;
        _lockout = lockout;
        _audit = audit;
        _fido2 = fido2;
        _challenges = challenges;
    }

    public async Task<WebAuthnOptionsResponse> RegisterBeginAsync(
        string? sessionToken,
        DateTimeOffset now,
        CancellationToken cancellationToken = default)
    {
        AssertPasskeysEnabled();

        var (_, user) = await _sessions.ResolveAsync(sessionToken, now, cancellationToken);
        var excludeCredentials = await LoadDescriptorsAsync(user.Id, cancellationToken);

        var options = _fido2.RequestNewCredential(new RequestNewCredentialParams
        {
            User = new Fido2User
            {
                DisplayName = user.Email,
                Name = user.Email,
                Id = WebAuthnConfig.UuidToUserHandle(user.Id),
            },
            ExcludeCredentials = excludeCredentials,
            AuthenticatorSelection = new AuthenticatorSelection
            {
                ResidentKey = ResidentKeyRequirement.Preferred,
                UserVerification = UserVerificationRequirement.Preferred,
            },
            AttestationPreference = AttestationConveyancePreference.None,
        });

        _challenges.Set(
            Base64UrlHelper.Encode(options.Challenge),
            WebAuthnChallengeKind.Register,
            user.Id,
            AuthConstants.WebAuthnChallengeTtl,
            now,
            createOptions: options);

        return new WebAuthnOptionsResponse { Options = options };
    }

    public async Task<PasskeyCredentialResponse> RegisterFinishAsync(
        string? sessionToken,
        WebAuthnFinishRequest request,
        DateTimeOffset now,
        CancellationToken cancellationToken = default)
    {
        AssertPasskeysEnabled();

        var (_, user) = await _sessions.ResolveAsync(sessionToken, now, cancellationToken);

        AuthenticatorAttestationRawResponse? attestation;
        try
        {
            attestation = request.Response.Deserialize<AuthenticatorAttestationRawResponse>(FidoJsonOptions);
        }
        catch
        {
            throw AuthErrors.Create(AuthErrorCode.ValidationError);
        }

        if (attestation is null)
        {
            throw AuthErrors.Create(AuthErrorCode.ValidationError);
        }

        var expectedChallenge = ExtractChallengeFromClientData(attestation.Response.ClientDataJson);
        if (expectedChallenge is null)
        {
            throw AuthErrors.Create(AuthErrorCode.ValidationError);
        }

        var stored = _challenges.Consume(expectedChallenge, WebAuthnChallengeKind.Register, now);
        if (stored?.CreateOptions is null || stored.UserId != user.Id)
        {
            throw AuthErrors.Create(AuthErrorCode.ValidationError);
        }

        RegisteredPublicKeyCredential credential;
        try
        {
            credential = await _fido2.MakeNewCredentialAsync(new MakeNewCredentialParams
            {
                AttestationResponse = attestation,
                OriginalOptions = stored.CreateOptions,
                IsCredentialIdUniqueToUserCallback = async (args, ct) =>
                {
                    var credentialId = Base64UrlHelper.Encode(args.CredentialId);
                    var exists = await _db.Credentials
                        .AsNoTracking()
                        .AnyAsync(
                            c => c.Type == CredentialType.Passkey && c.CredentialId == credentialId,
                            ct);
                    return !exists;
                },
            }, cancellationToken);
        }
        catch
        {
            throw AuthErrors.Create(AuthErrorCode.ValidationError);
        }

        var entity = new Credential
        {
            UserId = user.Id,
            Type = CredentialType.Passkey,
            CredentialId = Base64UrlHelper.Encode(credential.Id),
            PublicKey = Convert.ToBase64String(credential.PublicKey),
            Counter = (int?)credential.SignCount,
            Transports = SerializeTransports(credential.Transports),
        };

        _db.Credentials.Add(entity);
        await _db.SaveChangesAsync(cancellationToken);

        return new PasskeyCredentialResponse
        {
            CredentialId = entity.CredentialId!,
            CreatedAt = entity.CreatedAt.ToString("O"),
            Nickname = entity.Nickname,
        };
    }

    public async Task<WebAuthnOptionsResponse> LoginBeginAsync(
        PasskeyLoginBeginRequest request,
        DateTimeOffset now,
        CancellationToken cancellationToken = default)
    {
        AssertPasskeysEnabled();

        List<PublicKeyCredentialDescriptor>? allowCredentials = null;
        Guid? userId = null;

        if (!string.IsNullOrWhiteSpace(request.Email))
        {
            var emailNormalized = EmailNormalizer.Normalize(request.Email);
            var user = await _db.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.EmailNormalized == emailNormalized, cancellationToken);

            if (user is null)
            {
                throw AuthErrors.Create(AuthErrorCode.ValidationError);
            }

            userId = user.Id;
            allowCredentials = await LoadDescriptorsAsync(user.Id, cancellationToken);

            if (allowCredentials.Count == 0)
            {
                throw AuthErrors.Create(AuthErrorCode.ValidationError);
            }
        }

        var options = _fido2.GetAssertionOptions(new GetAssertionOptionsParams
        {
            AllowedCredentials = allowCredentials ?? [],
            UserVerification = UserVerificationRequirement.Preferred,
        });

        _challenges.Set(
            Base64UrlHelper.Encode(options.Challenge),
            WebAuthnChallengeKind.Login,
            userId,
            AuthConstants.WebAuthnChallengeTtl,
            now,
            assertionOptions: options);

        return new WebAuthnOptionsResponse { Options = options };
    }

    public async Task<(SessionResponse Body, CreatedSession Session)> LoginFinishAsync(
        WebAuthnFinishRequest request,
        string? existingSessionToken,
        string ipAddress,
        string? userAgent,
        DateTimeOffset now,
        CancellationToken cancellationToken = default)
    {
        AssertPasskeysEnabled();

        AuthenticatorAssertionRawResponse? assertion;
        try
        {
            assertion = request.Response.Deserialize<AuthenticatorAssertionRawResponse>(FidoJsonOptions);
        }
        catch
        {
            throw AuthErrors.Create(AuthErrorCode.InvalidCredentials);
        }

        if (assertion is null)
        {
            throw AuthErrors.Create(AuthErrorCode.InvalidCredentials);
        }

        var expectedChallenge = ExtractChallengeFromClientData(assertion.Response.ClientDataJson);
        if (expectedChallenge is null)
        {
            throw AuthErrors.Create(AuthErrorCode.InvalidCredentials);
        }

        var stored = _challenges.Consume(expectedChallenge, WebAuthnChallengeKind.Login, now);
        if (stored?.AssertionOptions is null)
        {
            throw AuthErrors.Create(AuthErrorCode.InvalidCredentials);
        }

        var storedCredential = await _db.Credentials
            .FirstOrDefaultAsync(
                c => c.Type == CredentialType.Passkey && c.CredentialId == assertion.Id,
                cancellationToken);

        if (storedCredential?.CredentialId is null || storedCredential.PublicKey is null)
        {
            throw AuthErrors.Create(AuthErrorCode.InvalidCredentials);
        }

        var userId = storedCredential.UserId;

        if (stored.UserId.HasValue && stored.UserId.Value != userId)
        {
            throw AuthErrors.Create(AuthErrorCode.InvalidCredentials);
        }

        var lockoutKey = $"passkey:{userId}";

        try
        {
            await _lockout.AssertNotLockedAsync(lockoutKey, now, cancellationToken);
        }
        catch (AuthNinjaException ex) when (ex.Code == AuthErrorCode.AccountLocked)
        {
            throw;
        }

        VerifyAssertionResult verification;
        try
        {
            verification = await _fido2.MakeAssertionAsync(new MakeAssertionParams
            {
                AssertionResponse = assertion,
                OriginalOptions = stored.AssertionOptions,
                StoredPublicKey = Convert.FromBase64String(storedCredential.PublicKey),
                StoredSignatureCounter = (uint)(storedCredential.Counter ?? 0),
                IsUserHandleOwnerOfCredentialIdCallback = (_, _) => Task.FromResult(true),
            }, cancellationToken);
        }
        catch
        {
            await RecordPasskeyFailureAsync(userId, ipAddress, userAgent, lockoutKey, now, cancellationToken);
            throw AuthErrors.Create(AuthErrorCode.InvalidCredentials);
        }

        await _lockout.RecordSuccessAsync(lockoutKey, cancellationToken);

        storedCredential.Counter = (int?)verification.SignCount;
        storedCredential.LastUsedAt = now;
        await _db.SaveChangesAsync(cancellationToken);

        var user = await _db.Users.FirstAsync(u => u.Id == userId, cancellationToken);

        var session = await _sessions.RotateAsync(
            user.Id,
            existingSessionToken,
            ipAddress,
            userAgent,
            now,
            cancellationToken);

        await _audit.PersistLoginAsync("success", ipAddress, userAgent, user.Id, now, cancellationToken);

        return (ToSessionResponse(user), session);
    }

    public async Task<PasskeyListResponse> ListAsync(
        string? sessionToken,
        DateTimeOffset now,
        CancellationToken cancellationToken = default)
    {
        AssertPasskeysEnabled();

        var (_, user) = await _sessions.ResolveAsync(sessionToken, now, cancellationToken);

        var rows = await _db.Credentials
            .AsNoTracking()
            .Where(c => c.UserId == user.Id && c.Type == CredentialType.Passkey && c.CredentialId != null)
            .Select(c => new { c.CredentialId, c.CreatedAt, c.Nickname })
            .ToListAsync(cancellationToken);

        return new PasskeyListResponse
        {
            Passkeys = rows.Select(r => new PasskeySummary
            {
                CredentialId = r.CredentialId!,
                CreatedAt = r.CreatedAt.ToString("O"),
                Nickname = r.Nickname,
            }).ToArray(),
        };
    }

    public async Task DeleteAsync(
        string? sessionToken,
        string credentialId,
        DateTimeOffset now,
        CancellationToken cancellationToken = default)
    {
        AssertPasskeysEnabled();

        var (_, user) = await _sessions.ResolveAsync(sessionToken, now, cancellationToken);

        var row = await _db.Credentials
            .FirstOrDefaultAsync(
                c =>
                    c.UserId == user.Id &&
                    c.Type == CredentialType.Passkey &&
                    c.CredentialId == credentialId,
                cancellationToken);

        if (row is null)
        {
            throw AuthErrors.Create(
                AuthErrorCode.Forbidden,
                "Unable to remove passkey.",
                StatusCodes.Status404NotFound);
        }

        _db.Credentials.Remove(row);
        await _db.SaveChangesAsync(cancellationToken);
    }

    private void AssertPasskeysEnabled()
    {
        if (!_options.PasskeysEnabled)
        {
            throw AuthErrors.Create(AuthErrorCode.Forbidden);
        }
    }

    private SessionResponse ToSessionResponse(User user) =>
        new()
        {
            User = new UserDto
            {
                Id = user.Id.ToString(),
                Email = user.Email,
                MfaEnabled = user.MfaEnabled,
                PasskeysEnabled = _options.PasskeysEnabled,
            },
        };

    private async Task<List<PublicKeyCredentialDescriptor>> LoadDescriptorsAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        var rows = await _db.Credentials
            .AsNoTracking()
            .Where(c => c.UserId == userId && c.Type == CredentialType.Passkey && c.CredentialId != null)
            .ToListAsync(cancellationToken);

        return rows.Select(row => new PublicKeyCredentialDescriptor(
            PublicKeyCredentialType.PublicKey,
            Base64UrlHelper.Decode(row.CredentialId!),
            ParseTransports(row.Transports))).ToList();
    }

    private async Task RecordPasskeyFailureAsync(
        Guid userId,
        string ipAddress,
        string? userAgent,
        string lockoutKey,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var failure = await _lockout.RecordFailureAsync(lockoutKey, now, cancellationToken);
        await _audit.PersistLoginAsync("failure", ipAddress, userAgent, userId, now, cancellationToken);

        if (failure.Locked)
        {
            throw AuthErrors.Create(AuthErrorCode.AccountLocked);
        }
    }

    private static string? SerializeTransports(IEnumerable<AuthenticatorTransport>? transports)
    {
        if (transports is null)
        {
            return null;
        }

        var list = transports.Select(t => t.ToString()).ToArray();
        return list.Length == 0 ? null : JsonSerializer.Serialize(list);
    }

    private static AuthenticatorTransport[]? ParseTransports(string? raw)
    {
        if (string.IsNullOrEmpty(raw))
        {
            return null;
        }

        try
        {
            var parsed = JsonSerializer.Deserialize<string[]>(raw);
            if (parsed is null || parsed.Length == 0)
            {
                return null;
            }

            return parsed
                .Select(t => Enum.TryParse<AuthenticatorTransport>(t, out var transport) ? transport : (AuthenticatorTransport?)null)
                .Where(t => t.HasValue)
                .Select(t => t!.Value)
                .ToArray();
        }
        catch
        {
            return null;
        }
    }

    internal static string? ExtractChallengeFromClientData(byte[] clientDataJson)
    {
        try
        {
            var json = JsonSerializer.Deserialize<JsonElement>(clientDataJson);
            if (json.TryGetProperty("challenge", out var challenge) &&
                challenge.ValueKind == JsonValueKind.String)
            {
                return challenge.GetString();
            }
        }
        catch
        {
            // ignored
        }

        return null;
    }
}
