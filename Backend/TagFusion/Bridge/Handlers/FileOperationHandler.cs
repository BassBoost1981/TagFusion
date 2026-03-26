using TagFusion.Services;

namespace TagFusion.Bridge.Handlers;

/// <summary>
/// Handles file operation actions: copyFiles, moveFiles, deleteFiles,
/// renameFile, openInExplorer, getProperties.
/// </summary>
public class FileOperationHandler : IBridgeHandler
{
    private readonly IFileOperationService _fileOperationService;

    private static readonly HashSet<string> _supported = new(StringComparer.Ordinal)
    {
        "copyFiles", "moveFiles", "deleteFiles", "renameFile", "openInExplorer", "getProperties"
    };

    public IReadOnlySet<string> SupportedActions => _supported;

    public FileOperationHandler(IFileOperationService fileOperationService)
    {
        _fileOperationService = fileOperationService;
    }

    public async Task<object?> HandleAsync(string action, Dictionary<string, object>? payload)
    {
        return action switch
        {
            "copyFiles" => await CopyFilesAsync(payload),
            "moveFiles" => await MoveFilesAsync(payload),
            "deleteFiles" => await DeleteFilesAsync(payload),
            "renameFile" => RenameFile(payload),
            "openInExplorer" => OpenInExplorer(payload),
            "getProperties" => GetProperties(payload),
            _ => throw new NotSupportedException($"Unknown action: {action}")
        };
    }

    private async Task<bool> CopyFilesAsync(Dictionary<string, object>? payload)
    {
        var paths = PayloadHelper.GetStringArray(payload, "paths");
        var targetFolder = PayloadHelper.GetString(payload, "targetFolder");
        return await _fileOperationService.CopyFilesAsync(paths, targetFolder);
    }

    private async Task<bool> MoveFilesAsync(Dictionary<string, object>? payload)
    {
        var paths = PayloadHelper.GetStringArray(payload, "paths");
        var targetFolder = PayloadHelper.GetString(payload, "targetFolder");
        return await _fileOperationService.MoveFilesAsync(paths, targetFolder);
    }

    private async Task<bool> DeleteFilesAsync(Dictionary<string, object>? payload)
    {
        var paths = PayloadHelper.GetStringArray(payload, "paths");
        return await _fileOperationService.DeleteFilesAsync(paths);
    }

    private object RenameFile(Dictionary<string, object>? payload)
    {
        var path = PayloadHelper.GetString(payload, "path");
        var newName = PayloadHelper.GetString(payload, "newName");
        return _fileOperationService.RenameFile(path, newName);
    }

    private object OpenInExplorer(Dictionary<string, object>? payload)
    {
        var path = PayloadHelper.GetString(payload, "path");
        _fileOperationService.OpenInExplorer(path);
        return true;
    }

    private object GetProperties(Dictionary<string, object>? payload)
    {
        var path = PayloadHelper.GetString(payload, "path");
        return _fileOperationService.GetProperties(path);
    }
}
