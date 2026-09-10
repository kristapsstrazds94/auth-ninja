using System.Text.Json.Serialization;

namespace AuthNinja.AspNetCore.Auth.Models;

public sealed class ErrorResponse
{
    [JsonPropertyName("code")]
    public required string Code { get; init; }

    [JsonPropertyName("message")]
    public required string Message { get; init; }
}

public sealed class RegisterRequest
{
    [JsonPropertyName("email")]
    public string? Email { get; init; }

    [JsonPropertyName("password")]
    public string? Password { get; init; }
}

public sealed class LoginRequest
{
    [JsonPropertyName("email")]
    public string? Email { get; init; }

    [JsonPropertyName("password")]
    public string? Password { get; init; }
}

public sealed class UserDto
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    [JsonPropertyName("email")]
    public required string Email { get; init; }

    [JsonPropertyName("mfaEnabled")]
    public bool MfaEnabled { get; init; }

    [JsonPropertyName("passkeysEnabled")]
    public bool PasskeysEnabled { get; init; }
}

public sealed class SessionResponse
{
    [JsonPropertyName("authenticated")]
    public bool Authenticated { get; init; } = true;

    [JsonPropertyName("user")]
    public required UserDto User { get; init; }
}

public sealed class MfaRequiredResponse
{
    [JsonPropertyName("mfaRequired")]
    public bool MfaRequired { get; init; } = true;

    [JsonPropertyName("loginToken")]
    public required string LoginToken { get; init; }
}

public sealed class CsrfResponse
{
    [JsonPropertyName("token")]
    public required string Token { get; init; }
}

public sealed class CreatedSession
{
    public required string Token { get; init; }

    public required Guid SessionId { get; init; }

    public required DateTimeOffset ExpiresAt { get; init; }
}

public sealed class TotpEnrollResponse
{
    [JsonPropertyName("secret")]
    public required string Secret { get; init; }

    [JsonPropertyName("otpauthUrl")]
    public required string OtpauthUrl { get; init; }
}

public sealed class TotpCodeRequest
{
    [JsonPropertyName("code")]
    public string? Code { get; init; }
}

public sealed class TotpConfirmResponse
{
    [JsonPropertyName("mfaEnabled")]
    public bool MfaEnabled { get; init; } = true;

    [JsonPropertyName("backupCodes")]
    public required string[] BackupCodes { get; init; }
}

public sealed class TotpVerifyRequest
{
    [JsonPropertyName("loginToken")]
    public string? LoginToken { get; init; }

    [JsonPropertyName("code")]
    public string? Code { get; init; }
}

public sealed class PasswordConfirmRequest
{
    [JsonPropertyName("password")]
    public string? Password { get; init; }
}

public sealed class BackupCodesResponse
{
    [JsonPropertyName("backupCodes")]
    public required string[] BackupCodes { get; init; }
}

public sealed class Disable2faRequest
{
    [JsonPropertyName("password")]
    public string? Password { get; init; }

    [JsonPropertyName("code")]
    public string? Code { get; init; }

    [JsonPropertyName("backupCode")]
    public string? BackupCode { get; init; }
}

public sealed class WebAuthnOptionsResponse
{
    [JsonPropertyName("options")]
    public required object Options { get; init; }
}

public sealed class WebAuthnFinishRequest
{
    [JsonPropertyName("response")]
    public System.Text.Json.JsonElement Response { get; init; }
}

public sealed class PasskeyLoginBeginRequest
{
    [JsonPropertyName("email")]
    public string? Email { get; init; }
}

public sealed class PasskeyCredentialResponse
{
    [JsonPropertyName("credentialId")]
    public required string CredentialId { get; init; }

    [JsonPropertyName("createdAt")]
    public required string CreatedAt { get; init; }

    [JsonPropertyName("nickname")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Nickname { get; init; }
}

public sealed class PasskeySummary
{
    [JsonPropertyName("credentialId")]
    public required string CredentialId { get; init; }

    [JsonPropertyName("createdAt")]
    public required string CreatedAt { get; init; }

    [JsonPropertyName("nickname")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Nickname { get; init; }
}

public sealed class PasskeyListResponse
{
    [JsonPropertyName("passkeys")]
    public required PasskeySummary[] Passkeys { get; init; }
}
