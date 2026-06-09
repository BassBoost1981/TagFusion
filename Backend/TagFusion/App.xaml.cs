using System.IO;
using System.Windows;
using System.Windows.Threading;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using TagFusion.Configuration;
using TagFusion.Database;
using TagFusion.Logging;
using TagFusion.Services;

namespace TagFusion;

/// <summary>
/// Interaction logic for App.xaml
/// </summary>
public partial class App : Application
{
    public IServiceProvider Services { get; private set; } = null!;
    private ILogger<App>? _appLogger;

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        // Load configuration from appsettings.json, then overlay Development overrides
        // (e.g. --disable-http-cache) when a debugger is attached or the build is Debug.
        // appsettings.Development.json wird nur im Debug-Modus geladen — so bleiben Dev-Flags
        // nicht in Release-Builds.
        var configBuilder = new ConfigurationBuilder()
            .SetBasePath(AppContext.BaseDirectory)
            .AddJsonFile("appsettings.json", optional: true, reloadOnChange: false);

#if DEBUG
        configBuilder.AddJsonFile("appsettings.Development.json", optional: true, reloadOnChange: false);
#else
        if (System.Diagnostics.Debugger.IsAttached)
            configBuilder.AddJsonFile("appsettings.Development.json", optional: true, reloadOnChange: false);
#endif

        var configuration = configBuilder.Build();

        var services = new ServiceCollection();

        // Bind strongly-typed settings sections
        services.Configure<ExifToolSettings>(configuration.GetSection("ExifTool"));
        services.Configure<ThumbnailSettings>(configuration.GetSection("Thumbnail"));
        services.Configure<DatabaseSettings>(configuration.GetSection("Database"));
        services.Configure<ImageEditSettings>(configuration.GetSection("ImageEdit"));
        services.Configure<BackupSettings>(configuration.GetSection("Backup"));
        services.Configure<FileLoggingSettings>(configuration.GetSection("FileLogging"));
        services.Configure<TagSettings>(configuration.GetSection("Tags"));
        services.Configure<UiSettings>(configuration.GetSection("Ui"));

        // Logging: Console (debug) + File (persistent)
        var fileLogging = configuration.GetSection("FileLogging").Get<FileLoggingSettings>() ?? new FileLoggingSettings();
        var logDir = Path.IsPathRooted(fileLogging.LogDirectory)
            ? fileLogging.LogDirectory
            : Path.Combine(AppContext.BaseDirectory, fileLogging.LogDirectory);
        var minLevel = Enum.TryParse<LogLevel>(fileLogging.MinLevel, true, out var parsed) ? parsed : LogLevel.Information;

        services.AddLogging(builder =>
        {
            builder.SetMinimumLevel(LogLevel.Debug);
            builder.AddConsole();
            builder.AddProvider(new FileLoggerProvider(logDir, minLevel, fileLogging.RetentionDays));
        });

        // Services ohne Abhängigkeiten
        services.AddSingleton<ThumbnailService>();
        services.AddSingleton<IThumbnailService>(sp => sp.GetRequiredService<ThumbnailService>());
        services.AddSingleton<IFileBackupService, FileBackupService>();
        services.AddSingleton<IDatabaseService, DatabaseService>();
        services.AddSingleton<TagService>();
        services.AddSingleton<ITagService>(sp => sp.GetRequiredService<TagService>());
        services.AddSingleton<FileOperationService>();
        services.AddSingleton<IFileOperationService>(sp => sp.GetRequiredService<FileOperationService>());
        services.AddSingleton<FolderWatcherService>();
        services.AddSingleton<DuplicateDetectionService>();

        // Services mit Abhängigkeiten
        services.AddSingleton<ExifToolService>();
        services.AddSingleton<IExifToolService>(sp => sp.GetRequiredService<ExifToolService>());
        services.AddSingleton<FileSystemService>();
        services.AddSingleton<IFileSystemService>(sp => sp.GetRequiredService<FileSystemService>());
        services.AddSingleton<ImageEditService>();
        services.AddSingleton<IImageEditService>(sp => sp.GetRequiredService<ImageEditService>());
        services.AddSingleton<DiagnosticsService>();
        services.AddSingleton<TagExportService>();

        Services = services.BuildServiceProvider();
        _appLogger = Services.GetRequiredService<ILogger<App>>();

        // === Global Error Handling ===
        DispatcherUnhandledException += OnDispatcherUnhandledException;
        AppDomain.CurrentDomain.UnhandledException += OnAppDomainUnhandledException;
        TaskScheduler.UnobservedTaskException += OnUnobservedTaskException;

        var mainWindow = new MainWindow(Services);
        mainWindow.Show();
    }

    private void OnDispatcherUnhandledException(object sender, DispatcherUnhandledExceptionEventArgs e)
    {
        _appLogger?.LogCritical(e.Exception, "Unbehandelte UI-Exception");
        MessageBox.Show(
            $"Ein unerwarteter Fehler ist aufgetreten:\n{e.Exception.Message}\n\nDie Anwendung versucht fortzufahren.",
            "TagFusion – Fehler",
            MessageBoxButton.OK,
            MessageBoxImage.Error);
        e.Handled = true;
    }

    private void OnAppDomainUnhandledException(object sender, UnhandledExceptionEventArgs e)
    {
        var ex = e.ExceptionObject as Exception;
        _appLogger?.LogCritical(ex, "Unbehandelte AppDomain-Exception (Terminating={IsTerminating})", e.IsTerminating);
        if (e.IsTerminating)
        {
            MessageBox.Show(
                $"Ein kritischer Fehler ist aufgetreten:\n{ex?.Message}\n\nDie Anwendung wird beendet.",
                "TagFusion – Kritischer Fehler",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
        }
    }

    private void OnUnobservedTaskException(object? sender, UnobservedTaskExceptionEventArgs e)
    {
        _appLogger?.LogError(e.Exception, "Unbeobachtete Task-Exception");
        e.SetObserved();
    }

    protected override void OnExit(ExitEventArgs e)
    {
        // Dispose ServiceProvider → ruft Dispose() auf allen IDisposable-Singletons (z.B. DatabaseService)
        (Services as IDisposable)?.Dispose();
        base.OnExit(e);
    }
}
