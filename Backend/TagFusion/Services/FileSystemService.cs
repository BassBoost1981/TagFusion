using System.Collections.Concurrent;
using System.IO;
using Microsoft.Extensions.Logging;
using Microsoft.Win32;
using TagFusion.Models;

namespace TagFusion.Services;

/// <summary>
/// Service for file system operations (drives, folders, images)
/// </summary>
public class FileSystemService : IFileSystemService
{
    private const int FolderStatsMaxParallelismCap = 8;
    // HashSet for O(1) extension lookups instead of O(n) array search
    // HashSet für O(1)-Erweiterungssuche statt O(n)-Array-Durchlauf
    private readonly HashSet<string> _supportedExtensions = new(StringComparer.OrdinalIgnoreCase)
        { ".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp" };
    private readonly HashSet<string> _videoExtensions = new(StringComparer.OrdinalIgnoreCase)
        { ".mp4", ".mov", ".avi", ".mkv", ".wmv", ".webm" };
    private readonly IExifToolService _exifToolService;
    private readonly IThumbnailService _thumbnailService;
    private readonly ILogger<FileSystemService> _logger;

    public FileSystemService(IExifToolService exifToolService, IThumbnailService thumbnailService, ILogger<FileSystemService> logger)
    {
        _exifToolService = exifToolService;
        _thumbnailService = thumbnailService;
        _logger = logger;
    }

