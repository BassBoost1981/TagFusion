namespace TagFusion.Models;

/// <summary>
/// Represents an image file with its metadata
/// </summary>
public class ImageFile
{
    public string Path { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string Extension { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public DateTime DateModified { get; set; }
    public DateTime DateCreated { get; set; }
    public DateTime? DateTaken { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public List<string> Tags { get; set; } = new();
    public int Rating { get; set; }  // 0-5 star rating (XMP:Rating)
    public string? ThumbnailBase64 { get; set; }
    public string? ThumbnailUrl { get; set; }
    public bool IsSelected { get; set; }

    /// <summary>
    /// Create an ImageFile from a file path with tags and rating.
    /// Populates FileName, Extension, FileSize, DateModified from FileInfo.
    /// </summary>
    public static ImageFile FromPath(string path, List<string> tags, int rating)
    {
        var fileInfo = new System.IO.FileInfo(path);
        return new ImageFile
        {
            Path = path,
            FileName = fileInfo.Name,
            Extension = fileInfo.Extension.ToLowerInvariant(),
            FileSize = fileInfo.Length,
            DateModified = fileInfo.LastWriteTime,
            Tags = tags,
            Rating = rating
        };
    }
}

