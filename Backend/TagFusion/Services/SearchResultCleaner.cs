using System.IO;
using TagFusion.Models;

namespace TagFusion.Services;

/// <summary>
/// Filters search results to files that still exist and decides which stale
/// DB entries are safe to delete. Files on unavailable roots (unplugged drives,
/// offline shares) are hidden from results but never deleted from the database.
/// Filtert Suchergebnisse auf existierende Dateien. Einträge auf nicht
/// verfügbaren Laufwerken werden nur ausgeblendet, nie gelöscht.
/// </summary>
public static class SearchResultCleaner
{
    public record CleanupResult(List<ImageFile> Visible, List<string> DeletablePaths);

    public static CleanupResult Partition(
        IReadOnlyList<ImageFile> results,
        Func<string, bool> isRootAvailable,
        Func<string, bool> fileExists)
    {
        var visible = new List<ImageFile>();
        var deletable = new List<string>();
        var rootCache = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);

        foreach (var image in results)
        {
            var root = Path.GetPathRoot(image.Path) ?? string.Empty;
            if (!rootCache.TryGetValue(root, out var available))
            {
                available = !string.IsNullOrEmpty(root) && isRootAvailable(root);
                rootCache[root] = available;
            }

            if (!available) continue;               // hide only / nur ausblenden
            if (fileExists(image.Path)) visible.Add(image);
            else deletable.Add(image.Path);         // root online, file gone → safe to delete
        }

        return new CleanupResult(visible, deletable);
    }

    /// <summary>
    /// Production root check: drive letters via DriveInfo.IsReady; UNC shares via
    /// Directory.Exists — both bounded to 2s (dead mapped drives and dead shares
    /// can otherwise block for the full SMB timeout, 10-30s).
    /// Produktions-Check: Laufwerke via IsReady, UNC-Shares via Directory.Exists —
    /// beide mit 2s-Schranke (tote gemappte Laufwerke/Shares blockieren sonst 10-30s).
    /// </summary>
    public static bool IsRootAvailable(string root)
    {
        try
        {
            var probe = root.StartsWith(@"\\", StringComparison.Ordinal)
                ? Task.Run(() => Directory.Exists(root))
                : Task.Run(() => new DriveInfo(root).IsReady);
            return probe.Wait(TimeSpan.FromSeconds(2)) && probe.Result;
        }
        catch
        {
            return false;
        }
    }
}
