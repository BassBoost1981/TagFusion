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
    /// Format: Path,Tags (semicolon-separated),Rating
    /// </summary>
    public async Task<string> ExportTagsAsCsvAsync(string[] paths, CancellationToken ct = default)
    {
        var metadata = await _databaseService.GetMetadataForPathsAsync(paths.ToList(), ct);
        var lines = new List<string> { "Path;Tags;Rating" };

        foreach (var kvp in metadata)
        {
            var tagsStr = string.Join(",", kvp.Value.Tags);
            lines.Add($"{kvp.Key};{tagsStr};{kvp.Value.Rating}");
        }

        return string.Join("\n", lines);
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
    public async Task<Dictionary<string, bool>> ImportTagsFromCsvAsync(string csv, CancellationToken ct = default)
    {
        var lines = csv.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var entries = new List<TagExportEntry>();

        // Skip header line
        foreach (var line in lines.Skip(1))
        {
            var parts = line.Split(';', 3);
            if (parts.Length < 2) continue;

            var path = parts[0].Trim();
            var tags = parts[1].Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
            var rating = parts.Length >= 3 && int.TryParse(parts[2].Trim(), out var r) ? r : 0;

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
                if (!File.Exists(entry.Path))
                {
                    results[entry.Path] = false;
                    _logger.LogWarning("TagImport: File not found {Path}", entry.Path);
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
