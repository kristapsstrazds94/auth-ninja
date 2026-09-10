using System.Text.Json.Serialization;

namespace AuthNinja.AspNetCore.Data.Models;

/// <summary>Type-specific audit fields stored in <c>payload</c> JSONB.</summary>
public sealed class AuditEventPayload
{
    [JsonPropertyName("outcome")]
    public string? Outcome { get; set; }

    [JsonPropertyName("attemptCount")]
    public int? AttemptCount { get; set; }

    [JsonPropertyName("unlockAt")]
    public string? UnlockAt { get; set; }

    [JsonPropertyName("reason")]
    public string? Reason { get; set; }

    [JsonPropertyName("previousIpAddress")]
    public string? PreviousIpAddress { get; set; }
}
