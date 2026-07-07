using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using TagFusion.Bridge;
using TagFusion.Configuration;

namespace TagFusion.Services;

/// <summary>
/// Manages the AiApiServer child process. Thread-safe via a private lock (all work
/// here is short and synchronous). Disposing kills an app-started server, which
/// runs automatically on app exit via the ServiceProvider dispose.
/// Verwaltet den AiApiServer-Kindprozess; Dispose beendet einen selbst gestarteten
/// Server (läuft automatisch beim App-Ende).
/// </summary>
public sealed class AiServerProcessService : IAiServerProcessService, IDisposable
{
    private readonly AiServerSettings _settings;
    private readonly ILogger<AiServerProcessService> _logger;
    private readonly object _gate = new();
    private Process? _process;
    private bool _disposed;
    // Last non-empty stderr line and the crash reason of the last unexpected exit.
    // Volatile: written from process callback threads, read from the poll/IsManagedByApp path.
    // Letzte stderr-Zeile bzw. Absturzgrund; volatile, da aus Callback-Threads geschrieben.
    private volatile string? _lastStderrLine;
    private volatile string? _lastStartError;
    // True while we intentionally kill the process, so its Exited event is not treated as a crash.
    // Wahr während wir bewusst killen — dann gilt das Exited-Event nicht als Absturz.
    private volatile bool _expectedExit;

    public AiServerProcessService(IOptions<AiServerSettings> options, ILogger<AiServerProcessService> logger)
    {
        _settings = options.Value;
        _logger = logger;
    }

    public bool IsManagedByApp
    {
        get
        {
            lock (_gate)
            {
                return _process is { HasExited: false };
            }
        }
    }

    public string? LastStartError => _lastStartError;

    public void StartServer()
    {
        lock (_gate)
        {
            if (_process is { HasExited: false })
                return; // already running under our control / läuft bereits unter unserer Kontrolle

            // Previous process crashed — release its handle before starting a new one.
            // Vorheriger Prozess ist abgestürzt — Handle freigeben, bevor neu gestartet wird.
            _process?.Dispose();
            _process = null;

            // Fresh attempt — clear stale crash state so the UI shows current status.
            // Neuer Versuch — alten Absturzgrund verwerfen, damit die UI aktuell bleibt.
            _lastStartError = null;
            _lastStderrLine = null;
            _expectedExit = false;

            var serverDir = ResolveServerDirectory(_settings.ServerDirectory, AppContext.BaseDirectory);
            if (serverDir == null)
                throw new BridgeException(
                    "AiApiServer-Ordner nicht gefunden.",
                    internalMessage: "AiApiServer directory not resolvable");

            var psi = new ProcessStartInfo
            {
                FileName = ResolvePythonExecutable(_settings.PythonExecutable, serverDir),
                WorkingDirectory = serverDir,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
            };
            psi.ArgumentList.Add("main.py");
            psi.Environment["TAGMANAGER_SERVER_PORT"] = PortFromBaseUrl(_settings.BaseUrl).ToString();

            try
            {
                var process = new Process { StartInfo = psi, EnableRaisingEvents = true };
                process.OutputDataReceived += (_, e) => { if (e.Data != null) _logger.LogInformation("[AiApiServer] {Line}", e.Data); };
                process.ErrorDataReceived += (_, e) =>
                {
                    if (e.Data == null) return;
                    _logger.LogWarning("[AiApiServer] {Line}", e.Data);
                    // Remember the last meaningful stderr line as the likely crash reason.
                    // Letzte aussagekräftige stderr-Zeile als wahrscheinlichen Absturzgrund merken.
                    var line = e.Data.Trim();
                    if (line.Length > 0) _lastStderrLine = line;
                };
                process.Exited += (_, _) =>
                {
                    // Unexpected death is the user's only diagnostic besides the log — make it loud
                    // and surface the reason to the UI (status poll), unless we killed it on purpose.
                    // Unerwartetes Ende laut loggen und den Grund an die UI geben (Status-Poll) —
                    // außer wir haben den Prozess selbst beendet.
                    int code = -1;
                    try { code = process.ExitCode; } catch { /* unavailable in rare races */ }
                    _logger.LogWarning("AiApiServer exited (code {ExitCode})", code);
                    if (!_expectedExit && code != 0)
                        _lastStartError = _lastStderrLine ?? $"Server beendet (Code {code})";
                };
                process.Start();
                process.BeginOutputReadLine();
                process.BeginErrorReadLine();
                _process = process;
                _logger.LogInformation("AiApiServer started (pid {Pid}) in {Dir}", process.Id, serverDir);
            }
            catch (Win32Exception ex)
            {
                _logger.LogWarning(ex, "Failed to launch python for AiApiServer");
                throw new BridgeException(
                    "Python nicht gefunden — Pfad in den Einstellungen (AiServer:PythonExecutable) setzen.",
                    internalMessage: $"python launch failed: {ex.Message}");
            }
        }
    }

