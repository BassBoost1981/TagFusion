using System.IO;
using Microsoft.Extensions.Logging;
using TagFusion.Database;
using TagFusion.Models;
using TagFusion.Services;

namespace TagFusion.Bridge.Handlers;

/// <summary>
/// Handles face recognition actions: scanning, review, confirmation.
/// Verarbeitet Gesichtserkennungs-Actions: Scan, Review, Bestätigung.
/// </summary>
public class FaceHandler : IBridgeHandler
{
    /// <summary>Max face crops embedded per group in a review response. / Max. Crops pro Gruppe.</summary>
    private const int MaxCropsPerGroup = 8;

    private readonly FaceScanService _scanService;
    private readonly IFaceEngine _engine;
    private readonly IDatabaseService _databaseService;
    private readonly IExifToolService _exifToolService;
    private readonly ILogger<FaceHandler> _logger;

    private static readonly HashSet<string> _supported = new(StringComparer.Ordinal)
    {
        "scanFacesInFolder", "cancelFaceScan", "getFaceReview",
        "confirmFaceGroup", "rejectFaceSuggestion", "ignoreFaces", "getPersons"
    };

    public IReadOnlySet<string> SupportedActions => _supported;

    public FaceHandler(
        FaceScanService scanService,
        IFaceEngine engine,
        IDatabaseService databaseService,
        IExifToolService exifToolService,
        ILogger<FaceHandler> logger)
    {
        _scanService = scanService;
        _engine = engine;
        _databaseService = databaseService;
        _exifToolService = exifToolService;
        _logger = logger;
    }

    public async Task<object?> HandleAsync(string action, Dictionary<string, object>? payload)
    {
        return action switch
        {
            "scanFacesInFolder" => StartScan(payload),
            "cancelFaceScan" => CancelScan(),
            "getFaceReview" => await GetFaceReviewAsync(payload),
            "confirmFaceGroup" => await ConfirmFaceGroupAsync(payload),
            "rejectFaceSuggestion" => await RejectAsync(payload),
            "ignoreFaces" => await IgnoreAsync(payload),
            "getPersons" => await GetPersonsAsync(),
            _ => throw new NotSupportedException($"Unknown action: {action}")
        };
    }

    private object StartScan(Dictionary<string, object>? payload)
    {
        if (!_engine.IsAvailable)
            throw new BridgeException(
                "Gesichtserkennung nicht verfügbar — Modelldateien fehlen.",
                internalMessage: "Face engine unavailable");

        var path = PayloadHelper.GetString(payload ?? new(), "path");
        if (string.IsNullOrWhiteSpace(path) || !Directory.Exists(path))
            throw new BridgeException("Ordner nicht gefunden.", internalMessage: $"Folder not found: {path}");

        if (!_scanService.StartScan(path))
            throw new BridgeException("Ein Gesichter-Scan läuft bereits.", internalMessage: "Scan already running");

        return true;
    }

    private object CancelScan()
    {
        _scanService.Cancel();
        return true;
    }

    private async Task<object> GetFaceReviewAsync(Dictionary<string, object>? payload)
    {
        var path = PayloadHelper.GetString(payload ?? new(), "path");
        var faces = await _databaseService.GetFacesForFolderAsync(path);
        var persons = (await _databaseService.GetPersonsAsync()).ToDictionary(p => p.Id, p => p.Name);

        // Suggestions grouped by suggested person. / Vorschläge nach Person gruppiert.
        var suggestions = new List<object>();
        foreach (var group in faces.Where(f => f.Status == FaceStatus.Suggested && f.SuggestedPersonId.HasValue)
                                   .GroupBy(f => f.SuggestedPersonId!.Value))
        {
            if (!persons.TryGetValue(group.Key, out var name)) continue;
            var members = group.ToList();
            suggestions.Add(new
            {
                personId = group.Key,
                personName = name,
                score = members.Max(f => f.SuggestionScore ?? 0),
                faceIds = members.Select(f => f.Id).ToList(),
                sample = await BuildCropsAsync(members),
            });
        }

        // Unknown faces clustered by similarity. / Unbekannte nach Ähnlichkeit gruppiert.
        var unnamed = faces.Where(f => f.Status == FaceStatus.Unnamed).ToList();
        var groups = new List<object>();
        foreach (var cluster in FaceMatcher.ClusterUnknown(unnamed))
        {
            groups.Add(new
            {
                faceIds = cluster.Select(f => f.Id).ToList(),
                sample = await BuildCropsAsync(cluster),
            });
        }

        return new { suggestions, groups };
    }

