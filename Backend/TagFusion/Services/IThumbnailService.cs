namespace TagFusion.Services;

/// <summary>
/// Thumbnail generation, caching, and virtual-host URL resolution.
/// Abstracts <see cref="ThumbnailService"/> so consumers can be unit-tested without the
/// concrete cache/ImageSharp implementation.
/// Abstrahiert <see cref="ThumbnailService"/> — entkoppelt Verbraucher von der konkreten Implementierung.
/// </summary>
public interface IThumbnailService
{
    /// <summary>HTTP URL for a cached thumbnail via the virtual host, or null if not yet cached.</summary>
    string? GetThumbnailUrl(string imagePath);

    /// <summary>Absolute path of the on-disk cache file for an image's thumbnail.</summary>
    string GetCachePath(string imagePath);

    /// <summary>Get (or create) a thumbnail and return its virtual-host URL.</summary>
    Task<string?> GetThumbnailAsync(string imagePath, string exifToolPath, CancellationToken cancellationToken = default);

    /// <summary>Get (or create) thumbnails for many images using batched ExifTool extraction.</summary>
    Task<Dictionary<string, string?>> GetThumbnailsBatchAsync(string[] imagePaths, string exifToolPath, int maxParallel = 0, CancellationToken cancellationToken = default);

    /// <summary>Get a full-resolution image scaled to <paramref name="maxSize"/> for lightbox viewing.</summary>
    Task<string?> GetFullImageAsync(string imagePath, int maxSize = 1920, CancellationToken cancellationToken = default);
}
