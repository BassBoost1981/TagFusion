using TagFusion.Services;

namespace TagFusion.Bridge.Handlers;

/// <summary>
/// Handles utility actions: healthCheck, watchFolder, stopWatching,
/// exportTagsJson/Csv, importTagsJson/Csv, findDuplicates.
/// </summary>
public class UtilityHandler : IBridgeHandler
{
    private readonly DiagnosticsService _diagnosticsService;
    private readonly FolderWatcherService _folderWatcherService;
    private readonly TagExportService _tagExportService;
    private readonly DuplicateDetectionService _duplicateDetectionService;

    private static readonly HashSet<string> _supported = new(StringComparer.Ordinal)
    {
        "healthCheck", "watchFolder", "stopWatching",
        "exportTagsJson", "exportTagsCsv", "exportTagsXmp", "importTagsJson", "importTagsCsv",
        "findDuplicates"
    };

    public IReadOnlySet<string> SupportedActions => _supported;

    public UtilityHandler(
        DiagnosticsService diagnosticsService,
        FolderWatcherService folderWatcherService,
        TagExportService tagExportService,
        DuplicateDetectionService duplicateDetectionService)
    {
        _diagnosticsService = diagnosticsService;
        _folderWatcherService = folderWatcherService;
        _tagExportService = tagExportService;
        _duplicateDetectionService = duplicateDetectionService;
    }

    public async Task<object?> HandleAsync(string action, Dictionary<string, object>? payload)
    {
        return action switch
        {
            "healthCheck" => await _diagnosticsService.CheckHealthAsync(),
            "watchFolder" => WatchFolder(payload),
            "stopWatching" => StopWatching(),
            "exportTagsJson" => await _tagExportService.ExportTagsAsJsonAsync(PayloadHelper.GetStringArray(payload, "paths")),
            "exportTagsCsv" => await _tagExportService.ExportTagsAsCsvAsync(PayloadHelper.GetStringArray(payload, "paths")),
            "exportTagsXmp" => await _tagExportService.ExportTagsAsXmpSidecarsAsync(PayloadHelper.GetStringArray(payload, "paths")),
            "importTagsJson" => await _tagExportService.ImportTagsFromJsonAsync(PayloadHelper.GetString(payload, "data")),
            "importTagsCsv" => await _tagExportService.ImportTagsFromCsvAsync(PayloadHelper.GetString(payload, "data")),
            "findDuplicates" => await FindDuplicatesAsync(payload),
            _ => throw new NotSupportedException($"Unknown action: {action}")
        };
    }

    private object WatchFolder(Dictionary<string, object>? payload)
    {
        var path = PayloadHelper.GetString(payload, "path");
        _folderWatcherService.Watch(path);
        return true;
    }

    private object StopWatching()
    {
        _folderWatcherService.StopWatching();
        return true;
    }

    private async Task<List<DuplicateGroup>> FindDuplicatesAsync(Dictionary<string, object>? payload)
    {
        var path = PayloadHelper.GetString(payload, "path");
        var includeSubfoldersObj = payload?.GetValueOrDefault("includeSubfolders");
        bool includeSubfolders = PayloadHelper.GetBool(includeSubfoldersObj);
        return await _duplicateDetectionService.FindDuplicatesAsync(path, includeSubfolders);
    }
}
