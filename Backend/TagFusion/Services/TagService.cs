using System.IO;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using TagFusion.Models;

namespace TagFusion.Services;

public class TagService
{
    private readonly string _tagFilePath;
    private readonly SemaphoreSlim _semaphore = new(1, 1);
    private readonly ILogger<TagService> _logger;
    private List<Tag> _cachedTags = new();
    private DateTime _lastLoadTime = DateTime.MinValue;
    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = true
    };

    public TagService(ILogger<TagService> logger)
    {
        _logger = logger;

        // Look for the tag file in the workspace root (development) or app directory (production)
        var appDir = AppContext.BaseDirectory ?? string.Empty;

        // Try to find the file in parent directories (up to workspace root)
        var currentDir = new DirectoryInfo(appDir);
        string? foundPath = null;

        // Search up to 6 levels up
        for (int i = 0; i < 6; i++)
        {
            if (currentDir == null) break;

            var files = currentDir.GetFiles("TagFusion_Tags_*.json");
            if (files.Length > 0)
            {
                // Use the most recent one if multiple exist
                foundPath = files.OrderByDescending(f => f.LastWriteTime).First().FullName;
                break;
            }
            currentDir = currentDir.Parent;
        }

        _tagFilePath = foundPath ?? Path.Combine(appDir, "TagFusion_Tags_20251112.json");
        _logger.LogInformation("Tag file path: {TagFilePath}", _tagFilePath);
    }

    public async Task<List<Tag>> GetAllTagsAsync(CancellationToken cancellationToken = default)
    {
        await _semaphore.WaitAsync(cancellationToken);
        try
        {
            if (_cachedTags.Count > 0 && File.Exists(_tagFilePath) && File.GetLastWriteTime(_tagFilePath) <= _lastLoadTime)
            {
                return _cachedTags;
            }

            if (!File.Exists(_tagFilePath))
            {
                return new List<Tag>();
            }

            var json = await File.ReadAllTextAsync(_tagFilePath, cancellationToken);
            var library = JsonSerializer.Deserialize<TagLibrary>(json, _jsonOptions);

            if (library?.Categories == null)
                return new List<Tag>();

            var tags = new HashSet<string>();

            foreach (var category in library.Categories)
            {
                if (category.Subcategories == null) continue;

                foreach (var sub in category.Subcategories)
                {
                    if (sub.Tags == null) continue;

                    foreach (var tag in sub.Tags)
                    {
                        tags.Add(tag);
                    }
                }
            }

            _cachedTags = tags.Select(t => new Tag
            {
                Name = t,
                UsageCount = 0,
                IsFavorite = false
            }).OrderBy(t => t.Name).ToList();

            _lastLoadTime = DateTime.Now;
            return _cachedTags;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error loading tags");
            return new List<Tag>();
        }
        finally
        {
            _semaphore.Release();
        }
    }

    public async Task<object?> GetTagLibraryAsync(CancellationToken cancellationToken = default)
    {
        if (!File.Exists(_tagFilePath))
            return null;

        try
        {
            var json = await File.ReadAllTextAsync(_tagFilePath, cancellationToken);
            return JsonSerializer.Deserialize<object>(json, _jsonOptions);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to load tag library");
            return null;
        }
    }

    public async Task<bool> SaveTagLibraryAsync(object library, CancellationToken cancellationToken = default)
    {
        await _semaphore.WaitAsync(cancellationToken);
        try
        {
            var json = JsonSerializer.Serialize(library, _jsonOptions);
            await File.WriteAllTextAsync(_tagFilePath, json, cancellationToken);

            // Invalidate cache
            _lastLoadTime = DateTime.MinValue;
            _cachedTags.Clear();

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving tags");
            return false;
        }
        finally
        {
            _semaphore.Release();
        }
    }

    // Helper classes for JSON deserialization
    private class TagLibrary
    {
        public List<Category>? Categories { get; set; }
    }

    private class Category
    {
        public string? Name { get; set; }
        public List<Subcategory>? Subcategories { get; set; }
    }

    private class Subcategory
    {
        public string? Name { get; set; }
        public List<string>? Tags { get; set; }
    }
}