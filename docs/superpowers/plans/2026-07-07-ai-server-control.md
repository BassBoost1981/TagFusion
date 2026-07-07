# Server Start/Stop im Beschreibungs-Dialog — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Im Dialog „Bilder mit KI beschreiben" kann der AiApiServer per Knopf gestartet und gestoppt werden; TagFusion verwaltet nur den selbst gestarteten Prozess und beendet ihn beim App-Ende.

**Architecture:** Neuer Singleton `AiServerProcessService` (`IDisposable`) startet `python main.py` als Kindprozess mit Port aus `BaseUrl`; reine Resolver-/Port-Helfer sind statisch testbar. `AiHandler` bekommt 2 neue Actions + `managedByApp` im Status. Dialog zeigt kontextabhängig Start- oder Stop-Knopf. Spec: `docs/superpowers/specs/2026-07-07-ai-server-control-design.md`.

**Tech Stack:** .NET 8 / C# 12, System.Diagnostics.Process; React/TypeScript, Zustand, Vitest.

## Global Constraints

- **`AiApiServer/` ist READ-ONLY** — kein Task ändert dort etwas; bleibt untracked.
- **Bridge-Kontrakt:** bestehende Actions unverändert; 2 neue Actions (`startAiServer`, `stopAiServer`) alphabetisch in `bridge-actions.json` UND `bridgeActions.ts`. `bridgeContract.test.ts` ist zwischen Task 2 und Task 3 planmäßig ROT — Task 3 macht ihn grün.
- **C#:** I/O async wo sinnvoll; `_camelCase`-Felder; DTOs als `record`; duale EN/DE-Kommentare; Prozess-Verwaltung thread-sicher (`lock`-Ersatz via `SemaphoreSlim` ODER — da rein CPU/synchron und kurz — ein privates `object`-Lock ist hier zulässig, weil kein async im kritischen Abschnitt; wenn unsicher, `SemaphoreSlim` synchron via `Wait()`).
- **Deutsche Fehlermeldungen** exakt wie in der Spec.
- **TypeScript** strict; ESLint `--max-warnings 0`; Builds warnungsfrei.
- **Commit-Hygiene:** `git add` nur beabsichtigte Dateien (nie `-A`); `Backend/TagFusion/wwwroot/index.html`, `.fallowrc.json`, `AiApiServer/` bleiben uncommitted.
- **Tests:** Backend `dotnet test TagFusion.sln` aus `Backend/`; Frontend `npm run test -- --run` aus `Frontend/`.

**Hinweis zu `lock`:** Die Projektregel „niemals `lock`" gilt für async-Nebenläufigkeit. Der Prozess-Service ist rein synchron und kurz — ein privates `readonly object _gate = new()` mit `lock` ist hier die einfachste korrekte Wahl. Falls der Reviewer das beanstandet, auf `SemaphoreSlim(1,1)` + `Wait()`/`Release()` umstellen.

---

### Task 1: `AiServerProcessService` + Settings + DI

**Files:**
- Create: `Backend/TagFusion/Services/IAiServerProcessService.cs`
- Create: `Backend/TagFusion/Services/AiServerProcessService.cs`
- Modify: `Backend/TagFusion/Configuration/AppSettings.cs` (`AiServerSettings` um 2 Felder erweitern)
- Modify: `Backend/TagFusion/appsettings.json` (`AiServer`-Abschnitt)
- Modify: `Backend/TagFusion/App.xaml.cs` (DI-Registrierung)
- Test: `Backend/TagFusion.Tests/Services/AiServerProcessServiceTests.cs` (neu)

**Interfaces:**
- Consumes: `AiServerSettings`, `BridgeException` (aus `TagFusion.Bridge`), `ILogger<T>`
- Produces:
  - `interface IAiServerProcessService { bool IsManagedByApp { get; } void StartServer(); void StopServer(); }`
  - `internal static string? AiServerProcessService.ResolveServerDirectory(string configuredDir, string startDir)`
  - `internal static int AiServerProcessService.PortFromBaseUrl(string baseUrl)`
  - `AiServerSettings.PythonExecutable` (default `"python"`), `AiServerSettings.ServerDirectory` (default `""`)

