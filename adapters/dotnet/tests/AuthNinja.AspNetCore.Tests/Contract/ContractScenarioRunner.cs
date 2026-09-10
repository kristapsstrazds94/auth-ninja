using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using AuthNinja.AspNetCore.Auth;

namespace AuthNinja.AspNetCore.Tests.Contract;

internal sealed class ContractScenarioRunner
{
    private static readonly Regex SessionCookiePattern = new(
        $"{AuthConstants.SessionCookieName}=([^;]+)",
        RegexOptions.CultureInvariant);

    private readonly HttpClient _client;
    private readonly Dictionary<string, string> _variables;
    private readonly Dictionary<string, string> _captures = new(StringComparer.Ordinal);
    private string? _csrfToken;

    public ContractScenarioRunner(HttpClient client, ContractScenario scenario)
    {
        _client = client;
        _variables = scenario.Variables is null
            ? new Dictionary<string, string>(StringComparer.Ordinal)
            : new Dictionary<string, string>(scenario.Variables, StringComparer.Ordinal);
    }

    public async Task RunAsync(ContractScenario scenario)
    {
        foreach (var step in scenario.Steps)
        {
            await RunStepAsync(step);
        }
    }

    private async Task RunStepAsync(ContractStep step)
    {
        using var request = new HttpRequestMessage(new HttpMethod(step.Method), step.Path);

        if (step.Session.HasValue)
        {
            var sessionKey = step.Session.Value.ValueKind switch
            {
                JsonValueKind.True => "session",
                JsonValueKind.String => step.Session.Value.GetString() ?? "session",
                _ => "session",
            };

            if (!_captures.TryGetValue(sessionKey, out var sessionToken))
            {
                throw new InvalidOperationException(
                    $"Step \"{step.Name}\" requires session capture \"{sessionKey}\".");
            }

            request.Headers.Add("Cookie", $"{AuthConstants.SessionCookieName}={sessionToken}");
        }

        if (NeedsCsrf(step))
        {
            _csrfToken ??= await FetchCsrfTokenAsync();
            request.Headers.Add(AuthConstants.CsrfHeaderName, _csrfToken);
        }

        if (step.Body.HasValue && step.Body.Value.ValueKind != JsonValueKind.Undefined)
        {
            var resolvedBody = ResolveJson(step.Body.Value);
            request.Content = new StringContent(
                JsonSerializer.Serialize(resolvedBody),
                Encoding.UTF8,
                "application/json");
        }

        var response = await _client.SendAsync(request);
        var bodyText = await response.Content.ReadAsStringAsync();
        JsonElement? body = null;
        if (!string.IsNullOrWhiteSpace(bodyText))
        {
            body = JsonDocument.Parse(bodyText).RootElement;
        }

        AssertExpect(response, body, step.Expect);

        if (step.Expect.Capture is not null)
        {
            foreach (var (name, source) in step.Expect.Capture)
            {
                _captures[name] = CaptureValue(response, body, source);
            }
        }
    }

    private static bool NeedsCsrf(ContractStep step)
    {
        if (step.SkipCsrf)
        {
            return false;
        }

        if (step.Csrf.HasValue)
        {
            return step.Csrf.Value;
        }

        return step.Method is "POST" or "DELETE";
    }

    private async Task<string> FetchCsrfTokenAsync()
    {
        var response = await _client.GetAsync("/auth/csrf");
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        var token = body.GetProperty("token").GetString();
        return token ?? throw new InvalidOperationException("Missing CSRF token.");
    }

    private void AssertExpect(HttpResponseMessage response, JsonElement? body, ContractExpect expect)
    {
        if ((int)response.StatusCode != expect.Status)
        {
            throw new InvalidOperationException(
                $"Expected status {expect.Status}, got {(int)response.StatusCode}: {body}");
        }

        if (expect.Code is not null)
        {
            var code = body?.GetProperty("code").GetString();
            if (code != expect.Code)
            {
                throw new InvalidOperationException($"Expected error code {expect.Code}, got {code}.");
            }
        }

        if (expect.Body is not null && body.HasValue)
        {
            foreach (var (path, expectedValue) in expect.Body)
            {
                var actual = GetNestedValue(body.Value, path);
                var resolvedExpected = ResolveJson(expectedValue) ?? expectedValue;
                if (!JsonElementEquals(actual, resolvedExpected))
                {
                    throw new InvalidOperationException(
                        $"Body mismatch at \"{path}\": expected {resolvedExpected}, got {actual}.");
                }
            }
        }
    }

