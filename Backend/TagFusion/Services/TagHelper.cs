namespace TagFusion.Services;

/// <summary>
/// Shared tag utility methods to avoid code duplication across services and handlers.
/// Gemeinsame Tag-Hilfsmethoden um Code-Duplikation zu vermeiden.
/// </summary>
public static class TagHelper
{
    /// <summary>
    /// Deduplicate tags: trim whitespace, remove blanks, case-insensitive unique.
    /// </summary>
    public static List<string> DeduplicateTags(IEnumerable<string> tags)
    {
        return tags
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .Select(t => t.Trim())
            .GroupBy(t => t, StringComparer.OrdinalIgnoreCase)
            .Select(g => g.First())
            .ToList();
    }
}