- [ ] **Step 1: Failing Tests für die statischen Helfer schreiben**

Neue Datei `Backend/TagFusion.Tests/Services/AiServerProcessServiceTests.cs`:

```csharp
using System.IO;
using NUnit.Framework;
using TagFusion.Services;

namespace TagFusion.Tests.Services;

[TestFixture]
public class AiServerProcessServiceTests
{
    private string _tempRoot = null!;

    [SetUp]
    public void SetUp()
    {
        _tempRoot = Path.Combine(Path.GetTempPath(), "aisrvtest_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_tempRoot);
    }

    [TearDown]
    public void TearDown()
    {
        if (Directory.Exists(_tempRoot)) Directory.Delete(_tempRoot, recursive: true);
    }

    [Test]
    public void PortFromBaseUrl_ParsesPort()
    {
        Assert.That(AiServerProcessService.PortFromBaseUrl("http://127.0.0.1:50051"), Is.EqualTo(50051));
        Assert.That(AiServerProcessService.PortFromBaseUrl("http://localhost:12345/"), Is.EqualTo(12345));
    }

    [Test]
    public void PortFromBaseUrl_Garbage_FallsBackTo50051()
    {
        Assert.That(AiServerProcessService.PortFromBaseUrl("not a url"), Is.EqualTo(50051));
        Assert.That(AiServerProcessService.PortFromBaseUrl(""), Is.EqualTo(50051));
    }

    [Test]
    public void ResolveServerDirectory_ConfiguredDirWithMainPy_IsReturned()
    {
        File.WriteAllText(Path.Combine(_tempRoot, "main.py"), "# fake");

        var result = AiServerProcessService.ResolveServerDirectory(_tempRoot, "C:\\irrelevant");

        Assert.That(result, Is.EqualTo(_tempRoot));
    }

    [Test]
    public void ResolveServerDirectory_ConfiguredDirWithoutMainPy_IgnoredThenAutoSearch()
    {
        // Configured dir has no main.py → fall through to auto-search from startDir.
        var serverDir = Path.Combine(_tempRoot, "AiApiServer");
        Directory.CreateDirectory(serverDir);
        File.WriteAllText(Path.Combine(serverDir, "main.py"), "# fake");
        var startDir = Path.Combine(_tempRoot, "app", "bin");
        Directory.CreateDirectory(startDir);

        var result = AiServerProcessService.ResolveServerDirectory("", startDir);

        Assert.That(result, Is.EqualTo(serverDir));
    }

    [Test]
    public void ResolveServerDirectory_AutoSearchWalksUpToSiblingAiApiServer()
    {
        // _tempRoot/AiApiServer/main.py, start deep below _tempRoot/x/y/z
        var serverDir = Path.Combine(_tempRoot, "AiApiServer");
        Directory.CreateDirectory(serverDir);
        File.WriteAllText(Path.Combine(serverDir, "main.py"), "# fake");
        var startDir = Path.Combine(_tempRoot, "x", "y", "z");
        Directory.CreateDirectory(startDir);

        var result = AiServerProcessService.ResolveServerDirectory("", startDir);

        Assert.That(result, Is.EqualTo(serverDir));
    }

    [Test]
    public void ResolveServerDirectory_NothingFound_ReturnsNull()
    {
        var startDir = Path.Combine(_tempRoot, "lonely");
        Directory.CreateDirectory(startDir);

        Assert.That(AiServerProcessService.ResolveServerDirectory("", startDir), Is.Null);
    }
}
```

- [ ] **Step 2: Tests ausführen — müssen fehlschlagen**

Run (aus `Backend/`): `dotnet test TagFusion.sln --filter "FullyQualifiedName~AiServerProcessServiceTests"`
Expected: FAIL — Compile-Error (Klasse/Methoden fehlen).

- [ ] **Step 3: Implementierung**

`AppSettings.cs` — `AiServerSettings` um zwei Felder ergänzen (bei den bestehenden):

```csharp
/// <summary>Python executable used to launch the server (PATH name or full path).</summary>
public string PythonExecutable { get; init; } = "python";
/// <summary>AiApiServer directory; empty = auto-search upward from the app for AiApiServer/main.py.</summary>
public string ServerDirectory { get; init; } = "";
```

