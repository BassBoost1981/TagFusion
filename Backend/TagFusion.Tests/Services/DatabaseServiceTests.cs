using NUnit.Framework;
using TagFusion.Models;
using TagFusion.Services;

namespace TagFusion.Tests.Services;

[TestFixture]
public class DatabaseServiceTests
{
    private DatabaseService _db = null!;

    [SetUp]
    public void SetUp()
    {
        // Use in-memory SQLite database for each test
        _db = new DatabaseService("Data Source=:memory:;Version=3;");
    }

    [TearDown]
    public void TearDown()
    {
        _db?.Dispose();
    }

    // ========================================================================
    // SaveImageAsync + GetImageAsync
    // ========================================================================

    [Test]
    public async Task SaveAndRetrieveImage_RoundTrips()
    {
        var image = CreateTestImage("C:\\test\\photo.jpg", new[] { "Natur", "Landschaft" }, 4);

        await _db.SaveImageAsync(image);
        var loaded = await _db.GetImageAsync("C:\\test\\photo.jpg");

        Assert.That(loaded, Is.Not.Null);
        Assert.That(loaded!.Path, Is.EqualTo("C:\\test\\photo.jpg"));
        Assert.That(loaded.Rating, Is.EqualTo(4));
        Assert.That(loaded.Tags, Is.EquivalentTo(new[] { "Natur", "Landschaft" }));
    }

    [Test]
    public async Task SaveImage_DuplicateTags_Deduplicates()
    {
        var image = CreateTestImage("C:\\test\\photo.jpg", new[] { "Natur", "natur", "NATUR", "Landschaft" });

        await _db.SaveImageAsync(image);
        var loaded = await _db.GetImageAsync("C:\\test\\photo.jpg");

        Assert.That(loaded, Is.Not.Null);
        // Should only have 2 unique tags (case-insensitive dedup)
        Assert.That(loaded!.Tags, Has.Count.EqualTo(2));
    }

    [Test]
    public async Task SaveImage_EmptyTags_SavesWithNoTags()
    {
        var image = CreateTestImage("C:\\test\\photo.jpg", Array.Empty<string>());

        await _db.SaveImageAsync(image);
        var loaded = await _db.GetImageAsync("C:\\test\\photo.jpg");

        Assert.That(loaded, Is.Not.Null);
        Assert.That(loaded!.Tags, Is.Empty);
    }

    [Test]
    public async Task SaveImage_UpdateExisting_OverwritesTags()
    {
        var image1 = CreateTestImage("C:\\test\\photo.jpg", new[] { "Alt1", "Alt2" }, 3);
        await _db.SaveImageAsync(image1);

        var image2 = CreateTestImage("C:\\test\\photo.jpg", new[] { "Neu1" }, 5);
        await _db.SaveImageAsync(image2);

        var loaded = await _db.GetImageAsync("C:\\test\\photo.jpg");
        Assert.That(loaded!.Tags, Is.EquivalentTo(new[] { "Neu1" }));
        Assert.That(loaded.Rating, Is.EqualTo(5));
    }

    [Test]
    public async Task GetImage_NotFound_ReturnsNull()
    {
        var loaded = await _db.GetImageAsync("C:\\nonexistent.jpg");
        Assert.That(loaded, Is.Null);
    }

    // ========================================================================
    // GetMetadataForPathsAsync
    // ========================================================================

    [Test]
    public async Task GetMetadataForPaths_MultiplePaths_ReturnsAll()
    {
        await _db.SaveImageAsync(CreateTestImage("C:\\a.jpg", new[] { "Tag1" }, 3));
        await _db.SaveImageAsync(CreateTestImage("C:\\b.jpg", new[] { "Tag2" }, 5));

        var metadata = await _db.GetMetadataForPathsAsync(new List<string> { "C:\\a.jpg", "C:\\b.jpg" });

        Assert.That(metadata, Has.Count.EqualTo(2));
        Assert.That(metadata["C:\\a.jpg"].Rating, Is.EqualTo(3));
        Assert.That(metadata["C:\\b.jpg"].Tags, Does.Contain("Tag2"));
    }

    [Test]
    public async Task GetMetadataForPaths_EmptyList_ReturnsEmpty()
    {
        var metadata = await _db.GetMetadataForPathsAsync(new List<string>());
        Assert.That(metadata, Is.Empty);
    }

    [Test]
    public async Task GetMetadataForPaths_MissingPaths_SkipsMissing()
    {
        await _db.SaveImageAsync(CreateTestImage("C:\\exists.jpg", new[] { "Tag1" }));

        var metadata = await _db.GetMetadataForPathsAsync(new List<string> { "C:\\exists.jpg", "C:\\missing.jpg" });
        Assert.That(metadata, Has.Count.EqualTo(1));
        Assert.That(metadata.ContainsKey("C:\\exists.jpg"), Is.True);
    }

    // ========================================================================
    // SaveImagesBatchAsync
    // ========================================================================

    [Test]
    public async Task SaveImagesBatch_MultipleSaves_AllPersisted()
    {
        var images = new List<ImageFile>
        {
            CreateTestImage("C:\\1.jpg", new[] { "A" }),
            CreateTestImage("C:\\2.jpg", new[] { "B" }),
            CreateTestImage("C:\\3.jpg", new[] { "C" }),
        };

        await _db.SaveImagesBatchAsync(images);

        var meta = await _db.GetMetadataForPathsAsync(new List<string> { "C:\\1.jpg", "C:\\2.jpg", "C:\\3.jpg" });
        Assert.That(meta, Has.Count.EqualTo(3));
    }

    // ========================================================================
    // HealthCheckAsync
    // ========================================================================

    [Test]
    public async Task HealthCheck_ReturnsTrue()
    {
        var result = await _db.HealthCheckAsync();
        Assert.That(result, Is.True);
    }

    // ========================================================================
    // Helpers
    // ========================================================================

    private static ImageFile CreateTestImage(string path, string[] tags, int rating = 0)
    {
        return new ImageFile
        {
            Path = path,
            FileName = System.IO.Path.GetFileName(path),
            Extension = System.IO.Path.GetExtension(path),
            FileSize = 1024,
            DateModified = DateTime.UtcNow,
            DateCreated = DateTime.UtcNow,
            Tags = tags.ToList(),
            Rating = rating,
            Width = 1920,
            Height = 1080
        };
    }
}

