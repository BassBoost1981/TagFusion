namespace TagFusion.Services;

internal sealed class NoopFileBackupService : IFileBackupService
{
    public static readonly NoopFileBackupService Instance = new();

    private NoopFileBackupService()
    {
    }

    public Task<FileBackupResult?> CreateBackupAsync(
        string path,
        string operation,
        CancellationToken cancellationToken = default)
    {
        return Task.FromResult<FileBackupResult?>(null);
    }
}
