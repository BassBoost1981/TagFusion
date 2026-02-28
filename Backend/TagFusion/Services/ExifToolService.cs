using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using TagFusion.Models;

namespace TagFusion.Services;

/// <summary>
/// Wrapper for ExifTool to read and write image metadata.
/// Uses -stay_open mode for persistent process (5-10x faster).
/// </summary>
public class ExifToolService : IDisposable
{
    private readonly string _exifToolPath;
    private readonly ThumbnailService _thumbnailService;
    private readonly ILogger<ExifToolService> _logger;
    private Process? _exifToolProcess;
    private StreamWriter? _commandWriter;
    private StreamReader? _outputReader;
    private readonly SemaphoreSlim _semaphore = new(1, 1);
    private bool _disposed;

    public string ExifToolPath => _exifToolPath;

    public ExifToolService(ThumbnailService thumbnailService, ILogger<ExifToolService> logger)
    {
        _thumbnailService = thumbnailService;
        _logger = logger;

        // Find ExifTool path relative to app directory
        var appDir = AppContext.BaseDirectory ?? string.Empty;
        _logger.LogDebug("AppContext.BaseDirectory: {AppDir}", appDir);

        // Try different possible locations
        var possiblePaths = new[]
        {
            // Development: relative to bin/Debug/net8.0-windows
            Path.Combine(appDir, "..", "..", "..", "..", "..", "Tools", "exiftool.exe"),
            Path.Combine(appDir, "..", "..", "..", "..", "Tools", "exiftool.exe"),
            // Production: Tools folder next to exe
            Path.Combine(appDir, "Tools", "exiftool.exe"),
            Path.Combine(appDir, "exiftool.exe")
        };

        _logger.LogDebug("Searching for exiftool.exe in:");
        foreach (var p in possiblePaths)
        {
            var fullPath = Path.GetFullPath(p);
            var exists = File.Exists(fullPath);
            _logger.LogDebug("  - {Path} (exists: {Exists})", fullPath, exists);
        }

        _exifToolPath = possiblePaths.FirstOrDefault(File.Exists)
            ?? throw new FileNotFoundException($"ExifTool not found. Searched in: {string.Join(", ", possiblePaths.Select(Path.GetFullPath))}");

        _exifToolPath = Path.GetFullPath(_exifToolPath);
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

        var args = $"-Keywords -XMP:Subject -j \"{imagePath}\"";
        var output = await RunExifToolAsync(args, cancellationToken);

        try
        {
            using var doc = JsonDocument.Parse(output);
            var results = doc.RootElement;
            if (results.GetArrayLength() == 0)
                return new List<string>();

            var tags = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var firstItem = results[0];

            // Get IPTC Keywords
            if (firstItem.TryGetProperty("Keywords", out var keywords))
            {
                if (keywords.ValueKind == JsonValueKind.Array)
                    foreach (var tag in keywords.EnumerateArray()) tags.Add(tag.GetString() ?? "");
                else if (keywords.ValueKind == JsonValueKind.String)
                    tags.Add(keywords.GetString() ?? "");
            }

            // Get XMP Subject
            if (firstItem.TryGetProperty("Subject", out var subject))
            {
                if (subject.ValueKind == JsonValueKind.Array)
                    foreach (var tag in subject.EnumerateArray()) tags.Add(tag.GetString() ?? "");
                else if (subject.ValueKind == JsonValueKind.String)
                    tags.Add(subject.GetString() ?? "");
            }

            return tags.ToList();
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

        // Deduplicate tags (case-insensitive, trim whitespace)
        var uniqueTags = tags
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .Select(t => t.Trim())
            .GroupBy(t => t, StringComparer.OrdinalIgnoreCase)
            .Select(g => g.First())
            .ToList();

        if (uniqueTags.Count != tags.Count)
            _logger.LogDebug("Deduplicated tags: {Original} → {Unique}", tags.Count, uniqueTags.Count);

        // Build argument list directly (no string→parse round-trip)
        var args = new List<string>();

        if (uniqueTags.Count == 0)
        {
            // Clear all tags
            args.Add("-Keywords=");
            args.Add("-XMP:Subject=");
        }
        else
        {
            // Use -sep with a separator that won't appear in tag names,
            // then set all keywords at once with direct assignment (replaces existing)
            args.Add("-sep");
            args.Add(";;");
            args.Add($"-Keywords={string.Join(";;", uniqueTags)}");
            args.Add($"-XMP:Subject={string.Join(";;", uniqueTags)}");
        }

        args.Add("-overwrite_original");
        args.Add(imagePath);

        _logger.LogDebug("Sending {ArgCount} args directly to ExifTool", args.Count);

        var output = await RunExifToolAsync(args, cancellationToken);
        _logger.LogDebug("WriteTagsAsync output: '{Output}'", output.Trim());

        // Check for errors in output (warnings are often harmless, only throw on actual errors)
        if (output.Contains("Error", StringComparison.OrdinalIgnoreCase))
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
    /// Read rating from an image file (XMP:Rating, 0-5)
    /// </summary>
    public async Task<int> ReadRatingAsync(string imagePath, CancellationToken cancellationToken = default)
    {
        if (!File.Exists(imagePath))
            throw new FileNotFoundException($"Image not found: {imagePath}");

        var args = $"-XMP:Rating -j \"{imagePath}\"";
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

        // Process in batches to avoid command line length limits (max ~50 files per batch)
        const int batchSize = 50;
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
                // Build arguments with batch files
                var filesArgs = string.Join(" ", batch.Select(p => $"\"{p}\""));
                var args = $"-Keywords -XMP:Subject -XMP:Rating -j {filesArgs}";

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

                    var tags = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                    // Get IPTC Keywords
                    if (item.TryGetProperty("Keywords", out var keywords))
                    {
                        if (keywords.ValueKind == JsonValueKind.Array)
                            foreach (var tag in keywords.EnumerateArray()) tags.Add(tag.GetString() ?? "");
                        else if (keywords.ValueKind == JsonValueKind.String)
                            tags.Add(keywords.GetString() ?? "");
                    }

                    // Get XMP Subject
                    if (item.TryGetProperty("Subject", out var subject))
                    {
                        if (subject.ValueKind == JsonValueKind.Array)
                            foreach (var tag in subject.EnumerateArray()) tags.Add(tag.GetString() ?? "");
                        else if (subject.ValueKind == JsonValueKind.String)
                            tags.Add(subject.GetString() ?? "");
                    }

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
    /// Write rating to an image file (XMP:Rating, 0-5)
    /// </summary>
    public async Task<bool> WriteRatingAsync(string imagePath, int rating, CancellationToken cancellationToken = default)
    {
        if (!File.Exists(imagePath))
            throw new FileNotFoundException($"Image not found: {imagePath}");

        rating = Math.Clamp(rating, 0, 5);

        _logger.LogDebug("WriteRatingAsync called for: {ImagePath}, rating: {Rating}", imagePath, rating);

        var args = $"-XMP:Rating={rating} -overwrite_original \"{imagePath}\"";
        _logger.LogDebug("Command args: {Args}", args);

        var output = await RunExifToolAsync(args, cancellationToken);
        _logger.LogDebug("WriteRatingAsync output: '{Output}'", output.Trim());
        
        // Check for errors in output
        if (output.Contains("Error", StringComparison.OrdinalIgnoreCase))
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
    public async Task<string?> GetFullImageAsync(string imagePath, int maxSize = 1920, CancellationToken cancellationToken = default)
    {
        return await _thumbnailService.GetFullImageAsync(imagePath, maxSize, cancellationToken);
    }

    /// <summary>
    /// Get detailed metadata from an image
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

        // Get tags and rating
        image.Tags = await ReadTagsAsync(imagePath, cancellationToken);
        image.Rating = await ReadRatingAsync(imagePath, cancellationToken);

        // Get additional metadata (dimensions, date taken)
        var args = $"-ImageWidth -ImageHeight -DateTimeOriginal -j \"{imagePath}\"";
        var output = await RunExifToolAsync(args, cancellationToken);

        try
        {
            using var doc = JsonDocument.Parse(output);
            var results = doc.RootElement;
            if (results.GetArrayLength() > 0)
            {
                var data = results[0];
                if (data.TryGetProperty("ImageWidth", out var widthProp) && widthProp.ValueKind == JsonValueKind.Number)
                    image.Width = widthProp.GetInt32();
                if (data.TryGetProperty("ImageHeight", out var heightProp) && heightProp.ValueKind == JsonValueKind.Number)
                    image.Height = heightProp.GetInt32();

                if (data.TryGetProperty("DateTimeOriginal", out var dateProp) && dateProp.ValueKind == JsonValueKind.String)
                {
                    var dateTaken = dateProp.GetString();
                    if (!string.IsNullOrEmpty(dateTaken) && DateTime.TryParse(dateTaken, out var dt))
                        image.DateTaken = dt;
                }
            }
        }
        catch (JsonException ex) { _logger.LogWarning(ex, "Failed to parse image metadata JSON"); }

        return image;
    }

    private async Task<string> RunExifToolAsync(string arguments, CancellationToken cancellationToken = default)
    {
        await _semaphore.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            EnsureProcessRunning();

            if (_commandWriter == null || _outputReader == null)
                throw new InvalidOperationException("ExifTool process not initialized");

            // In -stay_open mode with -@ -, each argument must be on a SEPARATE LINE
            // Parse the arguments string and send each argument individually
            var args = ParseArguments(arguments);
            _logger.LogDebug("RunExifToolAsync: Sending {ArgCount} arguments", args.Count);
            foreach (var arg in args)
            {
                _logger.LogDebug("  > {Arg}", arg);
                await _commandWriter.WriteLineAsync(arg.AsMemory(), cancellationToken).ConfigureAwait(false);
            }
            await _commandWriter.WriteLineAsync("-execute".AsMemory(), cancellationToken).ConfigureAwait(false);
            await _commandWriter.FlushAsync(cancellationToken).ConfigureAwait(false);

            // Read output until {ready}
            var sb = new StringBuilder();
            string? line;
            while ((line = await _outputReader.ReadLineAsync(cancellationToken).ConfigureAwait(false)) != null)
            {
                if (line.Trim() == "{ready}")
                    break;
                sb.AppendLine(line);
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
    /// Run ExifTool with pre-parsed arguments (no string→parse round-trip).
    /// Used by WriteTagsAsync to avoid quoting issues with tag values.
    /// </summary>
    private async Task<string> RunExifToolAsync(List<string> args, CancellationToken cancellationToken = default)
    {
        await _semaphore.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            EnsureProcessRunning();

            if (_commandWriter == null || _outputReader == null)
                throw new InvalidOperationException("ExifTool process not initialized");

            _logger.LogDebug("RunExifToolAsync (List): Sending {ArgCount} arguments", args.Count);
            foreach (var arg in args)
            {
                _logger.LogDebug("  > {Arg}", arg);
                await _commandWriter.WriteLineAsync(arg.AsMemory(), cancellationToken).ConfigureAwait(false);
            }
            await _commandWriter.WriteLineAsync("-execute".AsMemory(), cancellationToken).ConfigureAwait(false);
            await _commandWriter.FlushAsync(cancellationToken).ConfigureAwait(false);

            // Read output until {ready}
            var sb = new StringBuilder();
            string? line;
            while ((line = await _outputReader.ReadLineAsync(cancellationToken).ConfigureAwait(false)) != null)
            {
                if (line.Trim() == "{ready}")
                    break;
                sb.AppendLine(line);
            }
            var output = sb.ToString();
            _logger.LogDebug("RunExifToolAsync (List): Output received: '{Output}'", output.Trim());

            return output;
        }
        finally
        {
            _semaphore.Release();
        }
    }

    /// <summary>
    /// Parse a command-line style argument string into individual arguments.
    /// Handles quoted strings with spaces correctly.
    /// </summary>
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
        var uniqueTags = tags
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .Select(t => t.Trim())
            .GroupBy(t => t, StringComparer.OrdinalIgnoreCase)
            .Select(g => g.First())
            .ToList();

        var args = new List<string>();

        if (uniqueTags.Count == 0)
        {
            args.Add("-Keywords=");
            args.Add("-XMP:Subject=");
        }
        else
        {
            args.Add("-sep");
            args.Add(";;");
            args.Add($"-Keywords={string.Join(";;", uniqueTags)}");
            args.Add($"-XMP:Subject={string.Join(";;", uniqueTags)}");
        }

        args.Add("-overwrite_original");
        args.Add(imagePath);

        return (uniqueTags, args);
    }

    public void Dispose()
    {
        if (_disposed) return;

        // Use synchronous Wait for Dispose — acceptable since Dispose is called once at shutdown
        _semaphore.Wait();
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
                        if (!_exifToolProcess.WaitForExit(1000))
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
            _semaphore.Release();
            _semaphore.Dispose();
        }

        _disposed = true;
        GC.SuppressFinalize(this);
    }
}

