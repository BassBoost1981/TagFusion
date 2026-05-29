using System.Collections.Concurrent;
using System.Diagnostics;
using System.IO;
using System.Management;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Processing;
using TagFusion.Configuration;
using TagFusion.Database;

namespace TagFusion.Services;

/// <summary>
/// Service for generating and caching thumbnails (Hybrid approach).
/// Thumbnails are served via WebView2 virtual host (thumbs.tagfusion.local) to avoid base64 overhead.
/// </summary>
public class ThumbnailService : IThumbnailService
{
    private const string ThumbnailHostName = "thumbs.tagfusion.local";
    private readonly int _thumbnailSize;
    private readonly int _jpegQuality;
    private readonly int _maxParallel;
    private readonly long _maxCacheSizeBytes;
    private readonly string _cacheDirectory;
    private readonly ILogger<ThumbnailService> _logger;
    private readonly IServiceProvider? _serviceProvider;

    // Lazy DB resolution avoids constructor-cycle problems and keeps tests free of
    // a DI requirement (pass null for tests that don't exercise eviction).
    // Lazy DB-Aufloesung — Tests koennen serviceProvider weglassen.
    private IDatabaseService? _database;
    private IDatabaseService? Database => _database ??= _serviceProvider?.GetService(typeof(IDatabaseService)) as IDatabaseService;

    // Memoize cache keys per (path, mtime, size). Avoids a FileInfo stat call on every
    // thumbnail lookup during fast scrolling.
    // Cache-Keys werden gemerkt — kein wiederholtes FileInfo bei schnellem Scrollen.
    private readonly ConcurrentDictionary<string, (long Size, long MTimeTicks, string Key)> _cacheKeyMemo = new(StringComparer.OrdinalIgnoreCase);

    // Cache drive-type → recommended parallelism so we don't query WMI per call.
    // Laufwerk-Typ → empfohlene Parallelität gecached.
    private static readonly ConcurrentDictionary<string, int> _drivePathToParallelism =
        new(StringComparer.OrdinalIgnoreCase);

    // Single-flight gate for cache eviction. Eviction is triggered fire-and-forget from
    // multiple callers (SaveToCacheAsync, GetFullImageAsync) and during batch generation
    // many writes fire in parallel. Without serialization, concurrent passes each read
    // "over limit", each compute the oldest set, and each delete — over-evicting well
    // below the target. We acquire non-blocking (Wait(0)) so overlapping triggers are
    // skipped, not queued: at most one eviction runs at a time.
    // Single-Flight-Sperre für die Eviction — überlappende Auslöser werden übersprungen, nicht gestapelt.
    private readonly SemaphoreSlim _evictionGate = new(1, 1);

    public ThumbnailService(ILogger<ThumbnailService> logger, IOptions<ThumbnailSettings> options, IServiceProvider? serviceProvider = null)
    {
        _logger = logger;
        _serviceProvider = serviceProvider;
        var settings = options.Value;
        _thumbnailSize = settings.Size;
        _jpegQuality = settings.JpegQuality;
        _maxParallel = settings.MaxParallel;
        _maxCacheSizeBytes = settings.MaxCacheSizeMb * 1024L * 1024L;
        var appDir = AppContext.BaseDirectory ?? string.Empty;
        _cacheDirectory = Path.Combine(appDir, "cache", "thumbnails");

        if (!Directory.Exists(_cacheDirectory))
            Directory.CreateDirectory(_cacheDirectory);
    }

    /// <summary>
    /// Get HTTP URL for a cached thumbnail via virtual host.
    /// Returns null if thumbnail doesn't exist in cache yet.
    /// </summary>
    public string? GetThumbnailUrl(string imagePath)
    {
        var cachePath = GetCachePath(imagePath);
        if (File.Exists(cachePath))
        {
            var cacheKey = GetCacheKey(imagePath);
            return $"https://{ThumbnailHostName}/{cacheKey}.jpg";
        }
        return null;
    }

    public string GetCachePath(string imagePath)
    {
        var cacheKey = GetCacheKey(imagePath);
        return Path.Combine(_cacheDirectory, $"{cacheKey}.jpg");
    }

