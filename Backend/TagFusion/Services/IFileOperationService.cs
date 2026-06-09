namespace TagFusion.Services;

/// <summary>
/// Interface for file copy, move, delete, rename operations.
/// </summary>
public interface IFileOperationService
{
    Task<bool> CopyFilesAsync(string[] sourcePaths, string targetFolder, CancellationToken cancellationToken = default);
    Task<bool> MoveFilesAsync(string[] sourcePaths, string targetFolder, CancellationToken cancellationToken = default);
    Task<bool> DeleteFilesAsync(string[] paths, CancellationToken cancellationToken = default);
    bool RenameFile(string path, string newName);
    void OpenInExplorer(string path);
    object GetProperties(string path);
}
