using Microsoft.Extensions.Logging;
using TagFusion.Database;
using TagFusion.Services;

namespace TagFusion.Bridge.Handlers;

/// <summary>
/// Handles ExifTool-related bridge actions: readTags, writeTags, getThumbnail,
/// getFullImage, getThumbnailsBatch, getRating, setRating.
/// </summary>
public class ExifToolHandler : IBridgeHandler
{
    private readonly IExifToolService _exifToolService;
    private readonly IDatabaseService _databaseService;
    private readonly ILogger<ExifToolHandler> _logger;

    private static readonly HashSet<string> _supported = new(StringComparer.Ordinal)
    {
        "readTags", "writeTags", "getThumbnail", "getFullImage",
        "getThumbnailsBatch", "getRating", "setRating"
    };

    public IReadOnlySet<string> SupportedActions => _supported;

    public ExifToolHandler(
        IExifToolService exifToolService,
        IDatabaseService databaseService,
        ILogger<ExifToolHandler> logger)
    {
        _exifToolService = exifToolService;
        _databaseService = databaseService;
        _logger = logger;
    }

    public async Task<object?> HandleAsync(string action, Dictionary<string, object>? payload)
    {
        return action switch
        {
            "readTags" => await _exifToolService.ReadTagsAsync(PayloadHelper.GetString(payload, "imagePath")),
            "writeTags" => await WriteTagsAsync(payload),
            "getThumbnail" => await _exifToolService.GetThumbnailAsync(PayloadHelper.GetString(payload, "imagePath")),
            "getFullImage" => await GetFullImageAsync(payload),
            "getThumbnailsBatch" => await GetThumbnailsBatchAsync(payload),
            "getRating" => await _exifToolService.ReadRatingAsync(PayloadHelper.GetString(payload, "imagePath")),
            "setRating" => await SetRatingAsync(payload),
            _ => throw new NotSupportedException($"Unknown action: {action}")
        };
    }

    private async Task<bool> WriteTagsAsync(Dictionary<string, object>? payload)
    {
        if (payload == null) throw new ArgumentNullException(nameof(payload));

        var imagePath = PayloadHelper.GetString(payload, "imagePath");
        var tagsObj = payload.GetValueOrDefault("tags");

        List<string> tags = TagHelper.DeduplicateTags(PayloadHelper.ExtractStringList(tagsObj));

        _logger.LogDebug("WriteTagsAsync: path={ImagePath}, tags=[{Tags}]", imagePath, string.Join(", ", tags));

        var success = await _exifToolService.WriteTagsAsync(imagePath, tags);
        if (success)
        {
            var image = Models.ImageFile.FromPath(imagePath, tags, await _exifToolService.ReadRatingAsync(imagePath));
            await _databaseService.SaveImageAsync(image);
            _logger.LogDebug("WriteTagsAsync: DB updated with {TagCount} tags", tags.Count);
        }
        return success;
    }

    private async Task<bool> SetRatingAsync(Dictionary<string, object>? payload)
    {
        if (payload == null) throw new ArgumentNullException(nameof(payload));

        var imagePath = PayloadHelper.GetString(payload, "imagePath");
        var ratingObj = payload.GetValueOrDefault("rating");
        int rating = PayloadHelper.GetInt(ratingObj);

        var success = await _exifToolService.WriteRatingAsync(imagePath, rating);
        if (success)
        {
            var image = await _exifToolService.GetImageMetadataAsync(imagePath);
            await _databaseService.SaveImageAsync(image);
        }
        return success;
    }

    private async Task<Dictionary<string, string?>> GetThumbnailsBatchAsync(Dictionary<string, object>? payload)
    {
        if (payload == null) return new Dictionary<string, string?>();

        var pathsObj = payload.GetValueOrDefault("imagePaths");
        string[] imagePaths = PayloadHelper.ExtractStringList(pathsObj).ToArray();
        return await _exifToolService.GetThumbnailsBatchAsync(imagePaths);
    }

    private async Task<string?> GetFullImageAsync(Dictionary<string, object>? payload)
    {
        if (payload == null) return null;

        var imagePath = PayloadHelper.GetString(payload, "imagePath");
        var maxSizeObj = payload.GetValueOrDefault("maxSize");
        int maxSize = PayloadHelper.GetInt(maxSizeObj, 1920);
        return await _exifToolService.GetFullImageAsync(imagePath, maxSize);
    }
}
