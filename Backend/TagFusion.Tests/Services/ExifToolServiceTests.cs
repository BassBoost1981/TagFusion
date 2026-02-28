using NUnit.Framework;
using TagFusion.Services;

namespace TagFusion.Tests.Services;

[TestFixture]
public class ExifToolServiceTests
{
    // ========================================================================
    // ParseArguments Tests
    // ========================================================================

    [Test]
    public void ParseArguments_SimpleArgs_SplitsBySpace()
    {
        var result = ExifToolService.ParseArguments("-Keywords -XMP:Subject -j");
        Assert.That(result, Is.EqualTo(new[] { "-Keywords", "-XMP:Subject", "-j" }));
    }

    [Test]
    public void ParseArguments_QuotedString_PreservesSpaces()
    {
        var result = ExifToolService.ParseArguments("-Keywords \"tag with spaces\"");
        Assert.That(result, Has.Count.EqualTo(2));
        Assert.That(result[0], Is.EqualTo("-Keywords"));
        Assert.That(result[1], Is.EqualTo("tag with spaces"));
    }

    [Test]
    public void ParseArguments_QuotedPath_PreservesPath()
    {
        var result = ExifToolService.ParseArguments("-j \"C:\\Users\\Test\\My Pictures\\photo.jpg\"");
        Assert.That(result, Has.Count.EqualTo(2));
        Assert.That(result[1], Is.EqualTo("C:\\Users\\Test\\My Pictures\\photo.jpg"));
    }

    [Test]
    public void ParseArguments_EmptyString_ReturnsEmptyList()
    {
        var result = ExifToolService.ParseArguments("");
        Assert.That(result, Is.Empty);
    }

    [Test]
    public void ParseArguments_MultipleSpaces_IgnoresExtraSpaces()
    {
        var result = ExifToolService.ParseArguments("-a   -b    -c");
        Assert.That(result, Is.EqualTo(new[] { "-a", "-b", "-c" }));
    }

    [Test]
    public void ParseArguments_EscapedQuote_HandlesCorrectly()
    {
        var result = ExifToolService.ParseArguments("-tag=value\\\"quoted");
        Assert.That(result, Has.Count.EqualTo(1));
        Assert.That(result[0], Is.EqualTo("-tag=value\"quoted"));
    }

    // ========================================================================
    // BuildWriteTagArgs Tests
    // ========================================================================

    [Test]
    public void BuildWriteTagArgs_NormalTags_BuildsCorrectArgs()
    {
        var tags = new List<string> { "Landschaft", "Natur", "Sonnenuntergang" };
        var (uniqueTags, args) = ExifToolService.BuildWriteTagArgs(tags, "C:\\photo.jpg");

        Assert.That(uniqueTags, Has.Count.EqualTo(3));
        Assert.That(args, Does.Contain("-sep"));
        Assert.That(args, Does.Contain(";;"));
        Assert.That(args, Does.Contain("-Keywords=Landschaft;;Natur;;Sonnenuntergang"));
        Assert.That(args, Does.Contain("-XMP:Subject=Landschaft;;Natur;;Sonnenuntergang"));
        Assert.That(args, Does.Contain("-overwrite_original"));
        Assert.That(args, Does.Contain("C:\\photo.jpg"));
    }

    [Test]
    public void BuildWriteTagArgs_DuplicateTags_Deduplicates()
    {
        var tags = new List<string> { "Natur", "natur", "NATUR", "Landschaft" };
        var (uniqueTags, args) = ExifToolService.BuildWriteTagArgs(tags, "C:\\photo.jpg");

        Assert.That(uniqueTags, Has.Count.EqualTo(2));
        Assert.That(uniqueTags[0], Is.EqualTo("Natur"));
        Assert.That(uniqueTags[1], Is.EqualTo("Landschaft"));
    }

    [Test]
    public void BuildWriteTagArgs_EmptyTags_ClearsKeywords()
    {
        var tags = new List<string>();
        var (uniqueTags, args) = ExifToolService.BuildWriteTagArgs(tags, "C:\\photo.jpg");

        Assert.That(uniqueTags, Is.Empty);
        Assert.That(args, Does.Contain("-Keywords="));
        Assert.That(args, Does.Contain("-XMP:Subject="));
        Assert.That(args, Does.Not.Contain("-sep"));
    }

    [Test]
    public void BuildWriteTagArgs_WhitespaceOnlyTags_ClearsKeywords()
    {
        var tags = new List<string> { "", "  ", "\t" };
        var (uniqueTags, args) = ExifToolService.BuildWriteTagArgs(tags, "C:\\photo.jpg");

        Assert.That(uniqueTags, Is.Empty);
        Assert.That(args, Does.Contain("-Keywords="));
    }

    [Test]
    public void BuildWriteTagArgs_TagsWithWhitespace_Trims()
    {
        var tags = new List<string> { "  Natur  ", " Landschaft " };
        var (uniqueTags, _) = ExifToolService.BuildWriteTagArgs(tags, "C:\\photo.jpg");

        Assert.That(uniqueTags[0], Is.EqualTo("Natur"));
        Assert.That(uniqueTags[1], Is.EqualTo("Landschaft"));
    }

    [Test]
    public void BuildWriteTagArgs_SpecialCharacters_PreservedInArgs()
    {
        var tags = new List<string> { "Ansicht von vorne", "Straße & Weg", "Größe (XXL)" };
        var (uniqueTags, args) = ExifToolService.BuildWriteTagArgs(tags, "C:\\photo.jpg");

        Assert.That(uniqueTags, Has.Count.EqualTo(3));
        var keywordsArg = args.First(a => a.StartsWith("-Keywords="));
        Assert.That(keywordsArg, Does.Contain("Ansicht von vorne"));
        Assert.That(keywordsArg, Does.Contain("Straße & Weg"));
        Assert.That(keywordsArg, Does.Contain("Größe (XXL)"));
    }

    [Test]
    public void BuildWriteTagArgs_MixedDuplicatesAndWhitespace_FiltersAndDeduplicates()
    {
        var tags = new List<string> { "  Tag1 ", "tag1", "", "Tag2", " TAG2 ", null! };
        var (uniqueTags, _) = ExifToolService.BuildWriteTagArgs(tags, "C:\\photo.jpg");

        Assert.That(uniqueTags, Has.Count.EqualTo(2));
        Assert.That(uniqueTags[0], Is.EqualTo("Tag1"));
        Assert.That(uniqueTags[1], Is.EqualTo("Tag2"));
    }
}

