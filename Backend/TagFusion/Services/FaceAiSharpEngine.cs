using FaceAiSharp;
using Microsoft.Extensions.Logging;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace TagFusion.Services;

/// <summary>
/// IFaceEngine backed by FaceAiSharp (SCRFD detection + ArcFace embeddings via ONNX, CPU).
/// FaceAiSharp types never leave this class — swapping to a raw-ONNX engine later
/// only means writing a new implementation of IFaceEngine.
/// IFaceEngine auf Basis von FaceAiSharp. FaceAiSharp-Typen verlassen diese Klasse nie.
/// </summary>
public sealed class FaceAiSharpEngine : IFaceEngine
{
    private const int MaxDimension = 1280;

    private readonly IFaceDetectorWithLandmarks? _detector;
    private readonly IFaceEmbeddingsGenerator? _embedder;
    private readonly ILogger<FaceAiSharpEngine> _logger;
    private readonly SemaphoreSlim _inferenceLock = new(1, 1);

    public bool IsAvailable { get; }

    public FaceAiSharpEngine(ILogger<FaceAiSharpEngine> logger)
    {
        _logger = logger;
        try
        {
            _detector = FaceAiSharpBundleFactory.CreateFaceDetectorWithLandmarks();
            _embedder = FaceAiSharpBundleFactory.CreateFaceEmbeddingsGenerator();
            IsAvailable = true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Face engine unavailable — models missing or failed to load");
            IsAvailable = false;
        }
    }

    public async Task<IReadOnlyList<DetectedFace>> AnalyzeAsync(string imagePath, CancellationToken cancellationToken = default)
    {
        if (!IsAvailable)
            throw new InvalidOperationException("Face engine is not available");

        // Serialize inference: one image at a time keeps CPU load predictable.
        // Serielle Inferenz — hält die CPU-Last vorhersehbar.
        await _inferenceLock.WaitAsync(cancellationToken);
        try
        {
            return await Task.Run(() => Analyze(imagePath, cancellationToken), cancellationToken);
        }
        finally
        {
            _inferenceLock.Release();
        }
    }

    private List<DetectedFace> Analyze(string imagePath, CancellationToken ct)
    {
        using var image = Image.Load<Rgb24>(imagePath);
        var scale = FaceGeometry.ComputeDownscale(image.Width, image.Height, MaxDimension);
        if (scale < 1.0)
            image.Mutate(x => x.Resize((int)(image.Width * scale), (int)(image.Height * scale)));

        var results = new List<DetectedFace>();
        foreach (var face in _detector!.DetectFaces(image))
        {
            ct.ThrowIfCancellationRequested();
            if (face.Landmarks is null || face.Landmarks.Count == 0) continue;

            // AlignFaceUsingLandmarks mutates the image — clone per face.
            // AlignFaceUsingLandmarks verändert das Bild — pro Gesicht klonen.
            using var clone = image.Clone();
            _embedder!.AlignFaceUsingLandmarks(clone, face.Landmarks);
            var embedding = _embedder.GenerateEmbedding(clone);

            var (x, y, w, h) = FaceGeometry.ToOriginal(face.Box, scale);
            results.Add(new DetectedFace(x, y, w, h, embedding));
        }
        return results;
    }
}
