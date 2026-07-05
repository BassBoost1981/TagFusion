using NUnit.Framework;
using TagFusion.Models;
using TagFusion.Services;

namespace TagFusion.Tests.Services;

[TestFixture]
public class SearchResultCleanerTests
{
    private static ImageFile Img(string path) => new() { Path = path };

    [Test]
    public void Partition_ExistingFile_IsVisible()
    {
        var result = SearchResultCleaner.Partition(
            new[] { Img("C:\\a.jpg") }, _ => true, _ => true);

        Assert.That(result.Visible, Has.Count.EqualTo(1));
        Assert.That(result.DeletablePaths, Is.Empty);
    }

    [Test]
    public void Partition_MissingFileOnAvailableRoot_IsDeletable()
    {
        var result = SearchResultCleaner.Partition(
            new[] { Img("C:\\weg.jpg") }, _ => true, _ => false);

        Assert.That(result.Visible, Is.Empty);
        Assert.That(result.DeletablePaths, Is.EqualTo(new[] { "C:\\weg.jpg" }));
    }

    [Test]
    public void Partition_MissingFileOnUnavailableRoot_IsHiddenButNotDeletable()
    {
        // Unplugged external drive: hide from results, never delete from DB.
        // Abgestöpselte externe Platte: ausblenden, aber nie aus der DB löschen.
        var result = SearchResultCleaner.Partition(
            new[] { Img("E:\\extern\\foto.jpg") }, _ => false, _ => false);

        Assert.That(result.Visible, Is.Empty);
        Assert.That(result.DeletablePaths, Is.Empty);
    }

    [Test]
    public void Partition_ChecksEachRootOnlyOnce()
    {
        var rootChecks = new List<string>();
        var images = new[] { Img("C:\\a.jpg"), Img("C:\\b.jpg"), Img("D:\\c.jpg") };

        SearchResultCleaner.Partition(images,
            root => { rootChecks.Add(root); return true; },
            _ => true);

        Assert.That(rootChecks, Has.Count.EqualTo(2)); // C:\ und D:\ je einmal
    }

    [Test]
    public void Partition_MixedRoots_PartitionsIndependently()
    {
        var images = new[] { Img("C:\\da.jpg"), Img("C:\\weg.jpg"), Img("E:\\offline.jpg") };

        var result = SearchResultCleaner.Partition(images,
            root => root.StartsWith("C", StringComparison.OrdinalIgnoreCase),
            path => path == "C:\\da.jpg");

        Assert.That(result.Visible.Select(i => i.Path), Is.EqualTo(new[] { "C:\\da.jpg" }));
        Assert.That(result.DeletablePaths, Is.EqualTo(new[] { "C:\\weg.jpg" }));
    }
}
