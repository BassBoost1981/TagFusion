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

    // Cancels the previous background metadata load when a new folder is opened.
    // Vorheriges Hintergrund-Laden wird abgebrochen, sobald ein neuer Ordner geöffnet wird.
    private CancellationTokenSource? _metadataLoadCts;
    private long _metadataLoadId;
    private readonly SemaphoreSlim _metadataLock = new(1, 1);

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
        var includeSubfolders = PayloadHelper.GetBool(payload?.GetValueOrDefault("includeSubfolders"));
        var items = await _fileSystemService.GetFolderContentsAsync(folderPath, includeSubfolders);

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
        var includeSubfolders = PayloadHelper.GetBool(payload?.GetValueOrDefault("includeSubfolders"));
        var images = await _fileSystemService.GetImagesAsync(folderPath, includeSubfolders);
        StartBackgroundMetadataLoad(images);
        return images;
    }

    private void StartBackgroundMetadataLoad(List<Models.ImageFile> images)
    {
        CancellationToken ct;
        long requestId;

        _metadataLock.Wait();
        try
        {
            // Cancel any in-flight load — rapid folder navigation should not produce
            // overlapping metadataUpdated events that overwrite newer results.
            // Vorheriges Laden abbrechen, damit schnelle Navigation keine veralteten Events auslöst.
            _metadataLoadCts?.Cancel();
            _metadataLoadCts?.Dispose();
            _metadataLoadCts = new CancellationTokenSource();
            ct = _metadataLoadCts.Token;
            requestId = ++_metadataLoadId;
        }
        finally
        {
            _metadataLock.Release();
        }

        _ = Task.Run(async () =>
        {
            try
            {
                var paths = images.Select(i => i.Path).ToList();

                var dbMetadata = await _databaseService.GetMetadataForPathsAsync(paths, ct);

                if (dbMetadata.Count > 0 && !ct.IsCancellationRequested)
                {
                    var serializableDbMetadata = dbMetadata.ToDictionary(
                        kvp => kvp.Key,
                        kvp => new
                        {
                            tags = kvp.Value.Tags,
                            rating = kvp.Value.Rating,
                            faceScanned = kvp.Value.FaceScanned,
                            hasDescription = kvp.Value.HasDescription
                        }
                    );
                    _sendEvent("metadataUpdated", new { requestId, metadata = serializableDbMetadata });
                }

                var missingPaths = paths.Where(p => !dbMetadata.ContainsKey(p)).ToList();

                if (missingPaths.Count > 0 && !ct.IsCancellationRequested)
                {
                    var exifMetadata = await _exifToolService.ReadBatchMetadataAsync(missingPaths, ct);

                    foreach (var kvp in exifMetadata)
                    {
                        ct.ThrowIfCancellationRequested();
                        var imageFile = images.FirstOrDefault(i => i.Path == kvp.Key);
                        if (imageFile != null)
                        {
                            imageFile.Tags = kvp.Value.Tags;
                            imageFile.Rating = kvp.Value.Rating;
                            await _databaseService.SaveImageAsync(imageFile, ct);
                        }
                    }

                    if (!ct.IsCancellationRequested)
                    {
                        // Not in DB yet — no face scan or AI description can exist.
                        // Noch nicht in der DB — Gesichtsscan/KI-Beschreibung kann es nicht geben.
                        var serializableExifMetadata = exifMetadata.ToDictionary(
                            kvp => kvp.Key,
                            kvp => new
                            {
                                tags = kvp.Value.Tags,
                                rating = kvp.Value.Rating,
                                faceScanned = false,
                                hasDescription = false
                            }
                        );
                        _sendEvent("metadataUpdated", new { requestId, metadata = serializableExifMetadata });
                    }
                }
            }
            catch (OperationCanceledException)
            {
                _logger.LogDebug("Background metadata load cancelled (requestId {RequestId})", requestId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Background metadata load failed");
                _sendEvent("metadataError", new { error = ex.Message });
            }
        }, ct);
    }
}
