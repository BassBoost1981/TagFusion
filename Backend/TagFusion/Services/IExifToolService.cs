using TagFusion.Models;

namespace TagFusion.Services;

/// <summary>
/// Interface for ExifTool-based metadata operations.
/// </summary>
public interface IExifToolService
{
    string ExifToolPath { get; }
    Task<List<string>> ReadTagsAsync(string imagePath, CancellationToken cancellationToken = default);
    Task<bool> WriteTagsAsync(string imagePath, List<string> tags, CancellationToken cancellationToken = default);
    /// <summary>
    /// Write the same tag set to many files in a single ExifTool invocation.
    /// Mehrere Dateien mit identischem Tag-Set in einem ExifTool-Aufruf beschreiben.
    /// </summary>
    Task<Dictionary<string, bool>> WriteTagsBatchAsync(IEnumerable<string> imagePaths, List<string> tags, CancellationToken cancellationToken = default);
    Task<int> ReadRatingAsync(string imagePath, CancellationToken cancellationToken = default);
    Task<bool> WriteRatingAsync(string imagePath, int rating, CancellationToken cancellationToken = default);
    Task<Dictionary<string, (List<string> Tags, int Rating)>> ReadBatchMetadataAsync(List<string> imagePaths, CancellationToken cancellationToken = default);
    /// <summary>
    /// Read MWG descriptions for many files in one batched call; only non-empty
    /// entries are returned. Liest MWG-Beschreibungen gebatcht; nur nicht-leere.
    /// </summary>
    Task<Dictionary<string, string>> ReadDescriptionsBatchAsync(List<string> imagePaths, CancellationToken cancellationToken = default);
    /// <summary>
    /// Write the description via the MWG composite tag (keeps XMP/IPTC/EXIF in sync).
    /// Schreibt die Beschreibung über das MWG-Komposit (XMP/IPTC/EXIF konsistent).
    /// </summary>
    Task<bool> WriteDescriptionAsync(string imagePath, string description, CancellationToken cancellationToken = default);
    Task<string?> GetThumbnailAsync(string imagePath, CancellationToken cancellationToken = default);
    Task<Dictionary<string, string?>> GetThumbnailsBatchAsync(string[] imagePaths, CancellationToken cancellationToken = default);
    Task<string?> GetFullImageAsync(string imagePath, int maxSize = 0, CancellationToken cancellationToken = default);
    Task<ImageFile> GetImageMetadataAsync(string imagePath, CancellationToken cancellationToken = default);
}