    private string CaptureValue(HttpResponseMessage response, JsonElement? body, string source)
    {
        if (source == "cookie")
        {
            if (!response.Headers.TryGetValues("Set-Cookie", out var cookies))
            {
                throw new InvalidOperationException("Expected session cookie but none was set.");
            }

            foreach (var cookie in cookies)
            {
                var match = SessionCookiePattern.Match(cookie);
                if (match.Success && match.Groups[1].Value.Length > 0)
                {
                    return match.Groups[1].Value;
                }
            }

            throw new InvalidOperationException("Expected session cookie but none was set.");
        }

        if (source.StartsWith("body.", StringComparison.Ordinal))
        {
            var path = source["body.".Length..];
            var value = GetNestedValue(body, path);
            if (value is null)
            {
                throw new InvalidOperationException($"Expected capture at {source} but value was missing.");
            }

            return value.Value.ValueKind switch
            {
                JsonValueKind.String => value.Value.GetString() ?? string.Empty,
                _ => value.Value.GetRawText(),
            };
        }

        throw new InvalidOperationException($"Unknown capture source: {source}");
    }

    private JsonElement? ResolveJson(JsonElement value)
    {
        return value.ValueKind switch
        {
            JsonValueKind.String => ResolveString(value.GetString() ?? string.Empty),
            JsonValueKind.Object => ResolveObject(value),
            JsonValueKind.Array => ResolveArray(value),
            _ => value,
        };
    }

    private JsonElement ResolveString(string value)
    {
        var totpMatch = Regex.Match(value, @"^\{\{totp:([^}]+)\}\}$");
        if (totpMatch.Success)
        {
            var secretKey = totpMatch.Groups[1].Value;
            if (!_captures.TryGetValue(secretKey, out var secret))
            {
                throw new InvalidOperationException($"Missing TOTP secret capture \"{secretKey}\".");
            }

            return JsonDocument.Parse($"\"{TotpHelper.GenerateCode(secret)}\"").RootElement;
        }

        if (value.StartsWith('$'))
        {
            var key = value[1..];
            if (_captures.TryGetValue(key, out var captured))
            {
                return JsonDocument.Parse($"\"{captured}\"").RootElement;
            }

            if (_variables.TryGetValue(key, out var variable))
            {
                return JsonDocument.Parse($"\"{variable}\"").RootElement;
            }

            throw new InvalidOperationException($"Unknown variable or capture: {value}");
        }

        return JsonDocument.Parse($"\"{value}\"").RootElement;
    }

    private JsonElement ResolveObject(JsonElement value)
    {
        var dict = new Dictionary<string, JsonElement>(StringComparer.Ordinal);
        foreach (var property in value.EnumerateObject())
        {
            dict[property.Name] = ResolveJson(property.Value) ?? property.Value;
        }

        return JsonSerializer.SerializeToElement(dict);
    }

    private JsonElement ResolveArray(JsonElement value)
    {
        var items = value.EnumerateArray()
            .Select(item => ResolveJson(item) ?? item)
            .ToArray();
        return JsonSerializer.SerializeToElement(items);
    }

    private static JsonElement? GetNestedValue(JsonElement? body, string path)
    {
        if (!body.HasValue)
        {
            return null;
        }

        JsonElement current = body.Value;
        foreach (var part in path.Split('.'))
        {
            if (current.ValueKind != JsonValueKind.Object || !current.TryGetProperty(part, out current))
            {
                return null;
            }
        }

        return current;
    }

    private static bool JsonElementEquals(JsonElement? actual, JsonElement expected)
    {
        if (actual is null)
        {
            return false;
        }

        return JsonSerializer.Serialize(actual.Value) == JsonSerializer.Serialize(expected);
    }
}
