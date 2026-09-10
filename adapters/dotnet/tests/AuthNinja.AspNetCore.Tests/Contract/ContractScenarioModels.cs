using System.Text.Json;
using System.Text.Json.Serialization;

namespace AuthNinja.AspNetCore.Tests.Contract;

internal sealed class ContractScenario
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("variables")]
    public Dictionary<string, string>? Variables { get; set; }

    [JsonPropertyName("steps")]
    public List<ContractStep> Steps { get; set; } = [];
}

internal sealed class ContractStep
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("method")]
    public string Method { get; set; } = "GET";

    [JsonPropertyName("path")]
    public string Path { get; set; } = string.Empty;

    [JsonPropertyName("body")]
    public JsonElement? Body { get; set; }

    [JsonPropertyName("session")]
    public JsonElement? Session { get; set; }

    [JsonPropertyName("csrf")]
    public bool? Csrf { get; set; }

    [JsonPropertyName("skipCsrf")]
    public bool SkipCsrf { get; set; }

    [JsonPropertyName("expect")]
    public ContractExpect Expect { get; set; } = new();
}

internal sealed class ContractExpect
{
    [JsonPropertyName("status")]
    public int Status { get; set; }

    [JsonPropertyName("code")]
    public string? Code { get; set; }

    [JsonPropertyName("body")]
    public Dictionary<string, JsonElement>? Body { get; set; }

    [JsonPropertyName("capture")]
    public Dictionary<string, string>? Capture { get; set; }
}