    public async Task<bool> EnsureThumbnailExistsAsync(string imagePath, string exifToolPath, CancellationToken cancellationToken = default)
    {
        var cachePath = GetCachePath(imagePath);
        if (File.Exists(cachePath)) return true;

        // Try to extract embedded thumbnail via ExifTool
        var embeddedThumbnail = await ExtractEmbeddedThumbnailBytesAsync(imagePath, exifToolPath, cancellationToken);
        if (embeddedThumbnail != null)
        {
            await File.WriteAllBytesAsync(cachePath, embeddedThumbnail, cancellationToken);
            return true;
        }

        // Generate thumbnail using ImageSharp
        var generatedThumbnail = await GenerateThumbnailBytesAsync(imagePath, cancellationToken);
        if (generatedThumbnail != null)
        {
            await File.WriteAllBytesAsync(cachePath, generatedThumbnail, cancellationToken);
            return true;
        }

        return false;
    }

    public async Task<string?> GetThumbnailAsync(string imagePath, string exifToolPath, CancellationToken cancellationToken = default)
    {
        if (!File.Exists(imagePath))
            return null;

        var cacheKey = GetCacheKey(imagePath);

        // Check cache first — return URL to cached file
        if (await GetFromCacheAsync(cacheKey, cancellationToken) != null)
            return $"https://{ThumbnailHostName}/{cacheKey}.jpg";

        // Try to extract embedded thumbnail via ExifTool
        var embeddedThumbnail = await ExtractEmbeddedThumbnailBytesAsync(imagePath, exifToolPath, cancellationToken);
        if (embeddedThumbnail != null)
        {
            await SaveToCacheAsync(cacheKey, embeddedThumbnail, cancellationToken);
            return $"https://{ThumbnailHostName}/{cacheKey}.jpg";
        }

        // Generate thumbnail using ImageSharp
        var generatedThumbnail = await GenerateThumbnailBytesAsync(imagePath, cancellationToken);
        if (generatedThumbnail != null)
        {
            await SaveToCacheAsync(cacheKey, generatedThumbnail, cancellationToken);
            return $"https://{ThumbnailHostName}/{cacheKey}.jpg";
        }

        return null;
    }

    /// <summary>
    /// Get multiple thumbnails with optimized 3-phase batch loading:
    /// Phase 1: Return cached thumbnails immediately
    /// Phase 2: Extract embedded thumbnails with ONE ExifTool process (not one per file!)
    /// Phase 3: Generate remaining thumbnails with ImageSharp in parallel
    /// </summary>
    public async Task<Dictionary<string, string?>> GetThumbnailsBatchAsync(string[] imagePaths, string exifToolPath, int maxParallel = 0, CancellationToken cancellationToken = default)
    {
        // Adaptive parallelism: HDDs thrash with 8 concurrent reads; SSDs love it.
        // Adaptive Parallelisierung: Auf HDD nur 2-3 parallele Decodes, auf SSD bis _maxParallel.
        if (maxParallel <= 0)
        {
            maxParallel = imagePaths.Length > 0
                ? Math.Min(_maxParallel, GetRecommendedParallelism(imagePaths[0]))
                : _maxParallel;
        }
        var results = new ConcurrentDictionary<string, string?>();
        var uncachedPaths = new List<string>();

        // === Phase 1: Check cache for all paths — return URLs for cached files ===
        foreach (var path in imagePaths)
        {
            if (!File.Exists(path)) continue;

            var cacheKey = GetCacheKey(path);
            var cached = await GetFromCacheAsync(cacheKey, cancellationToken);
            if (cached != null)
                results[path] = $"https://{ThumbnailHostName}/{cacheKey}.jpg";
            else
                uncachedPaths.Add(path);
        }

        if (uncachedPaths.Count == 0)
            return new Dictionary<string, string?>(results);

        // === Phase 2: Batch extract embedded thumbnails (single ExifTool process) ===
        var extracted = await ExtractBatchEmbeddedThumbnailsAsync(uncachedPaths, exifToolPath, cancellationToken);
        var needsGeneration = new List<string>();

        foreach (var path in uncachedPaths)
        {
            if (extracted.TryGetValue(path, out var bytes) && bytes != null)
            {
                var cacheKey = GetCacheKey(path);
                await SaveToCacheAsync(cacheKey, bytes, cancellationToken);
                results[path] = $"https://{ThumbnailHostName}/{cacheKey}.jpg";
            }
            else
            {
                needsGeneration.Add(path);
            }
        }

        // === Phase 3: Generate remaining thumbnails with ImageSharp ===
        if (needsGeneration.Count > 0)
        {
            using var semaphore = new SemaphoreSlim(maxParallel);
            var tasks = needsGeneration.Select(async path =>
            {
                await semaphore.WaitAsync(cancellationToken);
                try
                {
                    var generated = await GenerateThumbnailBytesAsync(path, cancellationToken);
                    if (generated != null)
                    {
                        var cacheKey = GetCacheKey(path);
                        await SaveToCacheAsync(cacheKey, generated, cancellationToken);
                        results[path] = $"https://{ThumbnailHostName}/{cacheKey}.jpg";
                    }
                }
                finally { semaphore.Release(); }
            });
            await Task.WhenAll(tasks);
        }

        return new Dictionary<string, string?>(results);
    }

