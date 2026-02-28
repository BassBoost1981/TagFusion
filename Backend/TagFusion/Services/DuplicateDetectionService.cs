using System.IO;
using System.Security.Cryptography;
using Microsoft.Extensions.Logging;

namespace TagFusion.Services;

/// <summary>
/// Detects duplicate images via SHA256 file hashing.
/// Erkennt doppelte Bilder über SHA256-Datei-Hashing.
/// </summary>
public class DuplicateDetectionService
{
    private readonly ILogger<DuplicateDetectionService> _logger;
    private readonly string[] _supportedExtensions = { ".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp" };

    public DuplicateDetectionService(ILogger<DuplicateDetectionService> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Find duplicate images in a folder by computing SHA256 hash of each file.
    /// Returns groups of duplicate file paths (each group has 2+ files with same hash).
    /// </summary>
    public async Task<List<DuplicateGroup>> FindDuplicatesAsync(
        string folderPath,
        bool includeSubfolders = false,
        CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(folderPath) || !Directory.Exists(folderPath))
            return new List<DuplicateGroup>();

        var searchOption = includeSubfolders ? SearchOption.AllDirectories : SearchOption.TopDirectoryOnly;

        var files = Directory.EnumerateFiles(folderPath, "*.*", searchOption)
            .Where(f => _supportedExtensions.Contains(Path.GetExtension(f).ToLowerInvariant()))
            .ToList();

        _logger.LogInformation("DuplicateDetection: Scanning {Count} files in {Path}", files.Count, folderPath);

        // First group by file size (quick filter — different sizes can never be duplicates)
        var sizeGroups = files
            .Select(f => { try { return (path: f, size: new FileInfo(f).Length); } catch { return (path: f, size: -1L); } })
            .Where(x => x.size > 0)
            .GroupBy(x => x.size)
            .Where(g => g.Count() > 1)
            .ToList();

        var hashMap = new Dictionary<string, List<string>>();

        foreach (var group in sizeGroups)
        {
            foreach (var (path, _) in group)
            {
                ct.ThrowIfCancellationRequested();
                try
                {
                    var hash = await ComputeHashAsync(path, ct);
                    if (!hashMap.ContainsKey(hash))
                        hashMap[hash] = new List<string>();
                    hashMap[hash].Add(path);
                }
                catch (Exception ex)
                {
                    _logger.LogDebug(ex, "DuplicateDetection: Failed to hash {Path}", path);
                }
            }
        }

        var duplicates = hashMap
            .Where(kvp => kvp.Value.Count > 1)
            .Select(kvp => new DuplicateGroup
            {
                Hash = kvp.Key,
                Paths = kvp.Value,
                FileSize = new FileInfo(kvp.Value[0]).Length
            })
            .OrderByDescending(g => g.FileSize)
            .ToList();

        _logger.LogInformation("DuplicateDetection: Found {Count} duplicate groups", duplicates.Count);
        return duplicates;
    }

    /// <summary>
    /// Compute SHA256 hash of a file asynchronously.
    /// </summary>
    private static async Task<string> ComputeHashAsync(string filePath, CancellationToken ct)
    {
        using var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read, 8192, true);
        var hashBytes = await SHA256.HashDataAsync(stream, ct);
        return Convert.ToHexString(hashBytes);
    }
}

/// <summary>
/// A group of duplicate files sharing the same hash.
/// </summary>
public class DuplicateGroup
{
    public string Hash { get; set; } = string.Empty;
    public List<string> Paths { get; set; } = new();
    public long FileSize { get; set; }
}
