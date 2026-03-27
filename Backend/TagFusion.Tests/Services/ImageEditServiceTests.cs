using NUnit.Framework;
using SixLabors.ImageSharp.Formats.Bmp;
using SixLabors.ImageSharp.Formats.Gif;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.Formats.Tiff;
using TagFusion.Services;

namespace TagFusion.Tests.Services;

[TestFixture]
public class ImageEditServiceTests
{
    // ========================================================================
    // GetEncoder Tests (internal static)
    // ========================================================================

    [Test]
    public void GetEncoder_Jpg_ReturnsJpegEncoder()
    {
        var encoder = ImageEditService.GetEncoder(".jpg");
        Assert.That(encoder, Is.InstanceOf<JpegEncoder>());
    }

    [Test]
    public void GetEncoder_Jpeg_ReturnsJpegEncoder()
    {
        var encoder = ImageEditService.GetEncoder(".jpeg");
        Assert.That(encoder, Is.InstanceOf<JpegEncoder>());
    }

    [Test]
    public void GetEncoder_Png_ReturnsPngEncoder()
    {
        var encoder = ImageEditService.GetEncoder(".png");
        Assert.That(encoder, Is.InstanceOf<PngEncoder>());
    }

    [Test]
    public void GetEncoder_Gif_ReturnsGifEncoder()
    {
        var encoder = ImageEditService.GetEncoder(".gif");
        Assert.That(encoder, Is.InstanceOf<GifEncoder>());
    }

    [Test]
    public void GetEncoder_Tiff_ReturnsTiffEncoder()
    {
        var encoder = ImageEditService.GetEncoder(".tiff");
        Assert.That(encoder, Is.InstanceOf<TiffEncoder>());
    }

    [Test]
    public void GetEncoder_Unknown_DefaultsToJpegEncoder()
    {
        var encoder = ImageEditService.GetEncoder(".webp");
        Assert.That(encoder, Is.InstanceOf<JpegEncoder>());
    }
}
