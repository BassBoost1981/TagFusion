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
        "getAllTags", "getTagLibrary", "saveTagLibrary", "writeBatchTags", "searchImages"
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

        var results = new Dictionary<string, bool>();
        var total = paths.Length;

        for (var i = 0; i < paths.Length; i++)
        {
            var path = paths[i];
            try
            {
                var success = await _exifToolService.WriteTagsAsync(path, tags);
                results[path] = success;

                if (success)
                {
                    var image = Models.ImageFile.FromPath(path, tags, await _exifToolService.ReadRatingAsync(path));
                    await _databaseService.SaveImageAsync(image);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "WriteBatchTags failed for {Path}", path);
                results[path] = false;
            }

            _sendEvent("batchProgress", new { current = i + 1, total, operation = "writeBatchTags" });
        }

        return results;
    }

    private async Task<List<Models.ImageFile>> SearchImagesAsync(Dictionary<string, object>? payload)
    {
        List<string>? tags = null;
        int? minRating = null;
        int limit = 200;
        int offset = 0;

        if (payload != null)
        {
            var tagsObj = payload.GetValueOrDefault("tags");
            var extracted = PayloadHelper.ExtractStringList(tagsObj);
            if (extracted.Count > 0) tags = extracted;

            var ratingObj = payload.GetValueOrDefault("minRating");
            var rating = PayloadHelper.GetInt(ratingObj, 0);
            if (rating > 0) minRating = rating;

            var limitObj = payload.GetValueOrDefault("limit");
            var parsedLimit = PayloadHelper.GetInt(limitObj, 200);
            if (parsedLimit > 0) limit = parsedLimit;

            var offsetObj = payload.GetValueOrDefault("offset");
            offset = PayloadHelper.GetInt(offsetObj, 0);
        }

        return await _databaseService.SearchImagesAsync(tags, minRating, limit, offset);
    }
}
