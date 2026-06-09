using System.IO;
using Microsoft.Extensions.Logging;
using NUnit.Framework;
using TagFusion.Logging;

namespace TagFusion.Tests.Logging;

[TestFixture]
public class FileLoggerProviderTests
{
    private string _tempDir = null!;

    [SetUp]
    public void SetUp()
    {
        _tempDir = Path.Combine(Path.GetTempPath(), $"TagFusionLogTests_{Guid.NewGuid():N}");
        Directory.CreateDirectory(_tempDir);
    }

    [TearDown]
    public void TearDown()
    {
        if (Directory.Exists(_tempDir))
            Directory.Delete(_tempDir, true);
    }

    [Test]
    public void LogError_WritesCategoryMessageAndException()
    {
        using (var provider = new FileLoggerProvider(_tempDir, LogLevel.Debug, retentionDays: 14))
        {
            var logger = provider.CreateLogger("TagFusion.Tests.CrashRecovery");
            logger.LogError(new InvalidOperationException("boom"), "Crash recovery probe failed");
        }

        var logFile = Directory.GetFiles(_tempDir, "tagfusion-*.log").Single();
        var content = File.ReadAllText(logFile);
        Assert.That(content, Does.Contain("[ERR]"));
        Assert.That(content, Does.Contain("[CrashRecovery]"));
        Assert.That(content, Does.Contain("Crash recovery probe failed"));
        Assert.That(content, Does.Contain("InvalidOperationException: boom"));
    }

    [Test]
    public void Constructor_RemovesExpiredLogFiles()
    {
        var oldLog = Path.Combine(_tempDir, "tagfusion-2000-01-01.log");
        File.WriteAllText(oldLog, "old");
        File.SetLastWriteTime(oldLog, DateTime.Now.AddDays(-10));

        using var _ = new FileLoggerProvider(_tempDir, LogLevel.Debug, retentionDays: 1);

        Assert.That(File.Exists(oldLog), Is.False);
    }
}
