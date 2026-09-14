using AuthNinja.AspNetCore.Auth.Models;
using AuthNinja.AspNetCore.Data;
using AuthNinja.AspNetCore.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace AuthNinja.AspNetCore.Auth.Services;

internal sealed class PasswordResetService
{
    private readonly AuthNinjaDbContext _db;
    private readonly AuthNinjaOptions _options;
    private readonly SessionService _sessions;

    public PasswordResetService(
        AuthNinjaDbContext db,
        IOptions<AuthNinjaOptions> options,
        SessionService sessions)
    {
        _db = db;
        _options = options.Value;
        _sessions = sessions;
    }

    public async Task<(GenericMessageResponse Body, string? ResetToken)> RequestAsync(
        PasswordResetRequest request,
        DateTimeOffset now,
        CancellationToken cancellationToken = default)
    {
        ValidateEmail(request.Email);

        var emailNormalized = EmailNormalizer.Normalize(request.Email!);
        var user = await _db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.EmailNormalized == emailNormalized, cancellationToken);

        if (user is null)
        {
            return (GenericMessage(), null);
        }

        await _db.PasswordResetTokens
            .Where(t => t.UserId == user.Id)
            .ExecuteDeleteAsync(cancellationToken);

        var resetToken = PasswordResetHelper.GenerateToken();
        var tokenHash = PasswordResetHelper.HashToken(resetToken);

        _db.PasswordResetTokens.Add(new PasswordResetToken
        {
            UserId = user.Id,
            TokenHash = tokenHash,
            ExpiresAt = now.AddSeconds(PasswordResetHelper.TokenTtlSeconds),
            CreatedAt = now,
        });

        await _db.SaveChangesAsync(cancellationToken);
        return (GenericMessage(), resetToken);
    }

    public async Task<GenericMessageResponse> ConfirmAsync(
        PasswordResetConfirmRequest request,
        DateTimeOffset now,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(request.Token) ||
            request.Token.Length < 32 ||
            string.IsNullOrEmpty(request.Password) ||
            request.Password.Length < 8 ||
            request.Password.Length > 128 ||
            !PasswordStrengthHelper.IsStrongEnough(request.Password, _options.PasswordMinScore))
        {
            throw AuthErrors.Create(AuthErrorCode.ValidationError);
        }

        var tokenHash = PasswordResetHelper.HashToken(request.Token);
        var row = await _db.PasswordResetTokens
            .FirstOrDefaultAsync(t => t.TokenHash == tokenHash, cancellationToken);

        if (row is null || now >= row.ExpiresAt)
        {
            throw AuthErrors.Create(
                AuthErrorCode.ValidationError,
                AuthGenericMessages.PasswordResetFailed);
        }

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == row.UserId, cancellationToken);
        if (user is null)
        {
            throw AuthErrors.Create(
                AuthErrorCode.ValidationError,
                AuthGenericMessages.PasswordResetFailed);
        }

        user.PasswordHash = PasswordHasher.HashPassword(request.Password);
        user.UpdatedAt = now;
        _db.PasswordResetTokens.Remove(row);

        await _sessions.InvalidateAllForUserAsync(user.Id, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);

        return SuccessMessage();
    }

    private static GenericMessageResponse GenericMessage() =>
        new() { Message = AuthGenericMessages.PasswordResetRequested };

    private static GenericMessageResponse SuccessMessage() =>
        new() { Message = AuthGenericMessages.PasswordResetSuccess };

    private static void ValidateEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            throw AuthErrors.Create(AuthErrorCode.ValidationError);
        }

        try
        {
            var addr = new System.Net.Mail.MailAddress(email);
            if (!addr.Address.Equals(email.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                throw AuthErrors.Create(AuthErrorCode.ValidationError);
            }
        }
        catch (FormatException)
        {
            throw AuthErrors.Create(AuthErrorCode.ValidationError);
        }
    }
}
