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
        var sep = ExifToolService.TagSeparator;

        Assert.That(uniqueTags, Has.Count.EqualTo(3));
        Assert.That(args, Does.Contain("-sep"));
        Assert.That(args, Does.Contain(sep));
        Assert.That(args, Does.Contain($"-Keywords=Landschaft{sep}Natur{sep}Sonnenuntergang"));
        Assert.That(args, Does.Contain($"-XMP:Subject=Landschaft{sep}Natur{sep}Sonnenuntergang"));
        Assert.That(args, Does.Contain("-overwrite_original"));
        Assert.That(args, Does.Contain("C:\\photo.jpg"));
    }

    [Test]
    public void BuildWriteTagArgs_TagContainingDoubleSemicolon_PreservedAndSeparatedBySafeChar()
    {
        // With the old ";;" separator, ExifTool would have split "Foo;;Bar" into two
        // keywords. Joining with U+001F separates only distinct tags and leaves a user
        // tag's literal ";;" intact.
        var tags = new List<string> { "Foo;;Bar", "Baz" };
        var (uniqueTags, args) = ExifToolService.BuildWriteTagArgs(tags, "C:\\photo.jpg");
        var sep = ExifToolService.TagSeparator;

        Assert.That(uniqueTags, Has.Count.EqualTo(2));
        var keywordsArg = args.First(a => a.StartsWith("-Keywords="));
        Assert.That(keywordsArg, Is.EqualTo($"-Keywords=Foo;;Bar{sep}Baz"));
    }

    [Test]
    public void BuildWriteTagArgs_TagContainingNewline_StripsControlCharsNoInjection()
    {
        // SECURITY: ExifTool -stay_open reads one argument per stdin line. A newline inside a
        // tag must NOT survive into the arg list — otherwise it would inject a new ExifTool
        // argument line (e.g. -execute / -overwrite_original).
        var tags = new List<string> { "evil\n-execute\n-delete_original", "Natur" };
        var (uniqueTags, args) = ExifToolService.BuildWriteTagArgs(tags, "C:\\photo.jpg");

        // No argument may contain a raw CR/LF.
        Assert.That(args, Has.None.Matches<string>(a => a.Contains('\n') || a.Contains('\r')));
        // The injected tokens must remain part of the keyword VALUE, never standalone args.
        Assert.That(args, Does.Not.Contain("-execute"));
        Assert.That(args, Does.Not.Contain("-delete_original"));
        var keywordsArg = args.First(a => a.StartsWith("-Keywords="));
        Assert.That(keywordsArg, Does.Not.Contain('\n'));
    }

    [Test]
    public void BuildWriteTagArgs_TagContainingSeparatorChar_StripsSeparator()
    {
        // A tag carrying the U+001F separator would otherwise be split into two keywords
        // by ExifTool's -sep. Stripping it keeps the tag intact as a single value.
        var sep = ExifToolService.TagSeparator;
        var tags = new List<string> { $"Foo{sep}Bar" };
        var (uniqueTags, args) = ExifToolService.BuildWriteTagArgs(tags, "C:\\photo.jpg");

        Assert.That(uniqueTags, Has.Count.EqualTo(1));
        Assert.That(uniqueTags[0], Is.EqualTo("FooBar"));
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

    // ========================================================================
    // OutputIndicatesError Tests
    // ========================================================================

    [Test]
    public void OutputIndicatesError_RealErrorLine_ReturnsTrue()
    {
        var output = "Error: Writing of this file type is not supported - C:\\photo.xyz";
        Assert.That(ExifToolService.OutputIndicatesError(output), Is.True);
    }

    [Test]
    public void OutputIndicatesError_SuccessMessage_ReturnsFalse()
    {
        var output = "    1 image files updated";
        Assert.That(ExifToolService.OutputIndicatesError(output), Is.False);
    }

    [Test]
    public void OutputIndicatesError_WarningContainingWordError_ReturnsFalse()
    {
        // ExifTool warnings sometimes contain the word "error" in their message text.
        // These are non-fatal and must NOT be treated as errors.
        var output = "Warning: Error reading PreviewImage\n    1 image files updated";
        Assert.That(ExifToolService.OutputIndicatesError(output), Is.False);
    }

    [Test]
    public void OutputIndicatesError_PathContainingWordError_ReturnsFalse()
    {
        // A file path containing "error" must not trigger a false positive.
        var output = "    1 image files updated - C:\\error_pics\\img.jpg";
        Assert.That(ExifToolService.OutputIndicatesError(output), Is.False);
    }

    [Test]
    public void OutputIndicatesError_EmptyOutput_ReturnsFalse()
    {
        Assert.That(ExifToolService.OutputIndicatesError(""), Is.False);
    }

    [Test]
    public void OutputIndicatesError_ErrorLineWithLeadingWhitespace_ReturnsTrue()
    {
        var output = "   Error: File not found - C:\\missing.jpg";
        Assert.That(ExifToolService.OutputIndicatesError(output), Is.True);
    }

    [Test]
    public void OutputIndicatesError_ErrorAmongMultipleLines_ReturnsTrue()
    {
        var output = "    0 image files updated\nError: No writable tags set - C:\\photo.jpg";
        Assert.That(ExifToolService.OutputIndicatesError(output), Is.True);
    }

    // EnsureNoLineBreaks Tests — argument injection guard for the -stay_open stdin protocol
    // Schutz gegen Argument-Injection ueber Zeilenumbrueche im -stay_open-Protokoll

    [Test]
    public void EnsureNoLineBreaks_CleanArgs_DoesNotThrow()
    {
        var args = new List<string> { "-Keywords=Urlaub", "-overwrite_original", "C:\\photo.jpg" };
        Assert.DoesNotThrow(() => ExifToolService.EnsureNoLineBreaks(args));
    }

    [Test]
    public void EnsureNoLineBreaks_NewlineInArg_Throws()
    {
        var args = new List<string> { "-Keywords=evil\n-execute" };
        Assert.Throws<ArgumentException>(() => ExifToolService.EnsureNoLineBreaks(args));
    }

    [Test]
    public void EnsureNoLineBreaks_CarriageReturnInArg_Throws()
    {
        var args = new List<string> { "C:\\photo\r.jpg" };
        Assert.Throws<ArgumentException>(() => ExifToolService.EnsureNoLineBreaks(args));
    }
}

