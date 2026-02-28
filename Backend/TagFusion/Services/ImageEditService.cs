using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using Microsoft.Extensions.Logging;

namespace TagFusion.Services;

/// <summary>
/// Service for basic image editing operations (rotate, flip)
/// Changes are saved directly to the original file
/// </summary>
public class ImageEditService
{
    private readonly ThumbnailService _thumbnailService;
    private readonly ILogger<ImageEditService> _logger;

    public ImageEditService(ThumbnailService thumbnailService, ILogger<ImageEditService> logger)
    {
        _thumbnailService = thumbnailService;
        _logger = logger;
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

        var rotateType = angle switch
        {
            90 => RotateFlipType.Rotate90FlipNone,
            -90 => RotateFlipType.Rotate270FlipNone,
            180 => RotateFlipType.Rotate180FlipNone,
            270 => RotateFlipType.Rotate270FlipNone,
            _ => throw new ArgumentException($"Invalid angle: {angle}. Use 90, -90, or 180.")
        };

        foreach (var path in imagePaths)
        {
            cancellationToken.ThrowIfCancellationRequested();
            results[path] = await TransformImageAsync(path, rotateType, cancellationToken);
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

        var flipType = horizontal
            ? RotateFlipType.RotateNoneFlipX
            : RotateFlipType.RotateNoneFlipY;

        foreach (var path in imagePaths)
        {
            cancellationToken.ThrowIfCancellationRequested();
            results[path] = await TransformImageAsync(path, flipType, cancellationToken);
        }

        return results;
    }

    private async Task<bool> TransformImageAsync(string imagePath, RotateFlipType transformation, CancellationToken cancellationToken = default)
    {
        return await Task.Run(() =>
        {
            try
            {
                if (!File.Exists(imagePath))
                {
                    _logger.LogWarning("File not found: {ImagePath}", imagePath);
                    return false;
                }

                // Get original format
                var extension = Path.GetExtension(imagePath).ToLowerInvariant();
                var format = GetImageFormat(extension);
                var tempPath = imagePath + ".tmp";

                // Read image bytes first to avoid file lock issues
                var imageBytes = File.ReadAllBytes(imagePath);

                using (var memoryStream = new MemoryStream(imageBytes))
                {
                    // Important: Create a copy of the image to detach from stream
                    using var originalImage = Image.FromStream(memoryStream);

                    // Create a new bitmap to avoid GDI+ issues with indexed formats
                    using var workingImage = new Bitmap(originalImage.Width, originalImage.Height, System.Drawing.Imaging.PixelFormat.Format32bppArgb);
                    using (var g = Graphics.FromImage(workingImage))
                    {
                        g.DrawImage(originalImage, 0, 0, originalImage.Width, originalImage.Height);
                    }

                    // Apply transformation to the working copy
                    workingImage.RotateFlip(transformation);

                    // Save to temporary file
                    if (format.Guid == ImageFormat.Jpeg.Guid)
                    {
                        var encoder = GetEncoder(ImageFormat.Jpeg);
                        var encoderParams = new EncoderParameters(1);
                        encoderParams.Param[0] = new EncoderParameter(Encoder.Quality, 95L);
                        workingImage.Save(tempPath, encoder, encoderParams);
                    }
                    else if (format.Guid == ImageFormat.Png.Guid)
                    {
                        workingImage.Save(tempPath, ImageFormat.Png);
                    }
                    else
                    {
                        workingImage.Save(tempPath, format);
                    }
                }

                // Replace original with transformed image
                File.Delete(imagePath);
                File.Move(tempPath, imagePath);

                // Invalidate thumbnail cache
                InvalidateThumbnailCache(imagePath);

                _logger.LogDebug("Successfully transformed: {ImagePath}", imagePath);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to transform {ImagePath}", imagePath);

                // Clean up temp file if it exists
                var tempPath = imagePath + ".tmp";
                if (File.Exists(tempPath))
                {
                    try { File.Delete(tempPath); } catch (Exception cleanupEx) { _logger.LogWarning(cleanupEx, "Failed to delete temp file: {TempPath}", tempPath); }
                }

                return false;
            }
        });
    }

    private ImageFormat GetImageFormat(string extension)
    {
        return extension switch
        {
            ".jpg" or ".jpeg" => ImageFormat.Jpeg,
            ".png" => ImageFormat.Png,
            ".gif" => ImageFormat.Gif,
            ".bmp" => ImageFormat.Bmp,
            ".tiff" or ".tif" => ImageFormat.Tiff,
            _ => ImageFormat.Jpeg
        };
    }

    private ImageCodecInfo GetEncoder(ImageFormat format)
    {
        var codecs = ImageCodecInfo.GetImageEncoders();
        return codecs.First(codec => codec.FormatID == format.Guid);
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

