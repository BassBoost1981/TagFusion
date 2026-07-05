namespace TagFusion.Services;

/// <summary>A detected face: bounding box in ORIGINAL image pixels plus its embedding.
/// Ein erkanntes Gesicht: Rahmen in Originalpixeln plus Embedding.</summary>
public record DetectedFace(float X, float Y, float Width, float Height, float[] Embedding);

/// <summary>
/// Local face detection + embedding engine. Implementations must never throw from
/// their constructor — a missing model results in IsAvailable = false instead.
/// Lokale Gesichts-Engine. Konstruktoren dürfen nie werfen — fehlende Modelle
/// bedeuten IsAvailable = false, die App läuft ohne das Feature weiter.
/// </summary>
public interface IFaceEngine
{
    bool IsAvailable { get; }
    Task<IReadOnlyList<DetectedFace>> AnalyzeAsync(string imagePath, CancellationToken cancellationToken = default);
}
