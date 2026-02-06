namespace TagFusion.Models;

/// <summary>
/// Application settings
/// </summary>
public class Settings
{
    public WindowSize WindowSize { get; set; } = new();
    public string Theme { get; set; } = "dark";
    public string? LastFolder { get; set; }
    public int ThumbnailSize { get; set; } = 256;
    public int CacheMaxSizeMB { get; set; } = 500;
    public string StartBehavior { get; set; } = "empty"; // "empty" | "lastFolder" | "favorites"
    public List<string> FavoriteFolders { get; set; } = new();
    public List<string> RecentFolders { get; set; } = new();
}

public class WindowSize
{
    public int Width { get; set; } = 1400;
    public int Height { get; set; } = 900;
}

