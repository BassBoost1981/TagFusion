# Design: Lokale KI-Bildbeschreibung (Feature 3)

**Datum:** 2026-07-06
**Status:** Entwurf zur Review
**Feature 3 von 3** (Feature 1: globale Suche — umgesetzt; Feature 2: Gesichtserkennung — umgesetzt)

## Ziel

TagFusion beschreibt Bilder eines Ordners per lokaler KI: manueller Start über einen
Toolbar-Button, Dialog mit Modell- und Prompt-Wahl, Abarbeitung im Hintergrund. Die
deutsche Beschreibung wird in die Bild-Metadaten geschrieben (portabel) und in die
Datenbank gespiegelt — die globale Suche findet Bilder damit auch über ihre Beschreibung.

Die Inferenz übernimmt der vorhandene **AiApiServer** (`AiApiServer/` im Repo-Root,
eigenständiges Python/Flask-Projekt des Users): REST auf `http://127.0.0.1:50051`,
Vision-Modelle (JoyCaption, Qwen2.5-VL, Florence-2, BLIP/BLIP2, Moondream2, …),
`/interrogateimage` (Base64-Bild → Text), `/status` (Modell-Lade-/Download-Fortschritt),
`/listmodelsbytype`. TagFusion ist reiner HTTP-Client.

## Getroffene Entscheidungen (mit User abgestimmt)

| Frage | Entscheidung |
|---|---|
| Ablageort | Metadaten (MWG-Beschreibungsfeld) + DB-Spiegel; Suche integriert |
| Workflow | Manuell: Toolbar-Button → Dialog (Modell, Prompt) → aktueller Ordner im Hintergrund |
| Prompt | Vorlagen-Dropdown (SFW/NSFW/Kurz, deutsch) + frei editierbares Textfeld; letzte Wahl gemerkt |
| Vorhandene Beschreibungen | Dialog fragt: Überspringen oder Überschreiben (nur wenn betroffen) |
| Sprache | Deutsch per Prompt (Modelle wie Qwen2.5-VL beschreiben direkt deutsch) |
| Technik | Ansatz A: HTTP-Client gegen AiApiServer; kein Einbetten von Modellen |
| Server-Lebenszyklus | TagFusion startet den Server NICHT (v1); Dialog zeigt Erreichbarkeit + Starthilfe |

## Architektur

```
Toolbar „Bilder beschreiben"
  → DescriptionDialog (React)
      ├→ bridge.getAiServerStatus      → AiHandler → IAiCaptionClient (/status, /listmodelsbytype)
      ├→ bridge.getDescriptionPrecheck → AiHandler → ExifTool-Batch-Read (vorhandene Beschreibungen zählen)
      └→ bridge.startDescriptionScan   → DescriptionScanService (seriell, Hintergrund)
                                            ├→ IAiCaptionClient.CaptionAsync (Base64 → Text)
                                            ├→ IExifToolService (MWG:Description schreiben)
                                            └→ IDatabaseService (Description-Spalte, Migration v5)
  ← descriptionScanProgress / descriptionScanCompleted (Events)
```

## Komponenten

### 1. `IAiCaptionClient` + `AiCaptionClient` (Backend/Services)

```csharp
public record AiServerStatus(bool Reachable, string State, string Model, double Progress, string Message);

public interface IAiCaptionClient
{
    Task<AiServerStatus> GetStatusAsync(CancellationToken ct = default);
    Task<List<string>> GetCaptionModelsAsync(CancellationToken ct = default);
    Task<string> CaptionAsync(string imagePath, string model, string prompt, CancellationToken ct = default);
}
```

- `HttpClient` gegen `AiServer:BaseUrl` aus `appsettings.json` (Default `http://127.0.0.1:50051`).
- `CaptionAsync`: Bild per ImageSharp auf max. 1536 px Kantenlänge verkleinern, als JPEG-Base64
  an `POST /interrogateimage` (Payload-Form wie `test.http`: `Image`, `ImageName`, `Models` mit
  `ModelName` + `prompt` in `AdditionalParameters`). `Success=false`/`ErrorMessage` → Exception
  mit Servermeldung. Timeout pro Aufruf großzügig (Konstante, 10 min — erster Aufruf kann
  Modell-Download/-Laden auslösen; der Dialog zeigt parallel den `/status`-Fortschritt).
