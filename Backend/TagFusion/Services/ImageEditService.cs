using System.IO;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats;
using SixLabors.ImageSharp.Formats.Bmp;
using SixLabors.ImageSharp.Formats.Gif;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.Formats.Tiff;
using SixLabors.ImageSharp.Processing;
using TagFusion.Configuration;

namespace TagFusion.Services;

/// <summary>
/// Service for basic image editing operations (rotate, flip)
/// Changes are saved directly to the original file
/// </summary>
public class ImageEditService : IImageEditService
{
    private readonly IThumbnailService _thumbnailService;
    private readonly ILogger<ImageEditService> _logger;
    private readonly IFileBackupService _backupService;
    private readonly int _jpegQuality;

    public ImageEditService(
        IThumbnailService thumbnailService,
        ILogger<ImageEditService> logger,
        IOptions<ImageEditSettings> options,
        IFileBackupService? backupService = null)
    {
        _thumbnailService = thumbnailService;
        _logger = logger;
        _backupService = backupService ?? NoopFileBackupService.Instance;
        _jpegQuality = options.Value.JpegQuality;
    }

    /// <summary>
    /// Rotate images by specified angle
    /// </summary>
    /// <param name="imagePaths">List of image paths to rotate</param>
    /// <param name="angle">Rotation angle: 90 (right), -90 (left), or 180</param>
    /// <returns>Dictionary with path -> success status</returns>
    public async Task<Dictionary<string, bool>> RotateImagesAsync(IEnumerable<string> imagePaths, int angle, CancellationToken cancellationToken = default)
    {
        var results = new Dictionary<string, bool>();

        var rotateAngle = angle switch
        {
            90 => 90f,
            -90 => -90f,
            180 => 180f,
            270 => -90f,
            _ => throw new ArgumentException($"Invalid angle: {angle}. Use 90, -90, or 180.")
        };

        foreach (var path in imagePaths)
        {
            cancellationToken.ThrowIfCancellationRequested();
            results[path] = await TransformImageAsync(path, img => img.Mutate(x => x.Rotate(rotateAngle)), cancellationToken);
        }

        return results;
    }

    /// <summary>
    /// Flip images horizontally or vertically
    /// </summary>
    /// <param name="imagePaths">List of image paths to flip</param>
    /// <param name="horizontal">True for horizontal flip, false for vertical</param>
    /// <returns>Dictionary with path -> success status</returns>
    public async Task<Dictionary<string, bool>> FlipImagesAsync(IEnumerable<string> imagePaths, bool horizontal, CancellationToken cancellationToken = default)
    {
        var results = new Dictionary<string, bool>();

        var flipMode = horizontal ? FlipMode.Horizontal : FlipMode.Vertical;

        foreach (var path in imagePaths)
        {
            cancellationToken.ThrowIfCancellationRequested();
            results[path] = await TransformImageAsync(path, img => img.Mutate(x => x.Flip(flipMode)), cancellationToken);
        }

        return results;
    }

    private async Task<bool> TransformImageAsync(string imagePath, Action<Image> transform, CancellationToken cancellationToken = default)
    {
        return await Task.Run(async () =>
        {
            try
            {
                if (!File.Exists(imagePath))
                {
                    _logger.LogWarning("File not found: {ImagePath}", imagePath);
                    return false;
                }

                var extension = Path.GetExtension(imagePath).ToLowerInvariant();
                var tempPath = imagePath + ".tmp";

                // Read image bytes first to avoid file lock issues
                await _backupService.CreateBackupAsync(imagePath, "image-transform", cancellationToken);
                var imageBytes = File.ReadAllBytes(imagePath);

                using (var memoryStream = new MemoryStream(imageBytes))
                {
                    using var image = Image.Load(memoryStream);

                    // Apply transformation
                    transform(image);

                    // Save to temporary file in the appropriate format with configured quality
                    var encoder = GetEncoderForExtension(extension, _jpegQuality);
                    await image.SaveAsync(tempPath, encoder, cancellationToken);
                }

                // Atomic replace on NTFS: File.Replace renames tempPath over imagePath
                // and writes the old content to backupPath in a single transacted operation.
                // Avoids the brief window where imagePath doesn't exist with the previous
                // 2-step File.Move approach.
                // Atomarer Austausch auf NTFS — kein Zeitfenster ohne Datei.
                // Falls back to move-based replace on FAT32/exFAT (USB, SD cards) and many
                // network shares where File.Replace (Win32 ReplaceFile) is unsupported.
                // Fallback via File.Move auf nicht-NTFS-Volumes (FAT32, exFAT, SMB).
                var backupPath = imagePath + ".bak";
                try
                {
                    File.Replace(tempPath, imagePath, backupPath, ignoreMetadataErrors: true);
                    File.Delete(backupPath);
                }
                catch (IOException)
                {
                    // File.Replace is NTFS-only; fall back to move-based replace
                    if (File.Exists(backupPath)) File.Delete(backupPath);
                    File.Move(imagePath, backupPath);   // original aside
                    try
                    {
                        File.Move(tempPath, imagePath); // temp becomes new original
                    }
                    catch
                    {
                        // Restore original if the second move fails
                        if (!File.Exists(imagePath) && File.Exists(backupPath))
                            File.Move(backupPath, imagePath);
                        throw;
                    }
                    File.Delete(backupPath);
                }

                // Invalidate thumbnail cache
                InvalidateThumbnailCache(imagePath);

                _logger.LogDebug("Successfully transformed: {ImagePath}", imagePath);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to transform {ImagePath}", imagePath);

                // Clean up temp/backup files if they exist
                var tempPath = imagePath + ".tmp";
                if (File.Exists(tempPath))
                {
                    try { File.Delete(tempPath); } catch (Exception cleanupEx) { _logger.LogWarning(cleanupEx, "Failed to delete temp file: {TempPath}", tempPath); }
                }
                var backupPath = imagePath + ".bak";
                if (File.Exists(backupPath) && !File.Exists(imagePath))
                {
                    // Restore from backup if original is missing (crash recovery)
                    try { File.Move(backupPath, imagePath); _logger.LogInformation("Restored original from backup: {ImagePath}", imagePath); }
                    catch (Exception restoreEx) { _logger.LogError(restoreEx, "Failed to restore backup: {BackupPath}", backupPath); }
                }
                else if (File.Exists(backupPath))
                {
                    try { File.Delete(backupPath); } catch (Exception cleanupEx) { _logger.LogWarning(cleanupEx, "Failed to delete backup file: {BackupPath}", backupPath); }
                }

                return false;
            }
        });
    }

    internal static IImageEncoder GetEncoder(string extension, int jpegQuality = 95)
    {
        return GetEncoderForExtension(extension, jpegQuality);
    }

    private static IImageEncoder GetEncoderForExtension(string extension, int jpegQuality)
    {
        return extension switch
        {
            ".jpg" or ".jpeg" => new JpegEncoder { Quality = jpegQuality },
            ".png" => new PngEncoder(),
            ".gif" => new GifEncoder(),
            ".bmp" => new BmpEncoder(),
            ".tiff" or ".tif" => new TiffEncoder(),
            _ => new JpegEncoder { Quality = jpegQuality }
        };
    }

    private void InvalidateThumbnailCache(string imagePath)
    {
        try
        {
            var cachePath = _thumbnailService.GetCachePath(imagePath);
            if (File.Exists(cachePath))
            {
                File.Delete(cachePath);
                _logger.LogDebug("Thumbnail cache invalidated: {ImagePath}", imagePath);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to invalidate thumbnail cache for {ImagePath}", imagePath);
        }
    }
}
