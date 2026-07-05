using NUnit.Framework;
using SixLabors.ImageSharp;
using TagFusion.Services;

namespace TagFusion.Tests.Services;

[TestFixture]
public class FaceGeometryTests
{
    [Test]
    public void ComputeDownscale_LargeImage_ScalesToMaxDim()
    {
        Assert.That(FaceGeometry.ComputeDownscale(2560, 1440, 1280), Is.EqualTo(0.5).Within(1e-9));
    }

    [Test]
    public void ComputeDownscale_SmallImage_NeverUpscales()
    {
        Assert.That(FaceGeometry.ComputeDownscale(640, 480, 1280), Is.EqualTo(1.0));
    }

    [Test]
    public void ToOriginal_RescalesBoxBackToOriginalPixels()
    {
        var (x, y, w, h) = FaceGeometry.ToOriginal(new RectangleF(10, 20, 30, 40), 0.5);
        Assert.That(x, Is.EqualTo(20f));
        Assert.That(y, Is.EqualTo(40f));
        Assert.That(w, Is.EqualTo(60f));
        Assert.That(h, Is.EqualTo(80f));
    }
}
