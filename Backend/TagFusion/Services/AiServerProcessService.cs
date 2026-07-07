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

            var serverDir = ResolveServerDirectory(_settings.ServerDirectory, AppContext.BaseDirectory);
            if (serverDir == null)
                throw new BridgeException(
                    "AiApiServer-Ordner nicht gefunden.",
                    internalMessage: "AiApiServer directory not resolvable");

            var psi = new ProcessStartInfo
            {
                FileName = _settings.PythonExecutable,
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
                process.ErrorDataReceived += (_, e) => { if (e.Data != null) _logger.LogWarning("[AiApiServer] {Line}", e.Data); };
                process.Exited += (_, _) =>
                {
                    // Unexpected death is the user's only diagnostic besides the log — make it loud.
                    // Unerwartetes Prozess-Ende laut loggen — sonst sieht der User nur „Server startet …" verschwinden.
                    try { _logger.LogWarning("AiApiServer exited (code {ExitCode})", process.ExitCode); }
                    catch { /* ExitCode unavailable in rare races / ExitCode in seltenen Races nicht lesbar */ }
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
