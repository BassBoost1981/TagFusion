using System.Text.Json;

namespace TagFusion.Bridge.Handlers;

/// <summary>
/// Shared helper methods for extracting typed values from bridge payloads.
/// Replaces the static methods previously scattered in WebViewBridge.
/// </summary>
public static class PayloadHelper
{
    public static string GetString(Dictionary<string, object>? payload, string key)
    {
        if (payload == null) return string.Empty;
        if (payload.TryGetValue(key, out var value))
        {
            if (value is JsonElement je && je.ValueKind == JsonValueKind.String)
                return je.GetString() ?? string.Empty;
            return value?.ToString() ?? string.Empty;
        }
        return string.Empty;
    }

    public static string[] GetStringArray(Dictionary<string, object>? payload, string key)
    {
        if (payload == null) return Array.Empty<string>();
        var obj = payload.GetValueOrDefault(key);
        return ExtractStringList(obj).ToArray();
    }

    public static List<string> ExtractStringList(object? obj)
    {
        if (obj == null) return new List<string>();

        if (obj is JsonElement jsonElement && jsonElement.ValueKind == JsonValueKind.Array)
        {
            return jsonElement.EnumerateArray()
                .Select(e => e.GetString() ?? "")
                .Where(s => !string.IsNullOrEmpty(s))
                .ToList();
        }
        if (obj is IEnumerable<object> enumerable)
        {
            return enumerable.Select(o => o?.ToString() ?? "").Where(s => !string.IsNullOrEmpty(s)).ToList();
        }

        return new List<string>();
    }

    public static int GetInt(object? obj, int defaultValue = 0)
    {
        if (obj == null) return defaultValue;
        if (obj is long l) return (int)l;
        if (obj is int i) return i;
        if (obj is double d) return (int)d;
        if (obj is JsonElement je && je.ValueKind == JsonValueKind.Number) return je.GetInt32();
        if (int.TryParse(obj?.ToString(), out var parsed)) return parsed;
        return defaultValue;
    }

    public static bool GetBool(object? obj, bool defaultValue = false)
    {
        if (obj == null) return defaultValue;
        if (obj is bool b) return b;
        if (obj is JsonElement je)
        {
            if (je.ValueKind == JsonValueKind.True) return true;
            if (je.ValueKind == JsonValueKind.False) return false;
        }
        if (bool.TryParse(obj?.ToString(), out var parsed)) return parsed;
        return defaultValue;
    }
}
