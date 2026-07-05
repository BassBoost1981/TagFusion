using System.IO;
using Microsoft.Extensions.Logging;
using TagFusion.Database;
using TagFusion.Models;

namespace TagFusion.Services;

/// <summary>
/// Runs one manual face scan at a time over a folder's images: analyze serially,
/// persist faces, then compute suggestions against known persons.
/// Führt einen manuellen Gesichts-Scan pro Zeit aus: seriell analysieren,
/// speichern, danach Vorschläge gegen bekannte Personen berechnen.
/// </summary>
public sealed class FaceScanService
{
    public record ScanSummary(int Scanned, int Faces, int Skipped, bool Cancelled);

    private readonly IFaceEngine _engine;
    private readonly IDatabaseService _databaseService;
    private readonly IFileSystemService _fileSystemService;
    private readonly ILogger<FaceScanService> _logger;

    private int _running; // 0 = idle, 1 = scanning (Interlocked)
    private CancellationTokenSource? _cts;
    private Task? _currentScan;

    public event Action<int, int, int>? Progress;   // current, total, facesSoFar
    public event Action<ScanSummary>? Completed;

    public bool IsScanning => Interlocked.CompareExchange(ref _running, 0, 0) == 1;

    internal Task? CurrentScanForTests => _currentScan;

    public FaceScanService(
        IFaceEngine engine,
        IDatabaseService databaseService,
        IFileSystemService fileSystemService,
        ILogger<FaceScanService> logger)
    {
        _engine = engine;
        _databaseService = databaseService;
        _fileSystemService = fileSystemService;
        _logger = logger;
    }

    /// <summary>Start a scan; returns false when one is already running.</summary>
    public bool StartScan(string folderPath)
    {
        if (Interlocked.CompareExchange(ref _running, 1, 0) != 0)
            return false;

        _cts = new CancellationTokenSource();
        _currentScan = Task.Run(() => RunScanAsync(folderPath, _cts.Token));
        return true;
    }

    public void Cancel() => _cts?.Cancel();

    private async Task RunScanAsync(string folderPath, CancellationToken ct)
    {
        int scanned = 0, faces = 0, skipped = 0;
        bool cancelled = false;

        try
        {
            var images = await _fileSystemService.GetImagesAsync(folderPath, ct);
            var paths = images.Select(i => i.Path).ToList();
            var scanTimes = await _databaseService.GetFaceScanTimesAsync(paths, ct);

            // Only new or changed files. / Nur neue oder geänderte Dateien.
            var todo = new List<string>();
            foreach (var path in paths)
            {
                var mtime = File.GetLastWriteTimeUtc(path).ToString("o");
                if (scanTimes.TryGetValue(path, out var stored) && stored == mtime) continue;
                todo.Add(path);
            }

            var total = todo.Count;
            for (int i = 0; i < total; i++)
            {
                ct.ThrowIfCancellationRequested();
                var path = todo[i];
                try
                {
                    var detected = await _engine.AnalyzeAsync(path, ct);
                    var newFaces = detected
                        .Select(d => new NewFace(d.X, d.Y, d.Width, d.Height, d.Embedding))
                        .ToList();
                    await _databaseService.SaveFacesAsync(path, newFaces, File.GetLastWriteTimeUtc(path), ct);
                    scanned++;
                    faces += newFaces.Count;
                }
                catch (OperationCanceledException)
                {
                    throw;
                }
                catch (Exception ex)
                {
                    skipped++;
                    _logger.LogWarning(ex, "Face scan skipped {Path}", path);
                }
                Progress?.Invoke(i + 1, total, faces);
            }

            // Suggestions for everything unnamed in this folder.
            // Vorschläge für alles Unbenannte in diesem Ordner.
            var folderFaces = await _databaseService.GetFacesForFolderAsync(folderPath, ct);
            var unnamed = folderFaces.Where(f => f.Status == FaceStatus.Unnamed).ToList();
            if (unnamed.Count > 0)
            {
                var confirmed = await _databaseService.GetConfirmedEmbeddingsByPersonAsync(ct);
                var suggestions = FaceMatcher.ComputeSuggestions(unnamed, confirmed);
                if (suggestions.Count > 0)
                    await _databaseService.ApplyFaceSuggestionsAsync(suggestions, ct);
            }
        }
        catch (OperationCanceledException)
        {
            cancelled = true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Face scan failed for {Folder}", folderPath);
        }
        finally
        {
            _cts?.Dispose();
            _cts = null;
            Interlocked.Exchange(ref _running, 0);
            Completed?.Invoke(new ScanSummary(scanned, faces, skipped, cancelled));
        }
    }
}
