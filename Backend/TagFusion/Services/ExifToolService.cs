using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using TagFusion.Configuration;
using TagFusion.Models;

namespace TagFusion.Services;

/// <summary>
/// Wrapper for ExifTool to read and write image metadata.
/// Uses -stay_open mode for persistent process (5-10x faster).
/// </summary>
public class ExifToolService : IExifToolService, IDisposable
{
    private readonly string _exifToolPath;
    private readonly IThumbnailService _thumbnailService;
    private readonly ILogger<ExifToolService> _logger;
    private readonly IFileBackupService _backupService;
    private readonly int _batchSize;
    private readonly int _maxImageSize;
    private readonly int _processStopTimeoutMs;
    private readonly int _readTimeoutMs;
    private Process? _exifToolProcess;
    private StreamWriter? _commandWriter;
    private StreamReader? _outputReader;
    private readonly SemaphoreSlim _semaphore = new(1, 1);
    private bool _disposed;

    /// <summary>
    /// Extra read-timeout budget per argument (mostly file paths in batch calls), so a
    /// 500-file batch on a slow drive does not hit the fixed base timeout.
    /// Zusatz-Timeout pro Argument, damit grosse Batches nicht ins Basis-Timeout laufen.
    /// </summary>
    internal const int PerArgTimeoutMs = 100;

    /// <summary>
    /// Separator passed to ExifTool's -sep option to split a tag list into individual
    /// Keywords/Subject entries. Uses the ASCII Unit Separator (U+001F) because it cannot
    /// be typed into a tag, so a user tag can never accidentally be split (the old ";;"
    /// collided with tags that legitimately contained semicolons).
    /// ASCII Unit Separator (U+001F) — kollisionssicher, da nicht eingebbar.
    /// </summary>
    internal const string TagSeparator = "\u001F";

    public string ExifToolPath => _exifToolPath;

    public ExifToolService(
        IThumbnailService thumbnailService,
        ILogger<ExifToolService> logger,
        IOptions<ExifToolSettings> options,
        IFileBackupService? backupService = null)
    {
        _thumbnailService = thumbnailService;
        _logger = logger;
        _backupService = backupService ?? NoopFileBackupService.Instance;
        var settings = options.Value;
        _batchSize = settings.BatchSize;
        _maxImageSize = settings.MaxImageSize;
        _processStopTimeoutMs = settings.ProcessStopTimeoutMs;
        _readTimeoutMs = settings.ReadTimeoutMs;

        // === PERF: Try cached path first, then search ===
        // Zuerst gecachten Pfad prüfen, dann suchen
        var appDir = AppContext.BaseDirectory ?? string.Empty;
        var cacheFile = Path.Combine(appDir, ".exiftool_path");

        // Try cached path from previous run
        if (File.Exists(cacheFile))
        {
            var cached = File.ReadAllText(cacheFile).Trim();
            if (File.Exists(cached))
            {
                _exifToolPath = cached;
                _logger.LogInformation("ExifTool path (cached): {ExifToolPath}", _exifToolPath);
                return;
            }
        }

        // Fallback: search for exiftool.exe
        var possiblePaths = new[]
        {
            Path.Combine(appDir, "Tools", "exiftool.exe"),
            Path.Combine(appDir, "exiftool.exe"),
            Path.Combine(appDir, "..", "..", "..", "..", "..", "Tools", "exiftool.exe"),
            Path.Combine(appDir, "..", "..", "..", "..", "Tools", "exiftool.exe"),
        };

        _exifToolPath = possiblePaths.FirstOrDefault(File.Exists)
            ?? throw new FileNotFoundException($"ExifTool not found. Searched in: {string.Join(", ", possiblePaths.Select(Path.GetFullPath))}");

        _exifToolPath = Path.GetFullPath(_exifToolPath);

        // Cache for next startup
        try { File.WriteAllText(cacheFile, _exifToolPath); } catch { /* non-critical */ }
        _logger.LogInformation("ExifTool path: {ExifToolPath}", _exifToolPath);
    }

