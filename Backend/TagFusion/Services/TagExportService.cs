using System.IO;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using TagFusion.Database;
using TagFusion.Models;

namespace TagFusion.Services;

/// <summary>
/// Exports and imports image tags as CSV or JSON.
/// Exportiert und importiert Bild-Tags als CSV oder JSON.
/// </summary>
public class TagExportService
{
    private readonly IDatabaseService _databaseService;
    private readonly ExifToolService _exifToolService;
    private readonly ILogger<TagExportService> _logger;

    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public TagExportService(
        IDatabaseService databaseService,
        ExifToolService exifToolService,
        ILogger<TagExportService> logger)
    {
        _databaseService = databaseService;
        _exifToolService = exifToolService;
        _logger = logger;
    }

    /// <summary>
    /// Export tags for given image paths as JSON.
    /// </summary>
    public async Task<string> ExportTagsAsJsonAsync(string[] paths, CancellationToken ct = default)
    {
        var metadata = await _databaseService.GetMetadataForPathsAsync(paths.ToList(), ct);
        var entries = metadata.Select(kvp => new TagExportEntry
        {
            Path = kvp.Key,
            FileName = Path.GetFileName(kvp.Key),
            Tags = kvp.Value.Tags,
            Rating = kvp.Value.Rating
        }).ToList();

        return JsonSerializer.Serialize(entries, _jsonOptions);
    }

    /// <summary>
    /// Export tags for given image paths as CSV.
    /// Format: Path;Tags (comma-separated);Rating — all fields quoted per RFC 4180.
    /// Felder werden nach RFC 4180 gequotet, damit ; und " in Tags/Pfaden unterstützt werden.
    /// </summary>
    public async Task<string> ExportTagsAsCsvAsync(string[] paths, CancellationToken ct = default)
    {
        var metadata = await _databaseService.GetMetadataForPathsAsync(paths.ToList(), ct);
        var lines = new List<string> { "Path;Tags;Rating" };

        foreach (var kvp in metadata)
        {
            var tagsStr = string.Join(",", kvp.Value.Tags);
            lines.Add($"{CsvQuote(kvp.Key)};{CsvQuote(tagsStr)};{kvp.Value.Rating}");
        }

        return string.Join("\n", lines);
    }

    /// <summary>RFC 4180 CSV quoting — wraps value in double quotes and escapes embedded quotes.</summary>
    private static string CsvQuote(string value) =>
        "\"" + (value ?? string.Empty).Replace("\"", "\"\"") + "\"";

    /// <summary>
    /// Split a CSV line respecting RFC 4180 quoting rules.
    /// Leerzeichen/Semikolons innerhalb von " " werden korrekt als Feld-Inhalt erkannt.
    /// </summary>
    private static List<string> ParseCsvLine(string line, char delimiter)
    {
        var result = new List<string>();
        var current = new System.Text.StringBuilder();
        var inQuotes = false;

        for (int i = 0; i < line.Length; i++)
        {
            var c = line[i];
            if (inQuotes)
            {
                if (c == '"')
                {
                    if (i + 1 < line.Length && line[i + 1] == '"')
                    {
                        current.Append('"');
                        i++;
                    }
                    else
                    {
                        inQuotes = false;
                    }
                }
                else
                {
                    current.Append(c);
                }
            }
            else if (c == '"')
            {
                inQuotes = true;
            }
            else if (c == delimiter)
            {
                result.Add(current.ToString());
                current.Clear();
            }
            else
            {
                current.Append(c);
            }
        }

        result.Add(current.ToString());
        return result;
    }

    /// <summary>
    /// Import tags from JSON string and write to images via ExifTool.
    /// </summary>
    public async Task<Dictionary<string, bool>> ImportTagsFromJsonAsync(string json, CancellationToken ct = default)
    {
        var entries = JsonSerializer.Deserialize<List<TagExportEntry>>(json, _jsonOptions);
        if (entries == null || entries.Count == 0)
            return new Dictionary<string, bool>();

        return await ApplyImportedTagsAsync(entries, ct);
    }

