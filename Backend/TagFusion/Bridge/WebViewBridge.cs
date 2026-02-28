using System.Windows;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Web.WebView2.Core;
using TagFusion.Database;
using TagFusion.Models;
using TagFusion.Services;

namespace TagFusion.Bridge;

/// <summary>
/// Handles communication between C# backend and React frontend
/// </summary>
public class WebViewBridge
{
    private readonly CoreWebView2 _webView;
    private readonly ExifToolService _exifToolService;
    private readonly FileSystemService _fileSystemService;
    private readonly TagService _tagService;
    private readonly IDatabaseService _databaseService;
    private readonly ImageEditService _imageEditService;
    private readonly FileOperationService _fileOperationService;
    private readonly DiagnosticsService _diagnosticsService;
    private readonly FolderWatcherService _folderWatcherService;
    private readonly TagExportService _tagExportService;
    private readonly DuplicateDetectionService _duplicateDetectionService;
    private readonly ILogger<WebViewBridge> _logger;
    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        PropertyNameCaseInsensitive = true
    };

    public WebViewBridge(
        CoreWebView2 webView,
        ExifToolService exifToolService,
        FileSystemService fileSystemService,
        TagService tagService,
        IDatabaseService databaseService,
        ImageEditService imageEditService,
        FileOperationService fileOperationService,
        DiagnosticsService diagnosticsService,
        FolderWatcherService folderWatcherService,
        TagExportService tagExportService,
        DuplicateDetectionService duplicateDetectionService,
        ILogger<WebViewBridge> logger)
    {
        _webView = webView;
        _exifToolService = exifToolService;
        _fileSystemService = fileSystemService;
        _tagService = tagService;
        _databaseService = databaseService;
        _imageEditService = imageEditService;
        _fileOperationService = fileOperationService;
        _diagnosticsService = diagnosticsService;
        _folderWatcherService = folderWatcherService;
        _tagExportService = tagExportService;
        _duplicateDetectionService = duplicateDetectionService;
        _logger = logger;

        _webView.WebMessageReceived += OnWebMessageReceived;

        // FileSystemWatcher: push changes to frontend
        _folderWatcherService.FilesChanged += (changedPaths) =>
        {
            SendEvent("folderChanged", new { paths = changedPaths });
        };

        _logger.LogInformation("WebViewBridge initialized");
    }

    private void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        // Delegate to async Task method and catch unobserved exceptions
        // to prevent process crash from unhandled task exceptions.
        _ = HandleWebMessageAsync(e).ContinueWith(
            t => _logger.LogError(t.Exception, "Unbehandelte Exception in HandleWebMessageAsync"),
            TaskContinuationOptions.OnlyOnFaulted);
    }

    private async Task HandleWebMessageAsync(CoreWebView2WebMessageReceivedEventArgs e)
    {
        try
        {
            // Use TryGetWebMessageAsString instead of WebMessageAsJson to avoid double-parsing
            var json = e.TryGetWebMessageAsString();
            _logger.LogDebug("Received: {Message}", json);

            var message = JsonSerializer.Deserialize<BridgeMessage>(json, _jsonOptions);

            if (message == null)
            {
                _logger.LogError("Invalid message format");
                SendError(null, "Invalid message format");
                return;
            }

            _logger.LogDebug("Processing action: {Action}", message.Action);
            await ProcessMessageAsync(message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error handling web message");
            SendError(null, ex.Message);
        }
    }

    private async Task ProcessMessageAsync(BridgeMessage message)
    {
        try
        {
            object? result = message.Action switch
            {
                // File System actions
                "getDrives" => _fileSystemService.GetDrives(),
                "getFolders" => _fileSystemService.GetFolders(GetPayloadString(message.Payload, "path")),
                "getImages" => await HandleGetImagesAsync(message.Payload),
                "getFolderContents" => await HandleGetFolderContentsAsync(message.Payload),
                "selectFolder" => await _fileSystemService.SelectFolderAsync(),

                // ExifTool actions
                "readTags" => await _exifToolService.ReadTagsAsync(GetPayloadString(message.Payload, "imagePath")),
                "writeTags" => await WriteTagsAsync(message.Payload),
                "getThumbnail" => await _exifToolService.GetThumbnailAsync(GetPayloadString(message.Payload, "imagePath")),
                "getFullImage" => await GetFullImageAsync(message.Payload),
                "getThumbnailsBatch" => await GetThumbnailsBatchAsync(message.Payload),

                // Rating actions
                "getRating" => await _exifToolService.ReadRatingAsync(GetPayloadString(message.Payload, "imagePath")),
                "setRating" => await SetRatingAsync(message.Payload),

                // Tag actions
                "getAllTags" => await _tagService.GetAllTagsAsync(),
                "getTagLibrary" => await _tagService.GetTagLibraryAsync(),
                "saveTagLibrary" => await _tagService.SaveTagLibraryAsync(message.Payload?["library"] ?? new object()),

                // Image Edit actions
                "rotateImages" => await RotateImagesAsync(message.Payload),
                "flipImages" => await FlipImagesAsync(message.Payload),

                // File Operation actions
                "copyFiles" => await CopyFilesHandlerAsync(message.Payload),
                "moveFiles" => await MoveFilesHandlerAsync(message.Payload),
                "deleteFiles" => await DeleteFilesHandlerAsync(message.Payload),
                "renameFile" => RenameFileHandler(message.Payload),
                "openInExplorer" => OpenInExplorerHandler(message.Payload),
                "getProperties" => GetPropertiesHandler(message.Payload),

                // Diagnostics
                "healthCheck" => await _diagnosticsService.CheckHealthAsync(),

                // Search / Filter
                "searchImages" => await SearchImagesAsync(message.Payload),

                // Batch tag operations
                "writeBatchTags" => await WriteBatchTagsAsync(message.Payload),

                // Folder watcher
                "watchFolder" => WatchFolder(message.Payload),
                "stopWatching" => StopWatching(),

                // Tag import/export
                "exportTagsJson" => await ExportTagsJsonAsync(message.Payload),
                "exportTagsCsv" => await ExportTagsCsvAsync(message.Payload),
                "importTagsJson" => await ImportTagsJsonAsync(message.Payload),
                "importTagsCsv" => await ImportTagsCsvAsync(message.Payload),

                // Duplicate detection
                "findDuplicates" => await FindDuplicatesAsync(message.Payload),

                _ => throw new NotSupportedException($"Unknown action: {message.Action}")
            };

            SendResponse(message.Id, true, result);
        }
        catch (Exception ex)
        {
            SendError(message.Id, ex.Message);
        }
    }

    private async Task<List<GridItem>> HandleGetFolderContentsAsync(Dictionary<string, object>? payload)
    {
        var folderPath = GetPayloadString(payload, "folderPath");
        var items = await _fileSystemService.GetFolderContentsAsync(folderPath);

        // Extract images for metadata loading
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

    private async Task<List<TagFusion.Models.ImageFile>> HandleGetImagesAsync(Dictionary<string, object>? payload)
    {
        var folderPath = GetPayloadString(payload, "folderPath");
        var images = await _fileSystemService.GetImagesAsync(folderPath);

        // Start background metadata loading
        StartBackgroundMetadataLoad(images);

        return images;
    }

    private void StartBackgroundMetadataLoad(List<TagFusion.Models.ImageFile> images)
    {
        _ = Task.Run(async () =>
        {
            try
            {
                var paths = images.Select(i => i.Path).ToList();
                
                // 1. Try to load from Database first
                var dbMetadata = await _databaseService.GetMetadataForPathsAsync(paths);
                
                if (dbMetadata.Count > 0)
                {
                    var serializableDbMetadata = dbMetadata.ToDictionary(
                        kvp => kvp.Key,
                        kvp => new { tags = kvp.Value.Tags, rating = kvp.Value.Rating }
                    );
                    SendEvent("metadataUpdated", serializableDbMetadata);
                }

                // 2. Identify missing or outdated files
                // For simplicity, we'll just check which paths were NOT in the DB.
                // A better approach would be to check LastModified timestamp.
                var missingPaths = paths.Where(p => !dbMetadata.ContainsKey(p)).ToList();

                if (missingPaths.Count > 0)
                {
                    // 3. Load missing from ExifTool
                    var exifMetadata = await _exifToolService.ReadBatchMetadataAsync(missingPaths);
                    
                    // 4. Update Database
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

                    // 5. Send updates for newly loaded
                    var serializableExifMetadata = exifMetadata.ToDictionary(
                        kvp => kvp.Key,
                        kvp => new { tags = kvp.Value.Tags, rating = kvp.Value.Rating }
                    );
                    SendEvent("metadataUpdated", serializableExifMetadata);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Background metadata load failed");
            }
        });
    }

    private async Task<bool> WriteTagsAsync(Dictionary<string, object>? payload)
    {
        if (payload == null) throw new ArgumentNullException(nameof(payload));

        var imagePath = GetPayloadString(payload, "imagePath");
        var tagsObj = payload.GetValueOrDefault("tags");

        List<string> tags = ExtractStringArray(tagsObj)
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .Select(t => t.Trim())
            .GroupBy(t => t, StringComparer.OrdinalIgnoreCase)
            .Select(g => g.First())
            .ToList();

        _logger.LogDebug("WriteTagsAsync: path={ImagePath}, tags=[{Tags}]", imagePath, string.Join(", ", tags));

        var success = await _exifToolService.WriteTagsAsync(imagePath, tags);
        if (success)
        {
            // Update DB with the tags we just wrote - don't re-read from file
            // as it may have timing issues or return stale data
            var fileInfo = new System.IO.FileInfo(imagePath);
            var image = new TagFusion.Models.ImageFile
            {
                Path = imagePath,
                FileName = fileInfo.Name,
                Extension = fileInfo.Extension.ToLowerInvariant(),
                FileSize = fileInfo.Length,
                DateModified = fileInfo.LastWriteTime,
                Tags = tags,  // Use the tags we just wrote
                Rating = await _exifToolService.ReadRatingAsync(imagePath)
            };
            await _databaseService.SaveImageAsync(image);
            _logger.LogDebug("WriteTagsAsync: DB updated with {TagCount} tags", tags.Count);
        }
        return success;
    }

    private async Task<bool> SetRatingAsync(Dictionary<string, object>? payload)
    {
        if (payload == null) throw new ArgumentNullException(nameof(payload));

        var imagePath = GetPayloadString(payload, "imagePath");
        var ratingObj = payload.GetValueOrDefault("rating");

        int rating = ExtractInt(ratingObj);

        var success = await _exifToolService.WriteRatingAsync(imagePath, rating);
        if (success)
        {
            // Update DB
            var image = await _exifToolService.GetImageMetadataAsync(imagePath);
            await _databaseService.SaveImageAsync(image);
        }
        return success;
    }

    private async Task<Dictionary<string, string?>> GetThumbnailsBatchAsync(Dictionary<string, object>? payload)
    {
        if (payload == null) return new Dictionary<string, string?>();

        var pathsObj = payload.GetValueOrDefault("imagePaths");
        string[] imagePaths = ExtractStringArray(pathsObj).ToArray();

        return await _exifToolService.GetThumbnailsBatchAsync(imagePaths);
    }

    private async Task<string?> GetFullImageAsync(Dictionary<string, object>? payload)
    {
        if (payload == null) return null;

        var imagePath = GetPayloadString(payload, "imagePath");
        var maxSizeObj = payload.GetValueOrDefault("maxSize");

        int maxSize = ExtractInt(maxSizeObj, 1920);

        return await _exifToolService.GetFullImageAsync(imagePath, maxSize);
    }

    private async Task<Dictionary<string, bool>> RotateImagesAsync(Dictionary<string, object>? payload)
    {
        if (payload == null) return new Dictionary<string, bool>();

        var paths = GetPayloadStringArray(payload, "paths");
        var angleObj = payload.GetValueOrDefault("angle");

        int angle = ExtractInt(angleObj, 90);

        return await _imageEditService.RotateImagesAsync(paths, angle);
    }

    private async Task<Dictionary<string, bool>> FlipImagesAsync(Dictionary<string, object>? payload)
    {
        if (payload == null) return new Dictionary<string, bool>();

        var paths = GetPayloadStringArray(payload, "paths");
        var horizontalObj = payload.GetValueOrDefault("horizontal");

        bool horizontal = true;
        if (horizontalObj is bool b) horizontal = b;
        else if (horizontalObj is JsonElement je && je.ValueKind == JsonValueKind.True) horizontal = true;
        else if (horizontalObj is JsonElement je2 && je2.ValueKind == JsonValueKind.False) horizontal = false;
        else if (bool.TryParse(horizontalObj?.ToString(), out var parsed)) horizontal = parsed;

        return await _imageEditService.FlipImagesAsync(paths, horizontal);
    }

    internal static List<string> ExtractStringArray(object? obj)
    {
        if (obj == null) return new List<string>();

        if (obj is JsonElement jsonElement && jsonElement.ValueKind == JsonValueKind.Array)
        {
            return jsonElement.EnumerateArray()
                .Select(e => e.GetString() ?? "")
                .Where(s => !string.IsNullOrEmpty(s))
                .ToList();
        }
        if (obj is IEnumerable<object> enumerable)
        {
            return enumerable.Select(o => o?.ToString() ?? "").Where(s => !string.IsNullOrEmpty(s)).ToList();
        }

        return new List<string>();
    }

    internal static int ExtractInt(object? obj, int defaultValue = 0)
    {
        if (obj == null) return defaultValue;
        if (obj is long l) return (int)l;
        if (obj is int i) return i;
        if (obj is double d) return (int)d;
        if (obj is JsonElement je && je.ValueKind == JsonValueKind.Number) return je.GetInt32();
        if (int.TryParse(obj?.ToString(), out var parsed)) return parsed;
        return defaultValue;
    }

    private static string[] GetPayloadStringArray(Dictionary<string, object>? payload, string key)
    {
        if (payload == null) return Array.Empty<string>();

        var obj = payload.GetValueOrDefault(key);
        return ExtractStringArray(obj).ToArray();
    }

    internal static string GetPayloadString(Dictionary<string, object>? payload, string key)
    {
        if (payload == null) return string.Empty;
        if (payload.TryGetValue(key, out var value))
        {
            if (value is JsonElement je && je.ValueKind == JsonValueKind.String)
                return je.GetString() ?? string.Empty;
            return value?.ToString() ?? string.Empty;
        }
        return string.Empty;
    }

    private void SendResponse(string? id, bool success, object? data)
    {
        var response = new BridgeResponse
        {
            Id = id,
            Success = success,
            Data = data
        };
        SendToFrontend(response);
    }

    private void SendError(string? id, string error)
    {
        var response = new BridgeResponse
        {
            Id = id,
            Success = false,
            Error = error
        };
        SendToFrontend(response);
    }

    public void SendEvent(string eventName, object? data)
    {
        var evt = new BridgeEvent
        {
            Event = eventName,
            Data = data
        };
        SendToFrontend(evt);
    }

    private void SendToFrontend(object message)
    {
        var json = JsonSerializer.Serialize(message, _jsonOptions);
        _logger.LogDebug("Sending: {Message}", json[..Math.Min(200, json.Length)]);

        // Ensure we're on the UI thread
        Application.Current.Dispatcher.Invoke(() =>
        {
            _webView.PostWebMessageAsJson(json);
        });
    }

    #region Search & Batch Handlers

    private async Task<List<ImageFile>> SearchImagesAsync(Dictionary<string, object>? payload)
    {
        List<string>? tags = null;
        int? minRating = null;
        int limit = 200;

        if (payload != null)
        {
            var tagsObj = payload.GetValueOrDefault("tags");
            var extracted = ExtractStringArray(tagsObj);
            if (extracted.Count > 0) tags = extracted;

            var ratingObj = payload.GetValueOrDefault("minRating");
            var rating = ExtractInt(ratingObj, 0);
            if (rating > 0) minRating = rating;

            var limitObj = payload.GetValueOrDefault("limit");
            var parsedLimit = ExtractInt(limitObj, 200);
            if (parsedLimit > 0) limit = parsedLimit;
        }

        return await _databaseService.SearchImagesAsync(tags, minRating, limit);
    }

    private async Task<Dictionary<string, bool>> WriteBatchTagsAsync(Dictionary<string, object>? payload)
    {
        if (payload == null) return new Dictionary<string, bool>();

        var paths = GetPayloadStringArray(payload, "paths");
        var tagsObj = payload.GetValueOrDefault("tags");
        var tags = ExtractStringArray(tagsObj)
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .Select(t => t.Trim())
            .GroupBy(t => t, StringComparer.OrdinalIgnoreCase)
            .Select(g => g.First())
            .ToList();

        var results = new Dictionary<string, bool>();

        foreach (var path in paths)
        {
            try
            {
                var success = await _exifToolService.WriteTagsAsync(path, tags);
                results[path] = success;

                if (success)
                {
                    var fileInfo = new System.IO.FileInfo(path);
                    var image = new ImageFile
                    {
                        Path = path,
                        FileName = fileInfo.Name,
                        Extension = fileInfo.Extension.ToLowerInvariant(),
                        FileSize = fileInfo.Length,
                        DateModified = fileInfo.LastWriteTime,
                        Tags = tags,
                        Rating = await _exifToolService.ReadRatingAsync(path)
                    };
                    await _databaseService.SaveImageAsync(image);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "WriteBatchTags failed for {Path}", path);
                results[path] = false;
            }
        }

        return results;
    }

    #endregion

    #region Folder Watcher Handlers

    private object WatchFolder(Dictionary<string, object>? payload)
    {
        var path = GetPayloadString(payload, "path");
        _folderWatcherService.Watch(path);
        return true;
    }

    private object StopWatching()
    {
        _folderWatcherService.StopWatching();
        return true;
    }

    #endregion

    #region Tag Import/Export Handlers

    private async Task<string> ExportTagsJsonAsync(Dictionary<string, object>? payload)
    {
        var paths = GetPayloadStringArray(payload, "paths");
        return await _tagExportService.ExportTagsAsJsonAsync(paths);
    }

    private async Task<string> ExportTagsCsvAsync(Dictionary<string, object>? payload)
    {
        var paths = GetPayloadStringArray(payload, "paths");
        return await _tagExportService.ExportTagsAsCsvAsync(paths);
    }

    private async Task<Dictionary<string, bool>> ImportTagsJsonAsync(Dictionary<string, object>? payload)
    {
        var json = GetPayloadString(payload, "data");
        return await _tagExportService.ImportTagsFromJsonAsync(json);
    }

    private async Task<Dictionary<string, bool>> ImportTagsCsvAsync(Dictionary<string, object>? payload)
    {
        var csv = GetPayloadString(payload, "data");
        return await _tagExportService.ImportTagsFromCsvAsync(csv);
    }

    #endregion

    #region Duplicate Detection Handlers

    private async Task<List<DuplicateGroup>> FindDuplicatesAsync(Dictionary<string, object>? payload)
    {
        var path = GetPayloadString(payload, "path");
        var includeSubfoldersObj = payload?.GetValueOrDefault("includeSubfolders");
        bool includeSubfolders = false;
        if (includeSubfoldersObj is bool b) includeSubfolders = b;
        else if (includeSubfoldersObj is System.Text.Json.JsonElement je)
        {
            if (je.ValueKind == System.Text.Json.JsonValueKind.True) includeSubfolders = true;
        }

        return await _duplicateDetectionService.FindDuplicatesAsync(path, includeSubfolders);
    }

    #endregion

    #region File Operation Handlers

    private async Task<bool> CopyFilesHandlerAsync(Dictionary<string, object>? payload)
    {
        var paths = GetPayloadStringArray(payload, "paths");
        var targetFolder = GetPayloadString(payload, "targetFolder");
        return await _fileOperationService.CopyFilesAsync(paths, targetFolder);
    }

    private async Task<bool> MoveFilesHandlerAsync(Dictionary<string, object>? payload)
    {
        var paths = GetPayloadStringArray(payload, "paths");
        var targetFolder = GetPayloadString(payload, "targetFolder");
        return await _fileOperationService.MoveFilesAsync(paths, targetFolder);
    }

    private async Task<bool> DeleteFilesHandlerAsync(Dictionary<string, object>? payload)
    {
        var paths = GetPayloadStringArray(payload, "paths");
        return await _fileOperationService.DeleteFilesAsync(paths);
    }

    private bool RenameFileHandler(Dictionary<string, object>? payload)
    {
        var path = GetPayloadString(payload, "path");
        var newName = GetPayloadString(payload, "newName");
        return _fileOperationService.RenameFile(path, newName);
    }

    private object? OpenInExplorerHandler(Dictionary<string, object>? payload)
    {
        var path = GetPayloadString(payload, "path");
        _fileOperationService.OpenInExplorer(path);
        return true;
    }

    private object GetPropertiesHandler(Dictionary<string, object>? payload)
    {
        var path = GetPayloadString(payload, "path");
        return _fileOperationService.GetProperties(path);
    }

    #endregion
}
