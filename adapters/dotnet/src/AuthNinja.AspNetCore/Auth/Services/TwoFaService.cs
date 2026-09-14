using AuthNinja.AspNetCore.Auth.Lockout;
using AuthNinja.AspNetCore.Auth.Models;
using AuthNinja.AspNetCore.Data;
using AuthNinja.AspNetCore.Data.Entities;
using AuthNinja.AspNetCore.Data.Enums;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace AuthNinja.AspNetCore.Auth.Services;

internal sealed class TwoFaService
{
    private readonly AuthNinjaDbContext _db;
    private readonly AuthNinjaOptions _options;
    private readonly SessionService _sessions;
    private readonly LockoutEngine _lockout;
    private readonly AuditService _audit;

    public TwoFaService(
        AuthNinjaDbContext db,
        IOptions<AuthNinjaOptions> options,
        SessionService sessions,
        LockoutEngine lockout,
        AuditService audit)
    {
        _db = db;
        _options = options.Value;
        _sessions = sessions;
        _lockout = lockout;
        _audit = audit;
    }

    public async Task<TotpEnrollResponse> EnrollAsync(
        string? sessionToken,
        DateTimeOffset now,
        CancellationToken cancellationToken = default)
    {
        var (_, user) = await _sessions.ResolveAsync(sessionToken, now, cancellationToken);

        if (user.MfaEnabled)
        {
            throw AuthErrors.Create(
                AuthErrorCode.Forbidden,
                "Two-factor authentication is already enabled.",
                StatusCodes.Status409Conflict);
        }

        var secret = TotpHelper.GenerateSecret();
        var otpauthUrl = TotpHelper.BuildOtpAuthUrl(secret, _options.TwoFaIssuer, user.Email);

        user.TotpSecret = FieldEncryption.Encrypt(secret, _options.Secret!);
        user.UpdatedAt = now;
        await _db.SaveChangesAsync(cancellationToken);

        return new TotpEnrollResponse { Secret = secret, OtpauthUrl = otpauthUrl };
    }

    public async Task<TotpConfirmResponse> ConfirmAsync(
        string? sessionToken,
        TotpCodeRequest request,
        DateTimeOffset now,
        CancellationToken cancellationToken = default)
    {
        ValidateTotpCode(request.Code);

        var (_, user) = await _sessions.ResolveAsync(sessionToken, now, cancellationToken);

        var totpSecret = DecryptTotpSecret(user.TotpSecret);

        if (user.MfaEnabled || string.IsNullOrEmpty(totpSecret))
        {
            throw AuthErrors.Create(AuthErrorCode.MfaInvalid);
        }

        if (!TotpHelper.VerifyCode(totpSecret, request.Code!))
        {
            throw AuthErrors.Create(AuthErrorCode.MfaInvalid);
        }

        var backupCodes = BackupCodeHelper.Generate();
        var codeHashes = BackupCodeHelper.HashCodes(backupCodes);

        await DeleteBackupCodesAsync(user.Id, cancellationToken);
        await StoreBackupCodesAsync(user.Id, codeHashes, cancellationToken);

        user.MfaEnabled = true;
        user.UpdatedAt = now;
        await _db.SaveChangesAsync(cancellationToken);

        return new TotpConfirmResponse { BackupCodes = backupCodes };
    }

    public async Task<(SessionResponse Body, CreatedSession Session)> VerifyLoginAsync(
        TotpVerifyRequest request,
        string? existingSessionToken,
        string ipAddress,
        string? userAgent,
        DateTimeOffset now,
        CancellationToken cancellationToken = default)
    {
        ValidateTotpVerifyRequest(request);

        var userId = LoginChallengeToken.Verify(request.LoginToken!, _options.Secret!, now);

        if (userId is null)
        {
            throw AuthErrors.Create(
                AuthErrorCode.InvalidCredentials,
                "Unable to verify two-factor authentication.");
        }

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        var totpSecret = DecryptTotpSecret(user?.TotpSecret);

        if (user is null || !user.MfaEnabled || string.IsNullOrEmpty(totpSecret))
        {
            throw AuthErrors.Create(
                AuthErrorCode.InvalidCredentials,
                "Unable to verify two-factor authentication.");
        }

        var lockoutKey = $"mfa:{userId}";

        try
        {
            await _lockout.AssertNotLockedAsync(lockoutKey, now, cancellationToken);
        }
        catch (AuthNinjaException ex) when (ex.Code == AuthErrorCode.AccountLocked)
        {
            throw;
        }

        if (!TotpHelper.VerifyCode(totpSecret, request.Code!))
        {
            var failure = await _lockout.RecordFailureAsync(lockoutKey, now, cancellationToken);
            await _audit.PersistLoginAsync("failure", ipAddress, userAgent, user.Id, now, cancellationToken);

            if (failure.Locked)
            {
                throw AuthErrors.Create(AuthErrorCode.AccountLocked);
            }

            throw AuthErrors.Create(AuthErrorCode.MfaInvalid);
        }

        await _lockout.RecordSuccessAsync(lockoutKey, cancellationToken);

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

    public async Task<BackupCodesResponse> RegenerateBackupCodesAsync(
        string? sessionToken,
        PasswordConfirmRequest request,
        DateTimeOffset now,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(request.Password))
        {
            throw AuthErrors.Create(AuthErrorCode.ValidationError);
        }

        var (_, user) = await _sessions.ResolveAsync(sessionToken, now, cancellationToken);

        if (!user.MfaEnabled)
        {
            throw AuthErrors.Create(AuthErrorCode.Forbidden);
        }

        if (!PasswordHasher.VerifyPassword(request.Password, user.PasswordHash))
        {
            throw AuthErrors.Create(AuthErrorCode.InvalidCredentials);
        }

        var backupCodes = BackupCodeHelper.Generate();
        var codeHashes = BackupCodeHelper.HashCodes(backupCodes);

        await DeleteBackupCodesAsync(user.Id, cancellationToken);
        await StoreBackupCodesAsync(user.Id, codeHashes, cancellationToken);

        user.UpdatedAt = now;
        await _db.SaveChangesAsync(cancellationToken);

        return new BackupCodesResponse { BackupCodes = backupCodes };
    }

