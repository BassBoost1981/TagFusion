using System.IO;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using TagFusion.Configuration;

namespace TagFusion.Services;

/// <summary>
/// Creates recovery backups before destructive operations.
/// Directories are logged in the manifest, files are copied when they fit the configured size limit.
/// </summary>
public sealed class FileBackupService : IFileBackupService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private readonly ILogger<FileBackupService> _logger;
    private readonly BackupSettings _settings;
    private readonly string _backupRoot;
    private readonly string _manifestPath;
    private readonly SemaphoreSlim _manifestLock = new(1, 1);

    public FileBackupService(ILogger<FileBackupService> logger, IOptions<BackupSettings> options)
    {
        _logger = logger;
        _settings = options.Value;
        _backupRoot = Path.IsPathRooted(_settings.Directory)
            ? _settings.Directory
            : Path.Combine(AppContext.BaseDirectory, _settings.Directory);
        _manifestPath = Path.Combine(_backupRoot, "manifest.jsonl");
    }

    public async Task<FileBackupResult?> CreateBackupAsync(
        string path,
        string operation,
        CancellationToken cancellationToken = default)
    {
        if (!_settings.Enabled || string.IsNullOrWhiteSpace(path))
            return null;

        try
        {
            Directory.CreateDirectory(_backupRoot);
            CleanupExpiredBackups();

            var fullPath = Path.GetFullPath(path);
            var createdAt = DateTimeOffset.UtcNow;
            string? backupPath = null;
            long? sizeBytes = null;

            if (File.Exists(fullPath))
            {
                var fileInfo = new FileInfo(fullPath);
                sizeBytes = fileInfo.Length;
                var maxBytes = Math.Max(1L, _settings.MaxFileSizeMb) * 1024L * 1024L;

                if (fileInfo.Length <= maxBytes)
                {
                    var dayDir = Path.Combine(_backupRoot, createdAt.ToString("yyyyMMdd"));
                    Directory.CreateDirectory(dayDir);
                    var safeName = $"{createdAt:HHmmssfff}_{HashPath(fullPath)}_{fileInfo.Name}";
                    backupPath = Path.Combine(dayDir, safeName);
                    await using var source = File.Open(fullPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
                    await using var target = File.Create(backupPath);
                    await source.CopyToAsync(target, cancellationToken);
                }
                else
                {
                    _logger.LogWarning(
                        "Skipping backup copy for {Path}: {SizeBytes} bytes exceeds limit {MaxFileSizeMb} MB",
                        fullPath,
                        fileInfo.Length,
                        _settings.MaxFileSizeMb);
                }
            }
            else if (!Directory.Exists(fullPath))
            {
                return null;
            }

            var result = new FileBackupResult(operation, fullPath, backupPath, createdAt, sizeBytes);
            await AppendManifestAsync(result, cancellationToken);
            return result;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Failed to create backup for {Path}", path);
            throw;
        }
    }

    private async Task AppendManifestAsync(FileBackupResult result, CancellationToken cancellationToken)
    {
        await _manifestLock.WaitAsync(cancellationToken);
        try
        {
            var json = JsonSerializer.Serialize(result, JsonOptions);
            await File.AppendAllTextAsync(_manifestPath, json + Environment.NewLine, cancellationToken);
        }
        finally
        {
            _manifestLock.Release();
        }
    }

    private void CleanupExpiredBackups()
    {
        if (_settings.RetentionDays <= 0 || !Directory.Exists(_backupRoot))
            return;

        var cutoff = DateTime.UtcNow.AddDays(-_settings.RetentionDays);
        foreach (var directory in Directory.GetDirectories(_backupRoot))
        {
            try
            {
                var info = new DirectoryInfo(directory);
                if (info.LastWriteTimeUtc < cutoff)
                    info.Delete(recursive: true);
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Failed to cleanup old backup directory {Directory}", directory);
            }
        }
    }

    private static string HashPath(string path)
    {
        var bytes = SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(path));
        return Convert.ToHexString(bytes, 0, 6).ToLowerInvariant();
    }
}
