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
        var angleObj = payload.GetValueOrDefault("angle");
        int angle = PayloadHelper.GetInt(angleObj, 90);
        return await _imageEditService.RotateImagesAsync(paths, angle);
    }

    private async Task<Dictionary<string, bool>> FlipImagesAsync(Dictionary<string, object>? payload)
    {
        if (payload == null) return new Dictionary<string, bool>();

        var paths = PayloadHelper.GetStringArray(payload, "paths");
        var horizontalObj = payload.GetValueOrDefault("horizontal");
        bool horizontal = PayloadHelper.GetBool(horizontalObj, true);
        return await _imageEditService.FlipImagesAsync(paths, horizontal);
    }
}