    /// <summary>
    /// Ensures the persistent ExifTool process is running
    /// </summary>
    /// <summary>
    /// Ensures the persistent ExifTool process is running.
    /// Must be called while _semaphore is held.
    /// </summary>
    private void EnsureProcessRunning()
    {
        if (_exifToolProcess != null && !_exifToolProcess.HasExited)
            return;

        // Clean up old process if exists
        _exifToolProcess?.Dispose();

        _exifToolProcess = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = _exifToolPath,
                Arguments = "-stay_open True -@ -",
                RedirectStandardInput = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
                StandardOutputEncoding = Encoding.UTF8,
                StandardErrorEncoding = Encoding.UTF8
            }
        };

        _exifToolProcess.Start();
        _commandWriter = _exifToolProcess.StandardInput;
        _outputReader = _exifToolProcess.StandardOutput;

        // Read stderr in background to prevent buffer deadlock and capture errors
        _exifToolProcess.ErrorDataReceived += (_, args) =>
        {
            if (!string.IsNullOrEmpty(args.Data))
            {
                _logger.LogWarning("[stderr] {StderrData}", args.Data);
            }
        };
        _exifToolProcess.BeginErrorReadLine();

        _logger.LogInformation("ExifTool persistent process started");
    }


    /// <summary>
    /// Read tags from an image file
    /// </summary>
    public async Task<List<string>> ReadTagsAsync(string imagePath, CancellationToken cancellationToken = default)
    {
        if (!File.Exists(imagePath))
            throw new FileNotFoundException($"Image not found: {imagePath}");

        var args = new List<string> { "-Keywords", "-XMP:Subject", "-j", imagePath };
        var output = await RunExifToolAsync(args, cancellationToken);

        try
        {
            using var doc = JsonDocument.Parse(output);
            var results = doc.RootElement;
            if (results.GetArrayLength() == 0)
                return new List<string>();

            return ParseTagsFromJson(results[0]).ToList();
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "Failed to parse tags JSON");
            return new List<string>();
        }
    }

    /// <summary>
    /// Write tags to an image file (IPTC Keywords + XMP Subject)
    /// </summary>
    public async Task<bool> WriteTagsAsync(string imagePath, List<string> tags, CancellationToken cancellationToken = default)
    {
        if (!File.Exists(imagePath))
            throw new FileNotFoundException($"Image not found: {imagePath}");

        _logger.LogDebug("WriteTagsAsync called for: {ImagePath}", imagePath);
        _logger.LogDebug("Tags to write: [{Tags}]", string.Join(", ", tags));

        var (uniqueTags, args) = BuildWriteTagArgs(tags, imagePath);

        if (uniqueTags.Count != tags.Count)
            _logger.LogDebug("Deduplicated tags: {Original} → {Unique}", tags.Count, uniqueTags.Count);

        _logger.LogDebug("Sending {ArgCount} args directly to ExifTool", args.Count);

        var output = await RunExifToolAsync(args, cancellationToken);
        _logger.LogDebug("WriteTagsAsync output: '{Output}'", output.Trim());

        // Check for errors in output (warnings are often harmless, only throw on actual errors)
        if (OutputIndicatesError(output))
        {
            _logger.LogError("WriteTagsAsync ERROR detected in output");
            throw new InvalidOperationException($"ExifTool error: {output}");
        }

        // Log warnings but don't fail
        if (output.Contains("Warning", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("WriteTagsAsync non-fatal warning: {Output}", output.Trim());
        }

        // Check if file was updated (ExifTool reports "1 image files updated")
        if (!output.Contains("1 image files updated", StringComparison.OrdinalIgnoreCase) &&
            !output.Contains("1 image file updated", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("WriteTagsAsync - No 'image files updated' confirmation found in output");
        }

        return true;
    }

    /// <summary>
    /// Write the same tag set to many files in one ExifTool invocation.
    /// 3-5x faster than calling WriteTagsAsync per file because the persistent
    /// process only needs one round-trip for the whole batch.
    /// </summary>
    public async Task<Dictionary<string, bool>> WriteTagsBatchAsync(IEnumerable<string> imagePaths, List<string> tags, CancellationToken cancellationToken = default)
    {
        var result = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
        var pathList = imagePaths.Where(File.Exists).ToList();
        if (pathList.Count == 0) return result;

        var uniqueTags = TagHelper.DeduplicateTags(tags);

        // Process in chunks to stay under any latent command-line / pipe limits even
        // though -stay_open uses pipes (no Win32 8K argv limit).
        var chunkSize = Math.Max(1, _batchSize);
        for (int i = 0; i < pathList.Count; i += chunkSize)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var chunk = pathList.GetRange(i, Math.Min(chunkSize, pathList.Count - i));

            var args = new List<string>();
            if (uniqueTags.Count == 0)
            {
                args.Add("-Keywords=");
                args.Add("-XMP:Subject=");
            }
            else
            {
                args.Add("-sep");
                args.Add(TagSeparator);
                args.Add($"-Keywords={string.Join(TagSeparator, uniqueTags)}");
                args.Add($"-XMP:Subject={string.Join(TagSeparator, uniqueTags)}");
            }
            args.Add("-overwrite_original");
            args.AddRange(chunk);

            try
            {
                // FIX #7: Back up each file individually (best-effort).
                // A backup failure for one file must not abort the ExifTool write for
                // the rest of the chunk — log a warning and continue.
                // Backup pro Datei einzeln und tolerant: ein Backup-Fehler darf den
                // ExifTool-Schreibvorgang der restlichen Dateien nicht blockieren.
                foreach (var path in chunk)
                {
                    try
                    {
                        await _backupService.CreateBackupAsync(path, "metadata-tags-batch-write", cancellationToken);
                    }
                    catch (OperationCanceledException)
                    {
                        throw; // always propagate cancellation
                    }
                    catch (Exception backupEx)
                    {
                        _logger.LogWarning(backupEx,
                            "WriteTagsBatchAsync: backup skipped for '{Path}' — write will proceed without backup / " +
                            "Backup uebersprungen fuer '{Path2}', Schreibvorgang wird ohne Backup fortgesetzt",
                            path, path);
                    }
                }

                var output = await RunExifToolAsync(args, cancellationToken);

                // ExifTool processes each file independently and continues past per-file
                // errors. Attribute errors per-path by EXACT normalized-path matching
                // against the filepath token in each "Error:" line.
                // Per-Datei-Fehler werden per exaktem Pfadvergleich zugeordnet — Teilstring-
                // Treffer koennen bei aehnlichen Pfaden zu Fehlzuordnungen fuehren.
                //
                // FIX #8: Use exact path equality (Path.GetFullPath + OrdinalIgnoreCase)
                // instead of substring containment. ExifTool error lines have the format
                //   Error: <message> - <filepath>
                // so we split on " - " and compare the trailing token with the normalized
                // chunk paths. This prevents a path that is a prefix of another from being
                // mis-attributed (e.g. C:\a\1.jpg matching C:\a\10.jpg).
                // Exakter Pfadvergleich statt Substring-Suche, um Fehlzuordnungen bei
                // aehnlichen Pfadnamen zu vermeiden.
                var normalizedChunkPaths = chunk
                    .ToDictionary(
                        p => Path.GetFullPath(p),
                        p => p,
                        StringComparer.OrdinalIgnoreCase);

                var failedPaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var line in output.Split('\n'))
                {
                    if (!LineIndicatesError(line)) continue;

                    // Extract the filepath token from "Error: <message> - <filepath>"
                    // If the line has no " - " separator (global/unattributable error),
                    // we cannot attribute it to a specific file — skip attribution here
                    // (the chunk-level catch handles fully fatal errors).
                    var separatorIndex = line.IndexOf(" - ", StringComparison.Ordinal);
                    if (separatorIndex < 0) continue;

                    var errorPath = line[(separatorIndex + 3)..].Trim();
                    if (string.IsNullOrEmpty(errorPath)) continue;

                    string normalizedError;
                    try { normalizedError = Path.GetFullPath(errorPath); }
                    catch { continue; } // malformed path in ExifTool output — skip

                    if (normalizedChunkPaths.TryGetValue(normalizedError, out var matchedPath))
                        failedPaths.Add(matchedPath);
                }

                foreach (var path in chunk)
                    result[path] = !failedPaths.Contains(path);

                if (failedPaths.Count > 0)
                    _logger.LogWarning("WriteTagsBatchAsync: {FailCount}/{ChunkSize} files failed in chunk: {Output}",
                        failedPaths.Count, chunk.Count, output.Trim());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "WriteTagsBatchAsync chunk failed for {Count} files", chunk.Count);
                foreach (var path in chunk)
                    result[path] = false;
            }
        }

        // Files that didn't exist on disk → false
        foreach (var path in imagePaths)
            result.TryAdd(path, false);

        return result;
    }

    /// <summary>
    /// Read rating from an image file (XMP:Rating, 0-5)
    /// </summary>
    public async Task<int> ReadRatingAsync(string imagePath, CancellationToken cancellationToken = default)
    {
        if (!File.Exists(imagePath))
            throw new FileNotFoundException($"Image not found: {imagePath}");

        var args = new List<string> { "-XMP:Rating", "-j", imagePath };
        var output = await RunExifToolAsync(args, cancellationToken);

        try
        {
            using var doc = JsonDocument.Parse(output);
            var results = doc.RootElement;
            if (results.GetArrayLength() == 0)
                return 0;

            if (results[0].TryGetProperty("Rating", out var ratingProp) && ratingProp.ValueKind == JsonValueKind.Number)
            {
                return Math.Clamp(ratingProp.GetInt32(), 0, 5);
            }
            return 0;
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "Failed to parse rating JSON");
            return 0;
        }
    }

    /// <summary>
    /// Batch read metadata (tags + rating) for multiple images with a single ExifTool call
    /// </summary>
    public async Task<Dictionary<string, (List<string> Tags, int Rating)>> ReadBatchMetadataAsync(List<string> imagePaths, CancellationToken cancellationToken = default)
    {
        var result = new Dictionary<string, (List<string> Tags, int Rating)>(StringComparer.OrdinalIgnoreCase);

        if (imagePaths.Count == 0)
            return result;

        // Process in batches to avoid command line length limits
        var batchSize = _batchSize;
        var batches = imagePaths
            .Select((path, index) => new { path, index })
            .GroupBy(x => x.index / batchSize)
            .Select(g => g.Select(x => x.path).ToList())
            .ToList();

        foreach (var batch in batches)
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                // Build argument list directly — avoids the string→parse round-trip
                // which broke on paths containing quotes or special chars.
                // Argumentliste direkt erstellen — vermeidet String-Parse-Umweg.
                var args = new List<string> { "-Keywords", "-XMP:Subject", "-XMP:Rating", "-j" };
                args.AddRange(batch);

                var output = await RunExifToolAsync(args, cancellationToken);

                using var doc = JsonDocument.Parse(output);
                var results = doc.RootElement;

                foreach (var item in results.EnumerateArray())
                {
                    if (!item.TryGetProperty("SourceFile", out var sourceFileProp))
                        continue;
                    var sourcePath = sourceFileProp.GetString();
                    if (string.IsNullOrEmpty(sourcePath))
                        continue;

                    // Normalize path (ExifTool may use forward slashes)
                    sourcePath = Path.GetFullPath(sourcePath);

                    var tags = ParseTagsFromJson(item);

                    var rating = 0;
                    if (item.TryGetProperty("Rating", out var ratingProp) && ratingProp.ValueKind == JsonValueKind.Number)
                        rating = Math.Clamp(ratingProp.GetInt32(), 0, 5);

                    result[sourcePath] = (tags.ToList(), rating);
                }
            }
            catch (JsonException ex)
            {
                _logger.LogWarning(ex, "Failed to parse batch metadata");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to read batch metadata");
            }
        }

        return result;
    }

    /// <summary>
    /// Read MWG descriptions for many files in one batched call; only non-empty
    /// entries are returned. Liest MWG-Beschreibungen gebatcht; nur nicht-leere.
    /// </summary>
    public async Task<Dictionary<string, string>> ReadDescriptionsBatchAsync(List<string> imagePaths, CancellationToken cancellationToken = default)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        if (imagePaths.Count == 0)
            return result;

        // Process in batches to avoid command line length limits
        var batchSize = _batchSize;
        var batches = imagePaths
            .Select((path, index) => new { path, index })
            .GroupBy(x => x.index / batchSize)
            .Select(g => g.Select(x => x.path).ToList())
            .ToList();

        foreach (var batch in batches)
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                var args = new List<string> { "-MWG:Description", "-j" };
                args.AddRange(batch);

                var output = await RunExifToolAsync(args, cancellationToken);

                foreach (var (path, text) in ParseDescriptionsFromJson(output))
                    result[path] = text;
            }
            catch (JsonException ex)
            {
                _logger.LogWarning(ex, "Failed to parse batch descriptions");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to read batch descriptions");
            }
        }

        return result;
    }

    /// <summary>
    /// Write the description via the MWG composite tag (keeps XMP/IPTC/EXIF in sync).
    /// Schreibt die Beschreibung über das MWG-Komposit (XMP/IPTC/EXIF konsistent).
    /// </summary>
    public async Task<bool> WriteDescriptionAsync(string imagePath, string description, CancellationToken cancellationToken = default)
    {
        if (!File.Exists(imagePath))
            throw new FileNotFoundException($"Image not found: {imagePath}");

        _logger.LogDebug("WriteDescriptionAsync called for: {ImagePath}", imagePath);

        // Backup is best-effort: a backup failure must not block the metadata write
        // (same policy as WriteTagsBatchAsync). Cancellation always propagates.
        // Backup ist tolerant — ein Backup-Fehler blockiert den Schreibvorgang nicht.
        try
        {
            await _backupService.CreateBackupAsync(imagePath, "metadata-description-write", cancellationToken);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception backupEx)
        {
            _logger.LogWarning(backupEx,
                "WriteDescriptionAsync: backup skipped for '{Path}' — write will proceed without backup / " +
                "Backup uebersprungen fuer '{Path2}', Schreibvorgang wird ohne Backup fortgesetzt",
                imagePath, imagePath);
        }

        var args = BuildWriteDescriptionArgs(imagePath, description);

        var output = await RunExifToolAsync(args, cancellationToken);
        _logger.LogDebug("WriteDescriptionAsync output: '{Output}'", output.Trim());

        // Check for errors in output (warnings are often harmless, only throw on actual errors)
        if (OutputIndicatesError(output))
        {
            _logger.LogError("WriteDescriptionAsync ERROR detected in output");
            throw new InvalidOperationException($"ExifTool error: {output}");
        }

        // Log warnings but don't fail
        if (output.Contains("Warning", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("WriteDescriptionAsync non-fatal warning: {Output}", output.Trim());
        }

        // Check if file was updated (ExifTool reports "1 image files updated")
        if (!output.Contains("1 image files updated", StringComparison.OrdinalIgnoreCase) &&
            !output.Contains("1 image file updated", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("WriteDescriptionAsync - No 'image files updated' confirmation found in output");
        }

        return true;
    }

    /// <summary>
    /// Write rating to an image file (XMP:Rating, 0-5)
    /// </summary>
    public async Task<bool> WriteRatingAsync(string imagePath, int rating, CancellationToken cancellationToken = default)
    {
        if (!File.Exists(imagePath))
            throw new FileNotFoundException($"Image not found: {imagePath}");

        rating = Math.Clamp(rating, 0, 5);

        _logger.LogDebug("WriteRatingAsync called for: {ImagePath}, rating: {Rating}", imagePath, rating);

        var args = new List<string> { $"-XMP:Rating={rating}", "-overwrite_original", imagePath };
        _logger.LogDebug("Command args: {Args}", string.Join(" ", args));

        var output = await RunExifToolAsync(args, cancellationToken);
        _logger.LogDebug("WriteRatingAsync output: '{Output}'", output.Trim());
        
        // Check for errors in output
        if (OutputIndicatesError(output))
        {
            _logger.LogError("WriteRatingAsync ERROR detected in output");
            throw new InvalidOperationException($"ExifTool error: {output}");
        }
        
        return true;
    }

    /// <summary>
    /// Get thumbnail from image (embedded or generated)
    /// </summary>
    public async Task<string?> GetThumbnailAsync(string imagePath, CancellationToken cancellationToken = default)
    {
        return await _thumbnailService.GetThumbnailAsync(imagePath, _exifToolPath, cancellationToken);
    }

    /// <summary>
    /// Get multiple thumbnails in batch (parallel loading)
    /// </summary>
    public async Task<Dictionary<string, string?>> GetThumbnailsBatchAsync(string[] imagePaths, CancellationToken cancellationToken = default)
    {
        return await _thumbnailService.GetThumbnailsBatchAsync(imagePaths, _exifToolPath, cancellationToken: cancellationToken);
    }

    /// <summary>
    /// Get full resolution image scaled for lightbox viewing
    /// </summary>
    public async Task<string?> GetFullImageAsync(string imagePath, int maxSize = 0, CancellationToken cancellationToken = default)
    {
        if (maxSize <= 0) maxSize = _maxImageSize;
        return await _thumbnailService.GetFullImageAsync(imagePath, maxSize, cancellationToken);
    }

    /// <summary>
    /// Get detailed metadata from an image.
    /// Uses a single ExifTool call for tags, rating, dimensions, and date taken.
    /// Liest alle Metadaten (Tags, Bewertung, Abmessungen, Aufnahmedatum) mit einem einzigen ExifTool-Aufruf.
    /// </summary>
    public async Task<ImageFile> GetImageMetadataAsync(string imagePath, CancellationToken cancellationToken = default)
    {
        var fileInfo = new FileInfo(imagePath);
        var image = new ImageFile
        {
            Path = imagePath,
            FileName = fileInfo.Name,
            Extension = fileInfo.Extension.ToLowerInvariant(),
            FileSize = fileInfo.Length,
            DateModified = fileInfo.LastWriteTime
        };

        // Single ExifTool call for ALL metadata (previously 3 separate calls)
        // Ein einziger ExifTool-Aufruf fuer ALLE Metadaten (vorher 3 separate Aufrufe)
        var metadata = await ReadFullMetadataAsync(imagePath, cancellationToken);

        image.Tags = metadata.Tags;
        image.Rating = metadata.Rating;
        image.Width = metadata.Width;
        image.Height = metadata.Height;
        image.DateTaken = metadata.DateTaken;

        return image;
    }

    /// <summary>
    /// Read all metadata fields with a SINGLE ExifTool call: tags, rating, dimensions, date taken.
    /// Replaces the previous approach of 3 separate calls (ReadTags + ReadRating + dimensions).
    /// Liest alle Metadaten-Felder mit EINEM ExifTool-Aufruf: Tags, Bewertung, Abmessungen, Aufnahmedatum.
    /// Ersetzt den bisherigen Ansatz mit 3 separaten Aufrufen.
    /// </summary>
    private async Task<(List<string> Tags, int Rating, int Width, int Height, DateTime? DateTaken)> ReadFullMetadataAsync(
        string imagePath, CancellationToken cancellationToken = default)
    {
        if (!File.Exists(imagePath))
            throw new FileNotFoundException($"Image not found: {imagePath}");

        // Combined args: tags + rating + dimensions + date in one call
        // Kombinierte Argumente: Tags + Bewertung + Abmessungen + Datum in einem Aufruf
        var args = new List<string>
        {
            "-Keywords", "-XMP:Subject", "-XMP:Rating",
            "-ImageWidth", "-ImageHeight", "-DateTimeOriginal", "-j", imagePath
        };
        var output = await RunExifToolAsync(args, cancellationToken);

        var tags = new List<string>();
        var rating = 0;
        var width = 0;
        var height = 0;
        DateTime? dateTaken = null;

        try
        {
            using var doc = JsonDocument.Parse(output);
            var results = doc.RootElement;
            if (results.GetArrayLength() == 0)
                return (tags, rating, width, height, dateTaken);

            var data = results[0];

            // === Parse tags (IPTC Keywords + XMP Subject) ===
            tags = ParseTagsFromJson(data).ToList();

            // === Parse rating (XMP:Rating, clamped 0-5) ===
            // Bewertung auslesen (XMP:Rating, begrenzt auf 0-5)
            if (data.TryGetProperty("Rating", out var ratingProp) && ratingProp.ValueKind == JsonValueKind.Number)
                rating = Math.Clamp(ratingProp.GetInt32(), 0, 5);

            // === Parse dimensions ===
            // Abmessungen auslesen
            if (data.TryGetProperty("ImageWidth", out var widthProp) && widthProp.ValueKind == JsonValueKind.Number)
                width = widthProp.GetInt32();
            if (data.TryGetProperty("ImageHeight", out var heightProp) && heightProp.ValueKind == JsonValueKind.Number)
                height = heightProp.GetInt32();

            // === Parse date taken ===
            // Aufnahmedatum auslesen
            if (data.TryGetProperty("DateTimeOriginal", out var dateProp) && dateProp.ValueKind == JsonValueKind.String)
            {
                var dateStr = dateProp.GetString();
                if (!string.IsNullOrEmpty(dateStr) && DateTime.TryParse(dateStr, out var dt))
                    dateTaken = dt;
            }
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "Failed to parse full metadata JSON for {ImagePath} / " +
                "JSON-Parsing der vollstaendigen Metadaten fehlgeschlagen fuer {ImagePath2}", imagePath, imagePath);
        }

        return (tags, rating, width, height, dateTaken);
    }

    /// <summary>
    /// Run ExifTool with pre-parsed arguments (no string→parse round-trip).
    /// Sends each argument on its own line, writes -execute, then reads until {ready}.
    /// </summary>
    private async Task<string> RunExifToolAsync(List<string> args, CancellationToken cancellationToken = default)
    {
        EnsureNoLineBreaks(args);

        await _semaphore.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            EnsureProcessRunning();

            if (_commandWriter == null || _outputReader == null)
                throw new InvalidOperationException("ExifTool process not initialized");

            _logger.LogDebug("RunExifToolAsync: Sending {ArgCount} arguments", args.Count);
            foreach (var arg in args)
            {
                _logger.LogDebug("  > {Arg}", arg);
                await _commandWriter.WriteLineAsync(arg.AsMemory(), cancellationToken).ConfigureAwait(false);
            }
            await _commandWriter.WriteLineAsync("-execute".AsMemory(), cancellationToken).ConfigureAwait(false);
            await _commandWriter.FlushAsync(cancellationToken).ConfigureAwait(false);

            // Read output until {ready} — with timeout to prevent hanging on stuck process.
            // The timeout scales with the argument count: a 500-file batch on a slow
            // HDD/network drive can legitimately exceed the base timeout.
            // Timeout skaliert mit der Argumentanzahl — grosse Batches brauchen laenger.
            var effectiveTimeoutMs = _readTimeoutMs > 0 ? _readTimeoutMs + args.Count * PerArgTimeoutMs : 0;
            using var readCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            if (effectiveTimeoutMs > 0)
                readCts.CancelAfter(effectiveTimeoutMs);

            var sb = new StringBuilder();
            string? line;
            try
            {
                while ((line = await _outputReader.ReadLineAsync(readCts.Token).ConfigureAwait(false)) != null)
                {
                    if (line.Trim() == "{ready}")
                        break;
                    sb.AppendLine(line);
                }
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                _logger.LogError("ExifTool read timeout after {TimeoutMs}ms — killing process", effectiveTimeoutMs);
                ResetProcessState();
                throw new TimeoutException($"ExifTool did not respond within {effectiveTimeoutMs}ms");
            }
            var output = sb.ToString();
            _logger.LogDebug("RunExifToolAsync: Output received: '{Output}'", output.Trim());

            return output;
        }
        finally
        {
            _semaphore.Release();
        }
    }

    /// <summary>
    /// SECURITY: In -stay_open -@ - mode every argument is one stdin line. An argument
    /// containing a line break would inject an extra ExifTool argument (argument injection).
    /// Defense-in-depth behind TagHelper.StripControlChars — this guards ALL args
    /// (including file paths), not just tag values.
    /// SICHERHEIT: Letzte Verteidigungslinie gegen Argument-Injection ueber Zeilenumbrueche.
    /// </summary>
    internal static void EnsureNoLineBreaks(IEnumerable<string> args)
    {
        foreach (var arg in args)
        {
            if (arg.IndexOf('\n') >= 0 || arg.IndexOf('\r') >= 0)
                throw new ArgumentException("ExifTool argument must not contain line breaks");
        }
    }

    /// <summary>
    /// Tear down the ExifTool process and all stream references after a timeout or fatal error.
    /// Must be called while _semaphore is held. The next call to EnsureProcessRunning will
    /// re-spawn a fresh process.
    /// </summary>
    private void ResetProcessState()
    {
        try { _exifToolProcess?.Kill(); } catch { /* best effort */ }
        _commandWriter?.Dispose();
        _outputReader?.Dispose();
        _exifToolProcess?.Dispose();
        _commandWriter = null;
        _outputReader = null;
        _exifToolProcess = null;
    }

    /// <summary>
    /// Parse a command-line style argument string into individual arguments.
    /// Handles quoted strings with spaces correctly.
    /// </summary>
    /// <summary>
    /// Parse Keywords and Subject tags from an ExifTool JSON element.
    /// Handles both array and single-string ValueKind.
    /// </summary>
    private static HashSet<string> ParseTagsFromJson(JsonElement item)
    {
        var tags = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        if (item.TryGetProperty("Keywords", out var keywords))
        {
            if (keywords.ValueKind == JsonValueKind.Array)
                foreach (var tag in keywords.EnumerateArray()) tags.Add(tag.GetString() ?? "");
            else if (keywords.ValueKind == JsonValueKind.String)
                tags.Add(keywords.GetString() ?? "");
        }

        if (item.TryGetProperty("Subject", out var subject))
        {
            if (subject.ValueKind == JsonValueKind.Array)
                foreach (var tag in subject.EnumerateArray()) tags.Add(tag.GetString() ?? "");
            else if (subject.ValueKind == JsonValueKind.String)
                tags.Add(subject.GetString() ?? "");
        }

        return tags;
    }

    /// <summary>
    /// Parse MWG descriptions from ExifTool -j output. Returns only non-empty
    /// descriptions keyed by the normalized SourceFile path (case-insensitive).
    /// Nur nicht-leere Beschreibungen; Keys per Path.GetFullPath normalisiert.
    /// </summary>
    internal static Dictionary<string, string> ParseDescriptionsFromJson(string json)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        using var doc = JsonDocument.Parse(json);
        foreach (var item in doc.RootElement.EnumerateArray())
        {
            if (!item.TryGetProperty("SourceFile", out var sourceFileProp))
                continue;
            var sourcePath = sourceFileProp.GetString();
            if (string.IsNullOrEmpty(sourcePath))
                continue;

            // Normalize path (ExifTool may use forward slashes)
            var normalizedPath = Path.GetFullPath(sourcePath);

            if (!item.TryGetProperty("Description", out var descProp) || descProp.ValueKind != JsonValueKind.String)
                continue;

            var text = descProp.GetString();
            if (string.IsNullOrEmpty(text))
                continue;

            result[normalizedPath] = text;
        }

        return result;
    }

    internal static List<string> ParseArguments(string arguments)
    {
        var result = new List<string>();
        var current = new StringBuilder();
        bool inQuotes = false;
        bool escaped = false;

        for (int i = 0; i < arguments.Length; i++)
        {
            char c = arguments[i];

            if (escaped)
            {
                current.Append(c);
                escaped = false;
                continue;
            }

            if (c == '\\' && i + 1 < arguments.Length && arguments[i + 1] == '"')
            {
                escaped = true;
                continue;
            }

            if (c == '"')
            {
                inQuotes = !inQuotes;
                // Don't include the quotes in the argument for ExifTool
                continue;
            }

            if (c == ' ' && !inQuotes)
            {
                if (current.Length > 0)
                {
                    result.Add(current.ToString());
                    current.Clear();
                }
                continue;
            }

            current.Append(c);
        }

        if (current.Length > 0)
        {
            result.Add(current.ToString());
        }

        return result;
    }

    /// <summary>
    /// Deduplicate tags (case-insensitive, trimmed) and build the ExifTool argument list.
    /// Extracted as internal static for testability.
    /// </summary>
    internal static (List<string> uniqueTags, List<string> args) BuildWriteTagArgs(List<string> tags, string imagePath)
    {
        var uniqueTags = TagHelper.DeduplicateTags(tags);

        var args = new List<string>();

        if (uniqueTags.Count == 0)
        {
            args.Add("-Keywords=");
            args.Add("-XMP:Subject=");
        }
        else
        {
            args.Add("-sep");
            args.Add(TagSeparator);
            args.Add($"-Keywords={string.Join(TagSeparator, uniqueTags)}");
            args.Add($"-XMP:Subject={string.Join(TagSeparator, uniqueTags)}");
        }

        args.Add("-overwrite_original");
        args.Add(imagePath);

        return (uniqueTags, args);
    }

    /// <summary>
    /// Build the ExifTool argument list for writing an MWG description.
    /// Extracted as internal static for testability (see BuildWriteTagArgs).
    /// Argumentliste für das Schreiben der MWG-Beschreibung; testbar als internal static.
    /// </summary>
    internal static List<string> BuildWriteDescriptionArgs(string imagePath, string description)
    {
        return new List<string>
        {
            $"-MWG:Description={description}",
            "-overwrite_original",
            imagePath
        };
    }

    /// <summary>
    /// True if a single ExifTool output line reports a fatal error (starts with "Error:").
    /// Warnings and informational lines — even ones whose text merely contains the word
    /// "error" — are ignored.
    /// Wahr, wenn eine Ausgabezeile einen echten Fehler meldet (beginnt mit "Error:").
    /// </summary>
    internal static bool LineIndicatesError(string line)
        => line.TrimStart().StartsWith("Error:", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// True if any line in ExifTool output reports a fatal error. Replaces the fragile
    /// output.Contains("Error") check, which false-positived on warnings and on file
    /// paths containing the word "error".
    /// Wahr, wenn irgendeine Ausgabezeile einen echten Fehler meldet.
    /// </summary>
    internal static bool OutputIndicatesError(string output)
    {
        if (string.IsNullOrEmpty(output)) return false;
        foreach (var line in output.Split('\n'))
            if (LineIndicatesError(line)) return true;
        return false;
    }

    public void Dispose()
    {
        if (_disposed) return;

        // Bounded wait: a stuck ExifTool call must never hang app shutdown forever.
        // If the semaphore cannot be acquired we still tear the process down — the app
        // is exiting and an unkilled exiftool.exe would outlive it as a zombie.
        // Begrenztes Warten: ein haengender ExifTool-Aufruf darf das Beenden nicht blockieren.
        var acquired = _semaphore.Wait(TimeSpan.FromSeconds(5));
        if (!acquired)
            _logger.LogWarning("Dispose: semaphore not acquired within 5s — forcing ExifTool shutdown");
        try
        {
            if (_commandWriter != null)
            {
                try
                {
                    _commandWriter.WriteLine("-stay_open");
                    _commandWriter.WriteLine("False");
                    _commandWriter.Flush();
                    _commandWriter.Dispose();
                }
                catch (Exception ex) { _logger.LogWarning(ex, "Failed to send ExifTool shutdown command"); }
            }

            if (_exifToolProcess != null)
            {
                try
                {
                    if (!_exifToolProcess.HasExited)
                    {
                        if (!_exifToolProcess.WaitForExit(_processStopTimeoutMs))
                            _exifToolProcess.Kill();
                    }
                    _exifToolProcess.Dispose();
                }
                catch (Exception ex) { _logger.LogWarning(ex, "Failed to dispose ExifTool process"); }
            }

            _outputReader?.Dispose();
        }
        finally
        {
            if (acquired) _semaphore.Release();
            _semaphore.Dispose();
        }

        _disposed = true;
        GC.SuppressFinalize(this);
    }
}

