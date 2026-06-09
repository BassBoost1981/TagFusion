using System.IO;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using NUnit.Framework;
using TagFusion.Configuration;
using TagFusion.Services;

namespace TagFusion.Tests.Services;

[TestFixture]
public class FileOperationServiceTests
{
    private string _tempDir = null!;
    private FileOperationService _service = null!;

    [SetUp]
    public void SetUp()
    {
        _tempDir = Path.Combine(Path.GetTempPath(), $"TagFusionTests_{Guid.NewGuid():N}");
        Directory.CreateDirectory(_tempDir);
        _service = new FileOperationService(NullLogger<FileOperationService>.Instance);
    }

    [TearDown]
    public void TearDown()
    {
        if (Directory.Exists(_tempDir))
            Directory.Delete(_tempDir, true);
    }

    // ========================================================================
    // GetUniqueDestPath Tests (internal static)
    // ========================================================================

    [Test]
    public void GetUniqueDestPath_NoConflict_ReturnsOriginal()
    {
        var path = Path.Combine(_tempDir, "test.jpg");
        var result = FileOperationService.GetUniqueDestPath(path);
        Assert.That(result, Is.EqualTo(path));
    }

    [Test]
    public void GetUniqueDestPath_FileExists_AppendsCounter()
    {
        var path = Path.Combine(_tempDir, "test.jpg");
        File.WriteAllText(path, "dummy");

        var result = FileOperationService.GetUniqueDestPath(path);
        Assert.That(result, Is.EqualTo(Path.Combine(_tempDir, "test (1).jpg")));
    }

    [Test]
    public void GetUniqueDestPath_MultipleConflicts_IncrementsCounter()
    {
        var basePath = Path.Combine(_tempDir, "photo.jpg");
        File.WriteAllText(basePath, "dummy");
        File.WriteAllText(Path.Combine(_tempDir, "photo (1).jpg"), "dummy");
        File.WriteAllText(Path.Combine(_tempDir, "photo (2).jpg"), "dummy");

        var result = FileOperationService.GetUniqueDestPath(basePath);
        Assert.That(result, Is.EqualTo(Path.Combine(_tempDir, "photo (3).jpg")));
    }

    [Test]
    public void GetUniqueDestPath_DirectoryExists_AppendsCounter()
    {
        var dirPath = Path.Combine(_tempDir, "subfolder");
        Directory.CreateDirectory(dirPath);

        var result = FileOperationService.GetUniqueDestPath(dirPath);
        Assert.That(result, Is.EqualTo(Path.Combine(_tempDir, "subfolder (1)")));
    }

    // ========================================================================
    // RenameFile Tests — Path Traversal Prevention
    // ========================================================================

    [Test]
    public void RenameFile_PathTraversalBackslash_Throws()
    {
        var filePath = Path.Combine(_tempDir, "test.jpg");
        File.WriteAllText(filePath, "dummy");

        Assert.Throws<ArgumentException>(() => _service.RenameFile(filePath, "..\\evil.jpg"));
    }

    [Test]
    public void RenameFile_PathTraversalForwardSlash_Throws()
    {
        var filePath = Path.Combine(_tempDir, "test.jpg");
        File.WriteAllText(filePath, "dummy");

        Assert.Throws<ArgumentException>(() => _service.RenameFile(filePath, "../evil.jpg"));
    }

    [Test]
    public void RenameFile_ValidRename_Succeeds()
    {
        var filePath = Path.Combine(_tempDir, "old.jpg");
        File.WriteAllText(filePath, "content");

        var result = _service.RenameFile(filePath, "new.jpg");

        Assert.That(result, Is.True);
        Assert.That(File.Exists(Path.Combine(_tempDir, "new.jpg")), Is.True);
        Assert.That(File.Exists(filePath), Is.False);
    }

    [Test]
    public async Task RenameFile_WithBackupService_CreatesRecoverableBackup()
    {
        var filePath = Path.Combine(_tempDir, "old.jpg");
        var backupRoot = Path.Combine(_tempDir, "backups");
        File.WriteAllText(filePath, "content-before-rename");
        var backupService = new FileBackupService(
            NullLogger<FileBackupService>.Instance,
            Options.Create(new BackupSettings
            {
                Enabled = true,
                Directory = backupRoot,
                RetentionDays = 30,
                MaxFileSizeMb = 512
            }));
        var service = new FileOperationService(NullLogger<FileOperationService>.Instance, backupService);

        var result = service.RenameFile(filePath, "new.jpg");

        Assert.That(result, Is.True);
        var backupFile = Directory.GetFiles(backupRoot, "*.jpg", SearchOption.AllDirectories).Single();
        Assert.That(await File.ReadAllTextAsync(backupFile), Is.EqualTo("content-before-rename"));
        var manifest = await File.ReadAllTextAsync(Path.Combine(backupRoot, "manifest.jsonl"));
        Assert.That(manifest, Does.Contain("rename-file"));
    }

    [Test]
    public void RenameFile_FileNotFound_Throws()
    {
        var filePath = Path.Combine(_tempDir, "nonexistent.jpg");

        Assert.Throws<FileNotFoundException>(() => _service.RenameFile(filePath, "new.jpg"));
    }
}