    private async Task<List<object>> BuildCropsAsync(IReadOnlyList<StoredFace> faces)
    {
        var crops = new List<object>();
        foreach (var face in faces.Take(MaxCropsPerGroup))
        {
            try
            {
                var crop = await FaceCropHelper.CreateCropBase64Async(face.ImagePath, face.X, face.Y, face.W, face.H);
                crops.Add(new { faceId = face.Id, imagePath = face.ImagePath, crop });
            }
            catch (Exception ex)
            {
                // A missing/broken source image must not break the whole review.
                // Ein fehlendes/defektes Bild darf das Review nicht abbrechen.
                _logger.LogWarning(ex, "Face crop failed for {Path}", face.ImagePath);
            }
        }
        return crops;
    }

    private async Task<object> ConfirmFaceGroupAsync(Dictionary<string, object>? payload)
    {
        var faceIds = PayloadHelper.ExtractLongList(payload?.GetValueOrDefault("faceIds"));
        var personName = PayloadHelper.GetString(payload ?? new(), "personName").Trim();
        if (faceIds.Count == 0 || string.IsNullOrWhiteSpace(personName))
            throw new BridgeException("Name oder Gesichter fehlen.", internalMessage: "confirmFaceGroup: empty faceIds or personName");

        var personId = await _databaseService.GetOrCreatePersonAsync(personName);
        var faces = await _databaseService.GetFacesByIdsAsync(faceIds);
        var pathsToTag = faces.Select(f => f.ImagePath).Distinct(StringComparer.OrdinalIgnoreCase).ToList();

        // Intentional small mirror of TagHandler.UpdateBatchTagAsync's add branch —
        // a shared helper would couple the independent handlers for ~15 lines.
        // Bewusste kleine Spiegelung der Add-Logik aus TagHandler.UpdateBatchTagAsync.
        var succeeded = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var failed = 0;
        foreach (var path in pathsToTag)
        {
            try
            {
                var existing = await _exifToolService.ReadTagsAsync(path);
                var updated = TagHelper.DeduplicateTags(existing.Append(personName));
                if (await _exifToolService.WriteTagsAsync(path, updated))
                {
                    succeeded.Add(path);
                    var image = Models.ImageFile.FromPath(path, updated, await _exifToolService.ReadRatingAsync(path));
                    await _databaseService.SaveImageAsync(image);
                }
                else
                {
                    failed++;
                }
            }
            catch (Exception ex)
            {
                failed++;
                _logger.LogError(ex, "Person tag write failed for {Path}", path);
            }
        }

        var confirmedFaceIds = faces.Where(f => succeeded.Contains(f.ImagePath)).Select(f => f.Id).ToList();
        if (confirmedFaceIds.Count > 0)
            await _databaseService.AssignFacesToPersonAsync(confirmedFaceIds, personId);

        return new { tagged = succeeded.Count, failed };
    }

    private async Task<object> RejectAsync(Dictionary<string, object>? payload)
    {
        var faceIds = PayloadHelper.ExtractLongList(payload?.GetValueOrDefault("faceIds"));
        await _databaseService.RejectFaceSuggestionsAsync(faceIds);
        return true;
    }

    private async Task<object> IgnoreAsync(Dictionary<string, object>? payload)
    {
        var faceIds = PayloadHelper.ExtractLongList(payload?.GetValueOrDefault("faceIds"));
        await _databaseService.SetFacesIgnoredAsync(faceIds);
        return true;
    }

    private async Task<object> GetPersonsAsync()
    {
        var persons = await _databaseService.GetPersonsAsync();
        return persons.Select(p => new { id = p.Id, name = p.Name, faceCount = p.FaceCount }).ToList();
    }
}
