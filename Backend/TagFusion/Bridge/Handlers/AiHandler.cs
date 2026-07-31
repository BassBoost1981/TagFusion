using System.IO;
using Microsoft.Extensions.Logging;
using TagFusion.Database;
using TagFusion.Services;

namespace TagFusion.Bridge.Handlers;

/// <summary>
/// Handles AI description actions: server status, precheck, scan start/cancel.
/// Verarbeitet KI-Beschreibungs-Actions: Serverstatus, Precheck, Scan.
/// </summary>
public class AiHandler : IBridgeHandler
{
    private readonly DescriptionScanService _scanService;
    private readonly IAiCaptionClient _client;
    private readonly IExifToolService _exifToolService;
    private readonly IFileSystemService _fileSystemService;
    private readonly IDatabaseService _databaseService;
    private readonly IAiServerProcessService _serverProcess;
    private readonly ILogger<AiHandler> _logger;

    private static readonly HashSet<string> _supported = new(StringComparer.Ordinal)
    {
        "getAiServerStatus", "getDescriptionPrecheck", "startDescriptionScan", "cancelDescriptionScan",
        "startAiServer", "stopAiServer", "getImageDescription"
    };

    public IReadOnlySet<string> SupportedActions => _supported;

    public AiHandler(
        DescriptionScanService scanService,
        IAiCaptionClient client,
        IExifToolService exifToolService,
        IFileSystemService fileSystemService,
        IDatabaseService databaseService,
        IAiServerProcessService serverProcess,
        ILogger<AiHandler> logger)
    {
        _scanService = scanService;
        _client = client;
        _exifToolService = exifToolService;
        _fileSystemService = fileSystemService;
        _databaseService = databaseService;
        _serverProcess = serverProcess;
        _logger = logger;
    }

    public async Task<object?> HandleAsync(string action, Dictionary<string, object>? payload)
    {
        return action switch
        {
            "getAiServerStatus" => await GetAiServerStatusAsync(),
            "getDescriptionPrecheck" => await GetDescriptionPrecheckAsync(payload),
            "startDescriptionScan" => await StartDescriptionScanAsync(payload),
            "cancelDescriptionScan" => CancelScan(),
            "startAiServer" => StartAiServer(),
            "stopAiServer" => StopAiServer(),
            "getImageDescription" => await GetImageDescriptionAsync(payload),
            _ => throw new NotSupportedException($"Unknown action: {action}")
        };
    }

    private async Task<object> GetAiServerStatusAsync()
    {
        var status = await _client.GetStatusAsync();
        var models = status.Reachable ? await _client.GetCaptionModelsAsync() : new List<string>();
        return new
        {
            reachable = status.Reachable,
            state = status.State,
            model = status.Model,
            progress = status.Progress,
            message = status.Message,
            models,
            managedByApp = _serverProcess.IsManagedByApp,
            lastStartError = _serverProcess.LastStartError,
        };
    }

    private async Task<object> GetDescriptionPrecheckAsync(Dictionary<string, object>? payload)
    {
        var path = PayloadHelper.GetString(payload ?? new(), "path");
        var includeSubfolders = PayloadHelper.GetBool(payload?.GetValueOrDefault("includeSubfolders"));
        var images = await _fileSystemService.GetImagesAsync(path, includeSubfolders);
        var paths = images.Select(i => i.Path).ToList();
        var existing = await _exifToolService.ReadDescriptionsBatchAsync(paths);
        return new { total = paths.Count, withDescription = existing.Count };
    }

    // Returns the stored AI description or null when there is none.
    // Liefert die gespeicherte KI-Beschreibung oder null, wenn keine existiert.
    private async Task<object?> GetImageDescriptionAsync(Dictionary<string, object>? payload)
    {
        var path = PayloadHelper.GetString(payload ?? new(), "path");
        return await _databaseService.GetImageDescriptionAsync(path);
    }

    private async Task<object> StartDescriptionScanAsync(Dictionary<string, object>? payload)
    {
        var p = payload ?? new();
        var path = PayloadHelper.GetString(p, "path");
        var model = PayloadHelper.GetString(p, "model");
        var prompt = PayloadHelper.GetString(p, "prompt");
        var overwrite = PayloadHelper.GetBool(p.GetValueOrDefault("overwriteExisting"), false);
        var includeSubfolders = PayloadHelper.GetBool(p.GetValueOrDefault("includeSubfolders"));

        var status = await _client.GetStatusAsync();
        if (!status.Reachable)
            throw new BridgeException(
                "KI-Server nicht erreichbar — bitte AiApiServer starten.",
                internalMessage: "AiApiServer unreachable");

        if (string.IsNullOrWhiteSpace(path) || !Directory.Exists(path))
            throw new BridgeException("Ordner nicht gefunden.", internalMessage: $"Folder not found: {path}");
        if (string.IsNullOrWhiteSpace(model) || string.IsNullOrWhiteSpace(prompt))
            throw new BridgeException("Modell oder Prompt fehlt.", internalMessage: "startDescriptionScan: empty model/prompt");

        if (!_scanService.StartScan(path, model, prompt, overwrite, includeSubfolders))
            throw new BridgeException("Eine Beschreibung läuft bereits.", internalMessage: "Description scan already running");

        return true;
    }

    private object CancelScan()
    {
        _scanService.Cancel();
        return true;
    }

    private object StartAiServer()
    {
        _serverProcess.StartServer();
        return true;
    }

    private object StopAiServer()
    {
        _serverProcess.StopServer();
        return true;
    }
}
