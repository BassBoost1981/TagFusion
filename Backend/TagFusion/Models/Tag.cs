namespace TagFusion.Models;

/// <summary>
/// Represents a tag with usage statistics (immutable DTO)
/// </summary>
public record Tag
{
    public string Name { get; init; } = string.Empty;
    public int UsageCount { get; init; }
    public DateTime LastUsed { get; init; }
    public bool IsFavorite { get; init; }
}

