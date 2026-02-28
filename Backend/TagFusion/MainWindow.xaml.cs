using System.IO;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media.Animation;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.Web.WebView2.Core;
using TagFusion.Bridge;
using TagFusion.Configuration;
using TagFusion.Database;
using TagFusion.Services;

namespace TagFusion;

/// <summary>
/// Interaction logic for MainWindow.xaml
/// </summary>
public partial class MainWindow : Window
{
    private readonly string _appDirectory;
    private readonly string _wwwrootPath;
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<MainWindow> _logger;
    private readonly UiSettings _uiSettings;

    private WebViewBridge? _bridge;

    // Windows DWM API for dark title bar
    [DllImport("dwmapi.dll", PreserveSig = true)]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);

    private const int DWMWA_USE_IMMERSIVE_DARK_MODE = 20;

    public MainWindow(IServiceProvider serviceProvider)
    {
        InitializeComponent();

        _serviceProvider = serviceProvider;
        _logger = serviceProvider.GetRequiredService<ILogger<MainWindow>>();
        _uiSettings = serviceProvider.GetRequiredService<IOptions<UiSettings>>().Value;

        // Use multiple fallbacks for app directory (single-file publishing can cause issues)
        _appDirectory = GetAppDirectory();
        _wwwrootPath = Path.Combine(_appDirectory, "wwwroot");

        Loaded += MainWindow_Loaded;

        // Apply dark title bar
        SourceInitialized += (s, e) => EnableDarkTitleBar();
    }

    private static string GetAppDirectory()
    {
        // Try multiple approaches to get the app directory
        var baseDir = AppContext.BaseDirectory;
        if (!string.IsNullOrEmpty(baseDir))
            return baseDir;

        // Fallback: Use the directory of the entry assembly
        var entryAssembly = System.Reflection.Assembly.GetEntryAssembly();
        if (entryAssembly != null)
        {
            var location = entryAssembly.Location;
            if (!string.IsNullOrEmpty(location))
                return Path.GetDirectoryName(location) ?? Environment.CurrentDirectory;
        }

        // Fallback: Use the current process directory
        var processPath = Environment.ProcessPath;
        if (!string.IsNullOrEmpty(processPath))
            return Path.GetDirectoryName(processPath) ?? Environment.CurrentDirectory;

        // Final fallback: Use current directory
        return Environment.CurrentDirectory;
    }

    private void EnableDarkTitleBar()
    {
        var hwnd = new WindowInteropHelper(this).Handle;
        var useDarkMode = 1;
        DwmSetWindowAttribute(hwnd, DWMWA_USE_IMMERSIVE_DARK_MODE, ref useDarkMode, sizeof(int));
    }

    private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
    {
        // Check if WebView2 Runtime is installed
        try
        {
            var version = CoreWebView2Environment.GetAvailableBrowserVersionString();
            _logger.LogInformation("WebView2 Runtime Version: {Version}", version);
        }
        catch (WebView2RuntimeNotFoundException)
        {
            MessageBox.Show(
                "WebView2 Runtime ist nicht installiert.\n\n" +
                "Bitte laden Sie die Runtime herunter:\n" +
                "https://developer.microsoft.com/en-us/microsoft-edge/webview2/",
                "TagFusion - WebView2 erforderlich",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
            Application.Current.Shutdown();
            return;
        }

        await InitializeWebViewAsync();
    }

    private async Task InitializeWebViewAsync()
    {
        try
        {
            // Create WebView2 environment with user data folder and GPU acceleration
            var userDataFolder = Path.Combine(_appDirectory, "WebView2Data");

            // Enable hardware acceleration via environment options
            var options = new CoreWebView2EnvironmentOptions
            {
                // Enable GPU acceleration and disable software rendering fallback
                AdditionalBrowserArguments = _uiSettings.BrowserArgs
            };

            var env = await CoreWebView2Environment.CreateAsync(null, userDataFolder, options);

            await webView.EnsureCoreWebView2Async(env);

            // Configure WebView2 settings
            webView.CoreWebView2.Settings.IsScriptEnabled = true;
            webView.CoreWebView2.Settings.AreDefaultScriptDialogsEnabled = true;
            webView.CoreWebView2.Settings.IsWebMessageEnabled = true;
            webView.CoreWebView2.Settings.AreDevToolsEnabled = true; // Disable in production
            webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;

            // Resolve services from DI container
            var exifToolService = _serviceProvider.GetRequiredService<ExifToolService>();
            var fileSystemService = _serviceProvider.GetRequiredService<FileSystemService>();
            var tagService = _serviceProvider.GetRequiredService<TagService>();
            var databaseService = _serviceProvider.GetRequiredService<IDatabaseService>();
            var imageEditService = _serviceProvider.GetRequiredService<ImageEditService>();
            var fileOperationService = _serviceProvider.GetRequiredService<FileOperationService>();
            var diagnosticsService = _serviceProvider.GetRequiredService<DiagnosticsService>();
            var folderWatcherService = _serviceProvider.GetRequiredService<FolderWatcherService>();
            var tagExportService = _serviceProvider.GetRequiredService<TagExportService>();
            var duplicateDetectionService = _serviceProvider.GetRequiredService<DuplicateDetectionService>();

            // Initialize bridge for C# <-> React communication
            var bridgeLogger = _serviceProvider.GetRequiredService<ILogger<WebViewBridge>>();
            _bridge = new WebViewBridge(
                webView.CoreWebView2,
                exifToolService,
                fileSystemService,
                tagService,
                databaseService,
                imageEditService,
                fileOperationService,
                diagnosticsService,
                folderWatcherService,
                tagExportService,
                duplicateDetectionService,
                bridgeLogger);

            // Set up virtual host for wwwroot
            if (Directory.Exists(_wwwrootPath))
            {
                webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                    "tagfusion.local",
                    _wwwrootPath,
                    CoreWebView2HostResourceAccessKind.Allow);
            }

            // Hide splash when navigation completes
            webView.CoreWebView2.NavigationCompleted += OnNavigationCompleted;

            if (Directory.Exists(_wwwrootPath))
            {
                webView.CoreWebView2.Navigate("https://tagfusion.local/index.html");
            }
            else
            {
                // Development mode: Load from Vite dev server
                webView.CoreWebView2.Navigate("http://localhost:5173");
            }
        }
        catch (Exception ex)
        {
            var innerMessage = ex.InnerException?.Message ?? "keine";
            var stackTrace = ex.StackTrace ?? "kein Stack Trace";
            MessageBox.Show(
                $"Fehler beim Initialisieren von WebView2:\n{ex.Message}\n\nInner Exception: {innerMessage}\n\nStack Trace (erste 500 Zeichen):\n{stackTrace.Substring(0, Math.Min(500, stackTrace.Length))}",
                "TagFusion - Fehler",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
        }
    }

    private void OnNavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e)
    {
        if (e.IsSuccess)
        {
            // Small delay to let React render
            Dispatcher.BeginInvoke(async () =>
            {
                await Task.Delay(_uiSettings.SplashDelayMs);
                HideSplash();
            });
        }
    }

    private void HideSplash()
    {
        var storyboard = (Storyboard)FindResource("FadeOutAnimation");
        storyboard.Completed += (s, e) =>
        {
            SplashOverlay.Visibility = Visibility.Collapsed;
        };
        storyboard.Begin(this);
    }
}