`appsettings.json` — im `AiServer`-Abschnitt ergänzen:

```json
"PythonExecutable": "python",
"ServerDirectory": ""
```

`IAiServerProcessService.cs`:

```csharp
namespace TagFusion.Services;

/// <summary>
/// Starts/stops the local AiApiServer as a child process. Only a server this app
/// started is ever stopped; externally launched servers are left alone.
/// Startet/stoppt den lokalen AiApiServer als Kindprozess — nur ein selbst
/// gestarteter Server wird gestoppt, fremd gestartete bleiben unberührt.
/// </summary>
public interface IAiServerProcessService
{
    /// <summary>True if this app started the tracked server and it is still alive.</summary>
    bool IsManagedByApp { get; }
    void StartServer();
    void StopServer();
}
```

`AiServerProcessService.cs`:

```csharp
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using TagFusion.Bridge;
using TagFusion.Configuration;

namespace TagFusion.Services;

/// <summary>
/// Manages the AiApiServer child process. Thread-safe via a private lock (all work
/// here is short and synchronous). Disposing kills an app-started server, which
/// runs automatically on app exit via the ServiceProvider dispose.
/// Verwaltet den AiApiServer-Kindprozess; Dispose beendet einen selbst gestarteten
/// Server (läuft automatisch beim App-Ende).
/// </summary>
public sealed class AiServerProcessService : IAiServerProcessService, IDisposable
{
    private readonly AiServerSettings _settings;
    private readonly ILogger<AiServerProcessService> _logger;
    private readonly object _gate = new();
    private Process? _process;
    private bool _disposed;

    public AiServerProcessService(IOptions<AiServerSettings> options, ILogger<AiServerProcessService> logger)
    {
        _settings = options.Value;
        _logger = logger;
    }

    public bool IsManagedByApp
    {
        get
        {
            lock (_gate)
            {
                return _process is { HasExited: false };
            }
        }
    }

    public void StartServer()
    {
        lock (_gate)
        {
            if (_process is { HasExited: false })
                return; // already running under our control / läuft bereits unter unserer Kontrolle

            var serverDir = ResolveServerDirectory(_settings.ServerDirectory, AppContext.BaseDirectory);
            if (serverDir == null)
                throw new BridgeException(
                    "AiApiServer-Ordner nicht gefunden.",
                    internalMessage: "AiApiServer directory not resolvable");

            var psi = new ProcessStartInfo
            {
                FileName = _settings.PythonExecutable,
                WorkingDirectory = serverDir,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
            };
            psi.ArgumentList.Add("main.py");
            psi.Environment["TAGMANAGER_SERVER_PORT"] = PortFromBaseUrl(_settings.BaseUrl).ToString();

            try
            {
                var process = new Process { StartInfo = psi, EnableRaisingEvents = true };
                process.OutputDataReceived += (_, e) => { if (e.Data != null) _logger.LogInformation("[AiApiServer] {Line}", e.Data); };
                process.ErrorDataReceived += (_, e) => { if (e.Data != null) _logger.LogInformation("[AiApiServer] {Line}", e.Data); };
                process.Start();
                process.BeginOutputReadLine();
                process.BeginErrorReadLine();
                _process = process;
                _logger.LogInformation("AiApiServer started (pid {Pid}) in {Dir}", process.Id, serverDir);
            }
            catch (Win32Exception ex)
            {
                _logger.LogWarning(ex, "Failed to launch python for AiApiServer");
                throw new BridgeException(
                    "Python nicht gefunden — Pfad in den Einstellungen (AiServer:PythonExecutable) setzen.",
                    internalMessage: $"python launch failed: {ex.Message}");
            }
        }
    }

    public void StopServer()
    {
        lock (_gate)
        {
            if (_process is null || _process.HasExited)
                throw new BridgeException(
                    "Der Server wurde nicht von TagFusion gestartet.",
                    internalMessage: "No app-managed server to stop");

            KillTrackedProcess();
        }
    }

    // Caller holds _gate. / Aufrufer hält _gate.
    private void KillTrackedProcess()
    {
        try
        {
            _process!.Kill(entireProcessTree: true);
            _process.WaitForExit(5000);
            _logger.LogInformation("AiApiServer stopped");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to stop AiApiServer cleanly");
        }
        finally
        {
            _process?.Dispose();
            _process = null;
        }
    }

    /// <summary>
    /// Resolve the server directory: use the configured dir if it contains main.py,
    /// otherwise search upward from startDir for an AiApiServer folder with main.py.
    /// Server-Ordner ermitteln: konfigurierten Ordner nehmen wenn er main.py enthält,
    /// sonst von startDir aufwärts nach AiApiServer/main.py suchen.
    /// </summary>
    internal static string? ResolveServerDirectory(string configuredDir, string startDir)
    {
        if (!string.IsNullOrWhiteSpace(configuredDir) &&
            File.Exists(Path.Combine(configuredDir, "main.py")))
        {
            return configuredDir;
        }

        var dir = new DirectoryInfo(startDir);
        while (dir != null)
        {
            // sibling/descendant AiApiServer/main.py
            var candidate = Path.Combine(dir.FullName, "AiApiServer", "main.py");
            if (File.Exists(candidate))
                return Path.GetDirectoryName(candidate);

            // the dir itself is AiApiServer with main.py
            if (string.Equals(dir.Name, "AiApiServer", StringComparison.OrdinalIgnoreCase) &&
                File.Exists(Path.Combine(dir.FullName, "main.py")))
                return dir.FullName;

            dir = dir.Parent;
        }
        return null;
    }

    /// <summary>Extract the port from a base URL, falling back to 50051. / Port aus BaseUrl, Fallback 50051.</summary>
    internal static int PortFromBaseUrl(string baseUrl)
    {
        return Uri.TryCreate(baseUrl, UriKind.Absolute, out var uri) && uri.Port > 0
            ? uri.Port
            : 50051;
    }

    public void Dispose()
    {
        lock (_gate)
        {
            if (_disposed) return;
            _disposed = true;
            if (_process is { HasExited: false })
                KillTrackedProcess();
        }
    }
}
```

