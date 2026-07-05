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
    public async Task WriteBatchTags_WritesToMultiplePaths_SendsCompletionEvent()
    {
        var path1 = CreateTempFile();
        var path2 = CreateTempFile();
        var path3 = CreateTempFile();
        var paths = new[] { path1, path2, path3 };

        var pathsJson = JsonSerializer.Deserialize<JsonElement>(JsonSerializer.Serialize(paths));
        var tagsJson = JsonSerializer.Deserialize<JsonElement>("[\"Nature\", \"Landscape\"]");

        // Handler now uses WriteTagsBatchAsync (one call) + SaveImagesBatchAsync (one call).
        _exifToolService
            .Setup(s => s.WriteTagsBatchAsync(It.IsAny<IEnumerable<string>>(), It.IsAny<List<string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((IEnumerable<string> p, List<string> _, CancellationToken _) =>
                p.ToDictionary(x => x, _ => true, StringComparer.OrdinalIgnoreCase));

        _exifToolService
            .Setup(s => s.ReadRatingAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(0);

        _databaseService
            .Setup(s => s.SaveImagesBatchAsync(It.IsAny<List<ImageFile>>(), It.IsAny<CancellationToken>()))
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

        // One batch invocation instead of one-per-file
        _exifToolService.Verify(
            s => s.WriteTagsBatchAsync(It.IsAny<IEnumerable<string>>(), It.IsAny<List<string>>(), It.IsAny<CancellationToken>()),
            Times.Once);

        // One DB batch save instead of N individual saves
        _databaseService.Verify(
            s => s.SaveImagesBatchAsync(It.Is<List<ImageFile>>(l => l.Count == 3), It.IsAny<CancellationToken>()),
            Times.Once);

        // Single completion progress event
        Assert.That(_sentEvents, Has.Count.EqualTo(1));
        Assert.That(_sentEvents[0].EventName, Is.EqualTo("batchProgress"));
    }

    [Test]
    public async Task WriteBatchTags_WhenSomePathsFail_ReportsFailures()
    {
        var goodPath = CreateTempFile();
        var badPath = CreateTempFile();
        var paths = new[] { goodPath, badPath };

        var pathsJson = JsonSerializer.Deserialize<JsonElement>(JsonSerializer.Serialize(paths));
        var tagsJson = JsonSerializer.Deserialize<JsonElement>("[\"Tag1\"]");

        // Batch write reports per-path success in the returned dictionary.
        _exifToolService
            .Setup(s => s.WriteTagsBatchAsync(It.IsAny<IEnumerable<string>>(), It.IsAny<List<string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase)
            {
                [goodPath] = true,
                [badPath] = false,
            });

        _exifToolService
            .Setup(s => s.ReadRatingAsync(goodPath, It.IsAny<CancellationToken>()))
            .ReturnsAsync(0);

        _databaseService
            .Setup(s => s.SaveImagesBatchAsync(It.IsAny<List<ImageFile>>(), It.IsAny<CancellationToken>()))
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

        // Only the successful image is persisted to DB
        _databaseService.Verify(
            s => s.SaveImagesBatchAsync(It.Is<List<ImageFile>>(l => l.Count == 1 && l[0].Path == goodPath), It.IsAny<CancellationToken>()),
            Times.Once);

        Assert.That(_sentEvents, Has.Count.EqualTo(1));
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
        var existingFile = CreateTempFile();
        var expectedImages = new List<ImageFile>
        {
            new() { Path = existingFile, Tags = new List<string> { "Nature" } }
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

    [Test]
    public async Task SearchImages_MissingFile_FilteredAndDeletedFromDb()
    {
        var existing = CreateTempFile();
        var missing = Path.Combine(Path.GetTempPath(), Guid.NewGuid() + ".jpg");

        _databaseService
            .Setup(s => s.SearchImagesAsync(It.IsAny<List<string>>(), null, 200, 0, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<ImageFile>
            {
                new() { Path = existing },
                new() { Path = missing }
            });

        var tagsJson = JsonSerializer.Deserialize<JsonElement>("[\"urlaub\"]");
        var result = await _handler.HandleAsync("searchImages", new Dictionary<string, object> { ["tags"] = tagsJson });

        var images = (List<ImageFile>)result!;
        Assert.That(images, Has.Count.EqualTo(1));
        Assert.That(images[0].Path, Is.EqualTo(existing));

        _databaseService.Verify(
            s => s.DeleteImagesAsync(
                It.Is<List<string>>(p => p.Count == 1 && p[0] == missing),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Test]
    public async Task SearchImages_CleanupFailure_StillReturnsFilteredResults()
    {
        var existing = CreateTempFile();
        var missing = Path.Combine(Path.GetTempPath(), Guid.NewGuid() + ".jpg");

        _databaseService
            .Setup(s => s.SearchImagesAsync(It.IsAny<List<string>>(), null, 200, 0, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<ImageFile> { new() { Path = existing }, new() { Path = missing } });
        _databaseService
            .Setup(s => s.DeleteImagesAsync(It.IsAny<List<string>>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("DB locked"));

        var tagsJson = JsonSerializer.Deserialize<JsonElement>("[\"urlaub\"]");
        var result = await _handler.HandleAsync("searchImages", new Dictionary<string, object> { ["tags"] = tagsJson });

        // Cleanup errors are non-fatal — filtered results still come back.
        // Cleanup-Fehler sind nicht fatal — gefilterte Ergebnisse kommen trotzdem.
        var images = (List<ImageFile>)result!;
        Assert.That(images, Has.Count.EqualTo(1));
    }

    [Test]
    public async Task SearchImages_NoMissingFiles_DoesNotDelete()
    {
        var existing = CreateTempFile();
        _databaseService
            .Setup(s => s.SearchImagesAsync(It.IsAny<List<string>>(), null, 200, 0, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<ImageFile> { new() { Path = existing } });

        var tagsJson = JsonSerializer.Deserialize<JsonElement>("[\"x\"]");
        await _handler.HandleAsync("searchImages", new Dictionary<string, object> { ["tags"] = tagsJson });

        _databaseService.Verify(
            s => s.DeleteImagesAsync(It.IsAny<List<string>>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Test]
    public async Task SearchImages_FirstBatchAllMissing_RefillsFromNextOffset()
    {
        var missing1 = Path.Combine(Path.GetTempPath(), Guid.NewGuid() + ".jpg");
        var missing2 = Path.Combine(Path.GetTempPath(), Guid.NewGuid() + ".jpg");
        var existing1 = CreateTempFile();
        var existing2 = CreateTempFile();

        _databaseService
            .Setup(s => s.SearchImagesAsync(It.IsAny<List<string>>(), null, 2, 0, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<ImageFile> { new() { Path = missing1 }, new() { Path = missing2 } });

        _databaseService
            .Setup(s => s.SearchImagesAsync(It.IsAny<List<string>>(), null, 2, 2, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<ImageFile> { new() { Path = existing1 }, new() { Path = existing2 } });

        var tagsJson = JsonSerializer.Deserialize<JsonElement>("[\"urlaub\"]");
        var payload = new Dictionary<string, object> { ["tags"] = tagsJson, ["limit"] = (long)2 };

        var result = await _handler.HandleAsync("searchImages", payload);

        var images = (List<ImageFile>)result!;
        Assert.That(images.Select(i => i.Path), Is.EquivalentTo(new[] { existing1, existing2 }));

        _databaseService.Verify(
            s => s.DeleteImagesAsync(
                It.Is<List<string>>(p => p.Count == 2 && p.Contains(missing1) && p.Contains(missing2)),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Test]
    public async Task SearchImages_DbExhausted_StopsRequerying()
    {
        var missing = Path.Combine(Path.GetTempPath(), Guid.NewGuid() + ".jpg");

        _databaseService
            .Setup(s => s.SearchImagesAsync(It.IsAny<List<string>>(), null, 2, 0, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<ImageFile> { new() { Path = missing } });

        var tagsJson = JsonSerializer.Deserialize<JsonElement>("[\"urlaub\"]");
        var payload = new Dictionary<string, object> { ["tags"] = tagsJson, ["limit"] = (long)2 };

        var result = await _handler.HandleAsync("searchImages", payload);

        var images = (List<ImageFile>)result!;
        Assert.That(images, Is.Empty);

        _databaseService.Verify(
            s => s.SearchImagesAsync(It.IsAny<List<string>>(), null, 2, 0, It.IsAny<CancellationToken>()),
            Times.Once);
        _databaseService.Verify(
            s => s.SearchImagesAsync(It.IsAny<List<string>>(), null, 2, 2, It.IsAny<CancellationToken>()),
            Times.Never);

        _databaseService.Verify(
            s => s.DeleteImagesAsync(
                It.Is<List<string>>(p => p.Count == 1 && p[0] == missing),
                It.IsAny<CancellationToken>()),
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
