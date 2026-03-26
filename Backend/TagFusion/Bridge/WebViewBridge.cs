using System.Windows;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Web.WebView2.Core;
using TagFusion.Bridge.Handlers;
using TagFusion.Database;
using TagFusion.Services;

namespace TagFusion.Bridge;

/// <summary>
/// Handles communication between C# backend and React frontend.
/// Routes incoming messages to the appropriate handler.
/// </summary>
public class WebViewBridge
{
    private readonly CoreWebView2 _webView;
    private readonly ILogger<WebViewBridge> _logger;
    private readonly Dictionary<string, IBridgeHandler> _actionMap = new(StringComparer.Ordinal);

    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        PropertyNameCaseInsensitive = true
    };

    public WebViewBridge(
        CoreWebView2 webView,
        IExifToolService exifToolService,
        IFileSystemService fileSystemService,
        ITagService tagService,
        IDatabaseService databaseService,
        IImageEditService imageEditService,
        IFileOperationService fileOperationService,
        DiagnosticsService diagnosticsService,
        FolderWatcherService folderWatcherService,
        TagExportService tagExportService,
        DuplicateDetectionService duplicateDetectionService,
        ILoggerFactory loggerFactory)
    {
        _webView = webView;
        _logger = loggerFactory.CreateLogger<WebViewBridge>();

        // Create handlers
        var handlers = new IBridgeHandler[]
        {
            new FileSystemHandler(
                fileSystemService, exifToolService, databaseService,
                loggerFactory.CreateLogger<FileSystemHandler>(), SendEvent),
            new ExifToolHandler(
                exifToolService, databaseService,
                loggerFactory.CreateLogger<ExifToolHandler>()),
            new TagHandler(
                tagService, exifToolService, databaseService,
                loggerFactory.CreateLogger<TagHandler>(), SendEvent),
            new ImageEditHandler(imageEditService),
            new FileOperationHandler(fileOperationService),
            new UtilityHandler(
                diagnosticsService, folderWatcherService,
                tagExportService, duplicateDetectionService),
        };

        // Build action → handler lookup
        foreach (var handler in handlers)
        {
            foreach (var action in handler.SupportedActions)
            {
                _actionMap[action] = handler;
            }
        }

        _webView.WebMessageReceived += OnWebMessageReceived;

        // FileSystemWatcher: push changes to frontend
        folderWatcherService.FilesChanged += (changedPaths) =>
        {
            SendEvent("folderChanged", new { paths = changedPaths });
        };

        _logger.LogInformation("WebViewBridge initialized with {HandlerCount} handlers, {ActionCount} actions",
            handlers.Length, _actionMap.Count);
    }

    private void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        _ = HandleWebMessageAsync(e).ContinueWith(
            t => _logger.LogError(t.Exception, "Unbehandelte Exception in HandleWebMessageAsync"),
            TaskContinuationOptions.OnlyOnFaulted);
    }

    private async Task HandleWebMessageAsync(CoreWebView2WebMessageReceivedEventArgs e)
    {
        try
        {
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
            if (!_actionMap.TryGetValue(message.Action, out var handler))
            {
                throw new NotSupportedException($"Unknown action: {message.Action}");
            }

            var result = await handler.HandleAsync(message.Action, message.Payload);
            SendResponse(message.Id, true, result);
        }
        catch (Exception ex)
        {
            SendError(message.Id, ex.Message);
        }
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

        Application.Current.Dispatcher.Invoke(() =>
        {
            _webView.PostWebMessageAsJson(json);
        });
    }

    // Keep static helpers public for backward compatibility with tests
    internal static List<string> ExtractStringArray(object? obj) => PayloadHelper.ExtractStringList(obj);
    internal static int ExtractInt(object? obj, int defaultValue = 0) => PayloadHelper.GetInt(obj, defaultValue);
    internal static string GetPayloadString(Dictionary<string, object>? payload, string key) => PayloadHelper.GetString(payload, key);
}