`App.xaml.cs` — bei den Service-Registrierungen (nach der `IAiCaptionClient`-Registrierung):

```csharp
services.AddSingleton<IAiServerProcessService, AiServerProcessService>();
```

- [ ] **Step 4: Tests ausführen — müssen bestehen**

Run: `dotnet test TagFusion.sln`
Expected: PASS komplett (die 6 neuen statischen Tests grün; kein echter Prozess wird gestartet).

- [ ] **Step 5: Commit**

```bash
git add Backend/TagFusion/Services/IAiServerProcessService.cs Backend/TagFusion/Services/AiServerProcessService.cs Backend/TagFusion/Configuration/AppSettings.cs Backend/TagFusion/appsettings.json Backend/TagFusion/App.xaml.cs Backend/TagFusion.Tests/Services/AiServerProcessServiceTests.cs
git commit -m "Add AI server process service with start/stop"
```

---

### Task 2: `AiHandler` — startAiServer/stopAiServer + managedByApp + Verdrahtung

**Files:**
- Modify: `Backend/TagFusion/Bridge/Handlers/AiHandler.cs`
- Modify: `Backend/TagFusion/Bridge/WebViewBridge.cs` (Ctor-Parameter + AiHandler-Erzeugung)
- Modify: `Backend/TagFusion/MainWindow.xaml.cs` (`ResolveServices`-Tuple + Destrukturierung + `new WebViewBridge(...)`)
- Modify: `bridge-actions.json`
- Modify: `Frontend/src/services/bridgeActions.ts`
- Test: `Backend/TagFusion.Tests/Bridge/Handlers/AiHandlerTests.cs`

**Interfaces:**
- Consumes: `IAiServerProcessService` (Task 1)
- Produces: Actions `startAiServer` → `true`, `stopAiServer` → `true`; `getAiServerStatus` enthält `managedByApp: bool`

