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
public class ExifToolHandlerTests
{
    private Mock<IExifToolService> _exifToolService = null!;
    private Mock<IDatabaseService> _databaseService = null!;
    private ExifToolHandler _handler = null!;
    private string _tempFile = null!;

    [SetUp]
    public void SetUp()
    {
        _exifToolService = new Mock<IExifToolService>();
        _databaseService = new Mock<IDatabaseService>();
        _handler = new ExifToolHandler(
            _exifToolService.Object,
            _databaseService.Object,
            NullLogger<ExifToolHandler>.Instance);

        // Create a real temp file so ImageFile.FromPath can read FileInfo
        _tempFile = Path.GetTempFileName();
        File.WriteAllText(_tempFile, "fake image data");
    }

    [TearDown]
    public void TearDown()
    {
        if (File.Exists(_tempFile))
            File.Delete(_tempFile);
    }

    // ========================================================================
    // readTags Tests
    // ========================================================================

    [Test]
    public async Task ReadTags_CallsReadTagsAsync_WithCorrectPath()
    {
        var expectedTags = new List<string> { "Nature", "Landscape" };
        var path = @"C:\Photos\test.jpg";

        _exifToolService
            .Setup(s => s.ReadTagsAsync(path, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedTags);

        var payload = new Dictionary<string, object>
        {
            ["imagePath"] = path
        };

        var result = await _handler.HandleAsync("readTags", payload);

        Assert.That(result, Is.EqualTo(expectedTags));
        _exifToolService.Verify(s => s.ReadTagsAsync(path, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Test]
    public async Task ReadTags_NullPayload_CallsWithEmptyString()
    {
        _exifToolService
            .Setup(s => s.ReadTagsAsync(string.Empty, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<string>());

        var result = await _handler.HandleAsync("readTags", null);

        _exifToolService.Verify(s => s.ReadTagsAsync(string.Empty, It.IsAny<CancellationToken>()), Times.Once);
    }

    // ========================================================================
    // writeTags Tests
    // ========================================================================

    [Test]
    public async Task WriteTags_DeduplicatesTags_AndWritesToExifAndDb()
    {
        // Duplicate "Nature" should be deduplicated
        var tagsJson = JsonSerializer.Deserialize<JsonElement>("[\"Nature\", \"Landscape\", \"Nature\"]");

        _exifToolService
            .Setup(s => s.WriteTagsAsync(_tempFile, It.Is<List<string>>(t => t.Count == 2), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        _exifToolService
            .Setup(s => s.ReadRatingAsync(_tempFile, It.IsAny<CancellationToken>()))
            .ReturnsAsync(3);

        _databaseService
            .Setup(s => s.SaveImageAsync(It.IsAny<ImageFile>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var payload = new Dictionary<string, object>
        {
            ["imagePath"] = _tempFile,
            ["tags"] = tagsJson
        };

        var result = await _handler.HandleAsync("writeTags", payload);

        Assert.That(result, Is.EqualTo(true));
        _exifToolService.Verify(
            s => s.WriteTagsAsync(_tempFile, It.Is<List<string>>(t =>
                t.Count == 2 && t.Contains("Nature") && t.Contains("Landscape")),
                It.IsAny<CancellationToken>()),
            Times.Once);
        _databaseService.Verify(s => s.SaveImageAsync(It.IsAny<ImageFile>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Test]
    public async Task WriteTags_WhenWriteFails_DoesNotSaveToDb()
    {
        var tagsJson = JsonSerializer.Deserialize<JsonElement>("[\"Tag1\"]");

        _exifToolService
            .Setup(s => s.WriteTagsAsync(_tempFile, It.IsAny<List<string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var payload = new Dictionary<string, object>
        {
            ["imagePath"] = _tempFile,
            ["tags"] = tagsJson
        };

        var result = await _handler.HandleAsync("writeTags", payload);

        Assert.That(result, Is.EqualTo(false));
        _databaseService.Verify(s => s.SaveImageAsync(It.IsAny<ImageFile>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Test]
    public void WriteTags_NullPayload_ThrowsArgumentNullException()
    {
        Assert.ThrowsAsync<ArgumentNullException>(async () =>
            await _handler.HandleAsync("writeTags", null));
    }

    // ========================================================================
    // getThumbnailsBatch Tests
    // ========================================================================

    [Test]
    public async Task GetThumbnailsBatch_PassesPathsCorrectly()
    {
        var paths = new[] { @"C:\Photos\a.jpg", @"C:\Photos\b.jpg" };
        var pathsJson = JsonSerializer.Deserialize<JsonElement>("[\"C:\\\\Photos\\\\a.jpg\", \"C:\\\\Photos\\\\b.jpg\"]");

        var expected = new Dictionary<string, string?>
        {
            [paths[0]] = "base64data1",
            [paths[1]] = "base64data2"
        };

        _exifToolService
            .Setup(s => s.GetThumbnailsBatchAsync(It.Is<string[]>(p => p.Length == 2), It.IsAny<CancellationToken>()))
            .ReturnsAsync(expected);

        var payload = new Dictionary<string, object>
        {
            ["imagePaths"] = pathsJson
        };

        var result = await _handler.HandleAsync("getThumbnailsBatch", payload);

        Assert.That(result, Is.EqualTo(expected));
        _exifToolService.Verify(
            s => s.GetThumbnailsBatchAsync(It.Is<string[]>(p => p.Length == 2), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Test]
    public async Task GetThumbnailsBatch_NullPayload_ReturnsEmptyDictionary()
    {
        var result = await _handler.HandleAsync("getThumbnailsBatch", null);

        Assert.That(result, Is.InstanceOf<Dictionary<string, string?>>());
        var dict = (Dictionary<string, string?>)result!;
        Assert.That(dict, Is.Empty);
    }

    // ========================================================================
    // setRating Tests
    // ========================================================================

    [Test]
    public async Task SetRating_WritesRating_FetchesMetadata_SavestoDb()
    {
        var rating = 5;
        var imageFile = new ImageFile { Path = _tempFile, Rating = rating };

        _exifToolService
            .Setup(s => s.WriteRatingAsync(_tempFile, rating, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        _exifToolService
            .Setup(s => s.GetImageMetadataAsync(_tempFile, It.IsAny<CancellationToken>()))
            .ReturnsAsync(imageFile);

        _databaseService
            .Setup(s => s.SaveImageAsync(imageFile, It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var payload = new Dictionary<string, object>
        {
            ["imagePath"] = _tempFile,
            ["rating"] = (long)rating
        };

        var result = await _handler.HandleAsync("setRating", payload);

        Assert.That(result, Is.EqualTo(true));
        _exifToolService.Verify(s => s.WriteRatingAsync(_tempFile, rating, It.IsAny<CancellationToken>()), Times.Once);
        _exifToolService.Verify(s => s.GetImageMetadataAsync(_tempFile, It.IsAny<CancellationToken>()), Times.Once);
        _databaseService.Verify(s => s.SaveImageAsync(imageFile, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Test]
    public async Task SetRating_WhenWriteFails_DoesNotFetchMetadataOrSaveToDb()
    {
        _exifToolService
            .Setup(s => s.WriteRatingAsync(_tempFile, 3, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var payload = new Dictionary<string, object>
        {
            ["imagePath"] = _tempFile,
            ["rating"] = (long)3
        };

        var result = await _handler.HandleAsync("setRating", payload);

        Assert.That(result, Is.EqualTo(false));
        _exifToolService.Verify(s => s.GetImageMetadataAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        _databaseService.Verify(s => s.SaveImageAsync(It.IsAny<ImageFile>(), It.IsAny<CancellationToken>()), Times.Never);
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
