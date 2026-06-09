using System.IO;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using NUnit.Framework;
using TagFusion.Configuration;
using TagFusion.Services;

namespace TagFusion.Tests.Services;

[TestFixture]
public class FileBackupServiceTests
{
    private string _tempDir = null!;

    [SetUp]
    public void SetUp()
    {
        _tempDir = Path.Combine(Path.GetTempPath(), $"TagFusionBackupTests_{Guid.NewGuid():N}");
        Directory.CreateDirectory(_tempDir);
    }

    [TearDown]
    public void TearDown()
    {
        if (Directory.Exists(_tempDir))
            Directory.Delete(_tempDir, true);
    }

    [Test]
    public async Task CreateBackupAsync_File_CopiesFileAndWritesManifest()
    {
        var sourcePath = Path.Combine(_tempDir, "image.jpg");
        var backupRoot = Path.Combine(_tempDir, "backups");
        await File.WriteAllTextAsync(sourcePath, "metadata-safe-content");
        var service = CreateService(backupRoot);

        var result = await service.CreateBackupAsync(sourcePath, "metadata-tags-write");

        Assert.That(result, Is.Not.Null);
        Assert.That(result!.Operation, Is.EqualTo("metadata-tags-write"));
        Assert.That(result.BackupPath, Is.Not.Null);
        Assert.That(File.Exists(result.BackupPath!), Is.True);
        Assert.That(await File.ReadAllTextAsync(result.BackupPath!), Is.EqualTo("metadata-safe-content"));

        var manifestPath = Path.Combine(backupRoot, "manifest.jsonl");
        Assert.That(File.Exists(manifestPath), Is.True);
        var manifest = await File.ReadAllTextAsync(manifestPath);
        Assert.That(manifest, Does.Contain("metadata-tags-write"));
        Assert.That(manifest, Does.Contain(sourcePath.Replace("\\", "\\\\")));
    }

    [Test]
    public async Task CreateBackupAsync_FileOverLimit_WritesManifestWithoutCopy()
    {
        var sourcePath = Path.Combine(_tempDir, "large.bin");
        var backupRoot = Path.Combine(_tempDir, "backups");
        await File.WriteAllBytesAsync(sourcePath, new byte[2 * 1024 * 1024]);
        var service = CreateService(backupRoot, maxFileSizeMb: 1);

        var result = await service.CreateBackupAsync(sourcePath, "delete-file");

        Assert.That(result, Is.Not.Null);
        Assert.That(result!.BackupPath, Is.Null);
        Assert.That(result.SizeBytes, Is.EqualTo(2 * 1024 * 1024));
        Assert.That(File.Exists(Path.Combine(backupRoot, "manifest.jsonl")), Is.True);
    }

    [Test]
    public async Task CreateBackupAsync_Directory_WritesManifestWithoutCopy()
    {
        var sourceDir = Path.Combine(_tempDir, "folder");
        var backupRoot = Path.Combine(_tempDir, "backups");
        Directory.CreateDirectory(sourceDir);
        var service = CreateService(backupRoot);

        var result = await service.CreateBackupAsync(sourceDir, "delete-directory");

        Assert.That(result, Is.Not.Null);
        Assert.That(result!.BackupPath, Is.Null);
        Assert.That(result.SizeBytes, Is.Null);
        var manifest = await File.ReadAllTextAsync(Path.Combine(backupRoot, "manifest.jsonl"));
        Assert.That(manifest, Does.Contain("delete-directory"));
    }

    private static FileBackupService CreateService(string backupRoot, int maxFileSizeMb = 512)
    {
        var options = Options.Create(new BackupSettings
        {
            Enabled = true,
            Directory = backupRoot,
            RetentionDays = 30,
            MaxFileSizeMb = maxFileSizeMb
        });

        return new FileBackupService(NullLogger<FileBackupService>.Instance, options);
    }
}
