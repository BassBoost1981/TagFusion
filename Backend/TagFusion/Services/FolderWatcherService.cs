using System.IO;
using Microsoft.Extensions.Logging;

namespace TagFusion.Services;

/// <summary>
/// Watches a folder for file changes and notifies via callbacks.
/// Überwacht einen Ordner auf Dateiänderungen und benachrichtigt über Callbacks.
/// </summary>
public class FolderWatcherService : IDisposable
{
    private const int DebounceMs = 500;
    // Raise the native buffer from 8KB default to 64KB so heavy write bursts
    // (e.g. batch tagging hundreds of files) don't overflow and suspend events.
    // Native-Puffer von 8KB auf 64KB anheben, damit Batch-Schreibvorgänge nicht
    // zu einem Buffer-Overflow führen.
    private const int WatcherBufferSize = 64 * 1024;

    private readonly ILogger<FolderWatcherService> _logger;
    private FileSystemWatcher? _watcher;
    private string? _currentPath;
    private bool _disposed;

    // Debounce: collect changes and fire once after a short delay.
    // Single long-lived timer reset via Stop/Start — avoids per-event allocations
    // and the race of disposing a timer mid-Elapsed.
    private readonly object _lock = new();
    private readonly System.Timers.Timer _debounceTimer;
    private readonly HashSet<string> _pendingChanges = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>
    /// Fired when files in the watched folder change (debounced).
    /// Contains list of changed file paths.
    /// </summary>
    public event Action<List<string>>? FilesChanged;

    public FolderWatcherService(ILogger<FolderWatcherService> logger)
    {
        _logger = logger;

        _debounceTimer = new System.Timers.Timer(DebounceMs) { AutoReset = false };
        _debounceTimer.Elapsed += (_, _) => FlushChanges();
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
                InternalBufferSize = WatcherBufferSize,
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
        var ex = e.GetException();
        _logger.LogWarning(ex, "FolderWatcher: Error — attempting to recover");

        // Buffer overflow or permission change can leave the watcher in a broken state.
        // Tear it down and restart on the same path so the user keeps getting events.
        // Buffer-Overflow: Watcher neu aufsetzen, damit Events weiter zugestellt werden.
        var path = _currentPath;
        if (!string.IsNullOrEmpty(path) && Directory.Exists(path))
        {
            try
            {
                Watch(path);
                _logger.LogInformation("FolderWatcher: Recovered on {Path}", path);
            }
            catch (Exception restartEx)
            {
                _logger.LogError(restartEx, "FolderWatcher: Recovery failed");
            }
        }
    }

    /// <summary>
    /// Queue a change and debounce — fire event after DebounceMs of quiet.
    /// Reuses a single long-lived timer; Stop+Start resets the interval.
    /// Bail early if already disposed to avoid touching a disposed timer.
    /// Vorzeitig abbrechen wenn bereits disposed, um ObjectDisposedException zu vermeiden.
    /// </summary>
    private void QueueChange(string path)
    {
        lock (_lock)
        {
            if (_disposed) return;  // Timer already disposed — discard event / Timer bereits entsorgt — Event verwerfen
            _pendingChanges.Add(path);
            _debounceTimer.Stop();
            _debounceTimer.Start();
        }
    }

    private void FlushChanges()
    {
        List<string> changes;
        lock (_lock)
        {
            if (_disposed || _pendingChanges.Count == 0) return;  // Skip if disposed / Überspringen wenn disposed
            changes = new List<string>(_pendingChanges);
            _pendingChanges.Clear();
        }

        _logger.LogDebug("FolderWatcher: {Count} changes detected", changes.Count);
        FilesChanged?.Invoke(changes);
    }

    public void Dispose()
    {
        lock (_lock)
        {
            if (_disposed) return;  // Idempotent — safe to call multiple times / Mehrfachaufruf sicher
            _disposed = true;       // Set under lock so QueueChange sees it atomically / Unter Lock setzen für atomare Sichtbarkeit
        }
        StopWatching();
        _debounceTimer.Dispose();
    }
}
