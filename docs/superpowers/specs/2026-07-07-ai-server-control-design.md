# Design: Server Start/Stop im Beschreibungs-Dialog (Feature 3.1)

**Datum:** 2026-07-07
**Status:** Freigegeben (User: „ja, setz es um")
**Nachtrag zu Feature 3** (lokale KI-Bildbeschreibung)

## Ziel

Im Dialog „Bilder mit KI beschreiben" kann der User den AiApiServer direkt starten und
stoppen, statt ihn extern von Hand zu starten. TagFusion verwaltet nur den von ihm selbst
gestarteten Prozess; ein extern gestarteter Server wird nie beendet.

## Getroffene Entscheidungen (mit User abgestimmt)

| Frage | Entscheidung |
|---|---|
| Python-Aufruf | `python` aus dem PATH (konfigurierbar über `AiServer:PythonExecutable`) |
| Server-Ordner | Auto-Suche aufwärts nach `AiApiServer/main.py` (konfigurierbar über `AiServer:ServerDirectory`) |
| Port | aus `AiServer:BaseUrl` abgeleitet, per Env `TAGMANAGER_SERVER_PORT` an den Server übergeben (garantiert konsistent) |
| App-Ende | Von TagFusion gestarteter Server wird mitbeendet; extern gestarteter bleibt unberührt |
| Stop-Berechtigung | Stop nur für den von TagFusion gestarteten Prozess |

## Komponenten

### 1. `IAiServerProcessService` + `AiServerProcessService` (Backend, Singleton, `IDisposable`)

```csharp
public interface IAiServerProcessService
{
    /// <summary>True if THIS app started the currently tracked server process and it is still alive.</summary>
    bool IsManagedByApp { get; }
    /// <summary>Start the AiApiServer as a child process. Throws BridgeException (German) on failure.</summary>
    void StartServer();
    /// <summary>Stop the app-started server (whole process tree). No-op if not app-managed.</summary>
    void StopServer();
}
```

- `StartServer`: findet den Server-Ordner (siehe Resolver), baut `ProcessStartInfo` (`python main.py`,
  `WorkingDirectory` = Server-Ordner, Env `TAGMANAGER_SERVER_PORT` = Port aus `BaseUrl`,
  `CreateNoWindow = true`, `UseShellExecute = false`, stdout/stderr umgeleitet → ins Log),
  startet den Prozess und merkt ihn sich (`_process`). Doppelter Start bei lebendem Prozess = No-Op.
- `StopServer`: beendet den gemerkten Prozess samt Kindern (`Process.Kill(entireProcessTree: true)`);
  No-Op/Fehlermeldung wenn nicht app-verwaltet.
- `IsManagedByApp`: `_process != null && !_process.HasExited`.
- `Dispose`: beendet einen laufenden app-verwalteten Prozess (greift automatisch über
  `App.OnExit` → ServiceProvider-Dispose).
- Fehler als `BridgeException` mit deutschen Meldungen:
  - „Python nicht gefunden — Pfad in den Einstellungen (AiServer:PythonExecutable) setzen." (Win32Exception beim Start)
  - „AiApiServer-Ordner nicht gefunden." (Resolver liefert nichts)
  - „Der Server wurde nicht von TagFusion gestartet." (Stop ohne app-verwalteten Prozess)

### 2. Resolver + Port — reine, testbare Statik in `AiServerProcessService`

- `internal static string? ResolveServerDirectory(string configuredDir, string startDir)`:
  wenn `configuredDir` nicht leer und `main.py` enthält → den; sonst von `startDir` aufwärts
  (bis Laufwerkswurzel) nach einem Ordner suchen, der eine Datei `AiApiServer/main.py` hat,
  bzw. selbst `AiApiServer` heißt und `main.py` enthält; `null` wenn nichts gefunden.
- `internal static int PortFromBaseUrl(string baseUrl)`: Port aus der URL (Fallback 50051 bei Parsefehler).

### 3. Konfiguration (`AiServerSettings` erweitern)

```csharp
public string PythonExecutable { get; init; } = "python";
public string ServerDirectory { get; init; } = ""; // leer = Auto-Suche
```
`appsettings.json` bekommt beide Felder im `AiServer`-Abschnitt.

### 4. Bridge (`AiHandler` erweitern)

- Zwei neue Actions: `startAiServer` → `true`, `stopAiServer` → `true` (deutsche `BridgeException` bei Fehlern).
- `getAiServerStatus` bekommt zusätzlich `managedByApp = _serverProcess.IsManagedByApp`.
- `AiHandler` erhält `IAiServerProcessService` als Konstruktor-Abhängigkeit; entsprechend
  `_supported`-Set, `bridge-actions.json`, `bridgeActions.ts`, Contract-Tests, WebViewBridge-Ctor,
  MainWindow-Verdrahtung.

### 5. Frontend

- `AiServerStatusInfo` bekommt `managedByApp: boolean`.
- Bridge: `startAiServer(): Promise<boolean>`, `stopAiServer(): Promise<boolean>` + Browser-Mocks.
- `descriptionStore`: `startServer()` / `stopServer()` — rufen die Bridge, zeigen Fehlertoast,
  triggern danach sofort ein `getAiServerStatus`-Refresh (das 2s-Polling übernimmt den Rest).
- **Dialog** (Server-Status-Zeile): kontextabhängig EIN Knopf neben dem Statustext:
  - nicht erreichbar → „Server starten" (ruft `startServer`)
  - erreichbar + `managedByApp` → „Server stoppen" (ruft `stopServer`)
  - erreichbar + nicht `managedByApp` → kein Knopf (extern gestartet, nur nutzbar)
  - Server startet gerade (gestartet, noch nicht erreichbar) → Statustext „Server startet …",
    Polling schaltet automatisch auf Grün, sobald Flask antwortet.
- Übersetzungen `descriptions.startServer` / `descriptions.stopServer` / `descriptions.serverStarting`
  in de + en.

## Fehlerbehandlung

- Alle Fehlerpfade über `BridgeException` → deutscher Toast, Details ins Log (bestehendes Muster).
- Start bei bereits laufendem app-Prozess: No-Op (kein Fehler).
- Stop während eines laufenden Beschreibungs-Laufs erlaubt — der Lauf endet über den
  bestehenden 3-Fehler-Abbruch.

## Testplan

- **`AiServerProcessService`**: `ResolveServerDirectory` (konfiguriert/Auto-Suche/nicht gefunden),
  `PortFromBaseUrl` (normal/Fehler-Fallback) als statische Unit-Tests. Prozess-Lebenszyklus
  (Start/IsManagedByApp/Stop/Dispose) gegen einen harmlosen Dummy-Prozess (z. B. via
  konfiguriertem `PythonExecutable` = ein triviales, langlebiges Kommando) — oder, wenn zu heikel,
  auf den dokumentierten manuellen Smoke-Test verlagern.
- **`AiHandler`**: `startAiServer`/`stopAiServer` delegieren an den (gemockten) Service;
  `getAiServerStatus` enthält `managedByApp`; deutsche Fehlertexte.
- **Frontend**: Store-Actions (start/stop → Bridge + Refresh); Dialog rendert den richtigen Knopf
  je nach `reachable`/`managedByApp`; Contract-Tests beidseitig.
- **Manueller Smoke-Test**: echter Server per Knopf starten (Statuszeile wechselt zu „startet …"
  → grün, Modelle erscheinen), beschreiben, stoppen; TagFusion schließen während app-verwalteter
  Server läuft → Prozess ist weg; extern gestarteten Server öffnen → kein Stop-Knopf.

## Bewusst nicht enthalten

- Kein Neustart-Knopf, kein Log-Viewer im Dialog, keine venv-Aktivierung (System-`python` mit
  passendem Environment wird vorausgesetzt; Pfad ist konfigurierbar).