- `GetCaptionModelsAsync`: via `/listmodelsbytype` (Captioning-Typ); exakter Typ-Name wird bei
  der Implementierung aus `AiApiServer/modules/models.py` (`INTERROGATOR_MAP`/`mode_type`)
  verifiziert — der Server ist die Quelle der Wahrheit, nichts wird hartkodiert.
- Erreichbarkeitsfehler → `Reachable=false`, nie Exceptions Richtung UI-Statusanzeige.

### 2. Migration v5 + Suche

```sql
-- v5 (guarded DataStep wie v3/v4, tolerant gegenüber nackten Test-Verbindungen):
ALTER TABLE Images ADD COLUMN Description TEXT;
```

- `SaveImageAsync`/`SaveImagesBatchAsync` erhalten die Beschreibung NICHT automatisch —
  eine neue Methode `SetImageDescriptionAsync(path, description)` setzt die Spalte gezielt
  (vermeidet, dass die vielen bestehenden Save-Aufrufer die Spalte nullen).
- `SearchImagesAsync`: dritter ODER-Zweig pro Suchbegriff:
  `OR lower_inv(i.Description) LIKE @termN ESCAPE '\'` (Description kann NULL sein —
  `lower_inv` gibt Nicht-Strings unverändert zurück, LIKE auf NULL ist einfach kein Treffer).

### 3. ExifTool: Beschreibung lesen/schreiben

Neue Methoden in `IExifToolService`/`ExifToolService`:
- `ReadDescriptionsBatchAsync(paths)` → `Dictionary<string, string>` (nur nicht-leere) —
  ein Batch-Aufruf für den Precheck und für Skip-Entscheidungen.
- `WriteDescriptionAsync(path, description)` → bool — schreibt `-MWG:Description=`
  (MWG-Komposit hält XMP-dc:Description, IPTC Caption-Abstract und EXIF ImageDescription
  konsistent; maximale Kompatibilität mit Adobe/Explorer). `-overwrite_original` wie im Bestand.
- Nach jedem erfolgreichen Schreiben: bestehender DB-Sync (`ImageFile.FromPath` → `SaveImageAsync`)
  + `SetImageDescriptionAsync`. Der `FaceScanFileTime`-Schutz aus `SaveImageAsync` greift
  automatisch — Beschreiben löst KEINE Gesichts-Rescans aus.

### 4. `DescriptionScanService` (Backend/Services)

Muster von `FaceScanService` (bewährt inkl. aller Concurrency-Fixes):
- `record ScanSummary(int Described, int Skipped, int Failed, bool Cancelled, bool Aborted)`
- `bool StartScan(string folderPath, string model, string prompt, bool overwriteExisting)` —
  false bei laufendem Scan; `void Cancel()` (Snapshot + ODE-Guard); `IsScanning`;
  Events `Progress(current, total, described)` und `Completed(ScanSummary)`;
  `internal Task? CurrentScanForTests`.
- Ablauf: Bilder des Ordners via `IFileSystemService.GetImagesAsync`; bei
  `overwriteExisting=false` zuerst `ReadDescriptionsBatchAsync` → Bilder mit Beschreibung
  zählen als `Skipped`; dann seriell pro Bild: `CaptionAsync` → `WriteDescriptionAsync` →
  DB-Sync. Einzelbild-Fehler → `Failed++`, weiter; **3 Fehler in Folge → Abbruch des Laufs**
  (Server offenbar weg — statt hunderte Timeouts zu sammeln), gemeldet über `Completed`
  mit `Aborted = true`.
- Kein mtime-Skip nötig — die Skip-Logik ist inhaltsbasiert (Beschreibung vorhanden/leer).

### 5. Bridge (neue Actions — Kontrakt-Erweiterung)

| Action | Payload | Ergebnis |
|---|---|---|
| `getAiServerStatus` | – | `{ reachable, state, model, progress, message, models: string[] }` (models leer wenn nicht erreichbar) |
| `getDescriptionPrecheck` | `{ path }` | `{ total, withDescription }` |
| `startDescriptionScan` | `{ path, model, prompt, overwriteExisting }` | `true` (Start bestätigt; Abschluss als Event) |
| `cancelDescriptionScan` | – | `true` |

- Events: `descriptionScanProgress { current, total, described }`,
  `descriptionScanCompleted { described, skipped, failed, cancelled, aborted }`.
