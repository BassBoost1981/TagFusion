using System.Collections.Concurrent;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace TagFusion.Services;

/// <summary>
/// Service for generating and caching thumbnails (Hybrid approach)
/// </summary>
public class ThumbnailService
{
    private readonly int _thumbnailSize;
    private readonly string _cacheDirectory;
    private readonly ILogger<ThumbnailService> _logger;

    public ThumbnailService(ILogger<ThumbnailService> logger, int thumbnailSize = 256)
    {
        _logger = logger;
        _thumbnailSize = thumbnailSize;
        var appDir = AppContext.BaseDirectory ?? string.Empty;
        _cacheDirectory = Path.Combine(appDir, "cache", "thumbnails");

        if (!Directory.Exists(_cacheDirectory))
            Directory.CreateDirectory(_cacheDirectory);
    }

    /// <summary>
    /// Get thumbnail for an image as data URI (cached)
    /// Returns null if thumbnail doesn't exist yet
    /// </summary>
    public string? GetThumbnailUrl(string imagePath)
    {
        var cachePath = GetCachePath(imagePath);
        if (File.Exists(cachePath))
        {
            var bytes = File.ReadAllBytes(cachePath);
            
            // Check if this is a valid JPEG (starts with FFD8) or old Base64 text format
            if (bytes.Length >= 2 && bytes[0] == 0xFF && bytes[1] == 0xD8)
            {
                // Valid binary JPEG
                var base64 = Convert.ToBase64String(bytes);
                return $"data:image/jpeg;base64,{base64}";
            }
            else
            {
                // Old Base64 text format - delete and regenerate
                try { File.Delete(cachePath); } catch (Exception ex) { _logger.LogDebug(ex, "Failed to delete old cache file"); }
                return null;
            }
        }
        return null;
    }

    public string GetThumbnailLazyUrl(string imagePath)
    {
        var bytes = System.Text.Encoding.UTF8.GetBytes(imagePath);
        var base64Path = Convert.ToBase64String(bytes).Replace('+', '-').Replace('/', '_').Replace("=", "");
        return $"https://tagfusion.local/thumbnails/{base64Path}.jpg";
    }

    public string? GetPathFromUrl(string filename)
    {
        try
        {
            // Remove extension if present
            if (filename.EndsWith(".jpg"))
                filename = filename.Substring(0, filename.Length - 4);

            filename = filename.Replace('-', '+').Replace('_', '/');
            switch (filename.Length % 4)
            {
                case 2: filename += "=="; break;
                case 3: filename += "="; break;
            }
            var bytes = Convert.FromBase64String(filename);
            return System.Text.Encoding.UTF8.GetString(bytes);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Failed to decode thumbnail path from URL");
            return null;
        }
    }

    public string GetCachePath(string imagePath)
    {
        var cacheKey = GetCacheKey(imagePath);
        return Path.Combine(_cacheDirectory, $"{cacheKey}.thumb");
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

        // Generate thumbnail using System.Drawing
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

        // Check cache first
        var cacheKey = GetCacheKey(imagePath);
        var cachedThumbnail = await GetFromCacheAsync(cacheKey, cancellationToken);
        if (cachedThumbnail != null)
            return Convert.ToBase64String(cachedThumbnail);

        // Try to extract embedded thumbnail via ExifTool
        var embeddedThumbnail = await ExtractEmbeddedThumbnailBytesAsync(imagePath, exifToolPath, cancellationToken);
        if (embeddedThumbnail != null)
        {
            await SaveToCacheAsync(cacheKey, embeddedThumbnail, cancellationToken);
            return Convert.ToBase64String(embeddedThumbnail);
        }

        // Generate thumbnail using System.Drawing
        var generatedThumbnail = await GenerateThumbnailBytesAsync(imagePath, cancellationToken);
        if (generatedThumbnail != null)
        {
            await SaveToCacheAsync(cacheKey, generatedThumbnail, cancellationToken);
            return Convert.ToBase64String(generatedThumbnail);
        }

        return null;
    }

    /// <summary>
    /// Get multiple thumbnails with optimized 3-phase batch loading:
    /// Phase 1: Return cached thumbnails immediately
    /// Phase 2: Extract embedded thumbnails with ONE ExifTool process (not one per file!)
    /// Phase 3: Generate remaining thumbnails with System.Drawing in parallel
    /// </summary>
    public async Task<Dictionary<string, string?>> GetThumbnailsBatchAsync(string[] imagePaths, string exifToolPath, int maxParallel = 8, CancellationToken cancellationToken = default)
    {
        var results = new ConcurrentDictionary<string, string?>();
        var uncachedPaths = new List<string>();

        // === Phase 1: Check cache for all paths ===
        foreach (var path in imagePaths)
        {
            if (!File.Exists(path)) continue;

            var cacheKey = GetCacheKey(path);
            var cached = await GetFromCacheAsync(cacheKey, cancellationToken);
            if (cached != null)
                results[path] = Convert.ToBase64String(cached);
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
                results[path] = Convert.ToBase64String(bytes);
            }
            else
            {
                needsGeneration.Add(path);
            }
        }

        // === Phase 3: Generate remaining thumbnails with System.Drawing ===
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
                        results[path] = Convert.ToBase64String(generated);
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
            var filesArgs = string.Join(" ", imagePaths.Select(p => $"\"{p}\""));
            var args = $"-json -b -ThumbnailImage {filesArgs}";

