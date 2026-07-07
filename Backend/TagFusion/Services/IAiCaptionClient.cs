namespace TagFusion.Services;

/// <summary>Current AiApiServer state as shown in the dialog. / Serverzustand für den Dialog.</summary>
public record AiServerStatus(bool Reachable, string State, string Model, double Progress, string Message);

/// <summary>
/// HTTP client for the local AiApiServer (captioning). Implementations never throw
/// from status/model-list calls — unreachable simply means Reachable=false.
/// HTTP-Client für den lokalen AiApiServer. Status-/Modell-Aufrufe werfen nie —
/// nicht erreichbar heißt schlicht Reachable=false.
/// </summary>
public interface IAiCaptionClient
{
    Task<AiServerStatus> GetStatusAsync(CancellationToken ct = default);
    Task<List<string>> GetCaptionModelsAsync(CancellationToken ct = default);
    /// <summary>Caption one image; throws InvalidOperationException with the server's message on failure.</summary>
    Task<string> CaptionAsync(string imagePath, string model, string prompt, CancellationToken ct = default);
}
