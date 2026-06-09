using TagFusion.Models;

namespace TagFusion.Services;

/// <summary>
/// Interface for file system navigation and image discovery.
/// </summary>
public interface IFileSystemService
{
    List<FolderItem> GetDrives();
    List<FolderItem> GetFolders(string path);
    Task<List<ImageFile>> GetImagesAsync(string folderPath, CancellationToken cancellationToken = default);
    Task<List<GridItem>> GetFolderContentsAsync(string folderPath, CancellationToken cancellationToken = default);
    Task<string?> SelectFolderAsync(CancellationToken cancellationToken = default);
}
