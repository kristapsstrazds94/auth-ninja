using AuthNinja.AspNetCore.Auth.Lockout;
using AuthNinja.AspNetCore.Auth.Models;
using AuthNinja.AspNetCore.Data;
using AuthNinja.AspNetCore.Data.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace AuthNinja.AspNetCore.Auth.Services;

internal sealed class AuthService
{
    private readonly AuthNinjaDbContext _db;
    private readonly AuthNinjaOptions _options;
    private readonly SessionService _sessions;
    private readonly LockoutEngine _lockout;
    private readonly AuditService _audit;

    public AuthService(
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

    public async Task<(SessionResponse Body, CreatedSession Session)> RegisterAsync(
        RegisterRequest request,
        string ipAddress,
        string? userAgent,
        DateTimeOffset now,
        CancellationToken cancellationToken = default)
    {
        ValidateRegisterRequest(request, _options.PasswordMinScore);

        var emailNormalized = EmailNormalizer.Normalize(request.Email!);
        var passwordHash = PasswordHasher.HashPassword(request.Password!);

        var existing = await _db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.EmailNormalized == emailNormalized, cancellationToken);

        if (existing is not null)
        {
            throw AuthErrors.Create(
                AuthErrorCode.ValidationError,
                AuthGenericMessages.RegistrationFailed,
                StatusCodes.Status409Conflict);
        }

        var user = new User
        {
            Email = request.Email!.Trim(),
            EmailNormalized = emailNormalized,
            PasswordHash = passwordHash,
        };

        _db.Users.Add(user);

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            throw AuthErrors.Create(
                AuthErrorCode.ValidationError,
                AuthGenericMessages.RegistrationFailed,
                StatusCodes.Status409Conflict);
        }

        var session = await _sessions.CreateAsync(user.Id, ipAddress, userAgent, now, cancellationToken);
        await _audit.PersistLoginAsync("success", ipAddress, userAgent, user.Id, now, cancellationToken);

        return (ToSessionResponse(user), session);
    }

    public async Task<LoginResult> LoginAsync(
        LoginRequest request,
        string? existingSessionToken,
        string ipAddress,
        string? userAgent,
        DateTimeOffset now,
        CancellationToken cancellationToken = default)
    {
        ValidateLoginRequest(request);

        var emailNormalized = EmailNormalizer.Normalize(request.Email!);
        var lockoutKey = $"login:{emailNormalized}";

        try
        {
            await _lockout.AssertNotLockedAsync(lockoutKey, now, cancellationToken);
        }
        catch (AuthNinjaException ex) when (ex.Code == AuthErrorCode.AccountLocked)
        {
            return LoginResult.Failure(ex);
        }

        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.EmailNormalized == emailNormalized, cancellationToken);

        var passwordValid = PasswordHasher.VerifyPasswordWithTimingProtection(
            request.Password!,
            user?.PasswordHash);

        if (!passwordValid)
        {
            var failure = await _lockout.RecordFailureAsync(lockoutKey, now, cancellationToken);
            await _audit.PersistLoginAsync(
                "failure",
                ipAddress,
                userAgent,
                user?.Id,
                now,
                cancellationToken);

            if (failure.JustLocked && user is not null)
            {
                await _audit.PersistLockoutAsync(
                    user.Id,
                    failure.AttemptCount,
                    ipAddress,
                    userAgent,
                    failure.UnlockAt,
                    now,
                    cancellationToken);
            }

            if (failure.Locked)
            {
                return LoginResult.Failure(AuthErrors.Create(AuthErrorCode.AccountLocked));
            }

            return LoginResult.Failure(AuthErrors.Create(AuthErrorCode.InvalidCredentials));
        }

        await _lockout.RecordSuccessAsync(lockoutKey, cancellationToken);

        if (user!.MfaEnabled)
        {
            var loginToken = LoginChallengeToken.Create(user.Id, _options.Secret!, now);
            return LoginResult.MfaRequired(loginToken);
        }

        var session = await _sessions.RotateAsync(
            user.Id,
            existingSessionToken,
            ipAddress,
            userAgent,
            now,
            cancellationToken);

        await _audit.PersistLoginAsync("success", ipAddress, userAgent, user.Id, now, cancellationToken);
        return LoginResult.Success(ToSessionResponse(user), session);
    }

    public async Task<SessionResponse> GetSessionAsync(
        string? token,
        DateTimeOffset now,
        CancellationToken cancellationToken = default)
    {
        var (session, user) = await _sessions.ResolveAsync(token, now, cancellationToken);
        await _sessions.TouchAsync(session.Id, now, cancellationToken);
        return ToSessionResponse(user);
    }

    public async Task LogoutAsync(
        string? token,
        string ipAddress,
        string? userAgent,
        DateTimeOffset now,
        CancellationToken cancellationToken = default)
    {
        var (_, user) = await _sessions.ResolveAsync(token, now, cancellationToken);
        await _sessions.InvalidateAsync(token, cancellationToken);
        await _audit.PersistLogoutAsync(user.Id, ipAddress, userAgent, now, cancellationToken);
    }

    public CsrfResponse GetCsrfToken(DateTimeOffset now) =>
        new() { Token = CsrfToken.Generate(_options.Secret!, now) };

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

    private static void ValidateRegisterRequest(RegisterRequest request, int passwordMinScore)
    {
        if (string.IsNullOrWhiteSpace(request.Email) ||
            !IsValidEmail(request.Email) ||
            string.IsNullOrEmpty(request.Password) ||
            request.Password.Length < 8 ||
            request.Password.Length > 128 ||
            !PasswordStrengthHelper.IsStrongEnough(request.Password, passwordMinScore))
        {
            throw AuthErrors.Create(AuthErrorCode.ValidationError);
        }
    }

    private static void ValidateLoginRequest(LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) ||
            !IsValidEmail(request.Email) ||
            string.IsNullOrEmpty(request.Password) ||
            request.Password.Length > 128)
        {
            throw AuthErrors.Create(AuthErrorCode.ValidationError);
        }
    }

    private static bool IsValidEmail(string email)
    {
        try
        {
            var addr = new System.Net.Mail.MailAddress(email);
            return addr.Address.Equals(email.Trim(), StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            return false;
        }
    }
}

internal abstract class LoginResult
{
    public abstract int Status { get; }

    public static LoginSuccess Success(SessionResponse body, CreatedSession session) =>
        new(body, session);

    public static LoginMfaRequired MfaRequired(string loginToken) => new(loginToken);

    public static LoginFailure Failure(AuthNinjaException error) => new(error);
}

internal sealed class LoginSuccess : LoginResult
{
    public override int Status => StatusCodes.Status200OK;

    public SessionResponse Body { get; }

    public CreatedSession Session { get; }

    public LoginSuccess(SessionResponse body, CreatedSession session)
    {
        Body = body;
        Session = session;
    }
}

internal sealed class LoginMfaRequired : LoginResult
{
    public override int Status => StatusCodes.Status200OK;

    public MfaRequiredResponse Body { get; }

    public LoginMfaRequired(string loginToken)
    {
        Body = new MfaRequiredResponse { LoginToken = loginToken };
    }
}

internal sealed class LoginFailure : LoginResult
{
    public override int Status => Error.Status;

    public AuthNinjaException Error { get; }

    public LoginFailure(AuthNinjaException error) => Error = error;
}
