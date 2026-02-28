using System.IO;
using Microsoft.Extensions.Logging;

namespace TagFusion.Services;

/// <summary>
/// Watches a folder for file changes and notifies via callbacks.
/// Überwacht einen Ordner auf Dateiänderungen und benachrichtigt über Callbacks.
/// </summary>
public class FolderWatcherService : IDisposable
{
    private readonly ILogger<FolderWatcherService> _logger;
    private FileSystemWatcher? _watcher;
    private string? _currentPath;
    private bool _disposed;

    // Debounce: collect changes and fire once after a short delay
    private readonly object _lock = new();
    private System.Timers.Timer? _debounceTimer;
    private readonly HashSet<string> _pendingChanges = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>
    /// Fired when files in the watched folder change (debounced).
    /// Contains list of changed file paths.
    /// </summary>
    public event Action<List<string>>? FilesChanged;

    public FolderWatcherService(ILogger<FolderWatcherService> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Start watching a folder. Stops any previous watcher.
    /// Startet die Überwachung eines Ordners. Stoppt vorherige Überwachung.
    /// </summary>
    public void Watch(string folderPath)
    {
        StopWatching();

        if (string.IsNullOrEmpty(folderPath) || !Directory.Exists(folderPath))
        {
            _logger.LogWarning("FolderWatcher: Invalid path {Path}", folderPath);
            return;
        }

        try
        {
            _currentPath = folderPath;
            _watcher = new FileSystemWatcher(folderPath)
            {
                NotifyFilter = NotifyFilters.FileName
                             | NotifyFilters.LastWrite
                             | NotifyFilters.Size
                             | NotifyFilters.DirectoryName,
                IncludeSubdirectories = false,
                EnableRaisingEvents = true
            };

            _watcher.Created += OnFileEvent;
            _watcher.Deleted += OnFileEvent;
            _watcher.Changed += OnFileEvent;
            _watcher.Renamed += OnRenamedEvent;
            _watcher.Error += OnError;

            _logger.LogDebug("FolderWatcher: Watching {Path}", folderPath);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "FolderWatcher: Failed to start watching {Path}", folderPath);
        }
    }

    /// <summary>
    /// Stop watching the current folder.
    /// </summary>
    public void StopWatching()
    {
        if (_watcher != null)
        {
            _watcher.EnableRaisingEvents = false;
            _watcher.Created -= OnFileEvent;
            _watcher.Deleted -= OnFileEvent;
            _watcher.Changed -= OnFileEvent;
            _watcher.Renamed -= OnRenamedEvent;
            _watcher.Error -= OnError;
            _watcher.Dispose();
            _watcher = null;
            _logger.LogDebug("FolderWatcher: Stopped watching {Path}", _currentPath);
        }
        _currentPath = null;
    }

    public string? CurrentPath => _currentPath;

    private void OnFileEvent(object sender, FileSystemEventArgs e)
    {
        QueueChange(e.FullPath);
    }

    private void OnRenamedEvent(object sender, RenamedEventArgs e)
    {
        QueueChange(e.OldFullPath);
        QueueChange(e.FullPath);
    }

    private void OnError(object sender, ErrorEventArgs e)
    {
        _logger.LogWarning(e.GetException(), "FolderWatcher: Error");
    }

    /// <summary>
    /// Queue a change and debounce — fire event after 500ms of quiet.
    /// </summary>
    private void QueueChange(string path)
    {
        lock (_lock)
        {
            _pendingChanges.Add(path);

            _debounceTimer?.Stop();
            _debounceTimer?.Dispose();

            _debounceTimer = new System.Timers.Timer(500);
            _debounceTimer.AutoReset = false;
            _debounceTimer.Elapsed += (_, _) => FlushChanges();
            _debounceTimer.Start();
        }
    }

    private void FlushChanges()
    {
        List<string> changes;
        lock (_lock)
        {
            if (_pendingChanges.Count == 0) return;
            changes = new List<string>(_pendingChanges);
            _pendingChanges.Clear();
        }

        _logger.LogDebug("FolderWatcher: {Count} changes detected", changes.Count);
        FilesChanged?.Invoke(changes);
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        StopWatching();
        _debounceTimer?.Dispose();
    }
}
