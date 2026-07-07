using System.Diagnostics;
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

    // Attribute 20 is Windows 10 20H1+ / Windows 11.
    // Attribute 19 is the legacy pre-20H1 value; we fall back if 20 is rejected.
    private const int DWMWA_USE_IMMERSIVE_DARK_MODE = 20;
    private const int DWMWA_USE_IMMERSIVE_DARK_MODE_LEGACY = 19;

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
        // Windows 10 pre-20H1 used attribute 19; try the modern value first
        // and fall back on any non-zero HRESULT so older installs still get dark chrome.
        var hr = DwmSetWindowAttribute(hwnd, DWMWA_USE_IMMERSIVE_DARK_MODE, ref useDarkMode, sizeof(int));
        if (hr != 0)
            DwmSetWindowAttribute(hwnd, DWMWA_USE_IMMERSIVE_DARK_MODE_LEGACY, ref useDarkMode, sizeof(int));
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

    /// <summary>
    /// Resolves all services from DI on a background thread (parallel to WebView2 init).
    /// Löst alle Services im Hintergrund auf (parallel zur WebView2-Initialisierung).
    /// </summary>
    private (IExifToolService, IFileSystemService, ITagService, IDatabaseService, IImageEditService,
        IFileOperationService, DiagnosticsService, FolderWatcherService, TagExportService,
        DuplicateDetectionService, FaceScanService, IFaceEngine, DescriptionScanService, IAiCaptionClient,
        ILoggerFactory) ResolveServices()
    {
        return (
            _serviceProvider.GetRequiredService<IExifToolService>(),
            _serviceProvider.GetRequiredService<IFileSystemService>(),
            _serviceProvider.GetRequiredService<ITagService>(),
            _serviceProvider.GetRequiredService<IDatabaseService>(),
            _serviceProvider.GetRequiredService<IImageEditService>(),
            _serviceProvider.GetRequiredService<IFileOperationService>(),
            _serviceProvider.GetRequiredService<DiagnosticsService>(),
            _serviceProvider.GetRequiredService<FolderWatcherService>(),
            _serviceProvider.GetRequiredService<TagExportService>(),
            _serviceProvider.GetRequiredService<DuplicateDetectionService>(),
            _serviceProvider.GetRequiredService<FaceScanService>(),
            _serviceProvider.GetRequiredService<IFaceEngine>(),
            _serviceProvider.GetRequiredService<DescriptionScanService>(),
            _serviceProvider.GetRequiredService<IAiCaptionClient>(),
            _serviceProvider.GetRequiredService<ILoggerFactory>()
        );
    }

    private async Task InitializeWebViewAsync()
    {
        try
        {
            var userDataFolder = Path.Combine(_appDirectory, "WebView2Data");

            var options = new CoreWebView2EnvironmentOptions
            {
                AdditionalBrowserArguments = _uiSettings.BrowserArgs
            };

            // === PERF: Resolve DI services on background thread WHILE WebView2 initializes ===
            // Service-Auflösung parallel zur WebView2-Erstellung starten
            var serviceTask = Task.Run(ResolveServices);

            var env = await CoreWebView2Environment.CreateAsync(null, userDataFolder, options);
            await webView.EnsureCoreWebView2Async(env);

            // Configure WebView2 settings
            var s = webView.CoreWebView2.Settings;
            s.IsScriptEnabled = true;
            // React UI never uses alert()/confirm()/prompt(); disabling prevents any
            // future embedded HTML from modal-hijacking the window.
            s.AreDefaultScriptDialogsEnabled = false;
            s.IsWebMessageEnabled = true;
            // Keep production locked down by default; development can opt in via appsettings.Development.json.
            s.AreDevToolsEnabled = _uiSettings.EnableDevTools;
            s.IsStatusBarEnabled = false;
            s.AreDefaultContextMenusEnabled = false;

            // Surface navigation + JS errors into the file log so a blank window is diagnosable.
            webView.CoreWebView2.NavigationCompleted += (_, args) =>
            {
                if (!args.IsSuccess)
                    _logger.LogError("WebView2 navigation failed: {Status} (web error code {WebErrorStatus})",
                        args.HttpStatusCode, args.WebErrorStatus);
            };
            webView.CoreWebView2.ProcessFailed += (_, args) =>
                _logger.LogError("WebView2 ProcessFailed: kind={Kind}, reason={Reason}", args.ProcessFailedKind, args.Reason);
            // Mirror page console messages into our log (visible without DevTools open).
            webView.CoreWebView2.WebResourceResponseReceived += (_, args) =>
            {
                var status = args.Response?.StatusCode ?? 0;
                if (status >= 400)
                    _logger.LogWarning("WebView2 resource {Status}: {Uri}", status, args.Request?.Uri);
            };

            // SECURITY: Lock the renderer to our trusted origins. The bridge exposes
            // powerful capabilities (file delete/move, ExifTool) to whatever document is
            // loaded, so a top-level navigation to an external origin must never succeed —
            // otherwise that page would inherit full bridge access.
            // SICHERHEIT: Renderer auf vertrauenswürdige Origins beschränken — sonst erbt
            // eine fremde Seite vollen Bridge-Zugriff (Dateien löschen/verschieben, ExifTool).
            webView.CoreWebView2.NavigationStarting += (_, args) =>
            {
                if (!IsAllowedNavigation(args.Uri))
                {
                    args.Cancel = true;
                    _logger.LogWarning("Blocked navigation to non-allowlisted URI: {Uri}", args.Uri);
                }
            };
            // Never open an in-app WebView window; route external links to the system browser.
            // Kein In-App-Fenster öffnen; externe Links im System-Browser öffnen.
            webView.CoreWebView2.NewWindowRequested += (_, args) =>
            {
                args.Handled = true;
                OpenExternalInBrowser(args.Uri);
            };

            // Clear the HTTP disk cache on every startup. Hashed chunk URLs are immutable
            // (so caching them isn't useful), and the unhashed index.html MUST be fresh
            // on every launch — otherwise a previous-version cached HTML can reference
            // chunk hashes that no longer exist on disk and the app loads to a blank window.
            // Cache vor dem Navigieren leeren — sonst kann eine veraltete index.html auf
            // nicht mehr existierende Chunk-Dateien zeigen und die App bleibt leer.
            if (_uiSettings.ClearDiskCacheOnStartup)
            {
                try
                {
                    await webView.CoreWebView2.Profile.ClearBrowsingDataAsync(
                        Microsoft.Web.WebView2.Core.CoreWebView2BrowsingDataKinds.DiskCache);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "WebView2 cache clear failed (continuing)");
                }
            }

            // Wait for services (should already be done by now)
            var (exifToolService, fileSystemService, tagService, databaseService,
                imageEditService, fileOperationService, diagnosticsService,
                folderWatcherService, tagExportService, duplicateDetectionService,
                faceScanService, faceEngine,
                descriptionScanService, aiCaptionClient,
                bridgeLogger) = await serviceTask;

            // Initialize bridge for C# <-> React communication
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
                faceScanService,
                faceEngine,
                descriptionScanService,
                aiCaptionClient,
                bridgeLogger);

            // Set up virtual host for wwwroot
            if (Directory.Exists(_wwwrootPath))
            {
                webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                    "tagfusion.local",
                    _wwwrootPath,
                    CoreWebView2HostResourceAccessKind.Allow);
            }

            // Set up virtual host for thumbnail cache (serves .jpg files directly via HTTP)
            var thumbnailCacheDir = Path.Combine(_appDirectory, "cache", "thumbnails");
            if (!Directory.Exists(thumbnailCacheDir))
                Directory.CreateDirectory(thumbnailCacheDir);
            webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                "thumbs.tagfusion.local",
                thumbnailCacheDir,
                CoreWebView2HostResourceAccessKind.Allow);

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

    // Origins the renderer is allowed to navigate to: the production virtual hosts and the
    // Vite dev server. Everything else (external sites, file://, etc.) is blocked.
    private static readonly string[] _allowedHosts =
        { "tagfusion.local", "thumbs.tagfusion.local", "localhost" };

    private static bool IsAllowedNavigation(string uri)
    {
        if (string.IsNullOrEmpty(uri))
            return false;
        // about:blank and the initial about: document are benign.
        if (uri.StartsWith("about:", StringComparison.OrdinalIgnoreCase))
            return true;
        if (!Uri.TryCreate(uri, UriKind.Absolute, out var parsed))
            return false;
        if (parsed.Scheme != Uri.UriSchemeHttp && parsed.Scheme != Uri.UriSchemeHttps)
            return false;
        return Array.Exists(_allowedHosts,
            h => string.Equals(h, parsed.Host, StringComparison.OrdinalIgnoreCase));
    }

    private void OpenExternalInBrowser(string uri)
    {
        // Only hand http/https URLs to the OS — never file:, javascript:, data:, etc.
        if (!Uri.TryCreate(uri, UriKind.Absolute, out var parsed) ||
            (parsed.Scheme != Uri.UriSchemeHttp && parsed.Scheme != Uri.UriSchemeHttps))
        {
            _logger.LogWarning("Refused to open non-http(s) new-window URI: {Uri}", uri);
            return;
        }

        try
        {
            Process.Start(new ProcessStartInfo(parsed.AbsoluteUri) { UseShellExecute = true });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to open external URL in system browser");
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