    /// <summary>
    /// Creates bounded parallel options for folder stats collection.
    /// Begrenzte Parallelisierung fuer die Ordner-Statistik.
    /// </summary>
    internal static ParallelOptions CreateFolderStatsParallelOptions(CancellationToken cancellationToken)
    {
        var maxDegree = Math.Clamp(Environment.ProcessorCount / 2, 1, FolderStatsMaxParallelismCap);
        return new ParallelOptions
        {
            CancellationToken = cancellationToken,
            MaxDegreeOfParallelism = maxDegree,
        };
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
    /// With includeSubfolders the whole subtree is enumerated.
    /// Mit includeSubfolders wird der gesamte Teilbaum durchlaufen.
    /// </summary>
    public Task<List<ImageFile>> GetImagesAsync(string folderPath, bool includeSubfolders = false, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(folderPath) || !Directory.Exists(folderPath))
            return Task.FromResult(new List<ImageFile>());

        return Task.Run(() =>
        {
            var images = new List<ImageFile>();
            try
            {
                // HashSet uses OrdinalIgnoreCase, no ToLowerInvariant needed
                // HashSet nutzt OrdinalIgnoreCase, kein ToLowerInvariant nötig
                var files = includeSubfolders
                    ? EnumerateImageFilesRecursive(folderPath, cancellationToken)
                    : Directory.GetFiles(folderPath)
                        .Where(f => _supportedExtensions.Contains(Path.GetExtension(f)))
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

            // Full path as tie-breaker keeps identical file names from different
            // subfolders in a stable order.
            // Voller Pfad als Zweitkriterium hält gleiche Dateinamen aus
            // verschiedenen Unterordnern stabil sortiert.
            return images
                .OrderBy(i => i.FileName, StringComparer.OrdinalIgnoreCase)
                .ThenBy(i => i.Path, StringComparer.OrdinalIgnoreCase)
                .ToList();
        }, cancellationToken);
    }

    /// <summary>
    /// Enumerate image files of a whole subtree with an iterative stack walk.
    /// SearchOption.AllDirectories would abort the entire enumeration at the first
    /// unreadable subfolder, so directories are visited one by one instead.
    /// Iterativer Stack-Walk statt SearchOption.AllDirectories — letzteres bricht
    /// beim ersten unlesbaren Unterordner komplett ab.
    /// </summary>
    private List<string> EnumerateImageFilesRecursive(string rootPath, CancellationToken cancellationToken)
    {
        var files = new List<string>();
        var pending = new Stack<string>();
        pending.Push(rootPath);

        while (pending.Count > 0)
        {
            // Checked per folder so NAS enumeration stays cancellable.
            // Pro Ordner geprüft, damit NAS-Enumeration abbrechbar bleibt.
            cancellationToken.ThrowIfCancellationRequested();
            var current = pending.Pop();

            try
            {
                files.AddRange(Directory.EnumerateFiles(current)
                    .Where(f => _supportedExtensions.Contains(Path.GetExtension(f))));
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Skipping inaccessible folder while enumerating images");
                continue;
            }

            try
            {
                foreach (var dir in Directory.EnumerateDirectories(current))
                {
                    try
                    {
                        var dirInfo = new DirectoryInfo(dir);

                        // Same visibility filter as GetFolders; reparse points
                        // (junctions/symlinks) are skipped to avoid endless loops.
                        // Gleicher Sichtbarkeitsfilter wie GetFolders; Reparse Points
                        // (Junctions/Symlinks) werden übersprungen (Endlosschleifen).
                        if ((dirInfo.Attributes & FileAttributes.Hidden) != 0 ||
                            (dirInfo.Attributes & FileAttributes.System) != 0 ||
                            (dirInfo.Attributes & FileAttributes.ReparsePoint) != 0)
                            continue;

                        pending.Push(dir);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogDebug(ex, "Skipping inaccessible folder while enumerating images");
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Skipping inaccessible folder while enumerating subfolders");
            }
        }

        return files;
    }

    /// <summary>
    /// Get folder contents (subfolders with stats and images).
    /// With includeSubfolders no folder tiles are returned — the hierarchy is
    /// meaningless in that mode, only the images of the whole subtree are shown.
    /// Mit includeSubfolders keine Ordner-Kacheln — die Hierarchie ist in diesem
    /// Modus bedeutungslos, es zählen nur die Bilder des gesamten Teilbaums.
    /// </summary>
    public async Task<List<GridItem>> GetFolderContentsAsync(string folderPath, bool includeSubfolders = false, CancellationToken cancellationToken = default)
    {
        var items = new List<GridItem>();

        if (string.IsNullOrEmpty(folderPath) || !Directory.Exists(folderPath))
            return items;

        // 1. Get Folders — parallel I/O for subfolder stats
        // 1. Ordner holen — parallele I/O für Unterordner-Statistiken
        if (!includeSubfolders)
            AddFolderItems(items, folderPath, cancellationToken);

        // 2. Get Images using existing logic
        var images = await GetImagesAsync(folderPath, includeSubfolders, cancellationToken);

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

    /// <summary>
    /// Collect the direct subfolders of a path as sorted grid items with stats.
    /// Sammelt die direkten Unterordner als sortierte Grid-Einträge mit Statistik.
    /// </summary>
    private void AddFolderItems(List<GridItem> items, string folderPath, CancellationToken cancellationToken)
    {
        try
        {
            var directories = Directory.GetDirectories(folderPath);

            // Filter visible directories first (fast, no heavy I/O)
            // Sichtbare Verzeichnisse zuerst filtern (schnell, keine aufwändige I/O)
            var visibleDirs = new List<(string Path, DirectoryInfo Info)>();
            foreach (var dir in directories)
            {
                try
                {
                    var dirInfo = new DirectoryInfo(dir);
                    if ((dirInfo.Attributes & FileAttributes.Hidden) != 0 ||
                        (dirInfo.Attributes & FileAttributes.System) != 0)
                        continue;
                    visibleDirs.Add((dir, dirInfo));
                }
                catch (Exception ex)
                {
                    _logger.LogDebug(ex, "Skipping inaccessible folder in content");
                }
            }

            // Parallel stat collection for all visible subdirectories
            // Parallele Statistik-Erfassung für alle sichtbaren Unterverzeichnisse
            var folderItems = new ConcurrentBag<GridItem>();
            var parallelOptions = CreateFolderStatsParallelOptions(cancellationToken);
            Parallel.ForEach(visibleDirs, parallelOptions, dirEntry =>
            {
                parallelOptions.CancellationToken.ThrowIfCancellationRequested();
                try
                {
                    var stats = GetFolderStats(dirEntry.Path);
                    folderItems.Add(new GridItem
                    {
                        Path = dirEntry.Path,
                        Name = dirEntry.Info.Name,
                        IsFolder = true,
                        SubfolderCount = stats.Subfolders,
                        ImageCount = stats.Images,
                        VideoCount = stats.Videos
                    });
                }
                catch (OperationCanceledException)
                {
                    throw;
                }
                catch (Exception ex)
                {
                    _logger.LogDebug(ex, "Skipping inaccessible folder in content");
                }
            });

            items.AddRange(folderItems);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Access denied reading folder content");
        }

        // Sort folders by name / Ordner nach Name sortieren
        items.Sort((a, b) => string.Compare(a.Name, b.Name, StringComparison.OrdinalIgnoreCase));
    }

    private (int Subfolders, int Images, int Videos) GetFolderStats(string path)
    {
        try
        {
            var subfolders = Directory.GetDirectories(path).Length;
            
            // Enumerate is more efficient than GetFiles for counting
            // EnumerateFiles ist effizienter als GetFiles zum Zählen
            var files = Directory.EnumerateFiles(path);
            int images = 0;
            int videos = 0;

            foreach (var file in files)
            {
                // HashSet uses OrdinalIgnoreCase, no ToLowerInvariant needed
                var ext = Path.GetExtension(file);
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
        cancellationToken.ThrowIfCancellationRequested();

        return Task.Run(() =>
        {
            cancellationToken.ThrowIfCancellationRequested();
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

            cancellationToken.ThrowIfCancellationRequested();
            return selectedPath;
        }, cancellationToken);
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