            using var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = exifToolPath,
                    Arguments = args,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    StandardOutputEncoding = Encoding.UTF8
                }
            };

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
            // Fall through — images without results will go to System.Drawing fallback
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
        return await Task.Run(() =>
        {
            try
            {
                cancellationToken.ThrowIfCancellationRequested();

                // Read file into memory first to avoid file locks
                var imageBytes = File.ReadAllBytes(imagePath);
                using var fileStream = new MemoryStream(imageBytes);
                using var originalImage = Image.FromStream(fileStream);

                // Calculate new dimensions maintaining aspect ratio
                var ratioX = (double)_thumbnailSize / originalImage.Width;
                var ratioY = (double)_thumbnailSize / originalImage.Height;
                var ratio = Math.Min(ratioX, ratioY);

                var newWidth = (int)(originalImage.Width * ratio);
                var newHeight = (int)(originalImage.Height * ratio);

                using var thumbnail = new Bitmap(newWidth, newHeight);
                using var graphics = Graphics.FromImage(thumbnail);

                graphics.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                graphics.DrawImage(originalImage, 0, 0, newWidth, newHeight);

                using var memoryStream = new MemoryStream();
                thumbnail.Save(memoryStream, ImageFormat.Jpeg);

                return memoryStream.ToArray();
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Failed to generate thumbnail for {ImagePath}", imagePath);
                return null;
            }
        }, cancellationToken);
    }

    /// <summary>
    /// Get full resolution image scaled to maxSize (for lightbox view)
    /// </summary>
    public async Task<string?> GetFullImageAsync(string imagePath, int maxSize = 1920, CancellationToken cancellationToken = default)
    {
        if (!File.Exists(imagePath))
            return null;

        return await Task.Run(() =>
        {
            try
            {
                cancellationToken.ThrowIfCancellationRequested();

                // Read file into memory first to avoid file locks
                var imageBytes = File.ReadAllBytes(imagePath);
                using var fileStream = new MemoryStream(imageBytes);
                using var originalImage = Image.FromStream(fileStream);

                // If image is smaller than maxSize, return original
                if (originalImage.Width <= maxSize && originalImage.Height <= maxSize)
                {
                    using var memoryStream = new MemoryStream();
                    // Use high quality JPEG
                    var encoder = GetEncoder(ImageFormat.Jpeg);
                    var encoderParams = new System.Drawing.Imaging.EncoderParameters(1);
                    encoderParams.Param[0] = new System.Drawing.Imaging.EncoderParameter(
                        System.Drawing.Imaging.Encoder.Quality, 92L);
                    originalImage.Save(memoryStream, encoder, encoderParams);
                    return Convert.ToBase64String(memoryStream.ToArray());
                }

                // Calculate new dimensions maintaining aspect ratio
                var ratioX = (double)maxSize / originalImage.Width;
                var ratioY = (double)maxSize / originalImage.Height;
                var ratio = Math.Min(ratioX, ratioY);

                var newWidth = (int)(originalImage.Width * ratio);
                var newHeight = (int)(originalImage.Height * ratio);

                using var resizedImage = new Bitmap(newWidth, newHeight);
                using var graphics = Graphics.FromImage(resizedImage);

                graphics.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.HighQuality;
                graphics.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;
                graphics.DrawImage(originalImage, 0, 0, newWidth, newHeight);

                using var memStream = new MemoryStream();
                var enc = GetEncoder(ImageFormat.Jpeg);
                var encParams = new System.Drawing.Imaging.EncoderParameters(1);
                encParams.Param[0] = new System.Drawing.Imaging.EncoderParameter(
                    System.Drawing.Imaging.Encoder.Quality, 92L);
                resizedImage.Save(memStream, enc, encParams);

                return Convert.ToBase64String(memStream.ToArray());
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to get full image: {ImagePath}", imagePath);
                return null;
            }
        }, cancellationToken);
    }

    private static System.Drawing.Imaging.ImageCodecInfo GetEncoder(ImageFormat format)
    {
        var codecs = System.Drawing.Imaging.ImageCodecInfo.GetImageEncoders();
        return codecs.First(codec => codec.FormatID == format.Guid);
    }

    private string GetCacheKey(string imagePath)
    {
        var fileInfo = new FileInfo(imagePath);
        var hashInput = $"{imagePath}|{fileInfo.Length}|{fileInfo.LastWriteTimeUtc.Ticks}";
        
        using var sha256 = System.Security.Cryptography.SHA256.Create();
        var hash = sha256.ComputeHash(System.Text.Encoding.UTF8.GetBytes(hashInput));
        return Convert.ToHexString(hash)[..32];
    }

    private async Task<byte[]?> GetFromCacheAsync(string cacheKey, CancellationToken cancellationToken = default)
    {
        var cachePath = Path.Combine(_cacheDirectory, $"{cacheKey}.thumb");
        if (File.Exists(cachePath))
        {
            return await File.ReadAllBytesAsync(cachePath, cancellationToken);
        }
        return null;
    }

    private async Task SaveToCacheAsync(string cacheKey, byte[] data, CancellationToken cancellationToken = default)
    {
        var cachePath = Path.Combine(_cacheDirectory, $"{cacheKey}.thumb");
        await File.WriteAllBytesAsync(cachePath, data, cancellationToken);
    }

    /// <summary>
    /// Clear all cached thumbnails
    /// </summary>
    public void ClearCache()
    {
        if (Directory.Exists(_cacheDirectory))
        {
            foreach (var file in Directory.GetFiles(_cacheDirectory, "*.thumb"))
            {
                try { File.Delete(file); } catch (Exception ex) { _logger.LogDebug(ex, "Failed to delete cache file: {FilePath}", file); }
            }
        }
    }
}

