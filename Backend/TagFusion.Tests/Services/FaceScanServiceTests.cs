using System.IO;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using NUnit.Framework;
using TagFusion.Database;
using TagFusion.Models;
using TagFusion.Services;

namespace TagFusion.Tests.Services;

[TestFixture]
public class FaceScanServiceTests
{
    private Mock<IFaceEngine> _engine = null!;
    private Mock<IDatabaseService> _db = null!;
    private Mock<IFileSystemService> _fs = null!;
    private FaceScanService _service = null!;
    private List<string> _tempFiles = null!;

    [SetUp]
    public void SetUp()
    {
        _engine = new Mock<IFaceEngine>();
        _engine.SetupGet(e => e.IsAvailable).Returns(true);
        _db = new Mock<IDatabaseService>();
        _fs = new Mock<IFileSystemService>();
        _tempFiles = new List<string>();

        // Default: no prior scans, no confirmed persons, empty folder faces.
        _db.Setup(d => d.GetFaceScanTimesAsync(It.IsAny<List<string>>(), It.IsAny<CancellationToken>()))
           .ReturnsAsync(new Dictionary<string, string>());
        _db.Setup(d => d.GetFacesForFolderAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
           .ReturnsAsync(new List<StoredFace>());
        _db.Setup(d => d.GetConfirmedEmbeddingsByPersonAsync(It.IsAny<CancellationToken>()))
           .ReturnsAsync(new Dictionary<long, List<float[]>>());

        _service = new FaceScanService(_engine.Object, _db.Object, _fs.Object, NullLogger<FaceScanService>.Instance);
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
        _fs.Setup(f => f.GetImagesAsync(It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync(images);
    }

    private async Task<FaceScanService.ScanSummary> RunScanAsync(string folder)
    {
        FaceScanService.ScanSummary? summary = null;
        var done = new TaskCompletionSource();
        _service.Completed += s => { summary = s; done.TrySetResult(); };

        Assert.That(_service.StartScan(folder), Is.True);
        await done.Task.WaitAsync(TimeSpan.FromSeconds(10));
        return summary!;
    }

    [Test]
    public async Task Scan_AnalyzesEveryImage_AndSavesFaces_WithProgressEvents()
    {
        var p1 = CreateTempImage();
        var p2 = CreateTempImage();
        SetupFolder(p1, p2);
        _engine.Setup(e => e.AnalyzeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
               .ReturnsAsync(new List<DetectedFace> { new(1, 2, 3, 4, new float[512]) });
        var progressEvents = new List<(int Current, int Total, int Faces)>();
        _service.Progress += (c, t, f) => progressEvents.Add((c, t, f));

        var summary = await RunScanAsync("C:\\egal");

        Assert.That(progressEvents, Has.Count.EqualTo(2));
        Assert.That(progressEvents[1], Is.EqualTo((2, 2, 2)));
        Assert.That(summary.Scanned, Is.EqualTo(2));
        Assert.That(summary.Faces, Is.EqualTo(2));
        Assert.That(summary.Cancelled, Is.False);
        _db.Verify(d => d.SaveFacesAsync(p1, It.Is<IReadOnlyList<NewFace>>(f => f.Count == 1), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()), Times.Once);
        _db.Verify(d => d.SaveFacesAsync(p2, It.IsAny<IReadOnlyList<NewFace>>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Test]
    public async Task Scan_SkipsUnchangedImages()
    {
        var p1 = CreateTempImage();
        SetupFolder(p1);
        var mtime = File.GetLastWriteTimeUtc(p1).ToString("o");
        _db.Setup(d => d.GetFaceScanTimesAsync(It.IsAny<List<string>>(), It.IsAny<CancellationToken>()))
           .ReturnsAsync(new Dictionary<string, string> { [p1] = mtime });

        var summary = await RunScanAsync("C:\\egal");

        Assert.That(summary.Scanned, Is.EqualTo(0));
        _engine.Verify(e => e.AnalyzeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Test]
    public async Task Scan_BrokenImage_CountsAsSkipped_AndContinues()
    {
        var p1 = CreateTempImage();
        var p2 = CreateTempImage();
        SetupFolder(p1, p2);
        _engine.Setup(e => e.AnalyzeAsync(p1, It.IsAny<CancellationToken>())).ThrowsAsync(new InvalidOperationException("kaputt"));
        _engine.Setup(e => e.AnalyzeAsync(p2, It.IsAny<CancellationToken>())).ReturnsAsync(new List<DetectedFace>());

        var summary = await RunScanAsync("C:\\egal");

        Assert.That(summary.Skipped, Is.EqualTo(1));
        Assert.That(summary.Scanned, Is.EqualTo(1));
    }

    [Test]
    public async Task Scan_SecondStartWhileRunning_ReturnsFalse()
    {
        var p1 = CreateTempImage();
        SetupFolder(p1);
        var block = new TaskCompletionSource<IReadOnlyList<DetectedFace>>();
        _engine.Setup(e => e.AnalyzeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>())).Returns(block.Task);

        Assert.That(_service.StartScan("C:\\egal"), Is.True);
        Assert.That(_service.StartScan("C:\\egal"), Is.False);
        Assert.That(_service.IsScanning, Is.True);

        block.SetResult(new List<DetectedFace>());
        await _service.CurrentScanForTests!;
        Assert.That(_service.IsScanning, Is.False);
    }

    [Test]
    public async Task Scan_AppliesSuggestionsAfterCompletion()
    {
        var p1 = CreateTempImage();
        SetupFolder(p1);
        var emb = new float[512]; emb[0] = 1f;
        _engine.Setup(e => e.AnalyzeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
               .ReturnsAsync(new List<DetectedFace> { new(1, 2, 3, 4, emb) });
        _db.Setup(d => d.GetFacesForFolderAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
           .ReturnsAsync(new List<StoredFace> { new(1, 1, p1, 1, 2, 3, 4, emb, null, null, null, null, FaceStatus.Unnamed) });
        _db.Setup(d => d.GetConfirmedEmbeddingsByPersonAsync(It.IsAny<CancellationToken>()))
           .ReturnsAsync(new Dictionary<long, List<float[]>> { [7] = new() { emb } });

        await RunScanAsync("C:\\egal");

        _db.Verify(d => d.ApplyFaceSuggestionsAsync(
            It.Is<IReadOnlyList<FaceSuggestionUpdate>>(s => s.Count == 1 && s[0].PersonId == 7),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Test]
    public async Task Cancel_StopsScan_AndReportsCancelled()
    {
        var p1 = CreateTempImage();
        var p2 = CreateTempImage();
        SetupFolder(p1, p2);
        _engine.Setup(e => e.AnalyzeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
               .Returns(async (string _, CancellationToken ct) =>
               {
                   await Task.CompletedTask;
                   _service.Cancel();
                   ct.ThrowIfCancellationRequested();
                   return (IReadOnlyList<DetectedFace>)new List<DetectedFace>();
               });

        var summary = await RunScanAsync("C:\\egal");

        Assert.That(summary.Cancelled, Is.True);
    }

    [Test]
    public async Task Cancel_AfterScanCompleted_DoesNotThrow()
    {
        var p1 = CreateTempImage();
        SetupFolder(p1);
        _engine.Setup(e => e.AnalyzeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
               .ReturnsAsync(new List<DetectedFace>());
        await RunScanAsync("C:\\egal");

        Assert.DoesNotThrow(() => _service.Cancel());
    }
}
