using System.IO;
using Microsoft.Extensions.Logging;
using TagFusion.Database;
using TagFusion.Models;

namespace TagFusion.Services;

/// <summary>
/// Runs one manual AI-description pass over a folder: caption serially via the
/// AiApiServer, write MWG metadata, mirror into the DB. Aborts after three
/// consecutive failures (server presumed gone).
/// Führt einen manuellen Beschreibungs-Lauf aus: seriell captionen, Metadaten
/// schreiben, DB spiegeln; nach drei Fehlern in Folge Abbruch.
/// </summary>
public sealed class DescriptionScanService
{
    public record ScanSummary(int Described, int Skipped, int Failed, bool Cancelled, bool Aborted);

    internal const int MaxConsecutiveFailures = 3;

    private readonly IAiCaptionClient _client;
    private readonly IExifToolService _exifToolService;
    private readonly IDatabaseService _databaseService;
    private readonly IFileSystemService _fileSystemService;
    private readonly ILogger<DescriptionScanService> _logger;

    private int _running;
    private CancellationTokenSource? _cts;
    private Task? _currentScan;

    public event Action<int, int, int>? Progress;   // current, total, described
    public event Action<ScanSummary>? Completed;

    public bool IsScanning => Interlocked.CompareExchange(ref _running, 0, 0) == 1;

    internal Task? CurrentScanForTests => _currentScan;

    public DescriptionScanService(
        IAiCaptionClient client,
        IExifToolService exifToolService,
        IDatabaseService databaseService,
        IFileSystemService fileSystemService,
        ILogger<DescriptionScanService> logger)
    {
        _client = client;
        _exifToolService = exifToolService;
        _databaseService = databaseService;
        _fileSystemService = fileSystemService;
        _logger = logger;
    }

    public bool StartScan(string folderPath, string model, string prompt, bool overwriteExisting, bool includeSubfolders = false)
    {
        if (Interlocked.CompareExchange(ref _running, 1, 0) != 0)
            return false;

        _cts = new CancellationTokenSource();
        _currentScan = Task.Run(() => RunScanAsync(folderPath, model, prompt, overwriteExisting, includeSubfolders, _cts.Token));
        return true;
    }

    public void Cancel()
    {
        // Snapshot — a concurrently finishing scan may dispose the CTS.
        // Snapshot — ein parallel endender Scan darf die CTS entsorgen.
        var cts = _cts;
        if (cts == null) return;
        try
        {
            cts.Cancel();
        }
        catch (ObjectDisposedException)
        {
            // Scan already finished. / Scan bereits beendet.
        }
    }

    private async Task RunScanAsync(string folderPath, string model, string prompt, bool overwriteExisting, bool includeSubfolders, CancellationToken ct)
    {
        int described = 0, skipped = 0, failed = 0;
        bool cancelled = false, aborted = false;

        try
        {
            var images = await _fileSystemService.GetImagesAsync(folderPath, includeSubfolders, ct);
            var paths = images.Select(i => i.Path).ToList();

            var existing = overwriteExisting
                ? new Dictionary<string, string>()
                : await _exifToolService.ReadDescriptionsBatchAsync(paths, ct);

            var todo = new List<string>();
            foreach (var path in paths)
            {
                if (existing.ContainsKey(path)) { skipped++; continue; }
                todo.Add(path);
            }

            var total = todo.Count;
            var consecutiveFailures = 0;

            for (int i = 0; i < total; i++)
            {
                ct.ThrowIfCancellationRequested();
                var path = todo[i];
                try
                {
                    var caption = await _client.CaptionAsync(path, model, prompt, ct);

                    // AI captions may contain line breaks; the ExifTool layer rejects them
                    // (stay_open injection guard) — collapse all whitespace to single spaces.
                    // KI-Beschreibungen können Zeilenumbrüche enthalten; die ExifTool-Schicht
                    // lehnt sie ab — alles Weißraum auf einzelne Leerzeichen normalisieren.
                    caption = System.Text.RegularExpressions.Regex.Replace(caption, @"\s+", " ").Trim();

                    if (!await _exifToolService.WriteDescriptionAsync(path, caption, ct))
                        throw new InvalidOperationException("ExifTool-Schreiben fehlgeschlagen");

                    // DB sync: refreshes tags/rating mirror AND FaceScanFileTime
                    // (metadata write bumps mtime — must not invalidate face scans).
                    // DB-Sync: aktualisiert auch FaceScanFileTime — Beschreiben darf
                    // Gesichts-Scans nicht entwerten.
                    var image = ImageFile.FromPath(path,
                        await _exifToolService.ReadTagsAsync(path, ct),
                        await _exifToolService.ReadRatingAsync(path, ct));
                    await _databaseService.SaveImageAsync(image, ct);
                    await _databaseService.SetImageDescriptionAsync(path, caption, ct);

                    described++;
                    consecutiveFailures = 0;
                }
                catch (OperationCanceledException) when (ct.IsCancellationRequested)
                {
                    // Genuine user cancellation only. HttpClient timeouts throw
                    // TaskCanceledException (an OperationCanceledException) WITHOUT ct being
                    // cancelled — those must fall through to the failure counter below,
                    // not abort the whole run as "Cancelled".
                    // Nur echter Abbruch durch den Nutzer. HttpClient-Timeouts werfen
                    // TaskCanceledException OHNE ct-Cancel — die zählen als Fehler,
                    // nicht als Abbruch des gesamten Laufs.
                    throw;
                }
                catch (Exception ex)
                {
                    failed++;
                    consecutiveFailures++;
                    _logger.LogWarning(ex, "Description failed for {Path}", path);
                    if (consecutiveFailures >= MaxConsecutiveFailures)
                    {
                        aborted = true;
                        _logger.LogError("Aborting description scan after {Count} consecutive failures", consecutiveFailures);
                        break;
                    }
                }
                Progress?.Invoke(i + 1, total, described);
            }
        }
        catch (OperationCanceledException)
        {
            cancelled = true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Description scan failed for {Folder}", folderPath);
            aborted = true;
        }
        finally
        {
            var cts = Interlocked.Exchange(ref _cts, null);
            cts?.Dispose();
            Interlocked.Exchange(ref _running, 0);
            Completed?.Invoke(new ScanSummary(described, skipped, failed, cancelled, aborted));
        }
    }
}
