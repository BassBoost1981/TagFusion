using System.IO;
using System.Security.AccessControl;
using System.Security.Principal;
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
                await service.GetFolderContentsAsync(tempDir, false, cts.Token));
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

    [Test]
    public async Task GetImagesAsync_WithoutSubfolders_ReturnsOnlyTopLevelImages()
    {
        var root = CreateTempTree();
        try
        {
            var images = await CreateService().GetImagesAsync(root);

            Assert.That(images.Select(i => i.FileName), Is.EqualTo(new[] { "top.jpg" }));
        }
        finally
        {
            DeleteTree(root);
        }
    }

    [Test]
    public async Task GetImagesAsync_IncludeSubfolders_ReturnsImagesFromNestedFolders()
    {
        var root = CreateTempTree();
        try
        {
            var images = await CreateService().GetImagesAsync(root, includeSubfolders: true);

            Assert.That(images.Select(i => i.Path), Does.Contain(Path.Combine(root, "top.jpg")));
            Assert.That(images.Select(i => i.Path), Does.Contain(Path.Combine(root, "sub", "deep.jpg")));
            Assert.That(images.Select(i => i.Path), Does.Contain(Path.Combine(root, "sub", "nested", "deepest.jpg")));
            // Non-image files stay out. / Nicht-Bilddateien bleiben draußen.
            Assert.That(images.Select(i => i.FileName), Does.Not.Contain("notes.txt"));
        }
        finally
        {
            DeleteTree(root);
        }
    }

    [Test]
    public async Task GetImagesAsync_IncludeSubfolders_SkipsHiddenSubfolderButKeepsSiblings()
    {
        var root = CreateTempTree();
        var hidden = Directory.CreateDirectory(Path.Combine(root, "hidden"));
        CreateImage(hidden.FullName, "hidden.jpg");
        hidden.Attributes |= FileAttributes.Hidden;

        try
        {
            var images = await CreateService().GetImagesAsync(root, includeSubfolders: true);

            Assert.That(images.Select(i => i.FileName), Does.Not.Contain("hidden.jpg"));
            Assert.That(images.Select(i => i.FileName), Does.Contain("deepest.jpg"));
        }
        finally
        {
            hidden.Attributes &= ~FileAttributes.Hidden;
            DeleteTree(root);
        }
    }

    [Test]
    public async Task GetImagesAsync_IncludeSubfolders_InaccessibleSubfolderDoesNotAbortWalk()
    {
        var root = CreateTempTree();
        var denied = Directory.CreateDirectory(Path.Combine(root, "denied"));
        CreateImage(denied.FullName, "denied.jpg");

        FileSystemAccessRule? denyRule = null;
        try
        {
            denyRule = DenyListing(denied);
            if (denyRule == null || CanList(denied.FullName))
            {
                // Elevated or ACL-less filesystem — the scenario cannot be produced here.
                // Erhöhte Rechte oder ACL-loses Dateisystem — Szenario nicht herstellbar.
                Assert.Ignore("Deny-ACL greift in dieser Umgebung nicht.");
            }

            var images = await CreateService().GetImagesAsync(root, includeSubfolders: true);

            // The unreadable folder is skipped, everything else is still enumerated.
            // Der unlesbare Ordner wird übersprungen, der Rest wird trotzdem gelesen.
            Assert.That(images.Select(i => i.FileName), Does.Not.Contain("denied.jpg"));
            Assert.That(images.Select(i => i.FileName), Does.Contain("top.jpg"));
            Assert.That(images.Select(i => i.FileName), Does.Contain("deepest.jpg"));
        }
        finally
        {
            if (denyRule != null) RemoveRule(denied, denyRule);
            DeleteTree(root);
        }
    }

    [Test]
    public async Task GetImagesAsync_IncludeSubfolders_SortsEqualNamesByFullPath()
    {
        var root = CreateTempTree();
        CreateImage(Directory.CreateDirectory(Path.Combine(root, "a")).FullName, "same.jpg");
        CreateImage(Directory.CreateDirectory(Path.Combine(root, "b")).FullName, "same.jpg");

        try
        {
            var images = await CreateService().GetImagesAsync(root, includeSubfolders: true);
            var samePaths = images.Where(i => i.FileName == "same.jpg").Select(i => i.Path).ToList();

            Assert.That(samePaths, Is.EqualTo(new[]
            {
                Path.Combine(root, "a", "same.jpg"),
                Path.Combine(root, "b", "same.jpg"),
            }));
        }
        finally
        {
            DeleteTree(root);
        }
    }

    [Test]
    public async Task GetFolderContentsAsync_WithoutSubfolders_KeepsFolderTiles()
    {
        var root = CreateTempTree();
        try
        {
            var items = await CreateService().GetFolderContentsAsync(root);

            Assert.That(items.Where(i => i.IsFolder).Select(i => i.Name), Is.EqualTo(new[] { "sub" }));
            Assert.That(items.Where(i => !i.IsFolder).Select(i => i.Name), Is.EqualTo(new[] { "top.jpg" }));
        }
        finally
        {
            DeleteTree(root);
        }
    }

    [Test]
    public async Task GetFolderContentsAsync_IncludeSubfolders_ReturnsSubtreeImagesWithoutFolderTiles()
    {
        var root = CreateTempTree();
        try
        {
            var items = await CreateService().GetFolderContentsAsync(root, includeSubfolders: true);

            Assert.That(items.Any(i => i.IsFolder), Is.False);
            Assert.That(items.Select(i => i.Name),
                Is.EquivalentTo(new[] { "deep.jpg", "deepest.jpg", "top.jpg" }));
        }
        finally
        {
            DeleteTree(root);
        }
    }

    private static FileSystemService CreateService() =>
        new(null!, CreateThumbnailService(), NullLogger<FileSystemService>.Instance);

    /// <summary>
    /// root/top.jpg, root/notes.txt, root/sub/deep.jpg, root/sub/nested/deepest.jpg
    /// </summary>
    private static string CreateTempTree()
    {
        var root = Path.Combine(Path.GetTempPath(), $"TagFusionFileSystem_{Guid.NewGuid():N}");
        var nested = Directory.CreateDirectory(Path.Combine(root, "sub", "nested"));

        CreateImage(root, "top.jpg");
        File.WriteAllText(Path.Combine(root, "notes.txt"), "kein Bild");
        CreateImage(Path.Combine(root, "sub"), "deep.jpg");
        CreateImage(nested.FullName, "deepest.jpg");

        return root;
    }

    private static void CreateImage(string folder, string fileName)
    {
        Directory.CreateDirectory(folder);
        File.WriteAllText(Path.Combine(folder, fileName), "fake");
    }

    private static void DeleteTree(string root)
    {
        try { Directory.Delete(root, true); }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
    }

    private static FileSystemAccessRule? DenyListing(DirectoryInfo dir)
    {
        try
        {
            var rule = new FileSystemAccessRule(
                WindowsIdentity.GetCurrent().User!,
                FileSystemRights.ListDirectory | FileSystemRights.ReadData,
                InheritanceFlags.None,
                PropagationFlags.None,
                AccessControlType.Deny);

            var security = dir.GetAccessControl();
            security.AddAccessRule(rule);
            dir.SetAccessControl(security);
            return rule;
        }
        catch (Exception)
        {
            return null;
        }
    }

    private static void RemoveRule(DirectoryInfo dir, FileSystemAccessRule rule)
    {
        try
        {
            var security = dir.GetAccessControl();
            security.RemoveAccessRule(rule);
            dir.SetAccessControl(security);
        }
        catch (Exception) { }
    }

    private static bool CanList(string path)
    {
        try
        {
            Directory.EnumerateFiles(path).ToList();
            return true;
        }
        catch (Exception)
        {
            return false;
        }
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
