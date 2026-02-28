using System.Drawing.Imaging;
using NUnit.Framework;
using TagFusion.Services;

namespace TagFusion.Tests.Services;

[TestFixture]
public class ImageEditServiceTests
{
    // ========================================================================
    // GetImageFormat Tests (internal static)
    // ========================================================================

    [Test]
    public void GetImageFormat_Jpg_ReturnsJpeg()
    {
        var format = ImageEditService.GetImageFormat(".jpg");
        Assert.That(format.Guid, Is.EqualTo(ImageFormat.Jpeg.Guid));
    }

    [Test]
    public void GetImageFormat_Jpeg_ReturnsJpeg()
    {
        var format = ImageEditService.GetImageFormat(".jpeg");
        Assert.That(format.Guid, Is.EqualTo(ImageFormat.Jpeg.Guid));
    }

    [Test]
    public void GetImageFormat_Png_ReturnsPng()
    {
        var format = ImageEditService.GetImageFormat(".png");
        Assert.That(format.Guid, Is.EqualTo(ImageFormat.Png.Guid));
    }

    [Test]
    public void GetImageFormat_Gif_ReturnsGif()
    {
        var format = ImageEditService.GetImageFormat(".gif");
        Assert.That(format.Guid, Is.EqualTo(ImageFormat.Gif.Guid));
    }

    [Test]
    public void GetImageFormat_Tiff_ReturnsTiff()
    {
        var format = ImageEditService.GetImageFormat(".tiff");
        Assert.That(format.Guid, Is.EqualTo(ImageFormat.Tiff.Guid));
    }

    [Test]
    public void GetImageFormat_Unknown_DefaultsToJpeg()
    {
        var format = ImageEditService.GetImageFormat(".webp");
        Assert.That(format.Guid, Is.EqualTo(ImageFormat.Jpeg.Guid));
    }
}
