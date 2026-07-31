using System.IO;
using Microsoft.Extensions.Logging;
using Microsoft.Win32;
using TagFusion.Database;
using TagFusion.Services;

namespace TagFusion.Bridge.Handlers;

/// <summary>
/// Handles tag management actions: getAllTags, getTagLibrary, saveTagLibrary,
/// exportTagLibrary, importTagLibrary, writeBatchTags, searchImages.
/// </summary>
public class TagHandler : IBridgeHandler
{
    private readonly ITagService _tagService;
    private readonly IExifToolService _exifToolService;
    private readonly IDatabaseService _databaseService;
    private readonly ILogger<TagHandler> _logger;
    private readonly Action<string, object?> _sendEvent;

    private static readonly HashSet<string> _supported = new(StringComparer.Ordinal)
    {
        "getAllTags", "getTagLibrary", "saveTagLibrary", "exportTagLibrary", "importTagLibrary",
        "writeBatchTags", "updateBatchTag", "searchImages"
    };

    public IReadOnlySet<string> SupportedActions => _supported;

    public TagHandler(
        ITagService tagService,
        IExifToolService exifToolService,
        IDatabaseService databaseService,
        ILogger<TagHandler> logger,
        Action<string, object?> sendEvent)
    {
        _tagService = tagService;
        _exifToolService = exifToolService;
        _databaseService = databaseService;
        _logger = logger;
        _sendEvent = sendEvent;
    }

    public async Task<object?> HandleAsync(string action, Dictionary<string, object>? payload)
    {
        return action switch
        {
            "getAllTags" => await _tagService.GetAllTagsAsync(),
            "getTagLibrary" => await _tagService.GetTagLibraryAsync(),
            "saveTagLibrary" => await _tagService.SaveTagLibraryAsync(payload?["library"] ?? new object()),
            "exportTagLibrary" => await ExportTagLibraryAsync(),
            "importTagLibrary" => await ImportTagLibraryAsync(),
            "writeBatchTags" => await WriteBatchTagsAsync(payload),
            "updateBatchTag" => await UpdateBatchTagAsync(payload),
            "searchImages" => await SearchImagesAsync(payload),
            _ => throw new NotSupportedException($"Unknown action: {action}")
        };
    }

    /// <summary>
    /// Asks for a target file and writes the tag library there as indented JSON.
    /// Cancelling the dialog is a regular result, not an error.
    /// Fragt nach einer Zieldatei und schreibt die Tag-Bibliothek als eingerücktes JSON.
    /// Abbruch im Dialog ist ein reguläres Ergebnis, kein Fehler.
    /// </summary>
    private async Task<TagLibraryTransferResult> ExportTagLibraryAsync()
    {
        var library = await _tagService.GetTagLibraryAsync();
        if (library == null)
            throw new BridgeException(
                "Es ist keine Tag-Bibliothek vorhanden, die exportiert werden könnte.",
                internalMessage: "Tag library export: GetTagLibraryAsync returned null");

        var targetPath = await ShowSaveDialogAsync(TagLibraryBackup.BuildDefaultFileName(DateTime.Now));
        if (string.IsNullOrEmpty(targetPath))
            return new TagLibraryTransferResult(true, null, 0, 0);

        var json = TagLibraryBackup.Serialize(library);
        var (categoryCount, tagCount) = TagLibraryBackup.Count(json);

        try
        {
            await File.WriteAllTextAsync(targetPath, json);
        }
        catch (Exception ex)
        {
            throw new BridgeException(
                "Die Tag-Bibliothek konnte nicht gespeichert werden — bitte einen anderen Speicherort wählen.",
                internalMessage: $"Tag library export failed for {targetPath}",
                inner: ex);
        }

        _logger.LogInformation("Tag library exported to {Path} ({Categories} categories, {Tags} tags)",
            targetPath, categoryCount, tagCount);

        return new TagLibraryTransferResult(false, targetPath, categoryCount, tagCount);
    }

    /// <summary>
    /// Asks for a backup file and replaces the current tag library with its content.
    /// Fragt nach einer Sicherungsdatei und ersetzt die aktuelle Tag-Bibliothek durch deren Inhalt.
    /// </summary>
    private async Task<TagLibraryTransferResult> ImportTagLibraryAsync()
    {
        var sourcePath = await ShowOpenDialogAsync();
        if (string.IsNullOrEmpty(sourcePath))
            return new TagLibraryTransferResult(true, null, 0, 0);

        return await ImportTagLibraryFromFileAsync(sourcePath);
    }

