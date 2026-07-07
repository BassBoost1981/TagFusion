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
    /// <summary>Timeout in ms for reading ExifTool output. 0 = no timeout. Default: 30s.</summary>
    public int ReadTimeoutMs { get; init; } = 30000;
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
    /// <summary>Max cache size in MB. When exceeded, oldest files are evicted. 0 = unlimited.</summary>
    public int MaxCacheSizeMb { get; init; } = 500;
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
/// Safety backups for destructive file and metadata operations.
/// Sicherheitskopien für schreibende Datei- und Metadatenaktionen.
/// </summary>
public record BackupSettings
{
    public bool Enabled { get; init; } = true;
    public string Directory { get; init; } = "backups";
    public int RetentionDays { get; init; } = 30;
    public int MaxFileSizeMb { get; init; } = 512;
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
    public int SplashDelayMs { get; init; } = 100;
    public string BrowserArgs { get; init; } = "--enable-gpu-rasterization --enable-zero-copy --enable-features=VaapiVideoDecoder --disable-software-rasterizer --enable-accelerated-2d-canvas --enable-accelerated-video-decode --gpu-rasterization-msaa-sample-count=0";
    public bool EnableDevTools { get; init; }
    public bool ClearDiskCacheOnStartup { get; init; } = true;
}

/// <summary>
/// Local AI caption server (AiApiServer) connection settings.
/// Verbindungseinstellungen für den lokalen KI-Server (AiApiServer).
/// </summary>
public record AiServerSettings
{
    public string BaseUrl { get; init; } = "http://127.0.0.1:50051";
    /// <summary>Per-caption timeout — first call may trigger a model download/load.</summary>
    public int CaptionTimeoutMinutes { get; init; } = 10;
    /// <summary>Timeout for status/model-list calls.</summary>
    public int QuickTimeoutSeconds { get; init; } = 5;
    public int MaxImageDimension { get; init; } = 1536;
    /// <summary>Python executable used to launch the server (PATH name or full path).</summary>
    public string PythonExecutable { get; init; } = "python";
    /// <summary>AiApiServer directory; empty = auto-search upward from the app for AiApiServer/main.py.</summary>
    public string ServerDirectory { get; init; } = "";
}
