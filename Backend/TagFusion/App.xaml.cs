using System.IO;
using System.Windows;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
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

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        var services = new ServiceCollection();

        // Logging: Console (debug) + File (persistent)
        var logDir = Path.Combine(AppContext.BaseDirectory, "logs");
        services.AddLogging(builder =>
        {
            builder.SetMinimumLevel(LogLevel.Debug);
            builder.AddConsole();
            builder.AddProvider(new FileLoggerProvider(logDir, LogLevel.Information));
        });

        // Services ohne Abhängigkeiten
        services.AddSingleton<ThumbnailService>();
        services.AddSingleton<IDatabaseService, DatabaseService>();
        services.AddSingleton<TagService>();
        services.AddSingleton<FileOperationService>();

        // Services mit Abhängigkeiten
        services.AddSingleton<ExifToolService>();
        services.AddSingleton<FileSystemService>();
        services.AddSingleton<ImageEditService>();

        Services = services.BuildServiceProvider();

        var mainWindow = new MainWindow(Services);
        mainWindow.Show();
    }

    protected override void OnExit(ExitEventArgs e)
    {
        // Dispose ServiceProvider → ruft Dispose() auf allen IDisposable-Singletons (z.B. DatabaseService)
        (Services as IDisposable)?.Dispose();
        base.OnExit(e);
    }
}

