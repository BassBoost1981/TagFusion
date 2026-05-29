using System.IO;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using TagFusion.Configuration;
using TagFusion.Models;

namespace TagFusion.Services;

public class TagService : ITagService
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

    public TagService(ILogger<TagService> logger, IOptions<TagSettings> options)
    {
        _logger = logger;
        var settings = options.Value;

        // Look for the tag file in the workspace root (development) or app directory (production)
        var appDir = AppContext.BaseDirectory ?? string.Empty;

        // In Release we only look in appDir — upward-walk is a dev convenience and can
        // otherwise pick up stale JSON files from the user's Documents/profile path.
        // In Release-Builds nur appDir prüfen — Aufwärts-Suche ist nur im Dev-Modus sinnvoll.
        string? foundPath = null;

#if DEBUG
        var currentDir = new DirectoryInfo(appDir);
        for (int i = 0; i < settings.MaxDirSearchDepth; i++)
        {
            if (currentDir == null) break;

            var files = currentDir.GetFiles("TagFusion_Tags_*.json");
            if (files.Length > 0)
            {
                foundPath = files.OrderByDescending(f => f.LastWriteTime).First().FullName;
                break;
            }
            currentDir = currentDir.Parent;
        }
#else
        var appDirInfo = new DirectoryInfo(appDir);
        if (appDirInfo.Exists)
        {
            var files = appDirInfo.GetFiles("TagFusion_Tags_*.json");
            if (files.Length > 0)
                foundPath = files.OrderByDescending(f => f.LastWriteTime).First().FullName;
        }
#endif

        _tagFilePath = foundPath ?? Path.Combine(appDir, settings.DefaultTagFile);
        _logger.LogInformation("Tag file resolved at startup: {TagFilePath}", _tagFilePath);
    }

    /// <summary>
    /// Internal constructor for testing — accepts a direct file path.
    /// Interner Konstruktor für Tests — akzeptiert direkten Dateipfad.
    /// </summary>
    internal TagService(ILogger<TagService> logger, string tagFilePath)
    {
        _logger = logger;
        _tagFilePath = tagFilePath;
    }

    public async Task<List<Tag>> GetAllTagsAsync(CancellationToken cancellationToken = default)
    {
        // Fast path: return a snapshot copy so callers never hold the live reference.
        // Schnellpfad: Snapshot-Kopie zurückgeben, damit Aufrufer nie die Live-Referenz halten.
        if (_cachedTags.Count > 0 && File.Exists(_tagFilePath)
            && File.GetLastWriteTime(_tagFilePath) <= _lastLoadTime)
        {
            return _cachedTags.ToList();
        }

        await _semaphore.WaitAsync(cancellationToken);
        try
        {
            // Re-check inside the lock in case another caller already populated the cache.
            // Erneute Prüfung im Lock: Snapshot-Kopie zurückgeben, nicht die Live-Referenz.
            if (_cachedTags.Count > 0 && File.Exists(_tagFilePath)
                && File.GetLastWriteTime(_tagFilePath) <= _lastLoadTime)
            {
                return _cachedTags.ToList();
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
            return _cachedTags.ToList();
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

            // Invalidate cache: swap reference so any concurrent reader keeps a stable snapshot.
            // Cache invalidieren: Referenz tauschen, damit laufende Leser ihr Snapshot behalten.
            _lastLoadTime = DateTime.MinValue;
            _cachedTags = new List<Tag>();

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