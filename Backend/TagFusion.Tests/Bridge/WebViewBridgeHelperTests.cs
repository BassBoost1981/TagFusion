using System.Text.Json;
using NUnit.Framework;
using TagFusion.Bridge;

namespace TagFusion.Tests.Bridge;

/// <summary>
/// Tests for WebViewBridge static helper/extraction methods.
/// </summary>
[TestFixture]
public class WebViewBridgeHelperTests
{
    // ========================================================================
    // ExtractStringArray Tests (via reflection on internal method)
    // ========================================================================

    [Test]
    public void ExtractStringArray_Null_ReturnsEmptyList()
    {
        var result = InvokeExtractStringArray(null);
        Assert.That(result, Is.Empty);
    }

    [Test]
    public void ExtractStringArray_JsonArray_ExtractsStrings()
    {
        var json = JsonSerializer.Deserialize<JsonElement>("[\"Tag1\", \"Tag2\", \"Tag3\"]");
        var result = InvokeExtractStringArray(json);

        Assert.That(result, Has.Count.EqualTo(3));
        Assert.That(result, Is.EquivalentTo(new[] { "Tag1", "Tag2", "Tag3" }));
    }

    [Test]
    public void ExtractStringArray_JsonArrayWithEmpties_FiltersEmpty()
    {
        var json = JsonSerializer.Deserialize<JsonElement>("[\"Tag1\", \"\", \"Tag2\", null]");
        var result = InvokeExtractStringArray(json);

        Assert.That(result, Has.Count.EqualTo(2));
        Assert.That(result, Is.EquivalentTo(new[] { "Tag1", "Tag2" }));
    }

    [Test]
    public void ExtractStringArray_NonArrayJson_ReturnsEmpty()
    {
        var json = JsonSerializer.Deserialize<JsonElement>("\"just a string\"");
        var result = InvokeExtractStringArray(json);

        Assert.That(result, Is.Empty);
    }

    // ========================================================================
    // ExtractInt Tests
    // ========================================================================

    [Test]
    public void ExtractInt_Null_ReturnsDefault()
    {
        var result = InvokeExtractInt(null, 42);
        Assert.That(result, Is.EqualTo(42));
    }

    [Test]
    public void ExtractInt_JsonNumber_ReturnsInt()
    {
        var json = JsonSerializer.Deserialize<JsonElement>("5");
        var result = InvokeExtractInt(json, 0);
        Assert.That(result, Is.EqualTo(5));
    }

    [Test]
    public void ExtractInt_LongValue_CastsToInt()
    {
        var result = InvokeExtractInt((long)42, 0);
        Assert.That(result, Is.EqualTo(42));
    }

    [Test]
    public void ExtractInt_StringNumber_ParsesInt()
    {
        var result = InvokeExtractInt("7", 0);
        Assert.That(result, Is.EqualTo(7));
    }

    [Test]
    public void ExtractInt_InvalidString_ReturnsDefault()
    {
        var result = InvokeExtractInt("not_a_number", 99);
        Assert.That(result, Is.EqualTo(99));
    }

    // ========================================================================
    // GetPayloadString Tests
    // ========================================================================

    [Test]
    public void GetPayloadString_NullPayload_ReturnsEmpty()
    {
        var result = InvokeGetPayloadString(null, "key");
        Assert.That(result, Is.EqualTo(string.Empty));
    }

    [Test]
    public void GetPayloadString_ExistingKey_ReturnsValue()
    {
        var payload = new Dictionary<string, object> { { "path", "C:\\test.jpg" } };
        var result = InvokeGetPayloadString(payload, "path");
        Assert.That(result, Is.EqualTo("C:\\test.jpg"));
    }

    [Test]
    public void GetPayloadString_MissingKey_ReturnsEmpty()
    {
        var payload = new Dictionary<string, object> { { "path", "C:\\test.jpg" } };
        var result = InvokeGetPayloadString(payload, "nonexistent");
        Assert.That(result, Is.EqualTo(string.Empty));
    }

    [Test]
    public void GetPayloadString_JsonElement_ExtractsString()
    {
        var jsonDoc = JsonDocument.Parse("{\"path\": \"C:\\\\photo.jpg\"}");
        var jsonElement = jsonDoc.RootElement.GetProperty("path");
        var payload = new Dictionary<string, object> { { "path", jsonElement } };

        var result = InvokeGetPayloadString(payload, "path");
        Assert.That(result, Is.EqualTo("C:\\photo.jpg"));
    }

    // ========================================================================
    // Helpers — direct static calls, no reflection needed
    // ========================================================================

    private static List<string> InvokeExtractStringArray(object? obj)
        => WebViewBridge.ExtractStringArray(obj);

    private static int InvokeExtractInt(object? obj, int defaultValue)
        => WebViewBridge.ExtractInt(obj, defaultValue);

    private static string InvokeGetPayloadString(Dictionary<string, object>? payload, string key)
        => WebViewBridge.GetPayloadString(payload, key);
}

