using System.Windows;
using Microsoft.Extensions.DependencyInjection;
using TagFusion.Database;
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
}

