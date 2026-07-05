using SixLabors.ImageSharp;

namespace TagFusion.Services;

/// <summary>Pure coordinate math for the face pipeline. / Reine Koordinaten-Mathematik.</summary>
public static class FaceGeometry
{
    /// <summary>Scale factor to fit into maxDim; never upscales (max 1.0).</summary>
    public static double ComputeDownscale(int width, int height, int maxDim)
        => Math.Min(1.0, (double)maxDim / Math.Max(width, height));

    /// <summary>Convert a box detected on the downscaled image back to original pixels.</summary>
    public static (float X, float Y, float W, float H) ToOriginal(RectangleF box, double scale)
        => ((float)(box.X / scale), (float)(box.Y / scale), (float)(box.Width / scale), (float)(box.Height / scale));
}
