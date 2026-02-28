using System.IO;
using Microsoft.Extensions.Logging;
using Microsoft.Win32;
using TagFusion.Models;

namespace TagFusion.Services;

/// <summary>
/// Service for file system operations (drives, folders, images)
/// </summary>
public class FileSystemService
{
    private readonly string[] _supportedExtensions = { ".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp" };
    private readonly string[] _videoExtensions = { ".mp4", ".mov", ".avi", ".mkv", ".wmv", ".webm" };
    private readonly ExifToolService _exifToolService;
    private readonly ThumbnailService _thumbnailService;
    private readonly ILogger<FileSystemService> _logger;

    public FileSystemService(ExifToolService exifToolService, ThumbnailService thumbnailService, ILogger<FileSystemService> logger)
    {
        _exifToolService = exifToolService;
        _thumbnailService = thumbnailService;
        _logger = logger;
    }

    /// <summary>
    /// Get all available drives
    /// </summary>
    public List<FolderItem> GetDrives()
    {
        var drives = new List<FolderItem>();

        foreach (var drive in DriveInfo.GetDrives())
        {
            try
            {
                if (drive.IsReady)
                {
                    drives.Add(new FolderItem
                    {
                        Path = drive.RootDirectory.FullName,
                        Name = string.IsNullOrEmpty(drive.VolumeLabel)
                            ? $"Lokaler Datenträger ({drive.Name.TrimEnd('\\')})"
                            : $"{drive.VolumeLabel} ({drive.Name.TrimEnd('\\')})",
                        Type = FolderItemType.Drive,
                        HasSubfolders = HasSubfolders(drive.RootDirectory.FullName),
                        TotalSize = drive.TotalSize,
                        FreeSpace = drive.AvailableFreeSpace,
                        DriveFormat = drive.DriveFormat,
                        DriveType = drive.DriveType.ToString()
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Skipping inaccessible drive");
            }
        }

        return drives;
    }

    /// <summary>
    /// Get subfolders for a path
    /// </summary>
    public List<FolderItem> GetFolders(string path)
    {
        var folders = new List<FolderItem>();

        if (string.IsNullOrEmpty(path) || !Directory.Exists(path))
            return folders;

        try
        {
            var directories = Directory.GetDirectories(path);

            foreach (var dir in directories)
            {
                try
                {
                    var dirInfo = new DirectoryInfo(dir);
                    
                    // Skip hidden and system folders
                    if ((dirInfo.Attributes & FileAttributes.Hidden) != 0 ||
                        (dirInfo.Attributes & FileAttributes.System) != 0)
                        continue;

                    folders.Add(new FolderItem
                    {
                        Path = dir,
                        Name = dirInfo.Name,
                        Type = dir.StartsWith(@"\\") ? FolderItemType.NetworkShare : FolderItemType.Folder,
                        HasSubfolders = HasSubfolders(dir)
                    });
                }
                catch (Exception ex)
                {
                    _logger.LogDebug(ex, "Skipping inaccessible folder");
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Access denied reading folders");
        }

        return folders.OrderBy(f => f.Name, StringComparer.OrdinalIgnoreCase).ToList();
    }

    /// <summary>
    /// Get images from a folder (with tags and rating from EXIF).
    /// Runs file I/O on a background thread to avoid blocking the UI.
    /// </summary>
    public Task<List<ImageFile>> GetImagesAsync(string folderPath, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(folderPath) || !Directory.Exists(folderPath))
            return Task.FromResult(new List<ImageFile>());

        return Task.Run(() =>
        {
            var images = new List<ImageFile>();
            try
            {
                var files = Directory.GetFiles(folderPath)
                    .Where(f => _supportedExtensions.Contains(Path.GetExtension(f).ToLowerInvariant()))
                    .ToList();

                foreach (var file in files)
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    try
                    {
                        var fileInfo = new FileInfo(file);
                        images.Add(new ImageFile
                        {
                            Path = file,
                            FileName = fileInfo.Name,
                            Extension = fileInfo.Extension.ToLowerInvariant(),
                            FileSize = fileInfo.Length,
                            DateModified = fileInfo.LastWriteTime,
                            DateCreated = fileInfo.CreationTime,
                            ThumbnailUrl = _thumbnailService.GetThumbnailUrl(file)
                        });
                    }
                    catch (Exception ex)
                    {
                        _logger.LogDebug(ex, "Skipping inaccessible file");
                    }
                }
            }
            catch (OperationCanceledException) { throw; }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Access denied reading images");
            }

            return images.OrderBy(i => i.FileName, StringComparer.OrdinalIgnoreCase).ToList();
        }, cancellationToken);
    }

    /// <summary>
    /// Get folder contents (subfolders with stats and images)
    /// </summary>
    public async Task<List<GridItem>> GetFolderContentsAsync(string folderPath, CancellationToken cancellationToken = default)
    {
        var items = new List<GridItem>();

        if (string.IsNullOrEmpty(folderPath) || !Directory.Exists(folderPath))
            return items;

        // 1. Get Folders
        try
        {
            var directories = Directory.GetDirectories(folderPath);

            foreach (var dir in directories)
            {
                try
                {
                    var dirInfo = new DirectoryInfo(dir);
                    
                    if ((dirInfo.Attributes & FileAttributes.Hidden) != 0 ||
                        (dirInfo.Attributes & FileAttributes.System) != 0)
                        continue;

                    var stats = GetFolderStats(dir);

                    items.Add(new GridItem
                    {
                        Path = dir,
                        Name = dirInfo.Name,
                        IsFolder = true,
                        SubfolderCount = stats.Subfolders,
                        ImageCount = stats.Images,
                        VideoCount = stats.Videos
                    });
                }
                catch (Exception ex)
                {
                    _logger.LogDebug(ex, "Skipping inaccessible folder in content");
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Access denied reading folder content");
        }

        // Sort folders by name
        items.Sort((a, b) => string.Compare(a.Name, b.Name, StringComparison.OrdinalIgnoreCase));

        // 2. Get Images using existing logic
        var images = await GetImagesAsync(folderPath, cancellationToken);
        
        // Add images as GridItems
        foreach (var img in images)
        {
            items.Add(new GridItem
            {
                Path = img.Path,
                Name = img.FileName,
                IsFolder = false,
                ImageData = img
            });
        }

        return items;
    }

    private (int Subfolders, int Images, int Videos) GetFolderStats(string path)
    {
        try
        {
            var subfolders = Directory.GetDirectories(path).Length;
            
            var files = Directory.EnumerateFiles(path); // Enumerate is more efficient than GetFiles for counting
            int images = 0;
            int videos = 0;

            foreach (var file in files)
            {
                var ext = Path.GetExtension(file).ToLowerInvariant();
                if (_supportedExtensions.Contains(ext)) images++;
                else if (_videoExtensions.Contains(ext)) videos++;
            }

            return (subfolders, images, videos);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Failed to get folder stats");
            return (0, 0, 0);
        }
    }

    /// <summary>
    /// Open folder browser dialog
    /// </summary>
    public Task<string?> SelectFolderAsync(CancellationToken cancellationToken = default)
    {
        return Task.Run(() =>
        {
            string? selectedPath = null;
            
            var thread = new System.Threading.Thread(() =>
            {
                var dialog = new OpenFolderDialog
                {
                    Title = "Ordner auswählen",
                    Multiselect = false
                };

                if (dialog.ShowDialog() == true)
                {
                    selectedPath = dialog.FolderName;
                }
            });

            thread.SetApartmentState(System.Threading.ApartmentState.STA);
            thread.Start();
            thread.Join();

            return selectedPath;
        });
    }

    private bool HasSubfolders(string path)
    {
        try
        {
            return Directory.EnumerateDirectories(path).Any();
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "HasSubfolders check failed");
            return false;
        }
    }
}

