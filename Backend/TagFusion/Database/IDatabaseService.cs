using TagFusion.Models;

namespace TagFusion.Database;

/// <summary>
/// Interface for database operations with optimized performance
/// </summary>
public interface IDatabaseService
{
    /// <summary>
    /// Get a single image with metadata
    /// </summary>
    Task<ImageFile?> GetImageAsync(string path, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get metadata for multiple images in a single optimized query
    /// </summary>
    Task<Dictionary<string, ImageMetadata>> GetMetadataForPathsAsync(List<string> paths, CancellationToken cancellationToken = default);

    /// <summary>
    /// Save a single image with metadata
    /// </summary>
    Task SaveImageAsync(ImageFile image, CancellationToken cancellationToken = default);

    /// <summary>
    /// Save multiple images in a batch operation
    /// </summary>
    Task SaveImagesBatchAsync(List<ImageFile> images, CancellationToken cancellationToken = default);

    /// <summary>
    /// Check database health and connectivity
    /// </summary>
    Task<bool> HealthCheckAsync(CancellationToken cancellationToken = default);
}

/// <summary>
/// Enhanced metadata record with all image properties
/// </summary>
public record ImageMetadata(
    List<string> Tags,
    int Rating,
    DateTime LastModified,
    int Width = 0,
    int Height = 0,
    DateTime? DateTaken = null
);