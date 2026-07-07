using System.IO;
using NUnit.Framework;
using TagFusion.Services;

namespace TagFusion.Tests.Services;

[TestFixture]
public class AiServerProcessServiceTests
{
    private string _tempRoot = null!;

    [SetUp]
    public void SetUp()
    {
        _tempRoot = Path.Combine(Path.GetTempPath(), "aisrvtest_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_tempRoot);
    }

    [TearDown]
    public void TearDown()
    {
        if (Directory.Exists(_tempRoot)) Directory.Delete(_tempRoot, recursive: true);
    }

    [Test]
    public void PortFromBaseUrl_ParsesPort()
    {
        Assert.That(AiServerProcessService.PortFromBaseUrl("http://127.0.0.1:50051"), Is.EqualTo(50051));
        Assert.That(AiServerProcessService.PortFromBaseUrl("http://localhost:12345/"), Is.EqualTo(12345));
    }

    [Test]
    public void PortFromBaseUrl_Garbage_FallsBackTo50051()
    {
        Assert.That(AiServerProcessService.PortFromBaseUrl("not a url"), Is.EqualTo(50051));
        Assert.That(AiServerProcessService.PortFromBaseUrl(""), Is.EqualTo(50051));
    }

    [Test]
    public void ResolveServerDirectory_ConfiguredDirWithMainPy_IsReturned()
    {
        File.WriteAllText(Path.Combine(_tempRoot, "main.py"), "# fake");

        var result = AiServerProcessService.ResolveServerDirectory(_tempRoot, "C:\\irrelevant");

        Assert.That(result, Is.EqualTo(_tempRoot));
    }

    [Test]
    public void ResolveServerDirectory_ConfiguredDirWithoutMainPy_IgnoredThenAutoSearch()
    {
        // Configured dir has no main.py → fall through to auto-search from startDir.
        var serverDir = Path.Combine(_tempRoot, "AiApiServer");
        Directory.CreateDirectory(serverDir);
        File.WriteAllText(Path.Combine(serverDir, "main.py"), "# fake");
        var startDir = Path.Combine(_tempRoot, "app", "bin");
        Directory.CreateDirectory(startDir);

        var result = AiServerProcessService.ResolveServerDirectory("", startDir);

        Assert.That(result, Is.EqualTo(serverDir));
    }

    [Test]
    public void ResolveServerDirectory_AutoSearchWalksUpToSiblingAiApiServer()
    {
        // _tempRoot/AiApiServer/main.py, start deep below _tempRoot/x/y/z
        var serverDir = Path.Combine(_tempRoot, "AiApiServer");
        Directory.CreateDirectory(serverDir);
        File.WriteAllText(Path.Combine(serverDir, "main.py"), "# fake");
        var startDir = Path.Combine(_tempRoot, "x", "y", "z");
        Directory.CreateDirectory(startDir);

        var result = AiServerProcessService.ResolveServerDirectory("", startDir);

        Assert.That(result, Is.EqualTo(serverDir));
    }

    [Test]
    public void ResolveServerDirectory_NothingFound_ReturnsNull()
    {
        var startDir = Path.Combine(_tempRoot, "lonely");
        Directory.CreateDirectory(startDir);

        Assert.That(AiServerProcessService.ResolveServerDirectory("", startDir), Is.Null);
    }

    [Test]
    public void ResolvePythonExecutable_AbsolutePath_ReturnedAsIs()
    {
        var abs = Path.Combine(_tempRoot, "some", "python.exe");

        Assert.That(AiServerProcessService.ResolvePythonExecutable(abs, _tempRoot), Is.EqualTo(abs));
    }

    [Test]
    public void ResolvePythonExecutable_RelativePath_ResolvedAgainstServerDir()
    {
        var result = AiServerProcessService.ResolvePythonExecutable(@"venv\Scripts\python.exe", _tempRoot);

        Assert.That(result, Is.EqualTo(Path.Combine(_tempRoot, "venv", "Scripts", "python.exe")));
    }

    [Test]
    public void ResolvePythonExecutable_BareCommand_BundledVenvWins()
    {
        // A venv bundled inside the server folder is preferred over PATH — keeps the folder portable.
        var venvPy = Path.Combine(_tempRoot, "venv", "Scripts", "python.exe");
        Directory.CreateDirectory(Path.GetDirectoryName(venvPy)!);
        File.WriteAllText(venvPy, "# fake");

        Assert.That(AiServerProcessService.ResolvePythonExecutable("python", _tempRoot), Is.EqualTo(venvPy));
    }

    [Test]
    public void ResolvePythonExecutable_BareCommand_NoBundle_FallsBackToCommand()
    {
        Assert.That(AiServerProcessService.ResolvePythonExecutable("python", _tempRoot), Is.EqualTo("python"));
    }

    [Test]
    public void ResolvePythonExecutable_Empty_TreatedAsPathLookup()
    {
        Assert.That(AiServerProcessService.ResolvePythonExecutable("", _tempRoot), Is.EqualTo("python"));
    }
}
