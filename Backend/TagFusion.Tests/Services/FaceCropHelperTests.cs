using System.IO;
using NUnit.Framework;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using TagFusion.Services;

namespace TagFusion.Tests.Services;

[TestFixture]
public class FaceCropHelperTests
{
    [Test]
    public void ComputeCropRectangle_SquareAroundCenter_WithMargin()
    {
        // Box 100x50 at (200, 100) → side = 100 * 1.4 = 140, centered on (250, 125)
        var rect = FaceCropHelper.ComputeCropRectangle(1000, 1000, 200, 100, 100, 50, 0.2f);
        Assert.That(rect.Width, Is.EqualTo(140));
        Assert.That(rect.Height, Is.EqualTo(140));
        Assert.That(rect.X, Is.EqualTo(180));
        Assert.That(rect.Y, Is.EqualTo(55));
    }

    [Test]
    public void ComputeCropRectangle_ClampsAtImageEdges()
    {
        var rect = FaceCropHelper.ComputeCropRectangle(100, 100, 0, 0, 90, 90, 0.2f);
        Assert.That(rect.X, Is.GreaterThanOrEqualTo(0));
        Assert.That(rect.Y, Is.GreaterThanOrEqualTo(0));
        Assert.That(rect.Right, Is.LessThanOrEqualTo(100));
        Assert.That(rect.Bottom, Is.LessThanOrEqualTo(100));
    }

    [Test]
    public async Task CreateCropBase64_ProducesDecodableJpeg()
    {
        var path = Path.Combine(Path.GetTempPath(), Guid.NewGuid() + ".png");
        try
        {
            using (var img = new Image<Rgb24>(200, 200))
                await img.SaveAsPngAsync(path);

            var base64 = await FaceCropHelper.CreateCropBase64Async(path, 50, 50, 40, 40);

            var bytes = Convert.FromBase64String(base64);
            using var crop = Image.Load(bytes);
            Assert.That(crop.Width, Is.EqualTo(96));
            Assert.That(crop.Height, Is.EqualTo(96));
        }
        finally
        {
            if (File.Exists(path)) File.Delete(path);
        }
    }
}
