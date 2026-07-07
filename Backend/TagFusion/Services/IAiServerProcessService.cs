namespace TagFusion.Services;

/// <summary>
/// Starts/stops the local AiApiServer as a child process. Only a server this app
/// started is ever stopped; externally launched servers are left alone.
/// Startet/stoppt den lokalen AiApiServer als Kindprozess — nur ein selbst
/// gestarteter Server wird gestoppt, fremd gestartete bleiben unberührt.
/// </summary>
public interface IAiServerProcessService
{
    /// <summary>True if this app started the tracked server and it is still alive.</summary>
    bool IsManagedByApp { get; }
    void StartServer();
    void StopServer();
}