- Neuer `AiHandler : IBridgeHandler`; Einträge in `bridge-actions.json`, `bridgeActions.ts`,
  Contract-Tests beidseitig. Fehlermeldungen deutsch via `BridgeException`
  („KI-Server nicht erreichbar — bitte AiApiServer starten.", „Eine Beschreibung läuft bereits.").

### 6. Frontend

- **Toolbar-Button** „Bilder beschreiben" (Lucide `Sparkles`), sichtbar bei geöffnetem Ordner;
  während eines Laufs Fortschritt + Abbrechen (Muster Gesichts-Scan).
- **`DescriptionDialog`** (GlassModal, neuer `descriptionStore`):
  - Server-Status-Zeile: erreichbar ✓ (grün) / ✗ mit Hinweis „AiApiServer starten
    (AiApiServer\\main.py)"; bei ladendem Modell Live-Fortschritt aus `/status`-Polling
    (alle 2 s, nur solange der Dialog geöffnet ist — nach dem Start tragen die
    Scan-Events den Fortschritt).
  - Modell-Dropdown (dynamisch), Prompt-Vorlagen-Dropdown + mehrzeiliges Textfeld.
    Vorlagen (deutsch formuliert, in `Frontend/src/constants/descriptionPrompts.ts`):
    „Standard" (2-3 sachliche Sätze, deutsch), „NSFW" (explizit erlaubt, deutsch),
    „Kurz" (ein Satz). Letzte Wahl (Modell + Vorlage + Text) in `localStorage`.
  - Precheck-Zeile: „12 von 87 Bildern haben bereits eine Beschreibung" + Radio
    Überspringen (Default) / Überschreiben — nur sichtbar wenn `withDescription > 0`.
  - Start-Button (deaktiviert ohne Server/Modell), danach schließt der Dialog;
    Fortschritt läuft in der Toolbar, Abschluss als Toast (inkl. Fehler-/Abbruchfall).
- Übersetzungen `descriptions.*` in `de/common.json` + `en/common.json`.

## Fehlerbehandlung

- Server nicht erreichbar beim Öffnen → Dialog zeigt Hinweis, Start deaktiviert (keine Exception).
- Server stirbt mitten im Lauf → Einzelfehler, nach 3 in Folge Abbruch mit Toast
  („KI-Server antwortet nicht mehr — Lauf abgebrochen. 34 Bilder beschrieben.").
- ExifTool-Schreibfehler → `Failed++`, DB bleibt unangetastet für dieses Bild.
- Alle UI-Meldungen deutsch; interne Details nur ins Log (bestehendes Muster).

## Testplan

- **`AiCaptionClient`**: gegen einen lokalen Fake-HTTP-Server (`HttpListener`/`WireMock`-frei:
  einfacher `HttpMessageHandler`-Mock) — Statusparsing, Modell-Liste, Caption-Erfolg,
  `Success=false`-Pfad, Timeout/Unreachable → `Reachable=false`.
- **`DescriptionScanService`** mit Mock-Client/-ExifTool/-DB: seriell, Skip vorhandener,
  Overwrite-Modus, Einzelfehler zählt, 3-Fehler-Abbruch, Cancel, Events, ein Lauf pro Zeit.
- **DB**: Migration v5, `SetImageDescriptionAsync`-Roundtrip, Suche über Beschreibung
  (Teilwort, Umlaute, NULL-Description stört nicht).
- **`AiHandler`**: Payload-Parsing, deutsche Fehlermeldungen, Precheck-Aggregation.
- **Frontend**: descriptionStore (Start/Progress/Completed/Fehler), Dialog-Rendering
  (Server weg, Precheck-Varianten), Contract-Tests beidseitig.
- **Manueller Smoke-Test** (dokumentiert): echter AiApiServer, kleiner Ordner, beide
  Modi (überspringen/überschreiben), Suche nach Beschreibungstext, Adobe/Explorer-Sichtbarkeit.

## Bewusst nicht in v1

- Auto-Start/-Stop des Python-Servers durch TagFusion
- Seed-X-Übersetzungskette (Deutsch kommt per Prompt)
- Batch über Ordnerbäume; automatischer Hintergrund-Betrieb ohne manuellen Start
- WD-Tagger-Anbindung (automatische Tag-Vorschläge — Kandidat für Feature 4)
- Beschreibungen in Lightbox/Grid anzeigen oder editieren
- Kein Extra-Schutz gegen parallelen Gesichts-Scan (beide Läufe sind unabhängig erlaubt)
