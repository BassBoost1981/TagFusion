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
    public void DeleteImages_EmptyList_NoOp()
    {
        Assert.DoesNotThrowAsync(() => _db.DeleteImagesAsync(new List<string>()));
    }

    [Test]
    public void DeleteImages_UnknownPath_DoesNotThrow()
    {
        Assert.DoesNotThrowAsync(() => _db.DeleteImagesAsync(new List<string> { "C:\\gibtsnicht.jpg" }));
    }

    // ========================================================================
    // Faces — Persistenz / persistence
    // ========================================================================

    private static NewFace TestFace(float x = 10, float y = 20, float seed = 1f)
    {
        var embedding = new float[512];
        embedding[0] = seed; // deterministic, distinguishable / deterministisch unterscheidbar
        return new NewFace(x, y, 100, 120, embedding);
    }

    [Test]
    public async Task SaveFaces_RoundTripsThroughFolderQuery()
    {
        var mtime = new DateTime(2026, 7, 1, 12, 0, 0, DateTimeKind.Utc);
        await _db.SaveFacesAsync("C:\\fotos\\a.jpg", new[] { TestFace(seed: 0.7f) }, mtime);

        var faces = await _db.GetFacesForFolderAsync("C:\\fotos");

        Assert.That(faces, Has.Count.EqualTo(1));
        Assert.That(faces[0].ImagePath, Is.EqualTo("C:\\fotos\\a.jpg"));
        Assert.That(faces[0].Status, Is.EqualTo(FaceStatus.Unnamed));
        Assert.That(faces[0].Embedding[0], Is.EqualTo(0.7f));
        Assert.That(faces[0].W, Is.EqualTo(100));
    }

    [Test]
    public async Task SaveFaces_Rescan_ReplacesOldFaces()
    {
        var mtime = DateTime.UtcNow;
        await _db.SaveFacesAsync("C:\\fotos\\a.jpg", new[] { TestFace(), TestFace(x: 200) }, mtime);
        await _db.SaveFacesAsync("C:\\fotos\\a.jpg", new[] { TestFace(x: 300) }, mtime);

        var faces = await _db.GetFacesForFolderAsync("C:\\fotos");
        Assert.That(faces, Has.Count.EqualTo(1));
        Assert.That(faces[0].X, Is.EqualTo(300));
    }

    [Test]
    public async Task SaveFaces_ImageRowIsCreatedIfMissing_AndScanTimeStored()
    {
        var mtime = new DateTime(2026, 7, 1, 12, 0, 0, DateTimeKind.Utc);
        await _db.SaveFacesAsync("C:\\neu\\x.jpg", Array.Empty<NewFace>(), mtime);

        var times = await _db.GetFaceScanTimesAsync(new List<string> { "C:\\neu\\x.jpg", "C:\\neu\\niegescannt.jpg" });

        Assert.That(times, Has.Count.EqualTo(1));
        Assert.That(times["C:\\neu\\x.jpg"], Is.EqualTo(mtime.ToString("o")));
    }

    [Test]
    public async Task GetFacesForFolder_IsNotRecursive()
    {
        var mtime = DateTime.UtcNow;
        await _db.SaveFacesAsync("C:\\fotos\\a.jpg", new[] { TestFace() }, mtime);
        await _db.SaveFacesAsync("C:\\fotos\\sub\\b.jpg", new[] { TestFace() }, mtime);

        var faces = await _db.GetFacesForFolderAsync("C:\\fotos");
        Assert.That(faces, Has.Count.EqualTo(1));
        Assert.That(faces[0].ImagePath, Is.EqualTo("C:\\fotos\\a.jpg"));
    }

    [Test]
    public async Task GetFacesByIds_ReturnsRequestedFaces()
    {
        await _db.SaveFacesAsync("C:\\fotos\\a.jpg", new[] { TestFace(), TestFace(x: 200) }, DateTime.UtcNow);
        var all = await _db.GetFacesForFolderAsync("C:\\fotos");

        var byIds = await _db.GetFacesByIdsAsync(new List<long> { all[0].Id });
        Assert.That(byIds, Has.Count.EqualTo(1));
        Assert.That(byIds[0].Id, Is.EqualTo(all[0].Id));
    }

    [Test]
    public async Task DeleteImages_AlsoRemovesFaces()
    {
        await _db.SaveFacesAsync("C:\\fotos\\weg.jpg", new[] { TestFace() }, DateTime.UtcNow);

        await _db.DeleteImagesAsync(new List<string> { "C:\\fotos\\weg.jpg" });

        var faces = await _db.GetFacesForFolderAsync("C:\\fotos");
        Assert.That(faces, Is.Empty);
    }

    [Test]
    public async Task GetFacesForFolder_FolderNameWithLikeWildcards_MatchesLiterally()
    {
        var mtime = DateTime.UtcNow;
        await _db.SaveFacesAsync("C:\\100%_Fertig\\a.jpg", new[] { TestFace() }, mtime);
        await _db.SaveFacesAsync("C:\\100x_Fertig\\b.jpg", new[] { TestFace() }, mtime);

        var faces = await _db.GetFacesForFolderAsync("C:\\100%_Fertig");

        Assert.That(faces, Has.Count.EqualTo(1));
        Assert.That(faces[0].ImagePath, Is.EqualTo("C:\\100%_Fertig\\a.jpg"));
    }

    // ========================================================================
    // Persons & Face-Status
    // ========================================================================

    [Test]
    public async Task GetOrCreatePerson_IsIdempotent()
    {
        var id1 = await _db.GetOrCreatePersonAsync("Max");
        var id2 = await _db.GetOrCreatePersonAsync("Max");
        Assert.That(id2, Is.EqualTo(id1));

        var persons = await _db.GetPersonsAsync();
        Assert.That(persons, Has.Count.EqualTo(1));
        Assert.That(persons[0].Name, Is.EqualTo("Max"));
    }

    [Test]
    public async Task AssignFaces_SetsConfirmedAndClearsSuggestion()
    {
        await _db.SaveFacesAsync("C:\\f\\a.jpg", new[] { TestFace() }, DateTime.UtcNow);
        var face = (await _db.GetFacesForFolderAsync("C:\\f"))[0];
        var personId = await _db.GetOrCreatePersonAsync("Max");
        await _db.ApplyFaceSuggestionsAsync(new[] { new FaceSuggestionUpdate(face.Id, personId, 0.8) });

        await _db.AssignFacesToPersonAsync(new List<long> { face.Id }, personId);

        var after = (await _db.GetFacesByIdsAsync(new List<long> { face.Id }))[0];
        Assert.That(after.Status, Is.EqualTo(FaceStatus.Confirmed));
        Assert.That(after.PersonId, Is.EqualTo(personId));
        Assert.That(after.SuggestedPersonId, Is.Null);

        var persons = await _db.GetPersonsAsync();
        Assert.That(persons[0].FaceCount, Is.EqualTo(1));
    }

    [Test]
    public async Task RejectSuggestion_RemembersRejectedPerson()
    {
        await _db.SaveFacesAsync("C:\\f\\a.jpg", new[] { TestFace() }, DateTime.UtcNow);
        var face = (await _db.GetFacesForFolderAsync("C:\\f"))[0];
        var personId = await _db.GetOrCreatePersonAsync("Max");
        await _db.ApplyFaceSuggestionsAsync(new[] { new FaceSuggestionUpdate(face.Id, personId, 0.8) });

        await _db.RejectFaceSuggestionsAsync(new List<long> { face.Id });

        var after = (await _db.GetFacesByIdsAsync(new List<long> { face.Id }))[0];
        Assert.That(after.Status, Is.EqualTo(FaceStatus.Unnamed));
        Assert.That(after.SuggestedPersonId, Is.Null);
        Assert.That(after.RejectedPersonId, Is.EqualTo(personId));
    }

    [Test]
    public async Task ApplySuggestions_OnlyTouchesUnnamedFaces()
    {
        await _db.SaveFacesAsync("C:\\f\\a.jpg", new[] { TestFace(), TestFace(x: 200) }, DateTime.UtcNow);
        var faces = await _db.GetFacesForFolderAsync("C:\\f");
        var personId = await _db.GetOrCreatePersonAsync("Max");
        await _db.SetFacesIgnoredAsync(new List<long> { faces[0].Id });

        await _db.ApplyFaceSuggestionsAsync(new[]
        {
            new FaceSuggestionUpdate(faces[0].Id, personId, 0.9),  // ignored — must stay ignored
            new FaceSuggestionUpdate(faces[1].Id, personId, 0.9),
        });

        var after = await _db.GetFacesByIdsAsync(faces.Select(f => f.Id).ToList());
        Assert.That(after.Single(f => f.Id == faces[0].Id).Status, Is.EqualTo(FaceStatus.Ignored));
        Assert.That(after.Single(f => f.Id == faces[1].Id).Status, Is.EqualTo(FaceStatus.Suggested));
    }

    [Test]
    public async Task GetConfirmedEmbeddingsByPerson_GroupsCorrectly()
    {
        await _db.SaveFacesAsync("C:\\f\\a.jpg", new[] { TestFace(seed: 0.1f), TestFace(x: 200, seed: 0.2f) }, DateTime.UtcNow);
        var faces = await _db.GetFacesForFolderAsync("C:\\f");
        var max = await _db.GetOrCreatePersonAsync("Max");
        await _db.AssignFacesToPersonAsync(faces.Select(f => f.Id).ToList(), max);

        var byPerson = await _db.GetConfirmedEmbeddingsByPersonAsync();

        Assert.That(byPerson, Has.Count.EqualTo(1));
        Assert.That(byPerson[max], Has.Count.EqualTo(2));
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

