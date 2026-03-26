using Microsoft.Extensions.Logging;
using TagFusion.Database;
using TagFusion.Services;

namespace TagFusion.Bridge.Handlers;

/// <summary>
/// Handles file-system related bridge actions: getDrives, getFolders, selectFolder,
/// getFolderContents, getImages.
/// </summary>
public class FileSystemHandler : IBridgeHandler
{
    private readonly IFileSystemService _fileSystemService;
    private readonly IExifToolService _exifToolService;
    private readonly IDatabaseService _databaseService;
    private readonly ILogger<FileSystemHandler> _logger;
    private readonly Action<string, object?> _sendEvent;

    private static readonly HashSet<string> _supported = new(StringComparer.Ordinal)
    {
        "getDrives", "getFolders", "getImages", "getFolderContents", "selectFolder"
    };

    public IReadOnlySet<string> SupportedActions => _supported;

    public FileSystemHandler(
        IFileSystemService fileSystemService,
        IExifToolService exifToolService,
        IDatabaseService databaseService,
        ILogger<FileSystemHandler> logger,
        Action<string, object?> sendEvent)
    {
        _fileSystemService = fileSystemService;
        _exifToolService = exifToolService;
        _databaseService = databaseService;
        _logger = logger;
        _sendEvent = sendEvent;
    }

    public async Task<object?> HandleAsync(string action, Dictionary<string, object>? payload)
    {
        return action switch
        {
            "getDrives" => _fileSystemService.GetDrives(),
            "getFolders" => _fileSystemService.GetFolders(PayloadHelper.GetString(payload, "path")),
            "getImages" => await HandleGetImagesAsync(payload),
            "getFolderContents" => await HandleGetFolderContentsAsync(payload),
            "selectFolder" => await _fileSystemService.SelectFolderAsync(),
            _ => throw new NotSupportedException($"Unknown action: {action}")
        };
    }

    private async Task<List<Models.GridItem>> HandleGetFolderContentsAsync(Dictionary<string, object>? payload)
    {
        var folderPath = PayloadHelper.GetString(payload, "folderPath");
        var items = await _fileSystemService.GetFolderContentsAsync(folderPath);

        var images = items
            .Where(x => !x.IsFolder && x.ImageData != null)
            .Select(x => x.ImageData!)
            .ToList();

        if (images.Any())
        {
            StartBackgroundMetadataLoad(images);
        }

        return items;
    }

    private async Task<List<Models.ImageFile>> HandleGetImagesAsync(Dictionary<string, object>? payload)
    {
        var folderPath = PayloadHelper.GetString(payload, "folderPath");
        var images = await _fileSystemService.GetImagesAsync(folderPath);
        StartBackgroundMetadataLoad(images);
        return images;
    }

    private void StartBackgroundMetadataLoad(List<Models.ImageFile> images)
    {
        _ = Task.Run(async () =>
        {
            try
            {
                var paths = images.Select(i => i.Path).ToList();

                // 1. Load from Database first
                var dbMetadata = await _databaseService.GetMetadataForPathsAsync(paths);

                if (dbMetadata.Count > 0)
                {
                    var serializableDbMetadata = dbMetadata.ToDictionary(
                        kvp => kvp.Key,
                        kvp => new { tags = kvp.Value.Tags, rating = kvp.Value.Rating }
                    );
                    _sendEvent("metadataUpdated", serializableDbMetadata);
                }

                // 2. Identify missing paths
                var missingPaths = paths.Where(p => !dbMetadata.ContainsKey(p)).ToList();

                if (missingPaths.Count > 0)
                {
                    var exifMetadata = await _exifToolService.ReadBatchMetadataAsync(missingPaths);

                    foreach (var kvp in exifMetadata)
                    {
                        var imageFile = images.FirstOrDefault(i => i.Path == kvp.Key);
                        if (imageFile != null)
                        {
                            imageFile.Tags = kvp.Value.Tags;
                            imageFile.Rating = kvp.Value.Rating;
                            await _databaseService.SaveImageAsync(imageFile);
                        }
                    }

                    var serializableExifMetadata = exifMetadata.ToDictionary(
                        kvp => kvp.Key,
                        kvp => new { tags = kvp.Value.Tags, rating = kvp.Value.Rating }
                    );
                    _sendEvent("metadataUpdated", serializableExifMetadata);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Background metadata load failed");
                _sendEvent("metadataError", new { error = ex.Message });
            }
        });
    }
}