**Bekannte Plan-Grenze:** Nach diesem Task ist `Frontend/src/services/bridgeContract.test.ts` planmäßig ROT (die 2 Actions haben noch keine bridge.ts-Aufrufer). Backend-Suite + `BridgeContractTests.cs` müssen grün sein; Frontend-Contract-Zustand im Report vermerken, nicht fixen.

- [ ] **Step 1: Kontraktdateien erweitern**

`bridge-actions.json` alphabetisch: `"startAiServer"`, `"stopAiServer"`.
`bridgeActions.ts` alphabetisch:

```typescript
  START_AI_SERVER: 'startAiServer',
  STOP_AI_SERVER: 'stopAiServer',
```

- [ ] **Step 2: Failing Handler-Tests schreiben**

In `AiHandlerTests.cs` — der Fixture-Setup konstruiert `AiHandler`; er bekommt jetzt einen zusätzlichen Konstruktor-Parameter `Mock<IAiServerProcessService>`. Das Feld ergänzen und im `[SetUp]` an den `AiHandler`-Ctor übergeben. Neue Tests:

```csharp
[Test]
public async Task GetAiServerStatus_IncludesManagedByApp()
{
    _client.Setup(c => c.GetStatusAsync(It.IsAny<CancellationToken>()))
           .ReturnsAsync(new AiServerStatus(true, "idle", "", -1, ""));
    _client.Setup(c => c.GetCaptionModelsAsync(It.IsAny<CancellationToken>()))
           .ReturnsAsync(new List<string> { "qwen" });
    _serverProcess.Setup(s => s.IsManagedByApp).Returns(true);

    var result = await _handler.HandleAsync("getAiServerStatus", null);

    var json = System.Text.Json.JsonSerializer.Serialize(result);
    Assert.That(json, Does.Contain("\"managedByApp\":true"));
}

[Test]
public async Task StartAiServer_DelegatesToService()
{
    var result = await _handler.HandleAsync("startAiServer", null);

    Assert.That(result, Is.EqualTo(true));
    _serverProcess.Verify(s => s.StartServer(), Times.Once);
}

[Test]
public async Task StopAiServer_DelegatesToService()
{
    var result = await _handler.HandleAsync("stopAiServer", null);

    Assert.That(result, Is.EqualTo(true));
    _serverProcess.Verify(s => s.StopServer(), Times.Once);
}

[Test]
public void StartAiServer_ServiceThrows_PropagatesBridgeException()
{
    _serverProcess.Setup(s => s.StartServer())
                  .Throws(new TagFusion.Bridge.BridgeException("Python nicht gefunden — Pfad in den Einstellungen (AiServer:PythonExecutable) setzen.", internalMessage: "x"));

    var ex = Assert.ThrowsAsync<TagFusion.Bridge.BridgeException>(() => _handler.HandleAsync("startAiServer", null));
    Assert.That(ex!.UserMessage, Does.Contain("Python nicht gefunden"));
}
```

(Feld im Fixture: `private Mock<IAiServerProcessService> _serverProcess = null!;` — im `[SetUp]` `_serverProcess = new Mock<IAiServerProcessService>();` und dem `AiHandler`-Ctor als letztes Argument übergeben.)

- [ ] **Step 3: Tests ausführen — müssen fehlschlagen**

Run: `dotnet test TagFusion.sln --filter "FullyQualifiedName~AiHandlerTests"`
Expected: FAIL — Compile-Error (Ctor-Signatur, neue Actions fehlen).

- [ ] **Step 4: Implementierung**

`AiHandler.cs`:
1. Feld `private readonly IAiServerProcessService _serverProcess;` + Ctor-Parameter (als letztes Argument, nach `logger`? — nein: Konvention ist Services zuerst, `logger` zuletzt; also `IAiServerProcessService serverProcess` VOR `ILogger<AiHandler> logger` einfügen und zuweisen).
2. `_supported` erweitern: `"startAiServer", "stopAiServer"`.
3. Switch-Arme:
```csharp
"startAiServer" => StartAiServer(),
"stopAiServer" => StopAiServer(),
```
4. `GetAiServerStatusAsync` — Rückgabe um `managedByApp` erweitern:
```csharp
return new
{
    reachable = status.Reachable,
    state = status.State,
    model = status.Model,
    progress = status.Progress,
    message = status.Message,
    models,
    managedByApp = _serverProcess.IsManagedByApp,
};
```
5. Zwei Methoden:
```csharp
private object StartAiServer()
{
    _serverProcess.StartServer();
    return true;
}

private object StopAiServer()
{
    _serverProcess.StopServer();
    return true;
}
```

