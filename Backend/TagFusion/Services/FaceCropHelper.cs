using System.IO;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace TagFusion.Services;

/// <summary>
/// Produces small square face crops as Base64 JPEG for the review UI.
/// Erzeugt kleine quadratische Gesichts-Ausschnitte als Base64-JPEG für das Review-Panel.
/// </summary>
public static class FaceCropHelper
{
    public static Rectangle ComputeCropRectangle(int imageWidth, int imageHeight, float x, float y, float w, float h, float marginFactor)
    {
        var side = Math.Max(w, h) * (1 + 2 * marginFactor);
        var centerX = x + w / 2;
        var centerY = y + h / 2;

        var left = (int)Math.Round(centerX - side / 2);
        var top = (int)Math.Round(centerY - side / 2);
        var size = (int)Math.Round(side);

        // Clamp to image bounds, keep at least 1x1. / An Bildgrenzen klemmen, min. 1x1.
        left = Math.Max(0, Math.Min(left, imageWidth - 1));
        top = Math.Max(0, Math.Min(top, imageHeight - 1));
        size = Math.Max(1, Math.Min(size, Math.Min(imageWidth - left, imageHeight - top)));

        return new Rectangle(left, top, size, size);
    }

    public static async Task<string> CreateCropBase64Async(
        string imagePath, float x, float y, float w, float h,
        int targetSize = 96, float marginFactor = 0.2f, CancellationToken ct = default)
    {
        using var image = await Image.LoadAsync<Rgb24>(imagePath, ct);
        var rect = ComputeCropRectangle(image.Width, image.Height, x, y, w, h, marginFactor);
        image.Mutate(ctx => ctx.Crop(rect).Resize(targetSize, targetSize));

        using var ms = new MemoryStream();
        await image.SaveAsJpegAsync(ms, ct);
        return Convert.ToBase64String(ms.ToArray());
    }
}