    /// <summary>
    /// Extract embedded thumbnails for multiple images using a SINGLE ExifTool process.
    /// Uses -json -b -ThumbnailImage which outputs base64-encoded binary in JSON.
    /// This is 50-100x faster than spawning one process per image.
    /// </summary>
    private async Task<Dictionary<string, byte[]?>> ExtractBatchEmbeddedThumbnailsAsync(
        List<string> imagePaths, string exifToolPath, CancellationToken cancellationToken)
    {
        var results = new Dictionary<string, byte[]?>(StringComparer.OrdinalIgnoreCase);

        if (imagePaths.Count == 0)
            return results;

        try
        {
            // Pass paths via ArgumentList so ProcessStartInfo handles quoting correctly.
            // This avoids the string-join quoting bug that silently dropped files with
            // special characters in their paths.
            // Pfade über ArgumentList übergeben — vermeidet Quoting-Fehler bei Sonderzeichen.
            var psi = new ProcessStartInfo
            {
                FileName = exifToolPath,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
                StandardOutputEncoding = Encoding.UTF8
            };
            psi.ArgumentList.Add("-json");
            psi.ArgumentList.Add("-b");
            psi.ArgumentList.Add("-ThumbnailImage");
            foreach (var p in imagePaths)
                psi.ArgumentList.Add(p);

            using var process = new Process { StartInfo = psi };

            process.Start();
            var output = await process.StandardOutput.ReadToEndAsync(cancellationToken);
            await process.WaitForExitAsync(cancellationToken);

            if (!string.IsNullOrWhiteSpace(output))
            {
                using var doc = JsonDocument.Parse(output);
                foreach (var item in doc.RootElement.EnumerateArray())
                {
                    if (!item.TryGetProperty("SourceFile", out var sfProp))
                        continue;
                    var sourcePath = sfProp.GetString();
                    if (string.IsNullOrEmpty(sourcePath))
                        continue;

                    sourcePath = Path.GetFullPath(sourcePath);

                    if (item.TryGetProperty("ThumbnailImage", out var thumbProp)
                        && thumbProp.ValueKind == JsonValueKind.String)
                    {
                        var b64 = thumbProp.GetString()!;
                        // ExifTool outputs "base64:DATA" format with -json -b
                        if (b64.StartsWith("base64:"))
                            b64 = b64[7..];

                        results[sourcePath] = Convert.FromBase64String(b64);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Batch embedded thumbnail extraction failed");
            // Fall through — images without results will go to ImageSharp fallback
        }

        return results;
    }

    private async Task<byte[]?> ExtractEmbeddedThumbnailBytesAsync(string imagePath, string exifToolPath, CancellationToken cancellationToken = default)
    {
        try
        {
            using var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = exifToolPath,
                    Arguments = $"-b -ThumbnailImage \"{imagePath}\"",
                    RedirectStandardOutput = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                }
            };

            process.Start();

            using var memoryStream = new MemoryStream();
            await process.StandardOutput.BaseStream.CopyToAsync(memoryStream, cancellationToken);
            await process.WaitForExitAsync(cancellationToken);

            if (memoryStream.Length > 0)
            {
                return memoryStream.ToArray();
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Failed to extract embedded thumbnail for {ImagePath}", imagePath);
        }

        return null;
    }

    private async Task<byte[]?> GenerateThumbnailBytesAsync(string imagePath, CancellationToken cancellationToken = default)
    {
        try
        {
            cancellationToken.ThrowIfCancellationRequested();

            // Stream image file — avoids loading entire file into memory (critical for large RAW files)
            using var fileStream = new FileStream(imagePath, FileMode.Open, FileAccess.Read, FileShare.Read);
            using var image = await Image.LoadAsync(fileStream, cancellationToken);

            // Resize maintaining aspect ratio using ImageSharp's ResizeMode.Max
            image.Mutate(x => x.Resize(new ResizeOptions
            {
                Size = new Size(_thumbnailSize, _thumbnailSize),
                Mode = ResizeMode.Max
            }));

            using var memoryStream = new MemoryStream();
            var encoder = new JpegEncoder { Quality = _jpegQuality };
            await image.SaveAsync(memoryStream, encoder, cancellationToken);

            return memoryStream.ToArray();
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Failed to generate thumbnail for {ImagePath}", imagePath);
            return null;
        }
    }

    /// <summary>
    /// Get full resolution image scaled to maxSize (for lightbox view).
    /// Caches the scaled image to disk and returns a virtual-host URL so the
    /// WebView2 can load it via HTTP instead of a multi-megabyte base64 bridge payload.
    /// Volle Auflösung für Lightbox: Skaliertes Bild wird gecached und per virtuellem Host ausgeliefert.
    /// </summary>
    public async Task<string?> GetFullImageAsync(string imagePath, int maxSize = 1920, CancellationToken cancellationToken = default)
    {
        if (!File.Exists(imagePath))
            return null;

        try
        {
            cancellationToken.ThrowIfCancellationRequested();

            // Cache key includes maxSize so different zoom levels don't collide.
            // Cache-Key enthält maxSize — unterschiedliche Zoomstufen kollidieren nicht.
            var cacheKey = $"full_{maxSize}_{GetCacheKey(imagePath)}";
            var cachePath = Path.Combine(_cacheDirectory, $"{cacheKey}.jpg");

            if (!File.Exists(cachePath))
            {
                using var fileStream = new FileStream(imagePath, FileMode.Open, FileAccess.Read, FileShare.Read);
                using var image = await Image.LoadAsync(fileStream, cancellationToken);

                if (image.Width > maxSize || image.Height > maxSize)
                {
                    image.Mutate(x => x.Resize(new ResizeOptions
                    {
                        Size = new Size(maxSize, maxSize),
                        Mode = ResizeMode.Max
                    }));
                }

                // Write to a unique temp file first, then atomic rename. This ensures
                // concurrent callers (e.g. lightbox preload of currentIndex±3 racing
                // with the primary fetch) never see a half-written or read-locked
                // file at cachePath. File.Exists(cachePath) only flips to true once
                // the bytes are fully on disk and the writer has released the file.
                // Atomares Schreiben ueber .tmp + Rename — kein Sichtfenster mit halbfertiger Datei.
                var tempPath = Path.Combine(_cacheDirectory, $"{cacheKey}.{Guid.NewGuid():N}.tmp");
                var encoder = new JpegEncoder { Quality = _jpegQuality };
                try
                {
                    await using (var outStream = new FileStream(tempPath, FileMode.Create, FileAccess.Write, FileShare.None))
                    {
                        await image.SaveAsync(outStream, encoder, cancellationToken);
                    }

                    try
                    {
                        File.Move(tempPath, cachePath, overwrite: true);
                    }
                    catch (IOException)
                    {
                        // Another thread won the race and produced cachePath first —
                        // discard our copy and use theirs.
                        try { File.Delete(tempPath); } catch { /* best effort */ }
                    }
                }
                catch
                {
                    try { if (File.Exists(tempPath)) File.Delete(tempPath); } catch { /* best effort */ }
                    throw;
                }

                if (_maxCacheSizeBytes > 0)
                    _ = Task.Run(EvictOldestIfOverLimit, CancellationToken.None);
            }

            return $"https://{ThumbnailHostName}/{cacheKey}.jpg";
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to get full image: {ImagePath}", imagePath);
            return null;
        }
    }

    private string GetCacheKey(string imagePath)
    {
        var fileInfo = new FileInfo(imagePath);
        var size = fileInfo.Exists ? fileInfo.Length : 0L;
        var mtime = fileInfo.Exists ? fileInfo.LastWriteTimeUtc.Ticks : 0L;

        if (_cacheKeyMemo.TryGetValue(imagePath, out var memo)
            && memo.Size == size && memo.MTimeTicks == mtime)
        {
            return memo.Key;
        }

        var hashInput = $"{imagePath}|{size}|{mtime}";
        using var sha256 = System.Security.Cryptography.SHA256.Create();
        var hash = sha256.ComputeHash(System.Text.Encoding.UTF8.GetBytes(hashInput));
        var key = Convert.ToHexString(hash)[..32];

        _cacheKeyMemo[imagePath] = (size, mtime, key);
        return key;
    }

    /// <summary>
    /// Pick a parallelism level based on the underlying physical drive type.
    /// SSD/NVMe → _maxParallel; HDD → max 3; unknown → _maxParallel.
    /// Uses Win32_PhysicalDisk.MediaType (4=SSD, 3=HDD, 5=SCM/Optane). Cached per drive root.
    /// </summary>
    private int GetRecommendedParallelism(string anyPathOnDrive)
    {
        try
        {
            var root = Path.GetPathRoot(anyPathOnDrive);
            if (string.IsNullOrEmpty(root)) return _maxParallel;

            return _drivePathToParallelism.GetOrAdd(root, _ =>
            {
                try
                {
                    var driveLetter = root.TrimEnd(Path.DirectorySeparatorChar, '/').TrimEnd(':');
                    using var partitionSearcher = new ManagementObjectSearcher(
                        $"ASSOCIATORS OF {{Win32_LogicalDisk.DeviceID='{driveLetter}:'}} WHERE AssocClass = Win32_LogicalDiskToPartition");
                    foreach (var partition in partitionSearcher.Get())
                    {
                        using var diskSearcher = new ManagementObjectSearcher(
                            $"ASSOCIATORS OF {{Win32_DiskPartition.DeviceID='{partition["DeviceID"]}'}} WHERE AssocClass = Win32_DiskDriveToDiskPartition");
                        foreach (var disk in diskSearcher.Get())
                        {
                            var diskIndex = Convert.ToUInt32(disk["Index"]);
                            using var physicalSearcher = new ManagementObjectSearcher(
                                @"root\Microsoft\Windows\Storage",
                                $"SELECT MediaType FROM MSFT_PhysicalDisk WHERE DeviceId='{diskIndex}'");
                            foreach (var physical in physicalSearcher.Get())
                            {
                                var mediaType = Convert.ToInt32(physical["MediaType"]);
                                // 3=HDD, 4=SSD, 5=SCM
                                if (mediaType == 3)
                                {
                                    _logger.LogInformation("Drive {Root}: HDD detected, capping parallelism to 3", root);
                                    return Math.Min(3, _maxParallel);
                                }
                                return _maxParallel;
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogDebug(ex, "Drive type detection failed for {Root}", root);
                }
                return _maxParallel;
            });
        }
        catch
        {
            return _maxParallel;
        }
    }

    private async Task<byte[]?> GetFromCacheAsync(string cacheKey, CancellationToken cancellationToken = default)
    {
        var cachePath = Path.Combine(_cacheDirectory, $"{cacheKey}.jpg");
        if (File.Exists(cachePath))
        {
            // Fire-and-forget: persist access time in SQLite so eviction can sort by it
            // (NTFS LastAccessTime is unreliable since access-time updates default-off).
            // Zugriffszeit in SQLite festhalten — auf NTFS ist LastAccessTime per Default deaktiviert.
            try { _ = Database?.TouchThumbnailAccessAsync(cacheKey, CancellationToken.None); } catch { /* best effort */ }
            return await File.ReadAllBytesAsync(cachePath, cancellationToken);
        }
        return null;
    }

    private async Task SaveToCacheAsync(string cacheKey, byte[] data, CancellationToken cancellationToken = default)
    {
        var cachePath = Path.Combine(_cacheDirectory, $"{cacheKey}.jpg");
        await File.WriteAllBytesAsync(cachePath, data, cancellationToken);

        // Trigger eviction check in background (non-blocking)
        if (_maxCacheSizeBytes > 0)
            _ = Task.Run(EvictOldestIfOverLimit, CancellationToken.None);
    }

    /// <summary>
    /// Evict oldest cache files if total size exceeds MaxCacheSizeMb.
    /// Uses SQLite-tracked access timestamps when available (NTFS LastAccessTime is
    /// unreliable). Falls back to filesystem mtime ordering if no DB record exists yet.
    /// </summary>
    private void EvictOldestIfOverLimit()
    {
        // Non-blocking single-flight: if another eviction pass is already running, skip
        // this trigger rather than queueing behind it. Re-checking the over-limit
        // condition below (inside the gate) ensures a just-completed pass is observed.
        // Nicht-blockierend: Läuft bereits eine Eviction, wird dieser Auslöser übersprungen.
        if (!_evictionGate.Wait(0)) return;
        try
        {
            if (!Directory.Exists(_cacheDirectory)) return;

            var files = new DirectoryInfo(_cacheDirectory).GetFiles("*.jpg").ToList();
            var totalSize = files.Sum(f => f.Length);
            if (totalSize <= _maxCacheSizeBytes) return;

            var targetSize = (long)(_maxCacheSizeBytes * 0.8);

            // Pull oldest cache keys from SQLite. Anything not on disk anymore gets forgotten.
            var orderedKeys = new List<string>();
            var db = Database;
            if (db != null)
            {
                try
                {
                    orderedKeys = db.GetOldestThumbnailKeysAsync(int.MaxValue).GetAwaiter().GetResult();
                }
                catch (Exception ex)
                {
                    _logger.LogDebug(ex, "Could not load thumbnail access order from DB; falling back to mtime");
                }
            }

            // Build deletion order: SQLite-known oldest first, then files we've never touched
            // (sorted by file mtime as a stable fallback).
            var orderedFiles = new List<FileInfo>();
            var byKey = files.ToDictionary(f => Path.GetFileNameWithoutExtension(f.Name), f => f, StringComparer.OrdinalIgnoreCase);
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var key in orderedKeys)
            {
                if (byKey.TryGetValue(key, out var fi))
                {
                    orderedFiles.Add(fi);
                    seen.Add(key);
                }
            }
            orderedFiles.AddRange(files
                .Where(f => !seen.Contains(Path.GetFileNameWithoutExtension(f.Name)))
                .OrderBy(f => f.LastWriteTimeUtc));

            var evicted = 0;
            var evictedKeys = new List<string>();
            foreach (var file in orderedFiles)
            {
                if (totalSize <= targetSize) break;
                try
                {
                    totalSize -= file.Length;
                    var key = Path.GetFileNameWithoutExtension(file.Name);
                    file.Delete();
                    evictedKeys.Add(key);
                    evicted++;
                }
                catch (Exception ex)
                {
                    _logger.LogDebug(ex, "Failed to evict cache file: {FilePath}", file.FullName);
                }
            }

            if (evicted > 0)
            {
                _logger.LogInformation("Thumbnail cache eviction: removed {Count} files, size now ~{SizeMb}MB",
                    evicted, totalSize / (1024 * 1024));
                if (db != null)
                {
                    try { db.ForgetThumbnailAccessAsync(evictedKeys).GetAwaiter().GetResult(); } catch { /* best effort */ }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Thumbnail cache eviction failed");
        }
        finally
        {
            _evictionGate.Release();
        }
    }

    /// <summary>
    /// Clear all cached thumbnails
    /// </summary>
    public void ClearCache()
    {
        if (Directory.Exists(_cacheDirectory))
        {
            foreach (var file in Directory.GetFiles(_cacheDirectory, "*.jpg"))
            {
                try { File.Delete(file); } catch (Exception ex) { _logger.LogDebug(ex, "Failed to delete cache file: {FilePath}", file); }
            }
        }
    }
}

