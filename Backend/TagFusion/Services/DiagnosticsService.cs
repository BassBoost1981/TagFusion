using System.IO;
using Microsoft.Extensions.Logging;
using TagFusion.Database;

namespace TagFusion.Services;

/// <summary>
/// System-wide health check service.
/// Übergreifender Gesundheitscheck für alle Subsysteme.
/// </summary>
public class DiagnosticsService
{
    private readonly IDatabaseService _databaseService;
    private readonly ExifToolService _exifToolService;
    private readonly ILogger<DiagnosticsService> _logger;

    public DiagnosticsService(
        IDatabaseService databaseService,
        ExifToolService exifToolService,
        ILogger<DiagnosticsService> logger)
    {
        _databaseService = databaseService;
        _exifToolService = exifToolService;
        _logger = logger;
    }

    /// <summary>
    /// Run all health checks and return a summary report.
    /// Führt alle Gesundheitschecks aus und gibt einen Bericht zurück.
    /// </summary>
    public async Task<HealthReport> CheckHealthAsync(CancellationToken cancellationToken = default)
    {
        var report = new HealthReport();

        // 1. Database health
        try
        {
            report.DatabaseOk = await _databaseService.HealthCheckAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Database health check failed");
            report.DatabaseOk = false;
            report.DatabaseError = ex.Message;
        }

        // 2. ExifTool availability
        try
        {
            report.ExifToolOk = File.Exists(_exifToolService.ExifToolPath);
            report.ExifToolPath = _exifToolService.ExifToolPath;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ExifTool health check failed");
            report.ExifToolOk = false;
            report.ExifToolError = ex.Message;
        }

        // 3. Disk space for app directory
        try
        {
            var appDir = AppContext.BaseDirectory;
            var driveInfo = new DriveInfo(Path.GetPathRoot(appDir)!);
            report.DiskFreeBytes = driveInfo.AvailableFreeSpace;
            report.DiskTotalBytes = driveInfo.TotalSize;
            // Warn if less than 100 MB free
            report.DiskOk = driveInfo.AvailableFreeSpace > 100 * 1024 * 1024;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Disk space check failed");
            report.DiskOk = false;
            report.DiskError = ex.Message;
        }

        report.AllOk = report.DatabaseOk && report.ExifToolOk && report.DiskOk;
        report.CheckedAt = DateTime.UtcNow;

        _logger.LogInformation("Health check completed: AllOk={AllOk}, DB={DbOk}, ExifTool={ExifToolOk}, Disk={DiskOk}",
            report.AllOk, report.DatabaseOk, report.ExifToolOk, report.DiskOk);

        return report;
    }
}

public class HealthReport
{
    public bool AllOk { get; set; }
    public DateTime CheckedAt { get; set; }

    public bool DatabaseOk { get; set; }
    public string? DatabaseError { get; set; }

    public bool ExifToolOk { get; set; }
    public string? ExifToolPath { get; set; }
    public string? ExifToolError { get; set; }

    public bool DiskOk { get; set; }
    public long DiskFreeBytes { get; set; }
    public long DiskTotalBytes { get; set; }
    public string? DiskError { get; set; }
}
