namespace TagFusion.Services;

public interface IFileBackupService
{
    Task<FileBackupResult?> CreateBackupAsync(string path, string operation, CancellationToken cancellationToken = default);
}

public sealed record FileBackupResult(
    string Operation,
    string SourcePath,
    string? BackupPath,
    DateTimeOffset CreatedAt,
    long? SizeBytes);