    public async Task DisableAsync(
        string? sessionToken,
        Disable2faRequest request,
        DateTimeOffset now,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(request.Password))
        {
            throw AuthErrors.Create(AuthErrorCode.ValidationError);
        }

        var (_, user) = await _sessions.ResolveAsync(sessionToken, now, cancellationToken);

        if (!user.MfaEnabled)
        {
            throw AuthErrors.Create(AuthErrorCode.Forbidden);
        }

        if (!PasswordHasher.VerifyPassword(request.Password, user.PasswordHash))
        {
            throw AuthErrors.Create(AuthErrorCode.InvalidCredentials);
        }

        var secondFactorValid = false;

        var totpSecret = DecryptTotpSecret(user.TotpSecret);

        if (!string.IsNullOrEmpty(request.Code) && !string.IsNullOrEmpty(totpSecret))
        {
            secondFactorValid = TotpHelper.VerifyCode(totpSecret, request.Code);
        }
        else if (!string.IsNullOrEmpty(request.BackupCode))
        {
            secondFactorValid = await VerifyAndConsumeBackupCodeAsync(
                user.Id,
                request.BackupCode,
                now,
                cancellationToken);
        }

        if (!secondFactorValid)
        {
            throw AuthErrors.Create(AuthErrorCode.MfaInvalid);
        }

        await DeleteBackupCodesAsync(user.Id, cancellationToken);

        user.MfaEnabled = false;
        user.TotpSecret = null;
        user.UpdatedAt = now;
        await _db.SaveChangesAsync(cancellationToken);
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

    private async Task DeleteBackupCodesAsync(Guid userId, CancellationToken cancellationToken)
    {
        await _db.Credentials
            .Where(c => c.UserId == userId && c.Type == CredentialType.TotpBackup)
            .ExecuteDeleteAsync(cancellationToken);
    }

    private async Task StoreBackupCodesAsync(
        Guid userId,
        string[] codeHashes,
        CancellationToken cancellationToken)
    {
        foreach (var hash in codeHashes)
        {
            _db.Credentials.Add(new Credential
            {
                UserId = userId,
                Type = CredentialType.TotpBackup,
                CodeHash = hash,
            });
        }

        await _db.SaveChangesAsync(cancellationToken);
    }

    private async Task<bool> VerifyAndConsumeBackupCodeAsync(
        Guid userId,
        string code,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var rows = await _db.Credentials
            .Where(c =>
                c.UserId == userId &&
                c.Type == CredentialType.TotpBackup &&
                c.ConsumedAt == null)
            .ToListAsync(cancellationToken);

        foreach (var row in rows)
        {
            if (string.IsNullOrEmpty(row.CodeHash))
            {
                continue;
            }

            if (BackupCodeHelper.Verify(code, row.CodeHash))
            {
                row.ConsumedAt = now;
                row.LastUsedAt = now;
                await _db.SaveChangesAsync(cancellationToken);
                return true;
            }
        }

        return false;
    }

    private static void ValidateTotpCode(string? code)
    {
        if (string.IsNullOrEmpty(code) || code.Length != 6 || !code.All(char.IsDigit))
        {
            throw AuthErrors.Create(AuthErrorCode.ValidationError);
        }
    }

    private static void ValidateTotpVerifyRequest(TotpVerifyRequest request)
    {
        if (string.IsNullOrEmpty(request.LoginToken))
        {
            throw AuthErrors.Create(AuthErrorCode.ValidationError);
        }

        ValidateTotpCode(request.Code);
    }

    private string? DecryptTotpSecret(string? stored) =>
        string.IsNullOrEmpty(stored) ? null : FieldEncryption.Decrypt(stored, _options.Secret!);
}
