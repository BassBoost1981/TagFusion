using System.IO;
using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using NUnit.Framework;
using TagFusion.Bridge.Handlers;
using TagFusion.Database;
using TagFusion.Models;
using TagFusion.Services;

namespace TagFusion.Tests.Bridge.Handlers;

[TestFixture]
public class TagHandlerTests
{
    private Mock<ITagService> _tagService = null!;
    private Mock<IExifToolService> _exifToolService = null!;
    private Mock<IDatabaseService> _databaseService = null!;
    private List<(string EventName, object? Data)> _sentEvents = null!;
    private TagHandler _handler = null!;
    private List<string> _tempFiles = null!;

    [SetUp]
    public void SetUp()
    {
        _tagService = new Mock<ITagService>();
        _exifToolService = new Mock<IExifToolService>();
        _databaseService = new Mock<IDatabaseService>();
        _sentEvents = new List<(string, object?)>();
        _tempFiles = new List<string>();

        _handler = new TagHandler(
            _tagService.Object,
            _exifToolService.Object,
            _databaseService.Object,
            NullLogger<TagHandler>.Instance,
            (name, data) => _sentEvents.Add((name, data)));
    }

    [TearDown]
    public void TearDown()
    {
        foreach (var f in _tempFiles)
        {
            if (File.Exists(f)) File.Delete(f);
        }
    }

    private string CreateTempFile()
    {
        var path = Path.GetTempFileName();
        File.WriteAllText(path, "fake image data");
        _tempFiles.Add(path);
        return path;
    }

    // ========================================================================
    // writeBatchTags Tests
    // ========================================================================

