namespace TagFusion.Models;

/// <summary>
/// Represents an item in the main grid view - folder or file (immutable DTO)
/// </summary>
public record GridItem
{
    public string Path { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public bool IsFolder { get; init; }

    // Folder stats (only populated if IsFolder = true)
    public int SubfolderCount { get; init; }
    public int ImageCount { get; init; }
    public int VideoCount { get; init; }

    // Image data (only populated if IsFolder = false)
    public ImageFile? ImageData { get; init; }
}