    /// <summary>
    /// Import tags from CSV string and write to images via ExifTool.
    /// Format: Path;Tags (comma-separated);Rating
    /// </summary>
    /// <summary>
    /// Write per-image XMP sidecar files (e.g. for RAW formats that can't be written inline).
    /// Uses ExifTool to copy all metadata into a `<image>.xmp` file next to each source.
    /// XMP-Sidecar-Dateien schreiben — nuetzlich fuer RAW-Formate ohne inline-Schreibschutz.
    /// </summary>
    public async Task<Dictionary<string, bool>> ExportTagsAsXmpSidecarsAsync(string[] paths, CancellationToken ct = default)
    {
        var results = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
        foreach (var path in paths)
        {
            ct.ThrowIfCancellationRequested();
            if (!File.Exists(path))
            {
                results[path] = false;
                continue;
            }

            try
            {
                // Use full filename + ".xmp" (e.g. IMG_0001.NEF.xmp) instead of
                // Path.ChangeExtension which would map IMG_0001.NEF and IMG_0001.JPG
                // both to IMG_0001.xmp — colliding for the canonical RAW+JPG pair.
                // This convention matches darktable, digiKam, and ExifTool itself for
                // mixed-format folders.
                // Volle Dateinamen-Variante — RAW+JPG-Paare kollidieren sonst auf
                // einem gemeinsamen photo.xmp.
                var xmpPath = path + ".xmp";

                var psi = new System.Diagnostics.ProcessStartInfo
                {
                    FileName = _exifToolService.ExifToolPath,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                };
                psi.ArgumentList.Add("-tagsfromfile");
                psi.ArgumentList.Add(path);
                psi.ArgumentList.Add("-all:all");
                // Force overwrite: if the user re-exports, refresh the existing sidecar
                // rather than failing silently with a non-zero exit.
                psi.ArgumentList.Add("-overwrite_original");
                psi.ArgumentList.Add("-o");
                psi.ArgumentList.Add(xmpPath);

                using var proc = System.Diagnostics.Process.Start(psi)!;
                await proc.WaitForExitAsync(ct);
                results[path] = proc.ExitCode == 0 && File.Exists(xmpPath);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "XMP sidecar export failed for {Path}", path);
                results[path] = false;
            }
        }
        return results;
    }

    public async Task<Dictionary<string, bool>> ImportTagsFromCsvAsync(string csv, CancellationToken ct = default)
    {
        var lines = csv.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var entries = new List<TagExportEntry>();

        // Skip header line. Use RFC 4180 quoting so tags containing the ; delimiter
        // and paths containing " survive round-trip.
        // RFC 4180: Felder können in "..." gequotet sein; doppelte "" sind escapte Quotes.
        foreach (var line in lines.Skip(1))
        {
            var parts = ParseCsvLine(line, ';');
            if (parts.Count < 2) continue;

            var path = parts[0].Trim();
            var tags = parts[1].Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
            var rating = parts.Count >= 3 && int.TryParse(parts[2].Trim(), out var r) ? r : 0;

            entries.Add(new TagExportEntry { Path = path, FileName = Path.GetFileName(path), Tags = tags, Rating = rating });
        }

        return await ApplyImportedTagsAsync(entries, ct);
    }

    private async Task<Dictionary<string, bool>> ApplyImportedTagsAsync(List<TagExportEntry> entries, CancellationToken ct)
    {
        var results = new Dictionary<string, bool>();

        foreach (var entry in entries)
        {
            ct.ThrowIfCancellationRequested();
            try
            {
                // Security: paths come from an untrusted import file (CSV/JSON), so a crafted
                // entry could point at an arbitrary absolute path (path traversal / system dirs).
                // Skip anything that is not a safe, existing image file before writing metadata.
                // Sicherheit: Pfade stammen aus einer ungeprueften Importdatei.
                if (!IsImportPathSafe(entry.Path))
                {
                    results[entry.Path] = false;
                    _logger.LogWarning("TagImport: Skipped unsafe or missing path {Path}", entry.Path);
                    continue;
                }

                var success = await _exifToolService.WriteTagsAsync(entry.Path, entry.Tags);
                if (success && entry.Rating > 0)
                {
                    await _exifToolService.WriteRatingAsync(entry.Path, entry.Rating);
                }

                if (success)
                {
                    var fileInfo = new FileInfo(entry.Path);
                    var image = new ImageFile
                    {
                        Path = entry.Path,
                        FileName = fileInfo.Name,
                        Extension = fileInfo.Extension.ToLowerInvariant(),
                        FileSize = fileInfo.Length,
                        DateModified = fileInfo.LastWriteTime,
                        Tags = entry.Tags,
                        Rating = entry.Rating
                    };
                    await _databaseService.SaveImageAsync(image, ct);
                }

                results[entry.Path] = success;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "TagImport: Failed for {Path}", entry.Path);
                results[entry.Path] = false;
            }
        }

        return results;
    }

    /// <summary>
    /// Validates an imported target path before writing metadata to it.
    /// Mirrors the system-directory protection FileOperationService enforces for copy/move/delete:
    /// rejects blank/control-char/non-rooted paths, non-existent files, and Windows system directories.
    /// Prueft einen Importpfad, bevor Metadaten geschrieben werden (gleiche Schutzlogik wie Dateioperationen).
    /// </summary>
    private bool IsImportPathSafe(string path)
    {
        if (string.IsNullOrWhiteSpace(path))
            return false;

        // Reject null bytes and control characters (same rule as FileOperationService.ValidatePath).
        if (path.Any(c => c < 0x20 && c != '\t'))
            return false;

        string fullPath;
        try
        {
            // Require a fully-qualified path and normalize it before the system-directory check.
            if (!Path.IsPathRooted(path))
                return false;
            fullPath = Path.GetFullPath(path);
        }
        catch (Exception ex) when (ex is ArgumentException or NotSupportedException or PathTooLongException)
        {
            return false;
        }

        if (!File.Exists(fullPath))
            return false;

        // Block writes into Windows system directories (Windows, Program Files, Program Files (x86)).
        var systemRoot = Environment.GetFolderPath(Environment.SpecialFolder.Windows);
        var programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        var programFilesX86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);

        string[] blockedRoots = [systemRoot, programFiles, programFilesX86];
        foreach (var blocked in blockedRoots)
        {
            if (!string.IsNullOrEmpty(blocked) &&
                fullPath.StartsWith(blocked, StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }
        }

        return true;
    }
}

/// <summary>
/// Data model for tag export/import entries.
/// </summary>
public class TagExportEntry
{
    public string Path { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public List<string> Tags { get; set; } = new();
    public int Rating { get; set; }
}
