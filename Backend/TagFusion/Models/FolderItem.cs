namespace TagFusion.Models;

/// <summary>
/// Represents a folder or drive in the navigation tree (immutable DTO)
/// </summary>
public record FolderItem
{
    public string Path { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public FolderItemType Type { get; init; }
    public bool HasSubfolders { get; init; }
    public bool IsExpanded { get; init; }
    public List<FolderItem> Children { get; init; } = new();

    // Drive-specific properties
    public long TotalSize { get; init; }
    public long FreeSpace { get; init; }
    public string DriveFormat { get; init; } = string.Empty;
    public string DriveType { get; init; } = string.Empty;
}

public enum FolderItemType
{
    Drive,
    Folder,
    NetworkShare
}

