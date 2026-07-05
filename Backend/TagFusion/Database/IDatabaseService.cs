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

    /// <summary>
    /// Search images: each term must match a tag name as substring (case-insensitive
    /// incl. umlauts). Terms are AND-combined; minRating filters additionally.
    /// Suche: jeder Begriff als Teilwort auf Tag-Namen (case-insensitiv inkl. Umlauten),
    /// Begriffe UND-verknüpft; minRating filtert zusätzlich.
    /// </summary>
    Task<List<ImageFile>> SearchImagesAsync(List<string>? terms, int? minRating, int limit = 200, int offset = 0, CancellationToken cancellationToken = default);

    /// <summary>
    /// Record that a thumbnail was just accessed. Used to drive LRU eviction
    /// without depending on the NTFS LastAccessTime (disabled by default since Vista).
    /// Speichert Zugriffszeit eines Thumbnails — ersetzt das auf NTFS oft deaktivierte LastAccessTime.
    /// </summary>
    Task TouchThumbnailAccessAsync(string cacheKey, CancellationToken cancellationToken = default);

    /// <summary>
    /// Return the N oldest-accessed thumbnail cache keys (for eviction).
    /// </summary>
    Task<List<string>> GetOldestThumbnailKeysAsync(int limit, CancellationToken cancellationToken = default);

    /// <summary>
    /// Forget access records for cache keys that no longer exist on disk.
    /// </summary>
    Task ForgetThumbnailAccessAsync(IEnumerable<string> cacheKeys, CancellationToken cancellationToken = default);

    /// <summary>
    /// Delete image rows and their tag links for the given paths (stale entries).
    /// Tag rows themselves are kept. Löscht Bild-Einträge samt Tag-Verknüpfungen;
    /// die Tags selbst bleiben erhalten.
    /// </summary>
    Task DeleteImagesAsync(List<string> paths, CancellationToken cancellationToken = default);

    /// <summary>
    /// Replace all faces of an image and record the scan time. Creates a minimal
    /// Images row when the image is not indexed yet.
    /// Ersetzt alle Gesichter eines Bildes und vermerkt den Scan-Zeitpunkt; legt
    /// bei Bedarf eine minimale Images-Zeile an.
    /// </summary>
    Task SaveFacesAsync(string imagePath, IReadOnlyList<NewFace> faces, DateTime fileLastWriteUtc, CancellationToken cancellationToken = default);

    /// <summary>Map path → stored FaceScanFileTime (ISO) for already-scanned images.</summary>
    Task<Dictionary<string, string>> GetFaceScanTimesAsync(List<string> paths, CancellationToken cancellationToken = default);

    /// <summary>Faces of images directly inside the folder (not recursive).</summary>
    Task<List<StoredFace>> GetFacesForFolderAsync(string folderPath, CancellationToken cancellationToken = default);

    /// <summary>Load specific faces by id. / Lädt Gesichter per Id.</summary>
    Task<List<StoredFace>> GetFacesByIdsAsync(List<long> faceIds, CancellationToken cancellationToken = default);
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