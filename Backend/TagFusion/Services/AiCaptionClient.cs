using System.IO;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;
using TagFusion.Configuration;

namespace TagFusion.Services;

/// <summary>
/// Talks to the neighbouring AiApiServer (Python/Flask). Request/response shapes
/// mirror AiApiServer/modules/server_dataclasses.py — the server is the source of truth.
/// Spricht mit dem AiApiServer; die JSON-Formen spiegeln dessen Dataclasses.
/// </summary>
public sealed class AiCaptionClient : IAiCaptionClient
{
    private readonly HttpClient _http;
    private readonly AiServerSettings _settings;
    private readonly ILogger<AiCaptionClient> _logger;

    private static readonly JsonSerializerOptions _json = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public AiCaptionClient(HttpClient http, IOptions<AiServerSettings> options, ILogger<AiCaptionClient> logger)
    {
        _http = http;
        _settings = options.Value;
        _http.BaseAddress = new Uri(_settings.BaseUrl);
        _http.Timeout = TimeSpan.FromMinutes(_settings.CaptionTimeoutMinutes);
        _logger = logger;
    }

    // --- /status ---------------------------------------------------------
    private sealed record StatusDto(string? state, string? model, double? progress, string? message);

    public async Task<AiServerStatus> GetStatusAsync(CancellationToken ct = default)
    {
        try
        {
            using var timerCts = new CancellationTokenSource(TimeSpan.FromSeconds(_settings.QuickTimeoutSeconds));
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct, timerCts.Token);
            var dto = await _http.GetFromJsonAsync<StatusDto>("/status", _json, cts.Token);
            return new AiServerStatus(true, dto?.state ?? "idle", dto?.model ?? "", dto?.progress ?? -1, dto?.message ?? "");
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            _logger.LogDebug(ex, "AiApiServer status check failed (treated as unreachable)");
            return new AiServerStatus(false, "unreachable", "", -1, "");
        }
    }

    // --- /listmodelsbytype + /getmodelparams ------------------------------
    private sealed record ModelBaseInfoDto(string? ModelName);
    private sealed record ListModelsDto(List<ModelBaseInfoDto>? Interrogators);
    private sealed record ModelParamDto(string? Key);
    private sealed record ModelParamsResponseDto(List<ModelParamDto>? Parameters);

    public async Task<List<string>> GetCaptionModelsAsync(CancellationToken ct = default)
    {
        var captionModels = new List<string>();
        try
        {
            using var timerCts = new CancellationTokenSource(TimeSpan.FromSeconds(_settings.QuickTimeoutSeconds));
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct, timerCts.Token);
            var list = await _http.GetFromJsonAsync<ListModelsDto>("/listmodelsbytype", _json, cts.Token);
            foreach (var model in list?.Interrogators ?? new List<ModelBaseInfoDto>())
            {
                if (string.IsNullOrEmpty(model.ModelName)) continue;
                ct.ThrowIfCancellationRequested();

                // Capability probe: captioning models expose a "prompt" parameter,
                // taggers only a "threshold". Fähigkeits-Check über den prompt-Parameter.
                using var probeTimerCts = new CancellationTokenSource(TimeSpan.FromSeconds(_settings.QuickTimeoutSeconds));
                using var probeCts = CancellationTokenSource.CreateLinkedTokenSource(ct, probeTimerCts.Token);
                var payloadStr = JsonSerializer.Serialize(new { Name = model.ModelName }, _json);
                var probeContent = new StringContent(payloadStr, System.Text.Encoding.UTF8, "application/json");
                var resp = await _http.PostAsync("/getmodelparams", probeContent, probeCts.Token);
                if (!resp.IsSuccessStatusCode) continue;
                var pars = await resp.Content.ReadFromJsonAsync<ModelParamsResponseDto>(_json, probeCts.Token);
                if (pars?.Parameters?.Any(p => string.Equals(p.Key, "prompt", StringComparison.OrdinalIgnoreCase)) == true)
                    captionModels.Add(model.ModelName!);
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            _logger.LogDebug(ex, "AiApiServer model listing failed");
        }
        return captionModels;
    }

    // --- /interrogateimage ------------------------------------------------
    private sealed record TagEntryDto(string? Tag, double? Probability);
    private sealed record InterrogateResultDto(string? ModelName, List<TagEntryDto>? Tags);
    private sealed record InterrogateResponseDto(bool Success, string? ErrorMessage, List<InterrogateResultDto>? Result);

    public async Task<string> CaptionAsync(string imagePath, string model, string prompt, CancellationToken ct = default)
    {
        var payload = new
        {
            DataObject = await ToDownscaledJpegBase64Async(imagePath, ct),
            DataType = 1, // IMAGE_BYTE_ARRAY
            SkipInternetRequests = false,
            SerializeVramUsage = false,
            FileName = Path.GetFileName(imagePath),
            Models = new[]
            {
                new
                {
                    ModelName = model,
                    AdditionalParameters = new[]
                    {
                        new { Key = "prompt", Value = prompt, Type = "string", Comment = "" }
                    }
                }
            }
        };

        var json = JsonSerializer.Serialize(payload, _json);
        var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");
        var response = await _http.PostAsync("/interrogateimage", content, ct);
        response.EnsureSuccessStatusCode();
        var dto = await response.Content.ReadFromJsonAsync<InterrogateResponseDto>(_json, ct)
                  ?? throw new InvalidOperationException("Leere Antwort vom KI-Server");

        if (!dto.Success)
            throw new InvalidOperationException(dto.ErrorMessage ?? "KI-Server meldet Fehler ohne Details");

        var texts = dto.Result?.FirstOrDefault()?.Tags?
            .Select(t => t.Tag)
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .ToList() ?? new List<string?>();

        if (texts.Count == 0)
            throw new InvalidOperationException("KI-Server lieferte keine Beschreibung");

        return string.Join(", ", texts);
    }

    private async Task<string> ToDownscaledJpegBase64Async(string imagePath, CancellationToken ct)
    {
        using var image = await Image.LoadAsync<Rgb24>(imagePath, ct);
        var max = Math.Max(image.Width, image.Height);
        if (max > _settings.MaxImageDimension)
        {
            var scale = (double)_settings.MaxImageDimension / max;
            image.Mutate(x => x.Resize((int)Math.Round(image.Width * scale), (int)Math.Round(image.Height * scale)));
        }
        using var ms = new MemoryStream();
        await image.SaveAsJpegAsync(ms, ct);
        return Convert.ToBase64String(ms.ToArray());
    }
}
