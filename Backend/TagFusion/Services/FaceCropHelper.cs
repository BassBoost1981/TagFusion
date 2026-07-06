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
        // Square crop centered on the face box, enlarged by the margin on every side.
        // Quadratischer Ausschnitt um die Box-Mitte, per Rand-Faktor vergrößert.
        var side = Math.Max(w, h) * (1 + 2 * marginFactor);
        var centerX = x + w / 2;
        var centerY = y + h / 2;

        var left = (int)Math.Round(centerX - side / 2);
        var top = (int)Math.Round(centerY - side / 2);
        var size = (int)Math.Round(side);

        // Clamp strategy is shrink-and-clamp, NOT shift-to-fit: near the right/bottom
        // edge the square shrinks instead of sliding back into the image. Intentional —
        // keeps the face centered; do not "fix" by shifting.
        // Klemm-Strategie ist Verkleinern statt Verschieben: am Rand schrumpft das
        // Quadrat, statt ins Bild zurückzurutschen — hält das Gesicht zentriert.
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

    /// <summary>
    /// Produce crops for several faces of ONE image with a single decode.
    /// Erzeugt mehrere Ausschnitte EINES Bildes mit nur einem Dekodier-Vorgang.
    /// </summary>
    public static async Task<Dictionary<long, string>> CreateCropsBase64Async(
        string imagePath,
        IReadOnlyList<(long FaceId, float X, float Y, float W, float H)> boxes,
        int targetSize = 96, float marginFactor = 0.2f, CancellationToken ct = default)
    {
        var result = new Dictionary<long, string>();
        using var image = await Image.LoadAsync<Rgb24>(imagePath, ct);
        foreach (var (faceId, x, y, w, h) in boxes)
        {
            ct.ThrowIfCancellationRequested();
            var rect = ComputeCropRectangle(image.Width, image.Height, x, y, w, h, marginFactor);
            // Clone processes on a copy — the decoded original stays untouched for the next box.
            // Clone arbeitet auf einer Kopie — das dekodierte Original bleibt für die nächste Box intakt.
            using var crop = image.Clone(ctx => ctx.Crop(rect).Resize(targetSize, targetSize));
            using var ms = new MemoryStream();
            await crop.SaveAsJpegAsync(ms, ct);
            result[faceId] = Convert.ToBase64String(ms.ToArray());
        }
        return result;
    }
}
