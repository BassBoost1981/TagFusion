using System.IO;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using NUnit.Framework;
using TagFusion.Database;
using TagFusion.Models;
using TagFusion.Services;

namespace TagFusion.Tests.Services;

[TestFixture]
public class DescriptionScanServiceTests
{
    private Mock<IAiCaptionClient> _client = null!;
    private Mock<IExifToolService> _exifTool = null!;
    private Mock<IDatabaseService> _db = null!;
    private Mock<IFileSystemService> _fs = null!;
    private DescriptionScanService _service = null!;
    private List<string> _tempFiles = null!;

    [SetUp]
    public void SetUp()
    {
        _client = new Mock<IAiCaptionClient>();
        _exifTool = new Mock<IExifToolService>();
        _db = new Mock<IDatabaseService>();
        _fs = new Mock<IFileSystemService>();
        _tempFiles = new List<string>();

        _exifTool.Setup(e => e.ReadDescriptionsBatchAsync(It.IsAny<List<string>>(), It.IsAny<CancellationToken>()))
                 .ReturnsAsync(new Dictionary<string, string>());
        _exifTool.Setup(e => e.WriteDescriptionAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
                 .ReturnsAsync(true);
        _exifTool.Setup(e => e.ReadTagsAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                 .ReturnsAsync(new List<string>());
        _exifTool.Setup(e => e.ReadRatingAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                 .ReturnsAsync(0);
        _client.Setup(c => c.CaptionAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
               .ReturnsAsync("Eine Beschreibung");

        _service = new DescriptionScanService(_client.Object, _exifTool.Object, _db.Object, _fs.Object,
            NullLogger<DescriptionScanService>.Instance);
    }

    [TearDown]
    public void TearDown()
    {
        foreach (var f in _tempFiles)
            if (File.Exists(f)) File.Delete(f);
    }

    private string CreateTempImage()
    {
        var path = Path.Combine(Path.GetTempPath(), Guid.NewGuid() + ".jpg");
        File.WriteAllText(path, "fake");
        _tempFiles.Add(path);
        return path;
    }

    private void SetupFolder(params string[] paths)
    {
        var images = paths.Select(p => new ImageFile { Path = p, FileName = Path.GetFileName(p) }).ToList();
        _fs.Setup(f => f.GetImagesAsync(It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<CancellationToken>())).ReturnsAsync(images);
    }

    private async Task<DescriptionScanService.ScanSummary> RunScanAsync(
        string folder, string model = "qwen", string prompt = "p", bool overwrite = false)
    {
        DescriptionScanService.ScanSummary? summary = null;
        var done = new TaskCompletionSource();
        _service.Completed += s => { summary = s; done.TrySetResult(); };

        Assert.That(_service.StartScan(folder, model, prompt, overwrite), Is.True);
        await done.Task.WaitAsync(TimeSpan.FromSeconds(10));
        return summary!;
    }

    [Test]
    public async Task Scan_DescribesEveryImage_WritesMetadataAndDb_WithProgress()
    {
        var p1 = CreateTempImage();
        var p2 = CreateTempImage();
        SetupFolder(p1, p2);
        var progress = new List<(int C, int T, int D)>();
        _service.Progress += (c, t, d) => progress.Add((c, t, d));

        var summary = await RunScanAsync("C:\\egal");

        Assert.That(summary.Described, Is.EqualTo(2));
        Assert.That(summary.Aborted, Is.False);
        Assert.That(progress[^1], Is.EqualTo((2, 2, 2)));
        _exifTool.Verify(e => e.WriteDescriptionAsync(p1, "Eine Beschreibung", It.IsAny<CancellationToken>()), Times.Once);
        _db.Verify(d => d.SaveImageAsync(It.Is<ImageFile>(i => i.Path == p1), It.IsAny<CancellationToken>()), Times.Once);
        _db.Verify(d => d.SetImageDescriptionAsync(p1, "Eine Beschreibung", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Test]
    public async Task Scan_SkipsImagesWithExistingDescription_WhenNotOverwriting()
    {
        var p1 = CreateTempImage();
        var p2 = CreateTempImage();
        SetupFolder(p1, p2);
        _exifTool.Setup(e => e.ReadDescriptionsBatchAsync(It.IsAny<List<string>>(), It.IsAny<CancellationToken>()))
                 .ReturnsAsync(new Dictionary<string, string> { [p1] = "Schon da" });

        var summary = await RunScanAsync("C:\\egal", overwrite: false);

        Assert.That(summary.Skipped, Is.EqualTo(1));
        Assert.That(summary.Described, Is.EqualTo(1));
        _client.Verify(c => c.CaptionAsync(p1, It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Test]
    public async Task Scan_OverwriteMode_DescribesEverything()
    {
        var p1 = CreateTempImage();
        SetupFolder(p1);
        _exifTool.Setup(e => e.ReadDescriptionsBatchAsync(It.IsAny<List<string>>(), It.IsAny<CancellationToken>()))
                 .ReturnsAsync(new Dictionary<string, string> { [p1] = "Alt" });

        var summary = await RunScanAsync("C:\\egal", overwrite: true);

        Assert.That(summary.Described, Is.EqualTo(1));
        Assert.That(summary.Skipped, Is.EqualTo(0));
    }

    [Test]
    public async Task Scan_SingleFailure_CountsAndContinues()
    {
        var p1 = CreateTempImage();
        var p2 = CreateTempImage();
        SetupFolder(p1, p2);
        _client.Setup(c => c.CaptionAsync(p1, It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
               .ThrowsAsync(new InvalidOperationException("kaputt"));

        var summary = await RunScanAsync("C:\\egal");

        Assert.That(summary.Failed, Is.EqualTo(1));
        Assert.That(summary.Described, Is.EqualTo(1));
        Assert.That(summary.Aborted, Is.False);
    }

    [Test]
    public async Task Scan_ThreeConsecutiveFailures_Aborts()
    {
        var paths = new[] { CreateTempImage(), CreateTempImage(), CreateTempImage(), CreateTempImage() };
        SetupFolder(paths);
        _client.Setup(c => c.CaptionAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
               .ThrowsAsync(new InvalidOperationException("server weg"));

        var summary = await RunScanAsync("C:\\egal");

        Assert.That(summary.Aborted, Is.True);
        Assert.That(summary.Failed, Is.EqualTo(3));
        _client.Verify(c => c.CaptionAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Exactly(3));
    }

    [Test]
    public async Task Scan_HttpTimeout_CountsAsFailureNotCancellation()
    {
        var paths = new[] { CreateTempImage(), CreateTempImage(), CreateTempImage(), CreateTempImage() };
        SetupFolder(paths);
        _client.Setup(c => c.CaptionAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
               .ThrowsAsync(new TaskCanceledException("timeout"));

        var summary = await RunScanAsync("C:\\egal");

        Assert.That(summary.Cancelled, Is.False);
        Assert.That(summary.Aborted, Is.True);
        Assert.That(summary.Failed, Is.EqualTo(3));
    }

    [Test]
    public async Task Scan_SecondStartWhileRunning_ReturnsFalse()
    {
        var p1 = CreateTempImage();
        SetupFolder(p1);
        var block = new TaskCompletionSource<string>();
        _client.Setup(c => c.CaptionAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
               .Returns(block.Task);

        Assert.That(_service.StartScan("C:\\egal", "m", "p", false), Is.True);
        Assert.That(_service.StartScan("C:\\egal", "m", "p", false), Is.False);
        Assert.That(_service.IsScanning, Is.True);

        block.SetResult("fertig");
        await _service.CurrentScanForTests!;
        Assert.That(_service.IsScanning, Is.False);
    }

    [Test]
    public async Task Cancel_StopsScan_AndReportsCancelled()
    {
        var p1 = CreateTempImage();
        var p2 = CreateTempImage();
        SetupFolder(p1, p2);
        _client.Setup(c => c.CaptionAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
               .Returns(async (string _, string _, string _, CancellationToken ct) =>
               {
                   await Task.CompletedTask;
                   _service.Cancel();
                   ct.ThrowIfCancellationRequested();
                   return "x";
               });

        var summary = await RunScanAsync("C:\\egal");

        Assert.That(summary.Cancelled, Is.True);
    }

    [Test]
    public async Task Cancel_AfterScanCompleted_DoesNotThrow()
    {
        var p1 = CreateTempImage();
        SetupFolder(p1);
        await RunScanAsync("C:\\egal");

        Assert.DoesNotThrow(() => _service.Cancel());
    }

    [Test]
    public async Task Scan_CaptionWithLineBreaks_IsNormalizedBeforeWriting()
    {
        var p1 = CreateTempImage();
        SetupFolder(p1);
        _client.Setup(c => c.CaptionAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
               .ReturnsAsync("Zeile eins.\r\nZeile   zwei.");

        await RunScanAsync("C:\\egal");

        _exifTool.Verify(e => e.WriteDescriptionAsync(p1, "Zeile eins. Zeile zwei.", It.IsAny<CancellationToken>()), Times.Once);
        _db.Verify(d => d.SetImageDescriptionAsync(p1, "Zeile eins. Zeile zwei.", It.IsAny<CancellationToken>()), Times.Once);
    }
}