`WebViewBridge.cs`: Ctor-Parameter `IAiServerProcessService aiServerProcessService` ergänzen (bei den anderen AI-Services); im `new AiHandler(...)` als zusätzliches Argument in der passenden Position durchreichen.

`MainWindow.xaml.cs`: `ResolveServices`-Tuple-Typ + `GetRequiredService<IAiServerProcessService>()` + Destrukturierung + `new WebViewBridge(...)`-Aufruf konsistent erweitern (gleiche relative Reihenfolge wie im Ctor).

- [ ] **Step 5: Tests ausführen — müssen bestehen (Backend)**

Run: `dotnet test TagFusion.sln`
Expected: PASS komplett (inkl. `BridgeContractTests`). Frontend-`bridgeContract` ist jetzt planmäßig rot — im Report vermerken.

- [ ] **Step 6: Commit**

```bash
git add Backend/TagFusion/Bridge/Handlers/AiHandler.cs Backend/TagFusion/Bridge/WebViewBridge.cs Backend/TagFusion/MainWindow.xaml.cs bridge-actions.json Frontend/src/services/bridgeActions.ts Backend/TagFusion.Tests/Bridge/Handlers/AiHandlerTests.cs
git commit -m "Wire AI server start/stop bridge actions"
```

---

### Task 3: Frontend — Typen, Bridge-Methoden, Store-Actions

**Files:**
- Modify: `Frontend/src/types/index.ts` (`AiServerStatusInfo.managedByApp`)
- Modify: `Frontend/src/services/bridge.ts` (2 Methoden + Mocks + `managedByApp` im Status-Mock)
- Modify: `Frontend/src/stores/descriptionStore.ts` (`startServer`/`stopServer`)
- Test: `Frontend/src/stores/__tests__/descriptionStore.test.ts`

**Interfaces:**
- Consumes: Actions aus Task 2 — **dieser Task macht `bridgeContract.test.ts` wieder GRÜN** (explizit verifizieren)
- Produces: `bridge.startAiServer()`/`stopAiServer()`; Store-Actions `startServer()`/`stopServer()`

- [ ] **Step 1: Failing Store-Test schreiben**

In `descriptionStore.test.ts` (Mock-Objekt um `startAiServer`/`stopAiServer` erweitern) neue Tests:

```typescript
it('startServer calls the bridge and refreshes status', async () => {
  mockedBridge.startAiServer.mockResolvedValue(true);
  mockedBridge.getAiServerStatus.mockResolvedValue({
    reachable: false, state: 'idle', model: '', progress: -1, message: '', models: [], managedByApp: true,
  });

  await useDescriptionStore.getState().startServer();

  expect(mockedBridge.startAiServer).toHaveBeenCalled();
  expect(mockedBridge.getAiServerStatus).toHaveBeenCalled();
});

it('stopServer calls the bridge and refreshes status', async () => {
  mockedBridge.stopAiServer.mockResolvedValue(true);
  mockedBridge.getAiServerStatus.mockResolvedValue({
    reachable: false, state: 'unreachable', model: '', progress: -1, message: '', models: [], managedByApp: false,
  });

  await useDescriptionStore.getState().stopServer();

  expect(mockedBridge.stopAiServer).toHaveBeenCalled();
  expect(useDescriptionStore.getState().serverStatus?.managedByApp).toBe(false);
});

it('startServer failure shows a toast and does not throw', async () => {
  mockedBridge.startAiServer.mockRejectedValue(new Error('Python nicht gefunden'));

  await useDescriptionStore.getState().startServer();
  // resolves without throwing
});
```

(Im Mock-Block `startAiServer: vi.fn()`, `stopAiServer: vi.fn()` ergänzen. Bestehende Status-Mock-Objekte in DIESER Testdatei um `managedByApp: false` erweitern, damit sie dem Typ genügen.)

