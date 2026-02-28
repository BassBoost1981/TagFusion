using System.IO;
using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using NUnit.Framework;
using TagFusion.Services;

namespace TagFusion.Tests.Services;

[TestFixture]
public class TagServiceTests
{
    private string _tempDir = null!;

    [SetUp]
    public void SetUp()
    {
        _tempDir = Path.Combine(Path.GetTempPath(), $"TagFusionTests_{Guid.NewGuid():N}");
        Directory.CreateDirectory(_tempDir);
    }

    [TearDown]
    public void TearDown()
    {
        if (Directory.Exists(_tempDir))
            Directory.Delete(_tempDir, true);
    }

    // ========================================================================
    // GetAllTagsAsync Tests
    // ========================================================================

    [Test]
    public async Task GetAllTags_ValidJson_ReturnsDistinctTags()
    {
        var path = WriteTagFile(new
        {
            categories = new[]
            {
                new
                {
                    name = "Natur",
                    subcategories = new[]
                    {
                        new { name = "Bäume", tags = new[] { "Eiche", "Buche" } },
                        new { name = "Blumen", tags = new[] { "Rose", "Tulpe" } }
                    }
                }
            }
        });

        var service = new TagService(NullLogger<TagService>.Instance, path);
        var tags = await service.GetAllTagsAsync();

        Assert.That(tags, Has.Count.EqualTo(4));
        Assert.That(tags.Select(t => t.Name), Does.Contain("Eiche"));
        Assert.That(tags.Select(t => t.Name), Does.Contain("Rose"));
    }

    [Test]
    public async Task GetAllTags_DuplicateTagsAcrossCategories_Deduplicates()
    {
        var path = WriteTagFile(new
        {
            categories = new[]
            {
                new
                {
                    name = "A",
                    subcategories = new[]
                    {
                        new { name = "Sub1", tags = new[] { "Tag1", "Tag2" } }
                    }
                },
                new
                {
                    name = "B",
                    subcategories = new[]
                    {
                        new { name = "Sub2", tags = new[] { "Tag2", "Tag3" } }
                    }
                }
            }
        });

        var service = new TagService(NullLogger<TagService>.Instance, path);
        var tags = await service.GetAllTagsAsync();

        // "Tag2" appears in both — HashSet should deduplicate
        Assert.That(tags, Has.Count.EqualTo(3));
    }

    [Test]
    public async Task GetAllTags_EmptyCategories_ReturnsEmpty()
    {
        var path = WriteTagFile(new { categories = Array.Empty<object>() });

        var service = new TagService(NullLogger<TagService>.Instance, path);
        var tags = await service.GetAllTagsAsync();

        Assert.That(tags, Is.Empty);
    }

    [Test]
    public async Task GetAllTags_FileNotFound_ReturnsEmpty()
    {
        var path = Path.Combine(_tempDir, "nonexistent.json");

        var service = new TagService(NullLogger<TagService>.Instance, path);
        var tags = await service.GetAllTagsAsync();

        Assert.That(tags, Is.Empty);
    }

    [Test]
    public async Task GetAllTags_InvalidJson_ReturnsEmpty()
    {
        var path = Path.Combine(_tempDir, "bad.json");
        await File.WriteAllTextAsync(path, "{ not valid json !!!");

        var service = new TagService(NullLogger<TagService>.Instance, path);
        var tags = await service.GetAllTagsAsync();

        Assert.That(tags, Is.Empty);
    }

    [Test]
    public async Task GetAllTags_Cached_ReturnsSameInstanceOnSecondCall()
    {
        var path = WriteTagFile(new
        {
            categories = new[]
            {
                new
                {
                    name = "A",
                    subcategories = new[]
                    {
                        new { name = "S", tags = new[] { "CachedTag" } }
                    }
                }
            }
        });

        var service = new TagService(NullLogger<TagService>.Instance, path);
        var first = await service.GetAllTagsAsync();
        var second = await service.GetAllTagsAsync();

        // Should return cached list (same reference)
        Assert.That(ReferenceEquals(first, second), Is.True);
    }

    [Test]
    public async Task GetAllTags_SortedAlphabetically()
    {
        var path = WriteTagFile(new
        {
            categories = new[]
            {
                new
                {
                    name = "A",
                    subcategories = new[]
                    {
                        new { name = "S", tags = new[] { "Zebra", "Apfel", "Mango" } }
                    }
                }
            }
        });

        var service = new TagService(NullLogger<TagService>.Instance, path);
        var tags = await service.GetAllTagsAsync();

        var names = tags.Select(t => t.Name).ToList();
        Assert.That(names, Is.EqualTo(new[] { "Apfel", "Mango", "Zebra" }));
    }

    [Test]
    public async Task GetAllTags_NullSubcategories_DoesNotThrow()
    {
        // Subcategories is null — should handle gracefully
        var json = "{\"categories\":[{\"name\":\"A\",\"subcategories\":null}]}";
        var path = Path.Combine(_tempDir, "null_sub.json");
        await File.WriteAllTextAsync(path, json);

        var service = new TagService(NullLogger<TagService>.Instance, path);
        var tags = await service.GetAllTagsAsync();

        Assert.That(tags, Is.Empty);
    }

    // ========================================================================
    // Helpers
    // ========================================================================

    private string WriteTagFile(object content)
    {
        var path = Path.Combine(_tempDir, "TagFusion_Tags_Test.json");
        File.WriteAllText(path, JsonSerializer.Serialize(content, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }));
        return path;
    }
}
