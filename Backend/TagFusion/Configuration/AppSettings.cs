namespace TagFusion.Configuration;

/// <summary>
/// ExifTool process and batch settings.
/// Konfiguration für ExifTool-Prozess und Batch-Verarbeitung.
/// </summary>
public record ExifToolSettings
{
    public int BatchSize { get; init; } = 50;
    public int MaxImageSize { get; init; } = 1920;
    public int ProcessStopTimeoutMs { get; init; } = 1000;
}

/// <summary>
/// Thumbnail generation and caching settings.
/// Konfiguration für Thumbnail-Erzeugung und Caching.
/// </summary>
public record ThumbnailSettings
{
    public int Size { get; init; } = 256;
    public int JpegQuality { get; init; } = 92;
    public int MaxParallel { get; init; } = 8;
}

/// <summary>
/// SQLite database settings.
/// Konfiguration für die SQLite-Datenbank.
/// </summary>
public record DatabaseSettings
{
    public string DbFileName { get; init; } = "tagfusion.db";
    public int ChunkSize { get; init; } = 500;
}

/// <summary>
/// Image editing settings (rotate/flip JPEG quality).
/// Konfiguration für Bildbearbeitung.
/// </summary>
public record ImageEditSettings
{
    public int JpegQuality { get; init; } = 95;
}

/// <summary>
/// File-based logging settings.
/// Konfiguration für dateibasiertes Logging.
/// </summary>
public record FileLoggingSettings
{
    public string LogDirectory { get; init; } = "logs";
    public string MinLevel { get; init; } = "Information";
    public int RetentionDays { get; init; } = 14;
}

/// <summary>
/// Tag service settings.
/// Konfiguration für den Tag-Service.
/// </summary>
public record TagSettings
{
    public int MaxDirSearchDepth { get; init; } = 6;
    public string DefaultTagFile { get; init; } = "TagFusion_Tags_20251112.json";
}

/// <summary>
/// UI / WebView2 settings.
/// Konfiguration für UI und WebView2.
/// </summary>
public record UiSettings
{
    public int SplashDelayMs { get; init; } = 300;
    public string BrowserArgs { get; init; } = "--enable-gpu-rasterization --enable-zero-copy --enable-features=VaapiVideoDecoder --disable-software-rasterizer --enable-accelerated-2d-canvas --enable-accelerated-video-decode --gpu-rasterization-msaa-sample-count=0 --disable-http-cache";
}