- [ ] **Step 2: Test ausführen — muss fehlschlagen**

Run (aus `Frontend/`): `npm run test -- --run descriptionStore`
Expected: FAIL — `startServer`/`stopServer` existieren nicht.

- [ ] **Step 3: Implementierung**

`types/index.ts` — `AiServerStatusInfo` um `managedByApp: boolean;` ergänzen.

`bridge.ts`:
- Statusmock (`case 'getAiServerStatus'`) um `managedByApp: false` erweitern.
- Zwei Methoden (bei den anderen AI-Methoden):
```typescript
  async startAiServer(): Promise<boolean> {
    return this.send<boolean>(BRIDGE_ACTIONS.START_AI_SERVER);
  }

  async stopAiServer(): Promise<boolean> {
    return this.send<boolean>(BRIDGE_ACTIONS.STOP_AI_SERVER);
  }
```
- Browser-Mocks:
```typescript
      case 'startAiServer':
      case 'stopAiServer':
        return true;
```

`descriptionStore.ts` — Interface + Implementierung um zwei Actions:

```typescript
  startServer: () => Promise<void>;
  stopServer: () => Promise<void>;
```

```typescript
  startServer: async () => {
    try {
      await bridge.startAiServer();
      // Reflect the new state immediately; the 2s poll keeps it fresh afterwards.
      // Neuen Zustand sofort spiegeln; das 2s-Polling hält ihn danach aktuell.
      const status = await bridge.getAiServerStatus();
      set({ serverStatus: status });
    } catch (error) {
      useToastStore.getState().warning((error as Error).message);
    }
  },

  stopServer: async () => {
    try {
      await bridge.stopAiServer();
      const status = await bridge.getAiServerStatus();
      set({ serverStatus: status });
    } catch (error) {
      useToastStore.getState().warning((error as Error).message);
    }
  },
```

- [ ] **Step 4: Tests + Lint — müssen bestehen (Contract grün)**

Run (aus `Frontend/`): `npm run test -- --run && npm run lint`
Expected: PASS komplett — **`bridgeContract.test.ts` wieder grün** — 0 Warnings.

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/types/index.ts Frontend/src/services/bridge.ts Frontend/src/stores/descriptionStore.ts Frontend/src/stores/__tests__/descriptionStore.test.ts
git commit -m "Add AI server start/stop store actions and bridge methods"
```

---

### Task 4: Dialog-Knopf + Übersetzungen + Verifikation + Changelog

**Files:**
- Modify: `Frontend/src/locales/de/common.json` + `Frontend/src/locales/en/common.json` (3 Schlüssel)
- Modify: `Frontend/src/components/descriptions/DescriptionDialog.tsx` (Knopf in der Status-Zeile)
- Modify: `Frontend/src/components/descriptions/DescriptionDialog.test.tsx` (Knopf-Tests)
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: `useDescriptionStore.startServer/stopServer` (Task 3), `serverStatus.managedByApp`

- [ ] **Step 1: Übersetzungen ergänzen**

`de/common.json` im `descriptions`-Block:
```json
"startServer": "Server starten",
"stopServer": "Server stoppen",
"serverStarting": "Server startet …"
```
`en/common.json`:
```json
"startServer": "Start server",
"stopServer": "Stop server",
"serverStarting": "Server starting …"
```

- [ ] **Step 2: Failing Component-Tests schreiben**

In `DescriptionDialog.test.tsx` — die bestehenden `serverStatus`-Objekte um `managedByApp` erweitern; neue Tests:

```typescript
it('shows a start-server button when the server is unreachable', () => {
  useDescriptionStore.setState({
    serverStatus: { reachable: false, state: 'unreachable', model: '', progress: -1, message: '', models: [], managedByApp: false },
    selectedModel: '',
  });
  render(<DescriptionDialog />);
  expect(screen.getByRole('button', { name: /server starten/i })).toBeInTheDocument();
});

it('shows a stop-server button when reachable and app-managed', () => {
  useDescriptionStore.setState({
    serverStatus: { reachable: true, state: 'idle', model: '', progress: -1, message: '', models: ['qwen'], managedByApp: true },
  });
  render(<DescriptionDialog />);
  expect(screen.getByRole('button', { name: /server stoppen/i })).toBeInTheDocument();
});