    /// <summary>
    /// Dialog-free import core: read, validate strictly, then replace the library.
    /// Dialogfreier Import-Kern: lesen, streng validieren, dann Bibliothek ersetzen.
    /// </summary>
    internal async Task<TagLibraryTransferResult> ImportTagLibraryFromFileAsync(string sourcePath)
    {
        string json;
        try
        {
            json = await File.ReadAllTextAsync(sourcePath);
        }
        catch (Exception ex)
        {
            throw new BridgeException(
                "Die Datei konnte nicht gelesen werden.",
                internalMessage: $"Tag library import: read failed for {sourcePath}",
                inner: ex);
        }

        // Validation runs before anything is persisted — invalid files leave the
        // existing library untouched (no partial import).
        // Validierung läuft vor dem Speichern — ungültige Dateien lassen die
        // bestehende Bibliothek unangetastet.
        var (validatedLibrary, categoryCount, tagCount) = TagLibraryBackup.ParseAndValidate(json);

        if (!await _tagService.SaveTagLibraryAsync(validatedLibrary))
            throw new BridgeException(
                "Die importierte Tag-Bibliothek konnte nicht übernommen werden.",
                internalMessage: $"Tag library import: SaveTagLibraryAsync failed for {sourcePath}");

        _logger.LogInformation("Tag library imported from {Path} ({Categories} categories, {Tags} tags)",
            sourcePath, categoryCount, tagCount);

        return new TagLibraryTransferResult(false, sourcePath, categoryCount, tagCount);
    }

    /// <summary>
    /// Windows save dialog on its own STA thread (same pattern as FileSystemService.SelectFolderAsync).
    /// Windows-Speichern-Dialog auf eigenem STA-Thread — gleiches Muster wie SelectFolderAsync.
    /// </summary>
    private static Task<string?> ShowSaveDialogAsync(string defaultFileName)
    {
        return Task.Run(() =>
        {
            string? selectedPath = null;

            var thread = new System.Threading.Thread(() =>
            {
                var dialog = new SaveFileDialog
                {
                    Title = "Tag-Bibliothek exportieren",
                    Filter = "TagFusion Tag-Bibliothek (*.json)|*.json",
                    DefaultExt = ".json",
                    AddExtension = true,
                    FileName = defaultFileName
                };

                if (dialog.ShowDialog() == true)
                {
                    selectedPath = dialog.FileName;
                }
            });

            thread.SetApartmentState(System.Threading.ApartmentState.STA);
            thread.Start();
            thread.Join();

            return selectedPath;
        });
    }

    /// <summary>
    /// Windows open dialog on its own STA thread.
    /// Windows-Öffnen-Dialog auf eigenem STA-Thread.
    /// </summary>
    private static Task<string?> ShowOpenDialogAsync()
    {
        return Task.Run(() =>
        {
            string? selectedPath = null;

            var thread = new System.Threading.Thread(() =>
            {
                var dialog = new OpenFileDialog
                {
                    Title = "Tag-Bibliothek importieren",
                    Filter = "TagFusion Tag-Bibliothek (*.json)|*.json",
                    DefaultExt = ".json",
                    Multiselect = false,
                    CheckFileExists = true
                };

                if (dialog.ShowDialog() == true)
                {
                    selectedPath = dialog.FileName;
                }
            });

            thread.SetApartmentState(System.Threading.ApartmentState.STA);
            thread.Start();
            thread.Join();

            return selectedPath;
        });
    }

    private async Task<Dictionary<string, bool>> WriteBatchTagsAsync(Dictionary<string, object>? payload)
    {
        if (payload == null) return new Dictionary<string, bool>();

        var paths = PayloadHelper.GetStringArray(payload, "paths");
        var tagsObj = payload.GetValueOrDefault("tags");
        var tags = TagHelper.DeduplicateTags(PayloadHelper.ExtractStringList(tagsObj));

        if (paths.Length == 0)
            return new Dictionary<string, bool>();

        // One ExifTool batch invocation for the whole list (3-5x faster than per-file).
        // Eine ExifTool-Batch-Invocation für alle Dateien — deutlich schneller als pro Datei.
        var results = await _exifToolService.WriteTagsBatchAsync(paths, tags);

        // Persist successes to the database in a single batch transaction.
        var imagesToPersist = new List<Models.ImageFile>();
        foreach (var path in paths)
        {
            if (results.TryGetValue(path, out var ok) && ok)
            {
                int rating;
                try { rating = await _exifToolService.ReadRatingAsync(path); }
                catch { rating = 0; }
                imagesToPersist.Add(Models.ImageFile.FromPath(path, tags, rating));
            }
        }
        if (imagesToPersist.Count > 0)
            await _databaseService.SaveImagesBatchAsync(imagesToPersist);

        // Single completion event (no per-file progress on the fast path).
        _sendEvent("batchProgress", new { current = paths.Length, total = paths.Length, operation = "writeBatchTags" });

        return results;
    }

