using System.IO;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using NUnit.Framework;
using TagFusion.Configuration;
using TagFusion.Services;

namespace TagFusion.Tests.Services;

[TestFixture]
public class FileSystemServiceTests
{
    [Test]
    public void CreateFolderStatsParallelOptions_UsesBoundedParallelismAndToken()
    {
        using var cts = new CancellationTokenSource();
        var options = FileSystemService.CreateFolderStatsParallelOptions(cts.Token);

        Assert.That(options.CancellationToken, Is.EqualTo(cts.Token));
        Assert.That(options.MaxDegreeOfParallelism, Is.GreaterThanOrEqualTo(1));
        Assert.That(options.MaxDegreeOfParallelism, Is.LessThanOrEqualTo(8));
    }

    [Test]
    public void GetFolderContentsAsync_CancelledToken_ThrowsOperationCanceledException()
    {
        var thumbnailService = CreateThumbnailService();
        var service = new FileSystemService(null!, thumbnailService, NullLogger<FileSystemService>.Instance);
        using var cts = new CancellationTokenSource();
        cts.Cancel();

        var tempDir = Path.Combine(Path.GetTempPath(), $"TagFusionFileSystem_{Guid.NewGuid():N}");
        Directory.CreateDirectory(tempDir);

        try
        {
            Assert.ThrowsAsync<OperationCanceledException>(async () =>
                await service.GetFolderContentsAsync(tempDir, cts.Token));
        }
        finally
        {
            Directory.Delete(tempDir, true);
        }
    }

    [Test]
    public void SelectFolderAsync_CancelledToken_ThrowsOperationCanceledException()
    {
        var thumbnailService = CreateThumbnailService();
        var service = new FileSystemService(null!, thumbnailService, NullLogger<FileSystemService>.Instance);
        using var cts = new CancellationTokenSource();
        cts.Cancel();

        Assert.ThrowsAsync<OperationCanceledException>(async () =>
            await service.SelectFolderAsync(cts.Token));
    }

    private static ThumbnailService CreateThumbnailService()
    {
        var settings = Options.Create(new ThumbnailSettings
        {
            Size = 200,
            JpegQuality = 85,
            MaxParallel = 2,
            MaxCacheSizeMb = 16,
        });

        return new ThumbnailService(NullLogger<ThumbnailService>.Instance, settings);
    }
}
