using System.Text.Json.Serialization;

namespace TagFusion.Bridge;

/// <summary>
/// Base message structure for C# ↔ React communication
/// </summary>
public class BridgeMessage
{
    [JsonPropertyName("id")]
    public string? Id { get; set; }

    [JsonPropertyName("action")]
    public string Action { get; set; } = string.Empty;

    [JsonPropertyName("payload")]
    public Dictionary<string, object>? Payload { get; set; }
}

/// <summary>
/// Response message from C# to React
/// </summary>
public class BridgeResponse
{
    [JsonPropertyName("id")]
    public string? Id { get; set; }

    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("data")]
    public object? Data { get; set; }

    [JsonPropertyName("error")]
    public string? Error { get; set; }
}

/// <summary>
/// Event message from C# to React (unprompted)
/// </summary>
public class BridgeEvent
{
    public string Type { get; set; } = "event";
    public string Event { get; set; } = string.Empty;
    public object? Data { get; set; }
}

