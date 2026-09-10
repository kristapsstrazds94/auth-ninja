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