it('shows no server button when reachable but not app-managed', () => {
  useDescriptionStore.setState({
    serverStatus: { reachable: true, state: 'idle', model: '', progress: -1, message: '', models: ['qwen'], managedByApp: false },
  });
  render(<DescriptionDialog />);
  expect(screen.queryByRole('button', { name: /server st/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 3: Test ausführen — muss fehlschlagen**

Run: `npm run test -- --run DescriptionDialog`
Expected: FAIL — Knopf existiert nicht.

- [ ] **Step 4: Implementierung**

In `DescriptionDialog.tsx`:
1. Store-Destrukturierung um `startServer, stopServer` erweitern; Import `Power`, `PlayCircle` (oder vorhandene passende Icons) aus `lucide-react` — verfügbare Icons in `lucide-react@0.292` nutzen (`Power` existiert; sonst `Server`).
2. Die Server-Status-Zeile durch einen Block ersetzen, der Text + kontextabhängigen Knopf zeigt:

```tsx
{/* Server status + control / Serverstatus + Steuerung */}
<div className="flex items-center justify-between gap-2">
  <p className={`text-sm ${reachable ? 'text-emerald-400' : 'text-amber-400'}`}>
    {loading
      ? '…'
      : reachable
        ? serverStatus!.state === 'loading' || serverStatus!.state === 'downloading'
          ? t('descriptions.serverBusy', { progress: Math.max(0, Math.round(serverStatus!.progress)) })
          : t('descriptions.serverOk')
        : serverStatus?.managedByApp
          ? t('descriptions.serverStarting')
          : t('descriptions.serverDown')}
  </p>
  {!reachable && (
    <GlassButton variant="ghost" onClick={() => void startServer()}>
      <Power size={16} /> {t('descriptions.startServer')}
    </GlassButton>
  )}
  {reachable && serverStatus?.managedByApp && (
    <GlassButton variant="ghost" onClick={() => void stopServer()}>
      <Power size={16} /> {t('descriptions.stopServer')}
    </GlassButton>
  )}
</div>
```

Anmerkung: `serverStatus?.managedByApp` in der „nicht erreichbar"-Verzweigung unterscheidet
„gerade gestartet, bootet noch" (→ `serverStarting`) von „gar nicht da" (→ `serverDown`).
Der Start-Knopf bleibt sichtbar, solange nicht erreichbar — ein Doppelklick ist backendseitig No-Op.

- [ ] **Step 5: Tests, Lint, Build — müssen bestehen**

Run (aus `Frontend/`): `npm run test -- --run && npm run lint && npm run build`
Expected: PASS / 0 Warnings / Build OK.

- [ ] **Step 6: Changelog + Commit**

`CHANGELOG.md` unter `## [Unreleased]` → `### Added` als ersten Eintrag:

```markdown
- Start/stop the local AiApiServer directly from the "Describe images" dialog; a server TagFusion started is shut down on exit
```

```bash
git add Frontend/src/locales/de/common.json Frontend/src/locales/en/common.json Frontend/src/components/descriptions/DescriptionDialog.tsx Frontend/src/components/descriptions/DescriptionDialog.test.tsx CHANGELOG.md
git commit -m "Add server start/stop button to description dialog"
```

---

## Hinweise für die Ausführung

- **Reihenfolge:** 1→2→3→4 strikt sequenziell.
- **`AiApiServer/` niemals anfassen oder committen.**
- **Contract-Test-Fenster:** rot nach Task 2, grün mit Task 3 (in Task 3 explizit verifizieren).
- **Kein echter Prozess in Unit-Tests:** nur `ResolveServerDirectory`/`PortFromBaseUrl` statisch getestet; der reale Start/Stop läuft über den dokumentierten Smoke-Test.
- **Manueller Smoke-Test nach Merge:** Knopf „Server starten" → Statuszeile „Server startet …" → grün + Modelle; beschreiben; „Server stoppen"; App schließen während app-verwalteter Server läuft → Prozess weg; extern gestarteten Server öffnen → kein Stop-Knopf.