    [Test]
    public async Task WriteBatchTags_WritesToMultiplePaths_SendsProgressEvents()
    {
        var path1 = CreateTempFile();
        var path2 = CreateTempFile();
        var path3 = CreateTempFile();
        var paths = new[] { path1, path2, path3 };

        // Build payload with real temp paths serialized as JSON array
        var pathsJson = JsonSerializer.Deserialize<JsonElement>(JsonSerializer.Serialize(paths));
        var tagsJson = JsonSerializer.Deserialize<JsonElement>("[\"Nature\", \"Landscape\"]");

        _exifToolService
            .Setup(s => s.WriteTagsAsync(It.IsAny<string>(), It.IsAny<List<string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        _exifToolService
            .Setup(s => s.ReadRatingAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(0);

        _databaseService
            .Setup(s => s.SaveImageAsync(It.IsAny<ImageFile>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var payload = new Dictionary<string, object>
        {
            ["paths"] = pathsJson,
            ["tags"] = tagsJson
        };

        var result = await _handler.HandleAsync("writeBatchTags", payload);

        Assert.That(result, Is.InstanceOf<Dictionary<string, bool>>());
        var dict = (Dictionary<string, bool>)result!;
        Assert.That(dict, Has.Count.EqualTo(3));
        Assert.That(dict.Values, Is.All.True);

        // Verify WriteTagsAsync was called for each path
        foreach (var path in paths)
        {
            _exifToolService.Verify(
                s => s.WriteTagsAsync(path, It.IsAny<List<string>>(), It.IsAny<CancellationToken>()),
                Times.Once);
        }

        // Verify progress events were sent for each path
        Assert.That(_sentEvents, Has.Count.EqualTo(3));
        Assert.That(_sentEvents.All(e => e.EventName == "batchProgress"), Is.True);

        // Verify DB save was called for each successful write
        _databaseService.Verify(
            s => s.SaveImageAsync(It.IsAny<ImageFile>(), It.IsAny<CancellationToken>()),
            Times.Exactly(3));
    }

    [Test]
    public async Task WriteBatchTags_WhenOnePathFails_ContinuesAndReportsFailure()
    {
        var goodPath = CreateTempFile();
        var badPath = CreateTempFile();
        var paths = new[] { goodPath, badPath };

        var pathsJson = JsonSerializer.Deserialize<JsonElement>(JsonSerializer.Serialize(paths));
        var tagsJson = JsonSerializer.Deserialize<JsonElement>("[\"Tag1\"]");

        // First path succeeds, second throws
        _exifToolService
            .Setup(s => s.WriteTagsAsync(goodPath, It.IsAny<List<string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        _exifToolService
            .Setup(s => s.ReadRatingAsync(goodPath, It.IsAny<CancellationToken>()))
            .ReturnsAsync(0);

        _exifToolService
            .Setup(s => s.WriteTagsAsync(badPath, It.IsAny<List<string>>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new IOException("File locked"));

        _databaseService
            .Setup(s => s.SaveImageAsync(It.IsAny<ImageFile>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var payload = new Dictionary<string, object>
        {
            ["paths"] = pathsJson,
            ["tags"] = tagsJson
        };

        var result = await _handler.HandleAsync("writeBatchTags", payload);

        var dict = (Dictionary<string, bool>)result!;
        Assert.That(dict[goodPath], Is.True);
        Assert.That(dict[badPath], Is.False);

        // Progress events sent for both paths despite failure
        Assert.That(_sentEvents, Has.Count.EqualTo(2));
    }

    [Test]
    public async Task WriteBatchTags_NullPayload_ReturnsEmptyDictionary()
    {
        var result = await _handler.HandleAsync("writeBatchTags", null);

        Assert.That(result, Is.InstanceOf<Dictionary<string, bool>>());
        var dict = (Dictionary<string, bool>)result!;
        Assert.That(dict, Is.Empty);
    }

    // ========================================================================
    // searchImages Tests
    // ========================================================================

    [Test]
    public async Task SearchImages_PassesAllParameters_Correctly()
    {
        var tagsJson = JsonSerializer.Deserialize<JsonElement>("[\"Nature\", \"Landscape\"]");
        var expectedImages = new List<ImageFile>
        {
            new() { Path = @"C:\Photos\a.jpg", Tags = new List<string> { "Nature" } }
        };

        _databaseService
            .Setup(s => s.SearchImagesAsync(
                It.Is<List<string>>(t => t.Count == 2),
                3,
                50,
                10,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedImages);

        var payload = new Dictionary<string, object>
        {
            ["tags"] = tagsJson,
            ["minRating"] = (long)3,
            ["limit"] = (long)50,
            ["offset"] = (long)10
        };

        var result = await _handler.HandleAsync("searchImages", payload);

        Assert.That(result, Is.EqualTo(expectedImages));
        _databaseService.Verify(
            s => s.SearchImagesAsync(
                It.Is<List<string>>(t => t.Contains("Nature") && t.Contains("Landscape")),
                3, 50, 10,
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Test]
    public async Task SearchImages_NullPayload_UsesDefaults()
    {
        _databaseService
            .Setup(s => s.SearchImagesAsync(null, null, 200, 0, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<ImageFile>());

        var result = await _handler.HandleAsync("searchImages", null);

        _databaseService.Verify(
            s => s.SearchImagesAsync(null, null, 200, 0, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Test]
    public async Task SearchImages_ZeroMinRating_TreatedAsNull()
    {
        _databaseService
            .Setup(s => s.SearchImagesAsync(null, null, 200, 0, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<ImageFile>());

        var payload = new Dictionary<string, object>
        {
            ["minRating"] = (long)0
        };

        var result = await _handler.HandleAsync("searchImages", payload);

        // minRating of 0 should be treated as null (no filter)
        _databaseService.Verify(
            s => s.SearchImagesAsync(null, null, 200, 0, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Test]
    public async Task SearchImages_EmptyTags_TreatedAsNull()
    {
        var emptyTags = JsonSerializer.Deserialize<JsonElement>("[]");

        _databaseService
            .Setup(s => s.SearchImagesAsync(null, null, 200, 0, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<ImageFile>());

        var payload = new Dictionary<string, object>
        {
            ["tags"] = emptyTags
        };

        var result = await _handler.HandleAsync("searchImages", payload);

        _databaseService.Verify(
            s => s.SearchImagesAsync(null, null, 200, 0, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    // ========================================================================
    // Unsupported action Tests
    // ========================================================================

    [Test]
    public void HandleAsync_UnsupportedAction_ThrowsNotSupportedException()
    {
        Assert.ThrowsAsync<NotSupportedException>(async () =>
            await _handler.HandleAsync("unknownAction", null));
    }
}
