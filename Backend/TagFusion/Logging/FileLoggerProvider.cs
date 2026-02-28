using System.Collections.Concurrent;
using System.IO;
using Microsoft.Extensions.Logging;

namespace TagFusion.Logging;

/// <summary>
/// Simple file logger provider with date-based rotation.
/// Writes to logs/tagfusion-yyyy-MM-dd.log next to the executable.
/// Automatically cleans up log files older than the configured retention period.
/// </summary>
public sealed class FileLoggerProvider : ILoggerProvider
{
    private readonly string _logDirectory;
    private readonly LogLevel _minLevel;
    private readonly int _retentionDays;
    private readonly ConcurrentDictionary<string, FileLogger> _loggers = new();
    private readonly object _writeLock = new();
    private StreamWriter? _writer;
    private string _currentDate = string.Empty;

    public FileLoggerProvider(string logDirectory, LogLevel minLevel = LogLevel.Information, int retentionDays = 14)
    {
        _logDirectory = logDirectory;
        _minLevel = minLevel;
        _retentionDays = retentionDays;

        Directory.CreateDirectory(_logDirectory);
        CleanupOldLogs();
    }

    public ILogger CreateLogger(string categoryName)
    {
        return _loggers.GetOrAdd(categoryName, name => new FileLogger(name, this));
    }

    internal void WriteEntry(string categoryName, LogLevel level, string message, Exception? exception)
    {
        if (level < _minLevel) return;

        var timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff");
        var levelTag = level switch
        {
            LogLevel.Trace => "TRC",
            LogLevel.Debug => "DBG",
            LogLevel.Information => "INF",
            LogLevel.Warning => "WRN",
            LogLevel.Error => "ERR",
            LogLevel.Critical => "CRT",
            _ => "???"
        };

        // Shorten category: "TagFusion.Services.ExifToolService" → "ExifToolService"
        var shortCategory = categoryName.Contains('.')
            ? categoryName[(categoryName.LastIndexOf('.') + 1)..]
            : categoryName;

        var logLine = $"[{timestamp}] [{levelTag}] [{shortCategory}] {message}";
        if (exception != null)
            logLine += $"{Environment.NewLine}  Exception: {exception.GetType().Name}: {exception.Message}{Environment.NewLine}  {exception.StackTrace}";

        lock (_writeLock)
        {
            EnsureWriter();
            _writer!.WriteLine(logLine);
            _writer.Flush();
        }
    }

    private void EnsureWriter()
    {
        var today = DateTime.Now.ToString("yyyy-MM-dd");
        if (today == _currentDate && _writer != null) return;

        _writer?.Dispose();
        _currentDate = today;
        var logPath = Path.Combine(_logDirectory, $"tagfusion-{today}.log");
        _writer = new StreamWriter(logPath, append: true) { AutoFlush = false };
    }

    private void CleanupOldLogs()
    {
        try
        {
            var cutoff = DateTime.Now.AddDays(-_retentionDays);
            foreach (var file in Directory.GetFiles(_logDirectory, "tagfusion-*.log"))
            {
                if (File.GetLastWriteTime(file) < cutoff)
                    File.Delete(file);
            }
        }
        catch
        {
            // Cleanup failure is non-critical — ignore
        }
    }

    public void Dispose()
    {
        lock (_writeLock)
        {
            _writer?.Dispose();
            _writer = null;
        }
        _loggers.Clear();
    }
}

/// <summary>
/// Individual logger instance created per category by FileLoggerProvider.
/// </summary>
internal sealed class FileLogger : ILogger
{
    private readonly string _categoryName;
    private readonly FileLoggerProvider _provider;

    public FileLogger(string categoryName, FileLoggerProvider provider)
    {
        _categoryName = categoryName;
        _provider = provider;
    }

    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

    public bool IsEnabled(LogLevel logLevel) => logLevel >= LogLevel.Debug;

    public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
    {
        if (!IsEnabled(logLevel)) return;
        _provider.WriteEntry(_categoryName, logLevel, formatter(state, exception), exception);
    }
}
