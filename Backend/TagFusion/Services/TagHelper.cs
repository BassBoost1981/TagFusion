namespace TagFusion.Services;

/// <summary>
/// Shared tag utility methods to avoid code duplication across services and handlers.
/// Gemeinsame Tag-Hilfsmethoden um Code-Duplikation zu vermeiden.
/// </summary>
public static class TagHelper
{
    /// <summary>
    /// Deduplicate tags: strip control characters, trim whitespace, remove blanks,
    /// case-insensitive unique.
    /// </summary>
    public static List<string> DeduplicateTags(IEnumerable<string> tags)
    {
        return tags
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .Select(t => StripControlChars(t).Trim())
            .Where(t => t.Length > 0)
            .GroupBy(t => t, StringComparer.OrdinalIgnoreCase)
            .Select(g => g.First())
            .ToList();
    }

    /// <summary>
    /// Remove C0 control characters (incl. CR/LF) and DEL from a tag value.
    /// SECURITY: ExifTool runs in -stay_open -@ - mode where every argument is a separate
    /// stdin line. A tag containing a newline would break out of the "-Keywords=…"/"-XMP:Subject=…"
    /// argument and inject an arbitrary ExifTool argument line (e.g. -execute, -overwrite_original,
    /// -stay_open False) — argument injection. U+001F (the -sep tag separator) is in this range too,
    /// so stripping it also prevents separator collisions.
    /// SICHERHEIT: Verhindert Argument-Injection im -stay_open-Protokoll und Separator-Kollisionen.
    /// </summary>
    private static string StripControlChars(string tag)
        => tag.Any(c => c < 0x20 || c == 0x7F)
            ? new string(tag.Where(c => c >= 0x20 && c != 0x7F).ToArray())
            : tag;
}
