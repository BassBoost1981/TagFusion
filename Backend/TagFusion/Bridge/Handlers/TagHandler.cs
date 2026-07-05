using System.IO;
using Microsoft.Extensions.Logging;
using TagFusion.Database;
using TagFusion.Services;

namespace TagFusion.Bridge.Handlers;

/// <summary>
/// Handles tag management actions: getAllTags, getTagLibrary, saveTagLibrary,
/// writeBatchTags, searchImages.
/// </summary>
public class TagHandler : IBridgeHandler
{
    private readonly ITagService _tagService;
    private readonly IExifToolService _exifToolService;
    private readonly IDatabaseService _databaseService;
    private readonly ILogger<TagHandler> _logger;
    private readonly Action<string, object?> _sendEvent;

    private static readonly HashSet<string> _supported = new(StringComparer.Ordinal)
    {
        "getAllTags", "getTagLibrary", "saveTagLibrary", "writeBatchTags", "updateBatchTag", "searchImages"
    };

    public IReadOnlySet<string> SupportedActions => _supported;

    public TagHandler(
        ITagService tagService,
        IExifToolService exifToolService,
        IDatabaseService databaseService,
        ILogger<TagHandler> logger,
        Action<string, object?> sendEvent)
    {
        _tagService = tagService;
        _exifToolService = exifToolService;
        _databaseService = databaseService;
        _logger = logger;
        _sendEvent = sendEvent;
    }

    public async Task<object?> HandleAsync(string action, Dictionary<string, object>? payload)
    {
        return action switch
        {
            "getAllTags" => await _tagService.GetAllTagsAsync(),
            "getTagLibrary" => await _tagService.GetTagLibraryAsync(),
            "saveTagLibrary" => await _tagService.SaveTagLibraryAsync(payload?["library"] ?? new object()),
            "writeBatchTags" => await WriteBatchTagsAsync(payload),
            "updateBatchTag" => await UpdateBatchTagAsync(payload),
            "searchImages" => await SearchImagesAsync(payload),
            _ => throw new NotSupportedException($"Unknown action: {action}")
        };
    }

    private async Task<Dictionary<string, bool>> WriteBatchTagsAsync(Dictionary<string, object>? payload)
    {
        if (payload == null) return new Dictionary<string, bool>();

        var paths = PayloadHelper.GetStringArray(payload, "paths");
        var tagsObj = payload.GetValueOrDefault("tags");
        var tags = TagHelper.DeduplicateTags(PayloadHelper.ExtractStringList(tagsObj));

        if (paths.Length == 0)
            return new Dictionary<string, bool>();

        // One ExifTool batch invocation for the whole list (3-5x faster than per-file).
        // Eine ExifTool-Batch-Invocation für alle Dateien — deutlich schneller als pro Datei.
        var results = await _exifToolService.WriteTagsBatchAsync(paths, tags);

        // Persist successes to the database in a single batch transaction.
        var imagesToPersist = new List<Models.ImageFile>();
        foreach (var path in paths)
        {
            if (results.TryGetValue(path, out var ok) && ok)
            {
                int rating;
                try { rating = await _exifToolService.ReadRatingAsync(path); }
                catch { rating = 0; }
                imagesToPersist.Add(Models.ImageFile.FromPath(path, tags, rating));
            }
        }
        if (imagesToPersist.Count > 0)
            await _databaseService.SaveImagesBatchAsync(imagesToPersist);

        // Single completion event (no per-file progress on the fast path).
        _sendEvent("batchProgress", new { current = paths.Length, total = paths.Length, operation = "writeBatchTags" });

        return results;
    }

    private async Task<Dictionary<string, bool>> UpdateBatchTagAsync(Dictionary<string, object>? payload)
    {
        if (payload == null) return new Dictionary<string, bool>();

        var paths = PayloadHelper.GetStringArray(payload, "paths");
        var tag = PayloadHelper.GetString(payload, "tag").Trim();
        var operation = PayloadHelper.GetString(payload, "operation");

        if (string.IsNullOrWhiteSpace(tag) || (operation != "add" && operation != "remove"))
        {
            return new Dictionary<string, bool>();
        }

        var results = new Dictionary<string, bool>();
        var total = paths.Length;

        for (var i = 0; i < paths.Length; i++)
        {
            var path = paths[i];
            try
            {
                var existingTags = await _exifToolService.ReadTagsAsync(path);
                var updatedTags = operation == "add"
                    ? TagHelper.DeduplicateTags(existingTags.Append(tag))
                    : existingTags.Where(existingTag => !string.Equals(existingTag, tag, StringComparison.OrdinalIgnoreCase)).ToList();

                var success = await _exifToolService.WriteTagsAsync(path, updatedTags);
                results[path] = success;

                if (success)
                {
                    var image = Models.ImageFile.FromPath(path, updatedTags, await _exifToolService.ReadRatingAsync(path));
                    await _databaseService.SaveImageAsync(image);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "UpdateBatchTag failed for {Path}", path);
                results[path] = false;
            }

            _sendEvent("batchProgress", new { current = i + 1, total, operation = "updateBatchTag" });
        }

        return results;
    }

    private async Task<List<Models.ImageFile>> SearchImagesAsync(Dictionary<string, object>? payload)
    {
        List<string>? terms = null;
        int? minRating = null;
        int limit = 200;
        int offset = 0;

        if (payload != null)
        {
            var tagsObj = payload.GetValueOrDefault("tags");
            var extracted = PayloadHelper.ExtractStringList(tagsObj);
            if (extracted.Count > 0) terms = extracted;

            var ratingObj = payload.GetValueOrDefault("minRating");
            var rating = PayloadHelper.GetInt(ratingObj, 0);
            if (rating > 0) minRating = rating;

            var limitObj = payload.GetValueOrDefault("limit");
            var parsedLimit = PayloadHelper.GetInt(limitObj, 200);
            if (parsedLimit > 0) limit = parsedLimit;

            var offsetObj = payload.GetValueOrDefault("offset");
            offset = PayloadHelper.GetInt(offsetObj, 0);
        }

        var results = await _databaseService.SearchImagesAsync(terms, minRating, limit, offset);

        // Auto-cleanup: hide files that no longer exist; forget them in the DB only
        // when their drive is online (protects unplugged external drives).
        // Auto-Cleanup: fehlende Dateien ausblenden; DB-Löschung nur bei
        // verbundenem Laufwerk (schützt abgestöpselte externe Platten).
        var cleanup = SearchResultCleaner.Partition(results, SearchResultCleaner.IsRootAvailable, File.Exists);
        if (cleanup.DeletablePaths.Count > 0)
        {
            try
            {
                await _databaseService.DeleteImagesAsync(cleanup.DeletablePaths);
                _logger.LogInformation("Removed {Count} stale image entries during search", cleanup.DeletablePaths.Count);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Stale-entry cleanup failed — returning filtered results anyway");
            }
        }

        return cleanup.Visible;
    }
}