    public void StopServer()
    {
        lock (_gate)
        {
            if (_process is null || _process.HasExited)
                throw new BridgeException(
                    "Der Server wurde nicht von TagFusion gestartet.",
                    internalMessage: "No app-managed server to stop");

            KillTrackedProcess();
        }
    }

    // Caller holds _gate. / Aufrufer hält _gate.
    private void KillTrackedProcess()
    {
        // Mark the coming Exited event as intentional so it is not reported as a crash.
        // Kommendes Exited-Event als gewollt markieren — kein Absturz.
        _expectedExit = true;
        try
        {
            _process!.Kill(entireProcessTree: true);
            _process.WaitForExit(5000);
            _logger.LogInformation("AiApiServer stopped");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to stop AiApiServer cleanly");
        }
        finally
        {
            _process?.Dispose();
            _process = null;
        }
    }

    /// <summary>
    /// Resolve the server directory: use the configured dir if it contains main.py,
    /// otherwise search upward from startDir for an AiApiServer folder with main.py.
    /// Server-Ordner ermitteln: konfigurierten Ordner nehmen wenn er main.py enthält,
    /// sonst von startDir aufwärts nach AiApiServer/main.py suchen.
    /// </summary>
    internal static string? ResolveServerDirectory(string configuredDir, string startDir)
    {
        if (!string.IsNullOrWhiteSpace(configuredDir) &&
            File.Exists(Path.Combine(configuredDir, "main.py")))
        {
            return configuredDir;
        }

        var dir = new DirectoryInfo(startDir);
        while (dir != null)
        {
            // sibling/descendant AiApiServer/main.py
            var candidate = Path.Combine(dir.FullName, "AiApiServer", "main.py");
            if (File.Exists(candidate))
                return Path.GetDirectoryName(candidate);

            // the dir itself is AiApiServer with main.py
            if (string.Equals(dir.Name, "AiApiServer", StringComparison.OrdinalIgnoreCase) &&
                File.Exists(Path.Combine(dir.FullName, "main.py")))
                return dir.FullName;

            dir = dir.Parent;
        }
        return null;
    }

    /// <summary>
    /// Resolve the python executable for portability. An explicit path is honored (relative paths
    /// are resolved against serverDir so the whole folder stays USB-portable); a bare command name
    /// ("python") first auto-detects a bundled venv/python inside serverDir, else falls back to the
    /// command (PATH lookup).
    /// Python-Programm portabel ermitteln: expliziter Pfad gewinnt (relativ → gegen serverDir, damit
    /// der Ordner USB-portabel bleibt); bloßer Befehlsname sucht zuerst ein gebündeltes venv/python
    /// im serverDir, sonst PATH.
    /// </summary>
    internal static string ResolvePythonExecutable(string configured, string serverDir)
    {
        var value = string.IsNullOrWhiteSpace(configured) ? "python" : configured.Trim();

        // Explicit path (rooted or with a separator) → resolve a relative one against serverDir.
        if (Path.IsPathRooted(value) || value.Contains('/') || value.Contains('\\'))
            return Path.IsPathRooted(value) ? value : Path.GetFullPath(Path.Combine(serverDir, value));

        // Bare command name → prefer a bundled python inside the server folder (portable).
        string[] candidates =
        {
            Path.Combine("venv", "Scripts", "python.exe"),
            Path.Combine(".venv", "Scripts", "python.exe"),
            Path.Combine("python", "python.exe"),
        };
        foreach (var rel in candidates)
        {
            var full = Path.Combine(serverDir, rel);
            if (File.Exists(full)) return full;
        }

        // Nothing bundled → PATH lookup (unchanged behavior).
        return value;
    }

    /// <summary>Extract the port from a base URL, falling back to 50051. / Port aus BaseUrl, Fallback 50051.</summary>
    internal static int PortFromBaseUrl(string baseUrl)
    {
        return Uri.TryCreate(baseUrl, UriKind.Absolute, out var uri) && uri.Port > 0
            ? uri.Port
            : 50051;
    }

    public void Dispose()
    {
        lock (_gate)
        {
            if (_disposed) return;
            _disposed = true;
            if (_process is { HasExited: false })
                KillTrackedProcess();
        }
    }
}
