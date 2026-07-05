using System.Globalization;
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

    [Test]
    public async Task SaveAndRetrieveImage_PreservesUtcDateModified()
    {
        // Bare DateTime.Parse loses Kind (a stored "...Z" comes back as Local, shifting
        // the value by the machine's UTC offset). Round-trip parsing must preserve it.
        var when = new DateTime(2026, 5, 28, 10, 0, 0, DateTimeKind.Utc);
        var image = CreateTestImage("C:\\test\\dt.jpg", new[] { "X" });
        image.DateModified = when;

        await _db.SaveImageAsync(image);
        var loaded = await _db.GetImageAsync("C:\\test\\dt.jpg");

        Assert.That(loaded, Is.Not.Null);
        Assert.That(loaded!.DateModified.Kind, Is.EqualTo(DateTimeKind.Utc));
        Assert.That(loaded.DateModified, Is.EqualTo(when));
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
    // ParseStoredDateTime
    // ========================================================================

    [TestCase(DateTimeKind.Utc)]
    [TestCase(DateTimeKind.Local)]
    [TestCase(DateTimeKind.Unspecified)]
    public void ParseStoredDateTime_RoundTripsValueAndKind(DateTimeKind kind)
    {
        var dt = DateTime.SpecifyKind(new DateTime(2026, 5, 28, 13, 45, 30, 123), kind);
        var stored = dt.ToString("o", CultureInfo.InvariantCulture);

        var parsed = DatabaseService.ParseStoredDateTime(stored);

        Assert.That(parsed, Is.EqualTo(dt));
        Assert.That(parsed.Kind, Is.EqualTo(kind));
    }

    // ========================================================================
    // SearchImagesAsync — Teilwort-Suche / partial-match search
    // ========================================================================

    [Test]
    public async Task Search_PartialTerm_MatchesTagSubstring()
    {
        await _db.SaveImageAsync(CreateTestImage("C:\\t\\1.jpg", new[] { "Urlaubsreise" }));
        await _db.SaveImageAsync(CreateTestImage("C:\\t\\2.jpg", new[] { "Arbeit" }));

        var results = await _db.SearchImagesAsync(new List<string> { "urlaub" }, null);

        Assert.That(results, Has.Count.EqualTo(1));
        Assert.That(results[0].Path, Is.EqualTo("C:\\t\\1.jpg"));
    }

    [Test]
    public async Task Search_UmlautTerm_IsCaseInsensitive()
    {
        // Built-in SQLite LIKE is ASCII-only case-insensitive — this needs lower_inv.
        // SQLites LIKE kann Umlaute nicht case-insensitiv — dafür gibt es lower_inv.
        await _db.SaveImageAsync(CreateTestImage("C:\\t\\1.jpg", new[] { "Käfer" }));

        var results = await _db.SearchImagesAsync(new List<string> { "KÄFER" }, null);

        Assert.That(results, Has.Count.EqualTo(1));
    }

    [Test]
    public async Task Search_MultipleTerms_AreAndCombined()
    {
        await _db.SaveImageAsync(CreateTestImage("C:\\t\\1.jpg", new[] { "Urlaub", "Strand" }));
        await _db.SaveImageAsync(CreateTestImage("C:\\t\\2.jpg", new[] { "Urlaub" }));

        var results = await _db.SearchImagesAsync(new List<string> { "urlaub", "strand" }, null);

        Assert.That(results, Has.Count.EqualTo(1));
        Assert.That(results[0].Path, Is.EqualTo("C:\\t\\1.jpg"));
    }

    [Test]
    public async Task Search_LikeWildcardsInTerm_AreEscaped()
    {
        await _db.SaveImageAsync(CreateTestImage("C:\\t\\1.jpg", new[] { "50%" }));
        await _db.SaveImageAsync(CreateTestImage("C:\\t\\2.jpg", new[] { "50x" }));

        var results = await _db.SearchImagesAsync(new List<string> { "50%" }, null);

        // Unescaped, '%' would match both tags. / Ohne Escaping träfe '%' beide Tags.
        Assert.That(results, Has.Count.EqualTo(1));
        Assert.That(results[0].Path, Is.EqualTo("C:\\t\\1.jpg"));
    }

    [Test]
    public async Task Search_TermPlusMinRating_BothApply()
    {
        await _db.SaveImageAsync(CreateTestImage("C:\\t\\1.jpg", new[] { "Urlaub" }, 5));
        await _db.SaveImageAsync(CreateTestImage("C:\\t\\2.jpg", new[] { "Urlaub" }, 2));

        var results = await _db.SearchImagesAsync(new List<string> { "urlaub" }, 4);

        Assert.That(results, Has.Count.EqualTo(1));
        Assert.That(results[0].Path, Is.EqualTo("C:\\t\\1.jpg"));
    }

    [Test]
    public void EscapeLikePattern_EscapesBackslashPercentUnderscore()
    {
        Assert.That(DatabaseService.EscapeLikePattern(@"a%b_c\d"), Is.EqualTo(@"a\%b\_c\\d"));
    }

    [Test]
    public async Task Search_MatchesFileNameSubstring()
    {
        await _db.SaveImageAsync(CreateTestImage("C:\\fotos\\IMG_2024_Sylt.jpg", Array.Empty<string>()));
        await _db.SaveImageAsync(CreateTestImage("C:\\fotos\\anders.jpg", Array.Empty<string>()));

        var results = await _db.SearchImagesAsync(new List<string> { "sylt" }, null);

        Assert.That(results, Has.Count.EqualTo(1));
        Assert.That(results[0].Path, Is.EqualTo("C:\\fotos\\IMG_2024_Sylt.jpg"));
    }

    [Test]
    public async Task Search_TermMatchesTagOrFileName()
    {
        await _db.SaveImageAsync(CreateTestImage("C:\\t\\strand.jpg", Array.Empty<string>()));
        await _db.SaveImageAsync(CreateTestImage("C:\\t\\2.jpg", new[] { "Strandtag" }));
        await _db.SaveImageAsync(CreateTestImage("C:\\t\\3.jpg", new[] { "Berge" }));

        var results = await _db.SearchImagesAsync(new List<string> { "strand" }, null);

        Assert.That(results, Has.Count.EqualTo(2));
    }

    [Test]
    public async Task SaveImage_EmptyFileName_DerivesFromPath()
    {
        // Some call sites build ImageFile manually without FileName — must still be searchable.
        // Manche Aufrufer setzen FileName nicht — der Fallback aus Path muss greifen.
        var image = CreateTestImage("C:\\t\\Sonnenuntergang.jpg", Array.Empty<string>());
        image.FileName = string.Empty;

        await _db.SaveImageAsync(image);
        var results = await _db.SearchImagesAsync(new List<string> { "sonnenuntergang" }, null);

        Assert.That(results, Has.Count.EqualTo(1));
    }

    // ========================================================================
    // DeleteImagesAsync
    // ========================================================================

    [Test]
    public async Task DeleteImages_RemovesImageAndItIsNoLongerFound()
    {
        await _db.SaveImageAsync(CreateTestImage("C:\\t\\weg.jpg", new[] { "Urlaub" }));
        await _db.SaveImageAsync(CreateTestImage("C:\\t\\bleibt.jpg", new[] { "Urlaub" }));

        await _db.DeleteImagesAsync(new List<string> { "C:\\t\\weg.jpg" });

        Assert.That(await _db.GetImageAsync("C:\\t\\weg.jpg"), Is.Null);
        var results = await _db.SearchImagesAsync(new List<string> { "urlaub" }, null);
        Assert.That(results, Has.Count.EqualTo(1));
        Assert.That(results[0].Path, Is.EqualTo("C:\\t\\bleibt.jpg"));
    }

    [Test]
    public async Task DeleteImages_EmptyList_NoOp()
    {
        Assert.DoesNotThrowAsync(() => _db.DeleteImagesAsync(new List<string>()));
    }

    [Test]
    public async Task DeleteImages_UnknownPath_DoesNotThrow()
    {
        Assert.DoesNotThrowAsync(() => _db.DeleteImagesAsync(new List<string> { "C:\\gibtsnicht.jpg" }));
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

