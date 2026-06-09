using TagFusion.Services;

namespace TagFusion.Bridge.Handlers;

/// <summary>
/// Handles image editing actions: rotateImages, flipImages.
/// </summary>
public class ImageEditHandler : IBridgeHandler
{
    private readonly IImageEditService _imageEditService;

    private static readonly HashSet<string> _supported = new(StringComparer.Ordinal)
    {
        "rotateImages", "flipImages"
    };

    public IReadOnlySet<string> SupportedActions => _supported;

    public ImageEditHandler(IImageEditService imageEditService)
    {
        _imageEditService = imageEditService;
    }

    public async Task<object?> HandleAsync(string action, Dictionary<string, object>? payload)
    {
        return action switch
        {
            "rotateImages" => await RotateImagesAsync(payload),
            "flipImages" => await FlipImagesAsync(payload),
            _ => throw new NotSupportedException($"Unknown action: {action}")
        };
    }

    private async Task<Dictionary<string, bool>> RotateImagesAsync(Dictionary<string, object>? payload)
    {
        if (payload == null) return new Dictionary<string, bool>();

        var paths = PayloadHelper.GetStringArray(payload, "paths");
        if (paths.Length == 0)
            throw new BridgeException("Keine Bilder ausgewählt.");

        var angleObj = payload.GetValueOrDefault("angle");
        int angle = PayloadHelper.GetInt(angleObj, 90);
        if (angle is not (90 or -90 or 180 or 270))
            throw new BridgeException(
                $"Ungültiger Drehwinkel ({angle}°). Erlaubt sind 90°, -90° oder 180°.",
                internalMessage: $"Invalid rotate angle: {angle}");

        return await _imageEditService.RotateImagesAsync(paths, angle);
    }

    private async Task<Dictionary<string, bool>> FlipImagesAsync(Dictionary<string, object>? payload)
    {
        if (payload == null) return new Dictionary<string, bool>();

        var paths = PayloadHelper.GetStringArray(payload, "paths");
        if (paths.Length == 0)
            throw new BridgeException("Keine Bilder ausgewählt.");

        var horizontalObj = payload.GetValueOrDefault("horizontal");
        bool horizontal = PayloadHelper.GetBool(horizontalObj, true);
        return await _imageEditService.FlipImagesAsync(paths, horizontal);
    }
}