    private async Task<Dictionary<string, bool>> UpdateBatchTagAsync(Dictionary<string, object>? payload)
    {
        if (payload == null) return new Dictionary<string, bool>();

        var paths = PayloadHelper.GetStringArray(payload, "paths");
        var tag = PayloadHelper.GetString(payload, "tag").Trim();
        var operation = PayloadHelper.GetString(payload, "operation");

        if (string.IsNullOrWhiteSpace(tag) || (operation != "add" && operation != "remove"))
        {
            return new Dictionary<string, bool>();
        }

        var results = new Dictionary<string, bool>();
        var total = paths.Length;

        for (var i = 0; i < paths.Length; i++)
        {
            var path = paths[i];
            try
            {
                var existingTags = await _exifToolService.ReadTagsAsync(path);
                var updatedTags = operation == "add"
                    ? TagHelper.DeduplicateTags(existingTags.Append(tag))
                    : existingTags.Where(existingTag => !string.Equals(existingTag, tag, StringComparison.OrdinalIgnoreCase)).ToList();

                var success = await _exifToolService.WriteTagsAsync(path, updatedTags);
                results[path] = success;

                if (success)
                {
                    var image = Models.ImageFile.FromPath(path, updatedTags, await _exifToolService.ReadRatingAsync(path));
                    await _databaseService.SaveImageAsync(image);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "UpdateBatchTag failed for {Path}", path);
                results[path] = false;
            }

            _sendEvent("batchProgress", new { current = i + 1, total, operation = "updateBatchTag" });
        }

        return results;
    }

    private async Task<List<Models.ImageFile>> SearchImagesAsync(Dictionary<string, object>? payload)
    {
        List<string>? terms = null;
        int? minRating = null;
        int limit = 200;
        int offset = 0;

        if (payload != null)
        {
            var tagsObj = payload.GetValueOrDefault("tags");
            var extracted = PayloadHelper.ExtractStringList(tagsObj);
            if (extracted.Count > 0) terms = extracted;

            var ratingObj = payload.GetValueOrDefault("minRating");
            var rating = PayloadHelper.GetInt(ratingObj, 0);
            if (rating > 0) minRating = rating;

            var limitObj = payload.GetValueOrDefault("limit");
            var parsedLimit = PayloadHelper.GetInt(limitObj, 200);
            if (parsedLimit > 0) limit = parsedLimit;

            var offsetObj = payload.GetValueOrDefault("offset");
            offset = PayloadHelper.GetInt(offsetObj, 0);
        }

        // Auto-cleanup can hide an entire LIMIT window (e.g. newest matches all live on
        // an unplugged drive) — refill by advancing the offset until enough visible
        // results are gathered or the DB is exhausted, instead of returning a false empty.
        // Auto-Cleanup kann ein ganzes LIMIT-Fenster ausblenden (z.B. wenn die neuesten
        // Treffer alle auf einer abgestöpselten Platte liegen) — wir füllen auf, indem
        // wir den Offset vorrücken, bis genug sichtbare Treffer da sind oder die DB
        // erschöpft ist, statt fälschlich ein leeres Ergebnis zu liefern.
        var visible = new List<Models.ImageFile>();
        var deletablePaths = new List<string>();

        // Root availability is checked at most once per root for the whole search,
        // not per batch — the lambda memoizes across all Partition calls below.
        // Verfügbarkeit wird pro Suche höchstens einmal pro Laufwerk geprüft —
        // das Lambda merkt sich das Ergebnis über alle Partition-Aufrufe hinweg.
        var rootAvailabilityCache = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
        bool IsRootAvailableMemoized(string root)
        {
            if (!rootAvailabilityCache.TryGetValue(root, out var available))
            {
                available = SearchResultCleaner.IsRootAvailable(root);
                rootAvailabilityCache[root] = available;
            }
            return available;
        }

        var currentOffset = offset;
        while (true)
        {
            var batch = await _databaseService.SearchImagesAsync(terms, minRating, limit, currentOffset);
            var cleanup = SearchResultCleaner.Partition(batch, IsRootAvailableMemoized, File.Exists);

            visible.AddRange(cleanup.Visible);
            deletablePaths.AddRange(cleanup.DeletablePaths);

            var exhausted = batch.Count < limit;
            if (visible.Count >= limit || exhausted) break;

            currentOffset += limit;
        }

        if (visible.Count > limit)
            visible.RemoveRange(limit, visible.Count - limit);

        if (deletablePaths.Count > 0)
        {
            try
            {
                await _databaseService.DeleteImagesAsync(deletablePaths);
                _logger.LogInformation("Removed {Count} stale image entries during search", deletablePaths.Count);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Stale-entry cleanup failed — returning filtered results anyway");
            }
        }

        return visible;
    }
}
