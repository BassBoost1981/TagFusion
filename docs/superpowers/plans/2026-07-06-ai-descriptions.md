# Lokale KI-Bildbeschreibung — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TagFusion beschreibt Bilder eines Ordners per manuell gestartetem Hintergrund-Lauf über den vorhandenen AiApiServer (HTTP, localhost:50051); deutsche Beschreibungen landen im MWG-Metadatenfeld und in der DB, die globale Suche findet sie.

**Architecture:** Neuer HTTP-Client `IAiCaptionClient` (Muster `IFaceEngine`), Migration v5 (`Images.Description`), ExifTool-Erweiterung (MWG:Description lesen/schreiben), `DescriptionScanService` nach dem `FaceScanService`-Muster (seriell, Events, Cancel, 3-Fehler-Abbruch), neuer `AiHandler` mit 4 Bridge-Actions, React-Dialog mit Modell-/Prompt-Wahl. Spec: `docs/superpowers/specs/2026-07-06-ai-descriptions-design.md`.

**Tech Stack:** .NET 8 / C# 12, HttpClient + System.Text.Json, SixLabors.ImageSharp, System.Data.SQLite, NUnit + Moq; React/TypeScript, Zustand, i18next, Vitest. Gegenstelle: AiApiServer (Python/Flask, Bestand — wird NICHT verändert).

## Global Constraints

- **`AiApiServer/` ist ein eigenständiges Nachbarprojekt und READ-ONLY** — kein Task ändert dort irgendetwas. Der Server ist Quelle der Wahrheit für API-Formen; verifizierte Verweise: Dataclasses in `AiApiServer/modules/server_dataclasses.py` (Zeilen ~8-108), Endpunkte in `AiApiServer/main.py` (`/interrogateimage` ~443, `/listmodelsbytype` ~279, `/getmodelparams` ~290-310, `/status` ~725).
- **Verifizierter API-Kontrakt** (aus den Dataclasses, NICHT aus der veralteten `test.http`):
  - `POST /interrogateimage` Request: `{ "DataObject": "<base64-jpeg>", "DataType": 1, "SkipInternetRequests": false, "SerializeVramUsage": false, "FileName": "<name>", "Models": [{ "ModelName": "<name>", "AdditionalParameters": [{ "Key": "prompt", "Value": "<prompt>", "Type": "string", "Comment": "" }] }] }`
  - Response: `{ "Success": bool, "ErrorMessage": string, "Result": [{ "ModelName": string, "Tags": [{ "Tag": string, "Probability": number }] }] }` — die Beschreibung ist `Result[0].Tags` (Texte mit ", " verbinden; Captioning-Modelle liefern i. d. R. genau einen Eintrag).
  - `GET /status` → `{ "state": "idle|downloading|loading|inferring", "model": string, "progress": number, "message": string }`
  - `GET /listmodelsbytype` (ohne Query) → `{ "Interrogators": [{ "ModelName": string, "SupportedVideo": bool, "RepositoryLink": string }], "Editors": [...], "Translators": [...] }`
  - `POST /getmodelparams` `{ "Name": "<model>" }` → enthält `Parameters`-Liste; Captioning-Modelle haben einen Eintrag mit `Key == "prompt"` (Tagger stattdessen `threshold`) — das ist der Fähigkeits-Filter. Exakte Feldnamen der Antwort beim Implementieren aus `main.py:290-310` (`ModelParamResponse`, `create_interrogator_parameter`) ablesen.
- **Bridge-Kontrakt:** Bestehende Actions unverändert; 4 neue Actions alphabetisch in `bridge-actions.json` UND `bridgeActions.ts`. **Bekannte Plan-Grenze:** `bridgeContract.test.ts` ist zwischen Task 5 und Task 6 planmäßig ROT (Actions ohne bridge.ts-Aufrufer) — Task 6 MUSS ihn wieder grün machen; das ist im jeweiligen Task vermerkt.
- **C#:** I/O async; `SemaphoreSlim`/`Interlocked`, nie `lock`; `_camelCase`-Felder; `Async`-Suffix; DTOs als `record`; duale EN/DE-Kommentare. **UI-Texte deutsch** (de+en Locale-Parität).
- **TypeScript** strict; ESLint `--max-warnings 0`; Builds warnungsfrei.
- **Commit-Hygiene:** `git add` nur beabsichtigte Dateien (nie `-A`); `Backend/TagFusion/wwwroot/index.html` (modifiziert) und `.fallowrc.json` (untracked) bleiben uncommitted; `AiApiServer/` bleibt untracked und unangetastet.
- **Tests:** Backend `dotnet test TagFusion.sln` aus `Backend/`; Frontend `npm run test -- --run` aus `Frontend/`.

---

### Task 1: Migration v5 + `SetImageDescriptionAsync` + Suche über Beschreibungen

**Files:**
- Modify: `Backend/TagFusion/Database/MigrationRunner.cs` (Migrations-Array, neue private Methode)
- Modify: `Backend/TagFusion/Database/IDatabaseService.cs`
- Modify: `Backend/TagFusion/Services/DatabaseService.cs` (`SearchImagesAsync`-Bedingung, neue Methode)
- Test: `Backend/TagFusion.Tests/Database/MigrationRunnerTests.cs`, `Backend/TagFusion.Tests/Services/DatabaseServiceTests.cs`

**Interfaces:**
- Consumes: v3/v4-Helfer `TableExists`/`ColumnExists`/`AddColumnIfMissing`, `EscapeLikePattern`, `lower_inv`
- Produces: Spalte `Images.Description TEXT NULL`; `Task SetImageDescriptionAsync(string imagePath, string description, CancellationToken cancellationToken = default)` (No-Op wenn Zeile fehlt); Suche: Begriff trifft Tag ODER Dateiname ODER Beschreibung

- [ ] **Step 1: Failing Tests schreiben**

In `MigrationRunnerTests.cs`:

```csharp
[Test]
public void MigrationV5_AddsDescriptionColumnWhenImagesTableExists()
{
    using (var cmd = _connection.CreateCommand())
    {
        cmd.CommandText = @"
            CREATE TABLE Images (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Path TEXT NOT NULL UNIQUE,
                FileName TEXT NOT NULL DEFAULT '',
                LastModified TEXT NOT NULL
            );";
        cmd.ExecuteNonQuery();
    }

    new MigrationRunner(_connection, NullLogger.Instance).ApplyMigrations();

    using var check = _connection.CreateCommand();
    check.CommandText = "SELECT COUNT(*) FROM pragma_table_info('Images') WHERE name = 'Description'";
    Assert.That(Convert.ToInt32(check.ExecuteScalar()), Is.EqualTo(1));
}
```

In `DatabaseServiceTests.cs` (neue Region vor dem `CreateTestImage`-Helper):

```csharp
// ========================================================================
// Beschreibungen / AI descriptions
// ========================================================================

[Test]
public async Task SetDescription_MakesImageFindableBySearch()
{
    await _db.SaveImageAsync(CreateTestImage("C:\\fotos\\a.jpg", Array.Empty<string>()));

    await _db.SetImageDescriptionAsync("C:\\fotos\\a.jpg", "Ein Sonnenuntergang über dem Meer");

    var results = await _db.SearchImagesAsync(new List<string> { "sonnenuntergang" }, null);
    Assert.That(results, Has.Count.EqualTo(1));
    Assert.That(results[0].Path, Is.EqualTo("C:\\fotos\\a.jpg"));
}

[Test]
public async Task SetDescription_UmlautSearchIsCaseInsensitive()
{
    await _db.SaveImageAsync(CreateTestImage("C:\\fotos\\a.jpg", Array.Empty<string>()));
    await _db.SetImageDescriptionAsync("C:\\fotos\\a.jpg", "Ein müder Bär im Wald");

    var results = await _db.SearchImagesAsync(new List<string> { "MÜDER" }, null);
    Assert.That(results, Has.Count.EqualTo(1));
}

[Test]
public async Task Search_ImagesWithoutDescription_AreUnaffected()
{
    // NULL descriptions must neither match nor break the query.
    // NULL-Beschreibungen dürfen weder treffen noch die Query brechen.
    await _db.SaveImageAsync(CreateTestImage("C:\\fotos\\ohne.jpg", new[] { "Urlaub" }));

    var byDesc = await _db.SearchImagesAsync(new List<string> { "sonnenuntergang" }, null);
    Assert.That(byDesc, Is.Empty);

    var byTag = await _db.SearchImagesAsync(new List<string> { "urlaub" }, null);
    Assert.That(byTag, Has.Count.EqualTo(1));
}

[Test]
public void SetDescription_UnknownPath_DoesNotThrow()
{
    Assert.DoesNotThrowAsync(() => _db.SetImageDescriptionAsync("C:\\gibtsnicht.jpg", "x"));
}
```

- [ ] **Step 2: Tests ausführen — müssen fehlschlagen**

Run (aus `Backend/`): `dotnet test TagFusion.sln --filter "FullyQualifiedName~MigrationRunnerTests|FullyQualifiedName~DatabaseServiceTests"`
Expected: FAIL — Compile-Error (`SetImageDescriptionAsync` fehlt) bzw. v5 existiert nicht.

- [ ] **Step 3: Implementierung**

`MigrationRunner.cs` — Migrations-Array ergänzen:

```csharp
new(5, "Description column on Images — AI descriptions searchable (C# step, idempotent)",
    "",
    AddDescriptionColumnToImages)
```

Neue private Methode (unter `AddFaceScanColumnsToImages`):

```csharp
/// <summary>
/// Adds the AI description column. Skips gracefully when the Images table is
/// absent (bare test connections) or the column already exists.
/// Ergänzt die KI-Beschreibungsspalte — tolerant gegenüber fehlender Tabelle
/// und bereits vorhandener Spalte.
/// </summary>
private static void AddDescriptionColumnToImages(SQLiteConnection connection, SQLiteTransaction transaction)
{
    if (!TableExists(connection, transaction, "Images")) return;
    AddColumnIfMissing(connection, transaction, "Images", "Description", "TEXT");
}
```

`IDatabaseService.cs`:

```csharp
/// <summary>
/// Set the AI description mirror for an already-indexed image (no-op when the
/// row does not exist). Setzt den DB-Spiegel der KI-Beschreibung; No-Op wenn
/// das Bild nicht indexiert ist.
/// </summary>
Task SetImageDescriptionAsync(string imagePath, string description, CancellationToken cancellationToken = default);
```

`DatabaseService.cs`:

```csharp
public async Task SetImageDescriptionAsync(string imagePath, string description, CancellationToken cancellationToken = default)
{
    await _writeSemaphore.WaitAsync(cancellationToken);
    try
    {
        using var cmd = _connection.CreateCommand();
        cmd.CommandText = "UPDATE Images SET Description = @Desc WHERE Path = @Path";
        cmd.Parameters.AddWithValue("@Desc", description);
        cmd.Parameters.AddWithValue("@Path", imagePath);
        await cmd.ExecuteNonQueryAsync(cancellationToken);
    }
    finally
    {
        _writeSemaphore.Release();
    }
}
```

In `SearchImagesAsync` die per-Begriff-Bedingung um den dritten ODER-Zweig erweitern (bestehende Bedingung ersetzen):

```csharp
conditions.Add($@"(EXISTS (
        SELECT 1 FROM ImageTags it
        JOIN Tags tg ON it.TagId = tg.Id
        WHERE it.ImageId = i.Id AND lower_inv(tg.Name) LIKE @term{t} ESCAPE '\')
    OR lower_inv(i.FileName) LIKE @term{t} ESCAPE '\'
    OR lower_inv(i.Description) LIKE @term{t} ESCAPE '\')");
```

(`lower_inv` reicht Nicht-Strings unverändert durch — `LIKE` auf NULL ist schlicht kein Treffer.)

- [ ] **Step 4: Tests ausführen — müssen bestehen**

Run: `dotnet test TagFusion.sln`
Expected: PASS komplett (v5 läuft auf nackten Verbindungen dank Guards; `AdvancesVersionToLatest` passt sich an).

- [ ] **Step 5: Commit**

```bash
git add Backend/TagFusion/Database/MigrationRunner.cs Backend/TagFusion/Database/IDatabaseService.cs Backend/TagFusion/Services/DatabaseService.cs Backend/TagFusion.Tests/Database/MigrationRunnerTests.cs Backend/TagFusion.Tests/Services/DatabaseServiceTests.cs
git commit -m "Add description column with search integration"
```

---

### Task 2: ExifTool — Beschreibung lesen (Batch) und schreiben (MWG)

**Files:**
- Modify: `Backend/TagFusion/Services/IExifToolService.cs`
- Modify: `Backend/TagFusion/Services/ExifToolService.cs`
- Test: `Backend/TagFusion.Tests/Services/ExifToolServiceTests.cs`

**Interfaces:**
- Consumes: bestehender Kern `RunExifToolAsync(List<string> args, CancellationToken)` → string; Referenzmuster `ReadBatchMetadataAsync` (Zeile ~385: Batching, `-j`, `SourceFile`-Normalisierung via `Path.GetFullPath`) und `WriteTagsAsync` (Backup via `_backupService`, `-overwrite_original`, Erfolgs-Erkennung)
- Produces:
  - `Task<Dictionary<string, string>> ReadDescriptionsBatchAsync(List<string> imagePaths, CancellationToken cancellationToken = default)` — nur nicht-leere Beschreibungen, Keys case-insensitiv
  - `Task<bool> WriteDescriptionAsync(string imagePath, string description, CancellationToken cancellationToken = default)`

**Vorgehen:** ZUERST die bestehenden `ReadBatchMetadataAsync` und `WriteTagsAsync` in `ExifToolService.cs` vollständig lesen und deren Idiome exakt übernehmen (Batching-Konstante `_batchSize`, JSON-Parsing mit `JsonDocument`, `SourceFile`-Normalisierung, Backup-Aufruf, Erfolgs-Erkennung des Schreibens). Ebenso den Teststil in `ExifToolServiceTests.cs` lesen und übernehmen (ob echte exiftool.exe auf Temp-Dateien oder Arg-Verifikation — die neuen Tests folgen exakt demselben Stil).

- [ ] **Step 1: Failing Tests schreiben**

In `ExifToolServiceTests.cs`, im Stil der vorhandenen Read/Write-Tests. Inhaltlich abzudecken:

```csharp
[Test]
public async Task WriteAndReadDescription_RoundTrips()
{
    // Analog zum bestehenden Tag-RoundTrip-Test dieser Fixture:
    // Testbild anlegen (bestehender Helper), Beschreibung schreiben, per Batch-Read zurücklesen.
    var path = /* bestehenden Testbild-Helper dieser Fixture verwenden */;

    var ok = await _service.WriteDescriptionAsync(path, "Ein Testbild mit Bäumen");
    Assert.That(ok, Is.True);

    var read = await _service.ReadDescriptionsBatchAsync(new List<string> { path });
    Assert.That(read[path], Is.EqualTo("Ein Testbild mit Bäumen"));
}

[Test]
public async Task ReadDescriptionsBatch_SkipsImagesWithoutDescription()
{
    var withDesc = /* Testbild-Helper */;
    var without = /* zweites Testbild */;
    await _service.WriteDescriptionAsync(withDesc, "Beschrieben");

    var read = await _service.ReadDescriptionsBatchAsync(new List<string> { withDesc, without });

    Assert.That(read.ContainsKey(withDesc), Is.True);
    Assert.That(read.ContainsKey(without), Is.False);
}

[Test]
public async Task ReadDescriptionsBatch_EmptyList_ReturnsEmpty()
{
    var read = await _service.ReadDescriptionsBatchAsync(new List<string>());
    Assert.That(read, Is.Empty);
}
```

(Die `/* … */`-Stellen mit den KONKRETEN Helpern/Konstruktionen der bestehenden Fixture füllen — sie existieren dort bereits für die Tag-Tests. Nichts neu erfinden.)

- [ ] **Step 2: Tests ausführen — müssen fehlschlagen**

Run: `dotnet test TagFusion.sln --filter "FullyQualifiedName~ExifToolServiceTests"`
Expected: FAIL — Compile-Error (Methoden fehlen).

- [ ] **Step 3: Implementierung**

`IExifToolService.cs`:

```csharp
/// <summary>
/// Read MWG descriptions for many files in one batched call; only non-empty
/// entries are returned. Liest MWG-Beschreibungen gebatcht; nur nicht-leere.
/// </summary>
Task<Dictionary<string, string>> ReadDescriptionsBatchAsync(List<string> imagePaths, CancellationToken cancellationToken = default);

/// <summary>
/// Write the description via the MWG composite tag (keeps XMP/IPTC/EXIF in sync).
/// Schreibt die Beschreibung über das MWG-Komposit (XMP/IPTC/EXIF konsistent).
/// </summary>
Task<bool> WriteDescriptionAsync(string imagePath, string description, CancellationToken cancellationToken = default);
```

`ExifToolService.cs` — `ReadDescriptionsBatchAsync` als exakte Spiegelung von `ReadBatchMetadataAsync` mit diesen Abweichungen: Args `{ "-MWG:Description", "-j" }` + Batch-Pfade; pro JSON-Item `"Description"`-Property lesen (`ValueKind == JsonValueKind.String`, nicht-leer), Ergebnis `result[normalizedPath] = text`. `WriteDescriptionAsync` als Spiegelung des Einzel-`WriteTagsAsync`: Backup (`"metadata-description-write"`), Args `{ $"-MWG:Description={description}", "-overwrite_original", imagePath }`, Erfolgs-Erkennung identisch zum Tag-Schreiben.

- [ ] **Step 4: Tests ausführen — müssen bestehen**

Run: `dotnet test TagFusion.sln`
Expected: PASS komplett (Mock-basierte Handler-Tests kompilieren automatisch weiter).

- [ ] **Step 5: Commit**

```bash
git add Backend/TagFusion/Services/IExifToolService.cs Backend/TagFusion/Services/ExifToolService.cs Backend/TagFusion.Tests/Services/ExifToolServiceTests.cs
git commit -m "Add MWG description read and write via ExifTool"
```

---

### Task 3: `AiServerSettings` + `IAiCaptionClient`/`AiCaptionClient`

**Files:**
- Modify: `Backend/TagFusion/Configuration/AppSettings.cs` (neues Record), `Backend/TagFusion/appsettings.json`, `Backend/TagFusion/App.xaml.cs` (Options-Registrierung analog zu den bestehenden + DI)
- Create: `Backend/TagFusion/Services/IAiCaptionClient.cs`
- Create: `Backend/TagFusion/Services/AiCaptionClient.cs`
- Test: `Backend/TagFusion.Tests/Services/AiCaptionClientTests.cs` (neu)

**Interfaces:**
- Consumes: verifizierter API-Kontrakt (Global Constraints), ImageSharp
- Produces:
  - `record AiServerStatus(bool Reachable, string State, string Model, double Progress, string Message)`
  - `interface IAiCaptionClient { Task<AiServerStatus> GetStatusAsync(CancellationToken ct = default); Task<List<string>> GetCaptionModelsAsync(CancellationToken ct = default); Task<string> CaptionAsync(string imagePath, string model, string prompt, CancellationToken ct = default); }`
  - `record AiServerSettings { public string BaseUrl { get; init; } = "http://127.0.0.1:50051"; public int CaptionTimeoutMinutes { get; init; } = 10; public int QuickTimeoutSeconds { get; init; } = 5; public int MaxImageDimension { get; init; } = 1536; }`

- [ ] **Step 1: Failing Tests schreiben**

Neue Datei `Backend/TagFusion.Tests/Services/AiCaptionClientTests.cs` — Client mit gemocktem `HttpMessageHandler`:

```csharp
using System.Net;
using System.Text;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using NUnit.Framework;
using TagFusion.Configuration;
using TagFusion.Services;

namespace TagFusion.Tests.Services;

[TestFixture]
public class AiCaptionClientTests
{
    /// <summary>Scriptable handler: URL-substring → response body. / Skriptbarer Handler.</summary>
    private sealed class FakeHandler : HttpMessageHandler
    {
        public Func<HttpRequestMessage, (HttpStatusCode Status, string Body)>? OnRequest;
        public List<string> RequestBodies { get; } = new();

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            if (request.Content != null)
                RequestBodies.Add(await request.Content.ReadAsStringAsync(ct));
            var (status, body) = OnRequest?.Invoke(request) ?? (HttpStatusCode.NotFound, "");
            return new HttpResponseMessage(status)
            {
                Content = new StringContent(body, Encoding.UTF8, "application/json")
            };
        }
    }

    private static AiCaptionClient Create(FakeHandler handler)
    {
        var settings = Options.Create(new AiServerSettings());
        return new AiCaptionClient(new HttpClient(handler), settings, NullLogger<AiCaptionClient>.Instance);
    }

    [Test]
    public async Task GetStatus_ParsesServerState()
    {
        var handler = new FakeHandler
        {
            OnRequest = req => (HttpStatusCode.OK,
                "{\"state\":\"loading\",\"model\":\"qwen\",\"progress\":43.5,\"message\":\"Loading\"}")
        };

        var status = await Create(handler).GetStatusAsync();

        Assert.That(status.Reachable, Is.True);
        Assert.That(status.State, Is.EqualTo("loading"));
        Assert.That(status.Progress, Is.EqualTo(43.5));
    }

    [Test]
    public async Task GetStatus_ServerDown_ReportsUnreachable()
    {
        var handler = new FakeHandler
        {
            OnRequest = _ => throw new HttpRequestException("connection refused")
        };

        var status = await Create(handler).GetStatusAsync();

        Assert.That(status.Reachable, Is.False);
    }

    [Test]
    public async Task GetCaptionModels_FiltersByPromptCapability()
    {
        var handler = new FakeHandler();
        handler.OnRequest = req =>
        {
            var url = req.RequestUri!.PathAndQuery;
            if (url.Contains("listmodelsbytype"))
                return (HttpStatusCode.OK,
                    "{\"Interrogators\":[{\"ModelName\":\"qwen-caption\",\"SupportedVideo\":false,\"RepositoryLink\":\"\"}," +
                    "{\"ModelName\":\"wd-tagger\",\"SupportedVideo\":false,\"RepositoryLink\":\"\"}],\"Editors\":[],\"Translators\":[]}");
            // getmodelparams: qwen has a prompt parameter, the tagger only a threshold
            var body = handler.RequestBodies[^1];
            if (body.Contains("qwen-caption"))
                return (HttpStatusCode.OK, "{\"Parameters\":[{\"Key\":\"prompt\",\"Value\":\"describe\",\"Type\":\"string\",\"Comment\":\"\"}]}");
            return (HttpStatusCode.OK, "{\"Parameters\":[{\"Key\":\"threshold\",\"Value\":\"0.25\",\"Type\":\"float1\",\"Comment\":\"\"}]}");
        };

        var models = await Create(handler).GetCaptionModelsAsync();

        Assert.That(models, Is.EqualTo(new List<string> { "qwen-caption" }));
    }

    [Test]
    public async Task Caption_SendsContractPayload_AndExtractsText()
    {
        // Tiny real image so the client can load and downscale it.
        var imagePath = Path.Combine(Path.GetTempPath(), Guid.NewGuid() + ".png");
        using (var img = new SixLabors.ImageSharp.Image<SixLabors.ImageSharp.PixelFormats.Rgb24>(32, 32))
            await img.SaveAsPngAsync(imagePath);

        try
        {
            var handler = new FakeHandler
            {
                OnRequest = _ => (HttpStatusCode.OK,
                    "{\"Success\":true,\"ErrorMessage\":\"\",\"Result\":[{\"ModelName\":\"qwen\",\"Tags\":[{\"Tag\":\"Ein Sonnenuntergang.\",\"Probability\":1.0}]}]}")
            };

            var text = await Create(handler).CaptionAsync(imagePath, "qwen", "Beschreibe das Bild");

            Assert.That(text, Is.EqualTo("Ein Sonnenuntergang."));
            var body = handler.RequestBodies[^1];
            Assert.That(body, Does.Contain("\"DataObject\""));
            Assert.That(body, Does.Contain("\"DataType\":1"));
            Assert.That(body, Does.Contain("\"ModelName\":\"qwen\""));
            Assert.That(body, Does.Contain("\"Key\":\"prompt\""));
            Assert.That(body, Does.Contain("Beschreibe das Bild"));
        }
        finally
        {
            if (File.Exists(imagePath)) File.Delete(imagePath);
        }
    }

    [Test]
    public async Task Caption_ServerReportsFailure_Throws()
    {
        var imagePath = Path.Combine(Path.GetTempPath(), Guid.NewGuid() + ".png");
        using (var img = new SixLabors.ImageSharp.Image<SixLabors.ImageSharp.PixelFormats.Rgb24>(8, 8))
            await img.SaveAsPngAsync(imagePath);

        try
        {
            var handler = new FakeHandler
            {
                OnRequest = _ => (HttpStatusCode.OK,
                    "{\"Success\":false,\"ErrorMessage\":\"model exploded\",\"Result\":[]}")
            };

            var ex = Assert.ThrowsAsync<InvalidOperationException>(
                () => Create(handler).CaptionAsync(imagePath, "qwen", "p"));
            Assert.That(ex!.Message, Does.Contain("model exploded"));
        }
        finally
        {
            if (File.Exists(imagePath)) File.Delete(imagePath);
        }
    }
}
```

(Benötigte usings für `Path`/`File`: `using System.IO;` — je nach ImplicitUsings-Stand der Testdatei ergänzen.)

- [ ] **Step 2: Tests ausführen — müssen fehlschlagen**

Run: `dotnet test TagFusion.sln --filter "FullyQualifiedName~AiCaptionClientTests"`
Expected: FAIL — Compile-Error (Typen fehlen).

- [ ] **Step 3: Implementierung**

`AppSettings.cs` — neues Record (bei den anderen):

```csharp
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
}
```

`appsettings.json` — Abschnitt ergänzen:

```json
"AiServer": {
  "BaseUrl": "http://127.0.0.1:50051",
  "CaptionTimeoutMinutes": 10,
  "QuickTimeoutSeconds": 5,
  "MaxImageDimension": 1536
}
```

`App.xaml.cs`: Options-Bindung analog zu den bestehenden (`services.Configure<AiServerSettings>(configuration.GetSection("AiServer"));` — exakt das Muster der anderen Settings-Registrierungen übernehmen) und DI:

```csharp
services.AddSingleton<IAiCaptionClient>(sp => new AiCaptionClient(
    new HttpClient(),
    sp.GetRequiredService<IOptions<AiServerSettings>>(),
    sp.GetRequiredService<ILogger<AiCaptionClient>>()));
```

`IAiCaptionClient.cs`:

```csharp
namespace TagFusion.Services;

/// <summary>Current AiApiServer state as shown in the dialog. / Serverzustand für den Dialog.</summary>
public record AiServerStatus(bool Reachable, string State, string Model, double Progress, string Message);

/// <summary>
/// HTTP client for the local AiApiServer (captioning). Implementations never throw
/// from status/model-list calls — unreachable simply means Reachable=false.
/// HTTP-Client für den lokalen AiApiServer. Status-/Modell-Aufrufe werfen nie —
/// nicht erreichbar heißt schlicht Reachable=false.
/// </summary>
public interface IAiCaptionClient
{
    Task<AiServerStatus> GetStatusAsync(CancellationToken ct = default);
    Task<List<string>> GetCaptionModelsAsync(CancellationToken ct = default);
    /// <summary>Caption one image; throws InvalidOperationException with the server's message on failure.</summary>
    Task<string> CaptionAsync(string imagePath, string model, string prompt, CancellationToken ct = default);
}
```

`AiCaptionClient.cs`:

```csharp
using System.IO;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;
using TagFusion.Configuration;

namespace TagFusion.Services;

/// <summary>
/// Talks to the neighbouring AiApiServer (Python/Flask). Request/response shapes
/// mirror AiApiServer/modules/server_dataclasses.py — the server is the source of truth.
/// Spricht mit dem AiApiServer; die JSON-Formen spiegeln dessen Dataclasses.
/// </summary>
public sealed class AiCaptionClient : IAiCaptionClient
{
    private readonly HttpClient _http;
    private readonly AiServerSettings _settings;
    private readonly ILogger<AiCaptionClient> _logger;

    private static readonly JsonSerializerOptions _json = new() { PropertyNameCaseInsensitive = true };

    public AiCaptionClient(HttpClient http, IOptions<AiServerSettings> options, ILogger<AiCaptionClient> logger)
    {
        _http = http;
        _settings = options.Value;
        _http.BaseAddress = new Uri(_settings.BaseUrl);
        _http.Timeout = TimeSpan.FromMinutes(_settings.CaptionTimeoutMinutes);
        _logger = logger;
    }

    private CancellationTokenSource QuickTimeout(CancellationToken ct)
        => CancellationTokenSource.CreateLinkedTokenSource(ct, new CancellationTokenSource(
            TimeSpan.FromSeconds(_settings.QuickTimeoutSeconds)).Token);

    // --- /status ---------------------------------------------------------
    private sealed record StatusDto(string? state, string? model, double? progress, string? message);

    public async Task<AiServerStatus> GetStatusAsync(CancellationToken ct = default)
    {
        try
        {
            using var cts = QuickTimeout(ct);
            var dto = await _http.GetFromJsonAsync<StatusDto>("/status", _json, cts.Token);
            return new AiServerStatus(true, dto?.state ?? "idle", dto?.model ?? "", dto?.progress ?? -1, dto?.message ?? "");
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            _logger.LogDebug(ex, "AiApiServer status check failed (treated as unreachable)");
            return new AiServerStatus(false, "unreachable", "", -1, "");
        }
    }

    // --- /listmodelsbytype + /getmodelparams ------------------------------
    private sealed record ModelBaseInfoDto(string? ModelName);
    private sealed record ListModelsDto(List<ModelBaseInfoDto>? Interrogators);
    private sealed record ModelParamDto(string? Key);
    private sealed record ModelParamsResponseDto(List<ModelParamDto>? Parameters);

    public async Task<List<string>> GetCaptionModelsAsync(CancellationToken ct = default)
    {
        var captionModels = new List<string>();
        try
        {
            using var cts = QuickTimeout(ct);
            var list = await _http.GetFromJsonAsync<ListModelsDto>("/listmodelsbytype", _json, cts.Token);
            foreach (var model in list?.Interrogators ?? new List<ModelBaseInfoDto>())
            {
                if (string.IsNullOrEmpty(model.ModelName)) continue;
                ct.ThrowIfCancellationRequested();

                // Capability probe: captioning models expose a "prompt" parameter,
                // taggers only a "threshold". Fähigkeits-Check über den prompt-Parameter.
                using var probeCts = QuickTimeout(ct);
                var resp = await _http.PostAsJsonAsync("/getmodelparams", new { Name = model.ModelName }, probeCts.Token);
                if (!resp.IsSuccessStatusCode) continue;
                var pars = await resp.Content.ReadFromJsonAsync<ModelParamsResponseDto>(_json, probeCts.Token);
                if (pars?.Parameters?.Any(p => string.Equals(p.Key, "prompt", StringComparison.OrdinalIgnoreCase)) == true)
                    captionModels.Add(model.ModelName!);
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            _logger.LogDebug(ex, "AiApiServer model listing failed");
        }
        return captionModels;
    }

    // --- /interrogateimage ------------------------------------------------
    private sealed record TagEntryDto(string? Tag, double? Probability);
    private sealed record InterrogateResultDto(string? ModelName, List<TagEntryDto>? Tags);
    private sealed record InterrogateResponseDto(bool Success, string? ErrorMessage, List<InterrogateResultDto>? Result);

    public async Task<string> CaptionAsync(string imagePath, string model, string prompt, CancellationToken ct = default)
    {
        var payload = new
        {
            DataObject = await ToDownscaledJpegBase64Async(imagePath, ct),
            DataType = 1, // IMAGE_BYTE_ARRAY
            SkipInternetRequests = false,
            SerializeVramUsage = false,
            FileName = Path.GetFileName(imagePath),
            Models = new[]
            {
                new
                {
                    ModelName = model,
                    AdditionalParameters = new[]
                    {
                        new { Key = "prompt", Value = prompt, Type = "string", Comment = "" }
                    }
                }
            }
        };

        var response = await _http.PostAsJsonAsync("/interrogateimage", payload, ct);
        response.EnsureSuccessStatusCode();
        var dto = await response.Content.ReadFromJsonAsync<InterrogateResponseDto>(_json, ct)
                  ?? throw new InvalidOperationException("Leere Antwort vom KI-Server");

        if (!dto.Success)
            throw new InvalidOperationException(dto.ErrorMessage ?? "KI-Server meldet Fehler ohne Details");

        var texts = dto.Result?.FirstOrDefault()?.Tags?
            .Select(t => t.Tag)
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .ToList() ?? new List<string?>();

        if (texts.Count == 0)
            throw new InvalidOperationException("KI-Server lieferte keine Beschreibung");

        return string.Join(", ", texts);
    }

    private async Task<string> ToDownscaledJpegBase64Async(string imagePath, CancellationToken ct)
    {
        using var image = await Image.LoadAsync<Rgb24>(imagePath, ct);
        var max = Math.Max(image.Width, image.Height);
        if (max > _settings.MaxImageDimension)
        {
            var scale = (double)_settings.MaxImageDimension / max;
            image.Mutate(x => x.Resize((int)Math.Round(image.Width * scale), (int)Math.Round(image.Height * scale)));
        }
        using var ms = new MemoryStream();
        await image.SaveAsJpegAsync(ms, ct);
        return Convert.ToBase64String(ms.ToArray());
    }
}
```

- [ ] **Step 4: Tests ausführen — müssen bestehen**

Run: `dotnet test TagFusion.sln`
Expected: PASS komplett.

- [ ] **Step 5: Commit**

```bash
git add Backend/TagFusion/Configuration/AppSettings.cs Backend/TagFusion/appsettings.json Backend/TagFusion/App.xaml.cs Backend/TagFusion/Services/IAiCaptionClient.cs Backend/TagFusion/Services/AiCaptionClient.cs Backend/TagFusion.Tests/Services/AiCaptionClientTests.cs
git commit -m "Add AI caption client for the local AiApiServer"
```

---

### Task 4: `DescriptionScanService`

**Files:**
- Create: `Backend/TagFusion/Services/DescriptionScanService.cs`
- Modify: `Backend/TagFusion/App.xaml.cs` (DI: `services.AddSingleton<DescriptionScanService>();`)
- Test: `Backend/TagFusion.Tests/Services/DescriptionScanServiceTests.cs` (neu)

**Interfaces:**
- Consumes: `IAiCaptionClient.CaptionAsync` (Task 3), `IExifToolService.ReadDescriptionsBatchAsync`/`WriteDescriptionAsync`/`ReadTagsAsync`/`ReadRatingAsync` (Task 2 + Bestand), `IDatabaseService.SaveImageAsync`/`SetImageDescriptionAsync` (Task 1 + Bestand), `IFileSystemService.GetImagesAsync`, `ImageFile.FromPath`
- Produces:
  - `record ScanSummary(int Described, int Skipped, int Failed, bool Cancelled, bool Aborted)` (verschachtelt)
  - `bool StartScan(string folderPath, string model, string prompt, bool overwriteExisting)`; `void Cancel()`; `bool IsScanning`; Events `Progress(current, total, described)` / `Completed(ScanSummary)`; `internal Task? CurrentScanForTests`
  - Konstante `MaxConsecutiveFailures = 3`

- [ ] **Step 1: Failing Tests schreiben**

Neue Datei `Backend/TagFusion.Tests/Services/DescriptionScanServiceTests.cs` (Fixture-Aufbau exakt wie `FaceScanServiceTests`: Temp-Dateien, `SetupFolder`, `RunScanAsync` via `Completed`-TaskCompletionSource mit 10-s-Timeout):

```csharp
using System.IO;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using NUnit.Framework;
using TagFusion.Database;
using TagFusion.Models;
using TagFusion.Services;

namespace TagFusion.Tests.Services;

[TestFixture]
public class DescriptionScanServiceTests
{
    private Mock<IAiCaptionClient> _client = null!;
    private Mock<IExifToolService> _exifTool = null!;
    private Mock<IDatabaseService> _db = null!;
    private Mock<IFileSystemService> _fs = null!;
    private DescriptionScanService _service = null!;
    private List<string> _tempFiles = null!;

    [SetUp]
    public void SetUp()
    {
        _client = new Mock<IAiCaptionClient>();
        _exifTool = new Mock<IExifToolService>();
        _db = new Mock<IDatabaseService>();
        _fs = new Mock<IFileSystemService>();
        _tempFiles = new List<string>();

        _exifTool.Setup(e => e.ReadDescriptionsBatchAsync(It.IsAny<List<string>>(), It.IsAny<CancellationToken>()))
                 .ReturnsAsync(new Dictionary<string, string>());
        _exifTool.Setup(e => e.WriteDescriptionAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
                 .ReturnsAsync(true);
        _exifTool.Setup(e => e.ReadTagsAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                 .ReturnsAsync(new List<string>());
        _exifTool.Setup(e => e.ReadRatingAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                 .ReturnsAsync(0);
        _client.Setup(c => c.CaptionAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
               .ReturnsAsync("Eine Beschreibung");

        _service = new DescriptionScanService(_client.Object, _exifTool.Object, _db.Object, _fs.Object,
            NullLogger<DescriptionScanService>.Instance);
    }

    [TearDown]
    public void TearDown()
    {
        foreach (var f in _tempFiles)
            if (File.Exists(f)) File.Delete(f);
    }

    private string CreateTempImage()
    {
        var path = Path.Combine(Path.GetTempPath(), Guid.NewGuid() + ".jpg");
        File.WriteAllText(path, "fake");
        _tempFiles.Add(path);
        return path;
    }

    private void SetupFolder(params string[] paths)
    {
        var images = paths.Select(p => new ImageFile { Path = p, FileName = Path.GetFileName(p) }).ToList();
        _fs.Setup(f => f.GetImagesAsync(It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync(images);
    }

    private async Task<DescriptionScanService.ScanSummary> RunScanAsync(
        string folder, string model = "qwen", string prompt = "p", bool overwrite = false)
    {
        DescriptionScanService.ScanSummary? summary = null;
        var done = new TaskCompletionSource();
        _service.Completed += s => { summary = s; done.TrySetResult(); };

        Assert.That(_service.StartScan(folder, model, prompt, overwrite), Is.True);
        await done.Task.WaitAsync(TimeSpan.FromSeconds(10));
        return summary!;
    }

    [Test]
    public async Task Scan_DescribesEveryImage_WritesMetadataAndDb_WithProgress()
    {
        var p1 = CreateTempImage();
        var p2 = CreateTempImage();
        SetupFolder(p1, p2);
        var progress = new List<(int C, int T, int D)>();
        _service.Progress += (c, t, d) => progress.Add((c, t, d));

        var summary = await RunScanAsync("C:\\egal");

        Assert.That(summary.Described, Is.EqualTo(2));
        Assert.That(summary.Aborted, Is.False);
        Assert.That(progress[^1], Is.EqualTo((2, 2, 2)));
        _exifTool.Verify(e => e.WriteDescriptionAsync(p1, "Eine Beschreibung", It.IsAny<CancellationToken>()), Times.Once);
        _db.Verify(d => d.SaveImageAsync(It.Is<ImageFile>(i => i.Path == p1), It.IsAny<CancellationToken>()), Times.Once);
        _db.Verify(d => d.SetImageDescriptionAsync(p1, "Eine Beschreibung", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Test]
    public async Task Scan_SkipsImagesWithExistingDescription_WhenNotOverwriting()
    {
        var p1 = CreateTempImage();
        var p2 = CreateTempImage();
        SetupFolder(p1, p2);
        _exifTool.Setup(e => e.ReadDescriptionsBatchAsync(It.IsAny<List<string>>(), It.IsAny<CancellationToken>()))
                 .ReturnsAsync(new Dictionary<string, string> { [p1] = "Schon da" });

        var summary = await RunScanAsync("C:\\egal", overwrite: false);

        Assert.That(summary.Skipped, Is.EqualTo(1));
        Assert.That(summary.Described, Is.EqualTo(1));
        _client.Verify(c => c.CaptionAsync(p1, It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Test]
    public async Task Scan_OverwriteMode_DescribesEverything()
    {
        var p1 = CreateTempImage();
        SetupFolder(p1);
        _exifTool.Setup(e => e.ReadDescriptionsBatchAsync(It.IsAny<List<string>>(), It.IsAny<CancellationToken>()))
                 .ReturnsAsync(new Dictionary<string, string> { [p1] = "Alt" });

        var summary = await RunScanAsync("C:\\egal", overwrite: true);

        Assert.That(summary.Described, Is.EqualTo(1));
        Assert.That(summary.Skipped, Is.EqualTo(0));
    }

    [Test]
    public async Task Scan_SingleFailure_CountsAndContinues()
    {
        var p1 = CreateTempImage();
        var p2 = CreateTempImage();
        SetupFolder(p1, p2);
        _client.Setup(c => c.CaptionAsync(p1, It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
               .ThrowsAsync(new InvalidOperationException("kaputt"));

        var summary = await RunScanAsync("C:\\egal");

        Assert.That(summary.Failed, Is.EqualTo(1));
        Assert.That(summary.Described, Is.EqualTo(1));
        Assert.That(summary.Aborted, Is.False);
    }

    [Test]
    public async Task Scan_ThreeConsecutiveFailures_Aborts()
    {
        var paths = new[] { CreateTempImage(), CreateTempImage(), CreateTempImage(), CreateTempImage() };
        SetupFolder(paths);
        _client.Setup(c => c.CaptionAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
               .ThrowsAsync(new InvalidOperationException("server weg"));

        var summary = await RunScanAsync("C:\\egal");

        Assert.That(summary.Aborted, Is.True);
        Assert.That(summary.Failed, Is.EqualTo(3));
        _client.Verify(c => c.CaptionAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Exactly(3));
    }

    [Test]
    public async Task Scan_SecondStartWhileRunning_ReturnsFalse()
    {
        var p1 = CreateTempImage();
        SetupFolder(p1);
        var block = new TaskCompletionSource<string>();
        _client.Setup(c => c.CaptionAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
               .Returns(block.Task);

        Assert.That(_service.StartScan("C:\\egal", "m", "p", false), Is.True);
        Assert.That(_service.StartScan("C:\\egal", "m", "p", false), Is.False);
        Assert.That(_service.IsScanning, Is.True);

        block.SetResult("fertig");
        await _service.CurrentScanForTests!;
        Assert.That(_service.IsScanning, Is.False);
    }

    [Test]
    public async Task Cancel_StopsScan_AndReportsCancelled()
    {
        var p1 = CreateTempImage();
        var p2 = CreateTempImage();
        SetupFolder(p1, p2);
        _client.Setup(c => c.CaptionAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
               .Returns(async (string _, string _, string _, CancellationToken ct) =>
               {
                   await Task.CompletedTask;
                   _service.Cancel();
                   ct.ThrowIfCancellationRequested();
                   return "x";
               });

        var summary = await RunScanAsync("C:\\egal");

        Assert.That(summary.Cancelled, Is.True);
    }

    [Test]
    public async Task Cancel_AfterScanCompleted_DoesNotThrow()
    {
        var p1 = CreateTempImage();
        SetupFolder(p1);
        await RunScanAsync("C:\\egal");

        Assert.DoesNotThrow(() => _service.Cancel());
    }
}
```

- [ ] **Step 2: Tests ausführen — müssen fehlschlagen**

Run: `dotnet test TagFusion.sln --filter "FullyQualifiedName~DescriptionScanServiceTests"`
Expected: FAIL — Compile-Error.

- [ ] **Step 3: Implementierung**

Neue Datei `Backend/TagFusion/Services/DescriptionScanService.cs` — Concurrency-Gerüst EXAKT wie `FaceScanService` (inkl. `Interlocked`-Flag, CTS-Snapshot-Cancel mit `ObjectDisposedException`-Guard, `Interlocked.Exchange` im finally, `Completed` immer im finally):

```csharp
using System.IO;
using Microsoft.Extensions.Logging;
using TagFusion.Database;
using TagFusion.Models;

namespace TagFusion.Services;

/// <summary>
/// Runs one manual AI-description pass over a folder: caption serially via the
/// AiApiServer, write MWG metadata, mirror into the DB. Aborts after three
/// consecutive failures (server presumed gone).
/// Führt einen manuellen Beschreibungs-Lauf aus: seriell captionen, Metadaten
/// schreiben, DB spiegeln; nach drei Fehlern in Folge Abbruch.
/// </summary>
public sealed class DescriptionScanService
{
    public record ScanSummary(int Described, int Skipped, int Failed, bool Cancelled, bool Aborted);

    internal const int MaxConsecutiveFailures = 3;

    private readonly IAiCaptionClient _client;
    private readonly IExifToolService _exifToolService;
    private readonly IDatabaseService _databaseService;
    private readonly IFileSystemService _fileSystemService;
    private readonly ILogger<DescriptionScanService> _logger;

    private int _running;
    private CancellationTokenSource? _cts;
    private Task? _currentScan;

    public event Action<int, int, int>? Progress;   // current, total, described
    public event Action<ScanSummary>? Completed;

    public bool IsScanning => Interlocked.CompareExchange(ref _running, 0, 0) == 1;

    internal Task? CurrentScanForTests => _currentScan;

    public DescriptionScanService(
        IAiCaptionClient client,
        IExifToolService exifToolService,
        IDatabaseService databaseService,
        IFileSystemService fileSystemService,
        ILogger<DescriptionScanService> logger)
    {
        _client = client;
        _exifToolService = exifToolService;
        _databaseService = databaseService;
        _fileSystemService = fileSystemService;
        _logger = logger;
    }

    public bool StartScan(string folderPath, string model, string prompt, bool overwriteExisting)
    {
        if (Interlocked.CompareExchange(ref _running, 1, 0) != 0)
            return false;

        _cts = new CancellationTokenSource();
        _currentScan = Task.Run(() => RunScanAsync(folderPath, model, prompt, overwriteExisting, _cts.Token));
        return true;
    }

    public void Cancel()
    {
        // Snapshot — a concurrently finishing scan may dispose the CTS.
        // Snapshot — ein parallel endender Scan darf die CTS entsorgen.
        var cts = _cts;
        if (cts == null) return;
        try
        {
            cts.Cancel();
        }
        catch (ObjectDisposedException)
        {
            // Scan already finished. / Scan bereits beendet.
        }
    }

    private async Task RunScanAsync(string folderPath, string model, string prompt, bool overwriteExisting, CancellationToken ct)
    {
        int described = 0, skipped = 0, failed = 0;
        bool cancelled = false, aborted = false;

        try
        {
            var images = await _fileSystemService.GetImagesAsync(folderPath, ct);
            var paths = images.Select(i => i.Path).ToList();

            var existing = overwriteExisting
                ? new Dictionary<string, string>()
                : await _exifToolService.ReadDescriptionsBatchAsync(paths, ct);

            var todo = new List<string>();
            foreach (var path in paths)
            {
                if (existing.ContainsKey(path)) { skipped++; continue; }
                todo.Add(path);
            }

            var total = todo.Count;
            var consecutiveFailures = 0;

            for (int i = 0; i < total; i++)
            {
                ct.ThrowIfCancellationRequested();
                var path = todo[i];
                try
                {
                    var caption = await _client.CaptionAsync(path, model, prompt, ct);
                    if (!await _exifToolService.WriteDescriptionAsync(path, caption, ct))
                        throw new InvalidOperationException("ExifTool-Schreiben fehlgeschlagen");

                    // DB sync: refreshes tags/rating mirror AND FaceScanFileTime
                    // (metadata write bumps mtime — must not invalidate face scans).
                    // DB-Sync: aktualisiert auch FaceScanFileTime — Beschreiben darf
                    // Gesichts-Scans nicht entwerten.
                    var image = ImageFile.FromPath(path,
                        await _exifToolService.ReadTagsAsync(path, ct),
                        await _exifToolService.ReadRatingAsync(path, ct));
                    await _databaseService.SaveImageAsync(image, ct);
                    await _databaseService.SetImageDescriptionAsync(path, caption, ct);

                    described++;
                    consecutiveFailures = 0;
                }
                catch (OperationCanceledException)
                {
                    throw;
                }
                catch (Exception ex)
                {
                    failed++;
                    consecutiveFailures++;
                    _logger.LogWarning(ex, "Description failed for {Path}", path);
                    if (consecutiveFailures >= MaxConsecutiveFailures)
                    {
                        aborted = true;
                        _logger.LogError("Aborting description scan after {Count} consecutive failures", consecutiveFailures);
                        break;
                    }
                }
                Progress?.Invoke(i + 1, total, described);
            }
        }
        catch (OperationCanceledException)
        {
            cancelled = true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Description scan failed for {Folder}", folderPath);
            aborted = true;
        }
        finally
        {
            var cts = Interlocked.Exchange(ref _cts, null);
            cts?.Dispose();
            Interlocked.Exchange(ref _running, 0);
            Completed?.Invoke(new ScanSummary(described, skipped, failed, cancelled, aborted));
        }
    }
}
```

In `App.xaml.cs`: `services.AddSingleton<DescriptionScanService>();`

- [ ] **Step 4: Tests ausführen — müssen bestehen**

Run: `dotnet test TagFusion.sln`
Expected: PASS komplett.

- [ ] **Step 5: Commit**

```bash
git add Backend/TagFusion/Services/DescriptionScanService.cs Backend/TagFusion/App.xaml.cs Backend/TagFusion.Tests/Services/DescriptionScanServiceTests.cs
git commit -m "Add serial AI description scan service"
```

---

### Task 5: `AiHandler` + Bridge-Verdrahtung + Kontraktdateien

**Files:**
- Create: `Backend/TagFusion/Bridge/Handlers/AiHandler.cs`
- Modify: `Backend/TagFusion/Bridge/Handlers/PayloadHelper.cs` (`GetBool`, falls nicht vorhanden)
- Modify: `Backend/TagFusion/Bridge/WebViewBridge.cs` (Ctor `AiCaptionClient`-frei — Handler bekommt Interfaces; Ctor-Parameter `DescriptionScanService descriptionScanService, IAiCaptionClient aiCaptionClient`, Handler-Array, Event-Verdrahtung)
- Modify: `Backend/TagFusion/MainWindow.xaml.cs` (`ResolveServices`-Tuple + Destrukturierung + `new WebViewBridge(...)`)
- Modify: `bridge-actions.json`, `Frontend/src/services/bridgeActions.ts` (alphabetisch: `cancelDescriptionScan`, `getAiServerStatus`, `getDescriptionPrecheck`, `startDescriptionScan`)
- Test: `Backend/TagFusion.Tests/Bridge/Handlers/AiHandlerTests.cs` (neu)

**Interfaces:**
- Consumes: `DescriptionScanService` (Task 4), `IAiCaptionClient` (Task 3), `IExifToolService.ReadDescriptionsBatchAsync` (Task 2), `IFileSystemService.GetImagesAsync`, `PayloadHelper`, `BridgeException`
- Produces: Actions `getAiServerStatus` → `{ reachable, state, model, progress, message, models }`; `getDescriptionPrecheck { path }` → `{ total, withDescription }`; `startDescriptionScan { path, model, prompt, overwriteExisting }` → `true`; `cancelDescriptionScan` → `true`; Events `descriptionScanProgress { current, total, described }`, `descriptionScanCompleted { described, skipped, failed, cancelled, aborted }`

**Bekannte Plan-Grenze:** Nach diesem Task ist `Frontend/src/services/bridgeContract.test.ts` planmäßig ROT (die 4 Actions haben noch keine bridge.ts-Aufrufer). Das ist KEIN Fehler dieses Tasks — Task 6 schließt die Lücke. Backend-Suite + `BridgeContractTests.cs` müssen grün sein.

- [ ] **Step 1: Kontraktdateien erweitern**

`bridge-actions.json` und `bridgeActions.ts` alphabetisch ergänzen:

```typescript
  CANCEL_DESCRIPTION_SCAN: 'cancelDescriptionScan',
  GET_AI_SERVER_STATUS: 'getAiServerStatus',
  GET_DESCRIPTION_PRECHECK: 'getDescriptionPrecheck',
  START_DESCRIPTION_SCAN: 'startDescriptionScan',
```

- [ ] **Step 2: Failing Handler-Tests schreiben**

Neue Datei `Backend/TagFusion.Tests/Bridge/Handlers/AiHandlerTests.cs`:

```csharp
using System.IO;
using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using NUnit.Framework;
using TagFusion.Bridge.Handlers;
using TagFusion.Database;
using TagFusion.Models;
using TagFusion.Services;

namespace TagFusion.Tests.Bridge.Handlers;

[TestFixture]
public class AiHandlerTests
{
    private Mock<IAiCaptionClient> _client = null!;
    private Mock<IExifToolService> _exifTool = null!;
    private Mock<IDatabaseService> _db = null!;
    private Mock<IFileSystemService> _fs = null!;
    private DescriptionScanService _scanService = null!;
    private AiHandler _handler = null!;

    [SetUp]
    public void SetUp()
    {
        _client = new Mock<IAiCaptionClient>();
        _exifTool = new Mock<IExifToolService>();
        _db = new Mock<IDatabaseService>();
        _fs = new Mock<IFileSystemService>();
        _scanService = new DescriptionScanService(_client.Object, _exifTool.Object, _db.Object, _fs.Object,
            NullLogger<DescriptionScanService>.Instance);
        _handler = new AiHandler(_scanService, _client.Object, _exifTool.Object, _fs.Object,
            NullLogger<AiHandler>.Instance);
    }

    private static Dictionary<string, object> Payload(string json)
        => JsonSerializer.Deserialize<Dictionary<string, object>>(json)!
            .ToDictionary(kvp => kvp.Key, kvp => (object)kvp.Value);

    [Test]
    public async Task GetAiServerStatus_MergesStatusAndModels()
    {
        _client.Setup(c => c.GetStatusAsync(It.IsAny<CancellationToken>()))
               .ReturnsAsync(new AiServerStatus(true, "idle", "", -1, ""));
        _client.Setup(c => c.GetCaptionModelsAsync(It.IsAny<CancellationToken>()))
               .ReturnsAsync(new List<string> { "qwen" });

        var result = await _handler.HandleAsync("getAiServerStatus", null);

        Assert.That(result, Is.Not.Null);
        _client.Verify(c => c.GetCaptionModelsAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Test]
    public async Task GetAiServerStatus_Unreachable_SkipsModelListing()
    {
        _client.Setup(c => c.GetStatusAsync(It.IsAny<CancellationToken>()))
               .ReturnsAsync(new AiServerStatus(false, "unreachable", "", -1, ""));

        await _handler.HandleAsync("getAiServerStatus", null);

        _client.Verify(c => c.GetCaptionModelsAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Test]
    public async Task GetDescriptionPrecheck_CountsExistingDescriptions()
    {
        _fs.Setup(f => f.GetImagesAsync("C:\\fotos", It.IsAny<CancellationToken>()))
           .ReturnsAsync(new List<ImageFile>
           {
               new() { Path = "C:\\fotos\\a.jpg" },
               new() { Path = "C:\\fotos\\b.jpg" },
           });
        _exifTool.Setup(e => e.ReadDescriptionsBatchAsync(It.IsAny<List<string>>(), It.IsAny<CancellationToken>()))
                 .ReturnsAsync(new Dictionary<string, string> { ["C:\\fotos\\a.jpg"] = "da" });

        var result = await _handler.HandleAsync("getDescriptionPrecheck", Payload("{\"path\":\"C:\\\\fotos\"}"));

        var json = JsonSerializer.Serialize(result);
        Assert.That(json, Does.Contain("\"total\":2"));
        Assert.That(json, Does.Contain("\"withDescription\":1"));
    }

    [Test]
    public void StartDescriptionScan_ServerUnreachable_ThrowsGermanMessage()
    {
        _client.Setup(c => c.GetStatusAsync(It.IsAny<CancellationToken>()))
               .ReturnsAsync(new AiServerStatus(false, "unreachable", "", -1, ""));

        var payload = Payload("{\"path\":\"C:\\\\fotos\",\"model\":\"qwen\",\"prompt\":\"p\",\"overwriteExisting\":false}");
        var ex = Assert.ThrowsAsync<TagFusion.Bridge.BridgeException>(
            () => _handler.HandleAsync("startDescriptionScan", payload));
        Assert.That(ex!.UserMessage, Does.Contain("nicht erreichbar"));
    }

    [Test]
    public async Task CancelDescriptionScan_ReturnsTrue()
    {
        var result = await _handler.HandleAsync("cancelDescriptionScan", null);
        Assert.That(result, Is.EqualTo(true));
    }
}
```

Hinweis: `StartDescriptionScan` prüft die Erreichbarkeit VOR dem Start (deshalb der Status-Mock). Ein Test für „Scan läuft bereits" braucht ein existierendes Verzeichnis + blockierenden Scan — der Guard wird über den Rückgabewert von `StartScan` abgedeckt (siehe Implementierung) und ist in `DescriptionScanServiceTests` bereits getestet.

- [ ] **Step 3: Tests ausführen — müssen fehlschlagen**

Run: `dotnet test TagFusion.sln --filter "FullyQualifiedName~AiHandlerTests"`
Expected: FAIL — Compile-Error (`AiHandler` fehlt).

- [ ] **Step 4: Implementierung**

Falls `PayloadHelper` keine `GetBool`-Methode hat, ergänzen (Muster `GetInt`):

```csharp
/// <summary>Extract a bool payload value with default. / Bool aus dem Payload mit Default.</summary>
public static bool GetBool(object? value, bool defaultValue)
{
    if (value is System.Text.Json.JsonElement el)
    {
        if (el.ValueKind == System.Text.Json.JsonValueKind.True) return true;
        if (el.ValueKind == System.Text.Json.JsonValueKind.False) return false;
    }
    return defaultValue;
}
```

Neue Datei `Backend/TagFusion/Bridge/Handlers/AiHandler.cs`:

```csharp
using System.IO;
using Microsoft.Extensions.Logging;
using TagFusion.Services;

namespace TagFusion.Bridge.Handlers;

/// <summary>
/// Handles AI description actions: server status, precheck, scan start/cancel.
/// Verarbeitet KI-Beschreibungs-Actions: Serverstatus, Precheck, Scan.
/// </summary>
public class AiHandler : IBridgeHandler
{
    private readonly DescriptionScanService _scanService;
    private readonly IAiCaptionClient _client;
    private readonly IExifToolService _exifToolService;
    private readonly IFileSystemService _fileSystemService;
    private readonly ILogger<AiHandler> _logger;

    private static readonly HashSet<string> _supported = new(StringComparer.Ordinal)
    {
        "getAiServerStatus", "getDescriptionPrecheck", "startDescriptionScan", "cancelDescriptionScan"
    };

    public IReadOnlySet<string> SupportedActions => _supported;

    public AiHandler(
        DescriptionScanService scanService,
        IAiCaptionClient client,
        IExifToolService exifToolService,
        IFileSystemService fileSystemService,
        ILogger<AiHandler> logger)
    {
        _scanService = scanService;
        _client = client;
        _exifToolService = exifToolService;
        _fileSystemService = fileSystemService;
        _logger = logger;
    }

    public async Task<object?> HandleAsync(string action, Dictionary<string, object>? payload)
    {
        return action switch
        {
            "getAiServerStatus" => await GetAiServerStatusAsync(),
            "getDescriptionPrecheck" => await GetDescriptionPrecheckAsync(payload),
            "startDescriptionScan" => await StartDescriptionScanAsync(payload),
            "cancelDescriptionScan" => CancelScan(),
            _ => throw new NotSupportedException($"Unknown action: {action}")
        };
    }

    private async Task<object> GetAiServerStatusAsync()
    {
        var status = await _client.GetStatusAsync();
        var models = status.Reachable ? await _client.GetCaptionModelsAsync() : new List<string>();
        return new
        {
            reachable = status.Reachable,
            state = status.State,
            model = status.Model,
            progress = status.Progress,
            message = status.Message,
            models,
        };
    }

    private async Task<object> GetDescriptionPrecheckAsync(Dictionary<string, object>? payload)
    {
        var path = PayloadHelper.GetString(payload ?? new(), "path");
        var images = await _fileSystemService.GetImagesAsync(path);
        var paths = images.Select(i => i.Path).ToList();
        var existing = await _exifToolService.ReadDescriptionsBatchAsync(paths);
        return new { total = paths.Count, withDescription = existing.Count };
    }

    private async Task<object> StartDescriptionScanAsync(Dictionary<string, object>? payload)
    {
        var p = payload ?? new();
        var path = PayloadHelper.GetString(p, "path");
        var model = PayloadHelper.GetString(p, "model");
        var prompt = PayloadHelper.GetString(p, "prompt");
        var overwrite = PayloadHelper.GetBool(p.GetValueOrDefault("overwriteExisting"), false);

        if (string.IsNullOrWhiteSpace(path) || !Directory.Exists(path))
            throw new BridgeException("Ordner nicht gefunden.", internalMessage: $"Folder not found: {path}");
        if (string.IsNullOrWhiteSpace(model) || string.IsNullOrWhiteSpace(prompt))
            throw new BridgeException("Modell oder Prompt fehlt.", internalMessage: "startDescriptionScan: empty model/prompt");

        var status = await _client.GetStatusAsync();
        if (!status.Reachable)
            throw new BridgeException(
                "KI-Server nicht erreichbar — bitte AiApiServer starten.",
                internalMessage: "AiApiServer unreachable");

        if (!_scanService.StartScan(path, model, prompt, overwrite))
            throw new BridgeException("Eine Beschreibung läuft bereits.", internalMessage: "Description scan already running");

        return true;
    }

    private object CancelScan()
    {
        _scanService.Cancel();
        return true;
    }
}
```

`WebViewBridge.cs`: Ctor um `DescriptionScanService descriptionScanService, IAiCaptionClient aiCaptionClient` erweitern (vor `ILoggerFactory`); im Handler-Array:

```csharp
new AiHandler(
    descriptionScanService, aiCaptionClient, exifToolService, fileSystemService,
    loggerFactory.CreateLogger<AiHandler>()),
```

Event-Verdrahtung (bei den Face-Scan-Events):

```csharp
// AI description scan events → frontend. / Beschreibungs-Scan-Events ans Frontend.
descriptionScanService.Progress += (current, total, described) =>
    SendEvent("descriptionScanProgress", new { current, total, described });
descriptionScanService.Completed += summary =>
    SendEvent("descriptionScanCompleted", new
    {
        described = summary.Described,
        skipped = summary.Skipped,
        failed = summary.Failed,
        cancelled = summary.Cancelled,
        aborted = summary.Aborted,
    });
```

`MainWindow.xaml.cs`: In `ResolveServices` `_serviceProvider.GetRequiredService<DescriptionScanService>()` und `GetRequiredService<IAiCaptionClient>()` ergänzen; Tuple-Destrukturierung und `new WebViewBridge(...)`-Aufruf in derselben relativen Position erweitern (Reihenfolge exakt wie die Ctor-Signatur).

- [ ] **Step 5: Tests ausführen — müssen bestehen (Backend)**

Run: `dotnet test TagFusion.sln`
Expected: PASS komplett (inkl. `BridgeContractTests` mit den 4 neuen Actions). `npm run test -- --run bridgeContract` aus `Frontend/` ist jetzt planmäßig ROT — dokumentieren, nicht fixen (Task 6).

- [ ] **Step 6: Commit**

```bash
git add Backend/TagFusion/Bridge/Handlers/AiHandler.cs Backend/TagFusion/Bridge/Handlers/PayloadHelper.cs Backend/TagFusion/Bridge/WebViewBridge.cs Backend/TagFusion/MainWindow.xaml.cs bridge-actions.json Frontend/src/services/bridgeActions.ts Backend/TagFusion.Tests/Bridge/Handlers/AiHandlerTests.cs
git commit -m "Add AI bridge handler with description scan actions"
```

---

### Task 6: Frontend — Typen, Bridge-Methoden, Prompt-Vorlagen, `descriptionStore`

**Files:**
- Modify: `Frontend/src/types/index.ts`
- Modify: `Frontend/src/services/bridge.ts` (4 Methoden + Mocks)
- Create: `Frontend/src/constants/descriptionPrompts.ts`
- Create: `Frontend/src/stores/descriptionStore.ts`
- Test: `Frontend/src/stores/__tests__/descriptionStore.test.ts` (neu)

**Interfaces:**
- Consumes: Actions/Events aus Task 5 — **dieser Task macht `bridgeContract.test.ts` wieder GRÜN** (explizit verifizieren!)
- Produces:
  - Typen: `AiServerStatusInfo { reachable: boolean; state: string; model: string; progress: number; message: string; models: string[] }`, `DescriptionPrecheck { total: number; withDescription: number }`
  - Bridge: `getAiServerStatus(): Promise<AiServerStatusInfo>`, `getDescriptionPrecheck(path): Promise<DescriptionPrecheck>`, `startDescriptionScan(path, model, prompt, overwriteExisting): Promise<boolean>`, `cancelDescriptionScan(): Promise<boolean>`
  - `DESCRIPTION_PROMPTS: { id: string; labelKey: string; text: string }[]` (3 deutsche Vorlagen)
  - `useDescriptionStore`: State `{ isDialogOpen, serverStatus: AiServerStatusInfo | null, precheck: DescriptionPrecheck | null, isScanning, progress: { current; total; described } | null, selectedModel, promptText, overwriteExisting }` + Actions `openDialog(path)`, `closeDialog()`, `setModel/setPrompt/setOverwrite`, `startScan(path)`, `cancelScan()`, `setupDescriptionSubscriptions()`; letzte Modell-/Prompt-Wahl in `localStorage` (`tagfusion.descriptionDialog`)

- [ ] **Step 1: Failing Store-Test schreiben**

Neue Datei `Frontend/src/stores/__tests__/descriptionStore.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDescriptionStore } from '../descriptionStore';
import { bridge } from '../../services/bridge';

vi.mock('../../services/bridge', () => ({
  bridge: {
    getAiServerStatus: vi.fn(),
    getDescriptionPrecheck: vi.fn(),
    startDescriptionScan: vi.fn(),
    cancelDescriptionScan: vi.fn(),
    on: vi.fn(),
  },
}));

const mockedBridge = vi.mocked(bridge);

describe('descriptionStore', () => {
  beforeEach(() => {
    useDescriptionStore.setState({
      isDialogOpen: false,
      serverStatus: null,
      precheck: null,
      isScanning: false,
      progress: null,
      selectedModel: '',
      promptText: '',
      overwriteExisting: false,
    });
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('openDialog loads server status and precheck in parallel', async () => {
    mockedBridge.getAiServerStatus.mockResolvedValue({
      reachable: true, state: 'idle', model: '', progress: -1, message: '', models: ['qwen'],
    });
    mockedBridge.getDescriptionPrecheck.mockResolvedValue({ total: 10, withDescription: 3 });

    await useDescriptionStore.getState().openDialog('C:\\fotos');

    const state = useDescriptionStore.getState();
    expect(state.isDialogOpen).toBe(true);
    expect(state.serverStatus?.models).toEqual(['qwen']);
    expect(state.precheck).toEqual({ total: 10, withDescription: 3 });
  });

  it('openDialog with unreachable server still opens with status', async () => {
    mockedBridge.getAiServerStatus.mockResolvedValue({
      reachable: false, state: 'unreachable', model: '', progress: -1, message: '', models: [],
    });
    mockedBridge.getDescriptionPrecheck.mockResolvedValue({ total: 5, withDescription: 0 });

    await useDescriptionStore.getState().openDialog('C:\\fotos');

    expect(useDescriptionStore.getState().isDialogOpen).toBe(true);
    expect(useDescriptionStore.getState().serverStatus?.reachable).toBe(false);
  });

  it('startScan passes the dialog selection and closes the dialog', async () => {
    mockedBridge.startDescriptionScan.mockResolvedValue(true);
    useDescriptionStore.setState({
      isDialogOpen: true, selectedModel: 'qwen', promptText: 'Beschreibe', overwriteExisting: true,
    });

    await useDescriptionStore.getState().startScan('C:\\fotos');

    expect(mockedBridge.startDescriptionScan).toHaveBeenCalledWith('C:\\fotos', 'qwen', 'Beschreibe', true);
    const state = useDescriptionStore.getState();
    expect(state.isScanning).toBe(true);
    expect(state.isDialogOpen).toBe(false);
  });

  it('startScan failure reverts isScanning and keeps state consistent', async () => {
    mockedBridge.startDescriptionScan.mockRejectedValue(new Error('Eine Beschreibung läuft bereits.'));
    useDescriptionStore.setState({ isDialogOpen: true, selectedModel: 'q', promptText: 'p' });

    await useDescriptionStore.getState().startScan('C:\\fotos');

    expect(useDescriptionStore.getState().isScanning).toBe(false);
  });

  it('remembers the last model and prompt via localStorage', async () => {
    useDescriptionStore.getState().setModel('qwen');
    useDescriptionStore.getState().setPrompt('Mein Prompt');

    const raw = localStorage.getItem('tagfusion.descriptionDialog');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toMatchObject({ model: 'qwen', prompt: 'Mein Prompt' });
  });
});
```

- [ ] **Step 2: Test ausführen — muss fehlschlagen**

Run (aus `Frontend/`): `npm run test -- --run descriptionStore`
Expected: FAIL — Modul existiert nicht.

- [ ] **Step 3: Implementierung**

`Frontend/src/types/index.ts` — ergänzen:

```typescript
// AI description types / KI-Beschreibungen
export interface AiServerStatusInfo {
  reachable: boolean;
  state: string;
  model: string;
  progress: number;
  message: string;
  models: string[];
}

export interface DescriptionPrecheck {
  total: number;
  withDescription: number;
}
```

`Frontend/src/services/bridge.ts` — Methoden (Typ-Import erweitern) + Mocks:

```typescript
  // AI descriptions — server status, precheck, scan / KI-Beschreibungen
  async getAiServerStatus(): Promise<AiServerStatusInfo> {
    return this.send<AiServerStatusInfo>(BRIDGE_ACTIONS.GET_AI_SERVER_STATUS);
  }

  async getDescriptionPrecheck(path: string): Promise<DescriptionPrecheck> {
    return this.send<DescriptionPrecheck>(BRIDGE_ACTIONS.GET_DESCRIPTION_PRECHECK, { path });
  }

  async startDescriptionScan(path: string, model: string, prompt: string, overwriteExisting: boolean): Promise<boolean> {
    return this.send<boolean>(BRIDGE_ACTIONS.START_DESCRIPTION_SCAN, { path, model, prompt, overwriteExisting });
  }

  async cancelDescriptionScan(): Promise<boolean> {
    return this.send<boolean>(BRIDGE_ACTIONS.CANCEL_DESCRIPTION_SCAN);
  }
```

Browser-Mocks im `switch`:

```typescript
      case 'getAiServerStatus':
        return { reachable: false, state: 'unreachable', model: '', progress: -1, message: '', models: [] };
      case 'getDescriptionPrecheck':
        return { total: 0, withDescription: 0 };
      case 'startDescriptionScan':
      case 'cancelDescriptionScan':
        return true;
```

Neue Datei `Frontend/src/constants/descriptionPrompts.ts`:

```typescript
// German prompt templates for AI descriptions. The text goes to the model verbatim;
// labels are i18n keys. Deutsche Prompt-Vorlagen — Text geht wörtlich ans Modell.
export interface DescriptionPromptTemplate {
  id: string;
  labelKey: string;
  text: string;
}

export const DESCRIPTION_PROMPTS: DescriptionPromptTemplate[] = [
  {
    id: 'standard',
    labelKey: 'descriptions.promptStandard',
    text: 'Beschreibe dieses Bild in zwei bis drei sachlichen Sätzen auf Deutsch. Nenne die wichtigsten Motive, Farben und die Bildstimmung.',
  },
  {
    id: 'nsfw',
    labelKey: 'descriptions.promptNsfw',
    text: 'Beschreibe dieses Bild detailliert und unzensiert auf Deutsch, einschließlich expliziter Inhalte, in zwei bis vier Sätzen.',
  },
  {
    id: 'short',
    labelKey: 'descriptions.promptShort',
    text: 'Beschreibe dieses Bild in einem prägnanten deutschen Satz.',
  },
];
```

Neue Datei `Frontend/src/stores/descriptionStore.ts`:

```typescript
import { create } from 'zustand';
import { bridge } from '../services/bridge';
import type { AiServerStatusInfo, DescriptionPrecheck } from '../types';
import { DESCRIPTION_PROMPTS } from '../constants/descriptionPrompts';
import { useToastStore } from './toastStore';

let subscriptionsInitialized = false;
let statusPollTimer: ReturnType<typeof setInterval> | null = null;

const STORAGE_KEY = 'tagfusion.descriptionDialog';
const STATUS_POLL_MS = 2000;

function loadLastChoice(): { model: string; prompt: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as { model: string; prompt: string };
  } catch {
    // ignore broken storage / defekten Speicher ignorieren
  }
  return { model: '', prompt: DESCRIPTION_PROMPTS[0].text };
}

function saveLastChoice(model: string, prompt: string): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ model, prompt }));
}

interface DescriptionState {
  isDialogOpen: boolean;
  serverStatus: AiServerStatusInfo | null;
  precheck: DescriptionPrecheck | null;
  isScanning: boolean;
  progress: { current: number; total: number; described: number } | null;
  selectedModel: string;
  promptText: string;
  overwriteExisting: boolean;

  openDialog: (path: string) => Promise<void>;
  closeDialog: () => void;
  setModel: (model: string) => void;
  setPrompt: (prompt: string) => void;
  setOverwrite: (overwrite: boolean) => void;
  startScan: (path: string) => Promise<void>;
  cancelScan: () => Promise<void>;
  setupDescriptionSubscriptions: () => void;
}

export const useDescriptionStore = create<DescriptionState>((set, get) => ({
  isDialogOpen: false,
  serverStatus: null,
  precheck: null,
  isScanning: false,
  progress: null,
  selectedModel: loadLastChoice().model,
  promptText: loadLastChoice().prompt,
  overwriteExisting: false,

  openDialog: async (path) => {
    set({ isDialogOpen: true, serverStatus: null, precheck: null });
    try {
      const [status, precheck] = await Promise.all([
        bridge.getAiServerStatus(),
        bridge.getDescriptionPrecheck(path),
      ]);
      // Preselect the remembered model when still available, else the first.
      // Gemerktes Modell vorwählen, wenn verfügbar — sonst das erste.
      const remembered = get().selectedModel;
      const model = status.models.includes(remembered) ? remembered : (status.models[0] ?? '');
      set({ serverStatus: status, precheck, selectedModel: model });
    } catch (error) {
      useToastStore.getState().warning((error as Error).message);
      set({ serverStatus: { reachable: false, state: 'unreachable', model: '', progress: -1, message: '', models: [] } });
    }

    // Poll /status while the dialog is open so model load/download progress ticks live.
    // Status-Polling, solange der Dialog offen ist — Ladefortschritt tickt live.
    if (statusPollTimer !== null) clearInterval(statusPollTimer);
    statusPollTimer = setInterval(() => {
      if (!get().isDialogOpen) return;
      void bridge.getAiServerStatus()
        .then((status) => {
          const current = get();
          const model = status.models.includes(current.selectedModel)
            ? current.selectedModel
            : (status.models[0] ?? '');
          set({ serverStatus: status, selectedModel: model });
        })
        .catch(() => { /* transient poll errors stay silent / stille Poll-Fehler */ });
    }, STATUS_POLL_MS);
  },

  closeDialog: () => {
    if (statusPollTimer !== null) {
      clearInterval(statusPollTimer);
      statusPollTimer = null;
    }
    set({ isDialogOpen: false });
  },

  setModel: (model) => {
    set({ selectedModel: model });
    saveLastChoice(model, get().promptText);
  },

  setPrompt: (prompt) => {
    set({ promptText: prompt });
    saveLastChoice(get().selectedModel, prompt);
  },

  setOverwrite: (overwrite) => set({ overwriteExisting: overwrite }),

  startScan: async (path) => {
    const { selectedModel, promptText, overwriteExisting } = get();
    set({ isScanning: true, progress: null, isDialogOpen: false });
    try {
      await bridge.startDescriptionScan(path, selectedModel, promptText, overwriteExisting);
    } catch (error) {
      set({ isScanning: false });
      useToastStore.getState().warning((error as Error).message);
    }
  },

  cancelScan: async () => {
    try {
      await bridge.cancelDescriptionScan();
    } catch (error) {
      useToastStore.getState().warning((error as Error).message);
    }
  },

  setupDescriptionSubscriptions: () => {
    if (subscriptionsInitialized) return;
    subscriptionsInitialized = true;

    bridge.on('descriptionScanProgress', (data) => {
      const { current, total, described } = data as { current: number; total: number; described: number };
      set({ progress: { current, total, described } });
    });

    bridge.on('descriptionScanCompleted', (data) => {
      const { described, skipped, failed, cancelled, aborted } = data as {
        described: number; skipped: number; failed: number; cancelled: boolean; aborted: boolean;
      };
      set({ isScanning: false, progress: null });
      const toast = useToastStore.getState();
      if (cancelled) {
        toast.warning(`Beschreiben abgebrochen — ${described} Bilder beschrieben`);
        return;
      }
      if (aborted) {
        toast.warning(`KI-Server antwortet nicht mehr — Lauf abgebrochen. ${described} Bilder beschrieben.`);
        return;
      }
      if (failed > 0) {
        toast.warning(`Fertig: ${described} beschrieben, ${skipped} übersprungen, ${failed} fehlgeschlagen`);
      } else {
        toast.success(`Fertig: ${described} beschrieben, ${skipped} übersprungen`);
      }
    });
  },
}));
```

- [ ] **Step 4: Tests, Lint — müssen bestehen (inkl. Contract wieder grün)**

Run (aus `Frontend/`): `npm run test -- --run && npm run lint`
Expected: PASS komplett — **explizit prüfen, dass `bridgeContract.test.ts` wieder grün ist** — und 0 Lint-Warnungen.

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/types/index.ts Frontend/src/services/bridge.ts Frontend/src/constants/descriptionPrompts.ts Frontend/src/stores/descriptionStore.ts Frontend/src/stores/__tests__/descriptionStore.test.ts
git commit -m "Add description store and bridge methods for AI descriptions"
```

---

### Task 7: Frontend — Toolbar-Button + `DescriptionDialog` + Übersetzungen

**Files:**
- Modify: `Frontend/src/locales/de/common.json` + `Frontend/src/locales/en/common.json` (Abschnitt `descriptions`)
- Create: `Frontend/src/components/descriptions/DescriptionDialog.tsx`
- Create: `Frontend/src/components/descriptions/index.ts`
- Modify: `Frontend/src/components/layout/Toolbar.tsx` (Button + Lauf-Fortschritt)
- Modify: `Frontend/src/App.tsx` bzw. `Frontend/src/hooks/useAppInit.ts` (Dialog mounten, `setupDescriptionSubscriptions()` beim bestehenden Subscription-Setup)
- Test: `Frontend/src/components/descriptions/DescriptionDialog.test.tsx` (neu)

**Interfaces:**
- Consumes: `useDescriptionStore` (Task 6), `DESCRIPTION_PROMPTS`, Glass-Komponenten, `useCurrentFolder`
- Produces: sichtbares Feature

**Glass-Props:** Vor dem Schreiben die realen Props von `GlassModal`/`GlassButton`/`GlassInput`/`GlassDropdown` in `Frontend/src/components/ui/glass/` nachschlagen und den Code exakt daran ausrichten (bei Feature 2 stimmten die angenommenen Props bereits — trotzdem prüfen, insbesondere `GlassDropdown`). Struktur unten ist bindend, Prop-Namen folgen der Realität. Für das mehrzeilige Prompt-Feld: falls es keine Glass-Textarea gibt, eine einfache `<textarea>` mit den Tailwind-Klassen der `GlassInput` verwenden — KEINE neue Glass-Komponente bauen.

- [ ] **Step 1: Übersetzungen ergänzen**

`Frontend/src/locales/de/common.json` (Top-Level `descriptions`):

```json
"descriptions": {
  "button": "Bilder beschreiben",
  "dialogTitle": "Bilder mit KI beschreiben",
  "serverOk": "KI-Server verbunden",
  "serverDown": "KI-Server nicht erreichbar — bitte AiApiServer starten (AiApiServer\\main.py)",
  "serverBusy": "Modell wird geladen … {{progress}} %",
  "model": "Modell",
  "promptTemplate": "Vorlage",
  "promptStandard": "Standard",
  "promptNsfw": "NSFW",
  "promptShort": "Kurz & sachlich",
  "promptLabel": "Anweisung an das Modell",
  "existing": "{{count}} von {{total}} Bildern haben bereits eine Beschreibung",
  "skipExisting": "Vorhandene überspringen",
  "overwriteExisting": "Vorhandene überschreiben",
  "start": "Beschreiben starten",
  "cancel": "Abbrechen",
  "scanning": "Beschreibe … {{current}}/{{total}}"
}
```

`Frontend/src/locales/en/common.json` (gleiche Schlüssel, englisch):

```json
"descriptions": {
  "button": "Describe images",
  "dialogTitle": "Describe images with AI",
  "serverOk": "AI server connected",
  "serverDown": "AI server unreachable — please start AiApiServer (AiApiServer\\main.py)",
  "serverBusy": "Loading model … {{progress}} %",
  "model": "Model",
  "promptTemplate": "Template",
  "promptStandard": "Standard",
  "promptNsfw": "NSFW",
  "promptShort": "Short & factual",
  "promptLabel": "Instruction for the model",
  "existing": "{{count}} of {{total}} images already have a description",
  "skipExisting": "Skip existing",
  "overwriteExisting": "Overwrite existing",
  "start": "Start describing",
  "cancel": "Cancel",
  "scanning": "Describing … {{current}}/{{total}}"
}
```

- [ ] **Step 2: Failing Component-Test schreiben**

Neue Datei `Frontend/src/components/descriptions/DescriptionDialog.test.tsx` (Mock-Setup wie `FaceReviewPanel.test.tsx`):

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DescriptionDialog } from './DescriptionDialog';
import { useDescriptionStore } from '../../stores/descriptionStore';
import { useAppStore } from '../../stores/appStore';

vi.mock('../../services/bridge', () => ({
  bridge: {
    getAiServerStatus: vi.fn(),
    getDescriptionPrecheck: vi.fn(),
    startDescriptionScan: vi.fn(),
    cancelDescriptionScan: vi.fn(),
    on: vi.fn(),
  },
}));

describe('DescriptionDialog', () => {
  beforeEach(() => {
    useAppStore.setState({ currentFolder: 'C:\\Test' });
    useDescriptionStore.setState({
      isDialogOpen: true,
      serverStatus: { reachable: true, state: 'idle', model: '', progress: -1, message: '', models: ['qwen', 'joycaption'] },
      precheck: { total: 87, withDescription: 12 },
      isScanning: false,
      progress: null,
      selectedModel: 'qwen',
      promptText: 'Beschreibe',
      overwriteExisting: false,
    });
  });

  it('renders model choices, precheck info and start button', () => {
    render(<DescriptionDialog />);

    expect(screen.getByText(/12/)).toBeInTheDocument();
    expect(screen.getByText(/87/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /starten/i })).toBeInTheDocument();
  });

  it('disables start when the server is unreachable', () => {
    useDescriptionStore.setState({
      serverStatus: { reachable: false, state: 'unreachable', model: '', progress: -1, message: '', models: [] },
      selectedModel: '',
    });
    render(<DescriptionDialog />);

    expect(screen.getByRole('button', { name: /starten/i })).toBeDisabled();
  });

  it('renders nothing when closed', () => {
    useDescriptionStore.setState({ isDialogOpen: false });
    const { container } = render(<DescriptionDialog />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 3: Test ausführen — muss fehlschlagen**

Run: `npm run test -- --run DescriptionDialog`
Expected: FAIL — Komponente existiert nicht.

- [ ] **Step 4: Implementierung**

Neue Datei `Frontend/src/components/descriptions/DescriptionDialog.tsx` (Struktur bindend, Glass-Props an Realität anpassen):

```tsx
import { useTranslation } from 'react-i18next';
import { Play, X } from 'lucide-react';
import { useDescriptionStore } from '../../stores/descriptionStore';
import { useCurrentFolder } from '../../stores/appStore';
import { GlassModal, GlassButton } from '../ui/glass';
import { DESCRIPTION_PROMPTS } from '../../constants/descriptionPrompts';

export function DescriptionDialog() {
  const { t } = useTranslation();
  const currentFolder = useCurrentFolder();
  const {
    isDialogOpen, serverStatus, precheck, selectedModel, promptText, overwriteExisting,
    closeDialog, setModel, setPrompt, setOverwrite, startScan,
  } = useDescriptionStore();

  if (!isDialogOpen || !currentFolder) return null;

  const reachable = serverStatus?.reachable === true;
  const loading = serverStatus === null;
  const canStart = reachable && !!selectedModel && promptText.trim().length > 0;

  return (
    <GlassModal isOpen={isDialogOpen} onClose={closeDialog} title={t('descriptions.dialogTitle')}>
      <div className="flex flex-col gap-4 p-1">
        {/* Server status / Serverstatus */}
        <p className={`text-sm ${reachable ? 'text-emerald-400' : 'text-amber-400'}`}>
          {loading
            ? '…'
            : reachable
              ? serverStatus!.state === 'loading' || serverStatus!.state === 'downloading'
                ? t('descriptions.serverBusy', { progress: Math.max(0, Math.round(serverStatus!.progress)) })
                : t('descriptions.serverOk')
              : t('descriptions.serverDown')}
        </p>

        {/* Model / Modell */}
        <label className="flex flex-col gap-1 text-sm">
          {t('descriptions.model')}
          <select
            value={selectedModel}
            onChange={(e) => setModel(e.target.value)}
            disabled={!reachable}
            className="rounded-lg border border-white/10 bg-transparent p-2"
          >
            {(serverStatus?.models ?? []).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>

        {/* Prompt template + editable text / Vorlage + editierbarer Prompt */}
        <label className="flex flex-col gap-1 text-sm">
          {t('descriptions.promptTemplate')}
          <select
            onChange={(e) => {
              const tpl = DESCRIPTION_PROMPTS.find((p) => p.id === e.target.value);
              if (tpl) setPrompt(tpl.text);
            }}
            className="rounded-lg border border-white/10 bg-transparent p-2"
            defaultValue=""
          >
            <option value="" disabled>{t('descriptions.promptTemplate')}</option>
            {DESCRIPTION_PROMPTS.map((p) => (
              <option key={p.id} value={p.id}>{t(p.labelKey)}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('descriptions.promptLabel')}
          <textarea
            value={promptText}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="rounded-lg border border-white/10 bg-transparent p-2"
          />
        </label>

        {/* Existing descriptions / Vorhandene Beschreibungen */}
        {precheck && precheck.withDescription > 0 && (
          <div className="flex flex-col gap-2 rounded-xl border border-white/10 p-3 text-sm">
            <p>{t('descriptions.existing', { count: precheck.withDescription, total: precheck.total })}</p>
            <label className="flex items-center gap-2">
              <input type="radio" checked={!overwriteExisting} onChange={() => setOverwrite(false)} />
              {t('descriptions.skipExisting')}
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={overwriteExisting} onChange={() => setOverwrite(true)} />
              {t('descriptions.overwriteExisting')}
            </label>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <GlassButton variant="ghost" onClick={closeDialog}>
            <X size={16} /> {t('descriptions.cancel')}
          </GlassButton>
          <GlassButton disabled={!canStart} onClick={() => void startScan(currentFolder)}>
            <Play size={16} /> {t('descriptions.start')}
          </GlassButton>
        </div>
      </div>
    </GlassModal>
  );
}
```

`Frontend/src/components/descriptions/index.ts`:

```typescript
export { DescriptionDialog } from './DescriptionDialog';
```

`Toolbar.tsx` — Button neben dem Gesichter-Button (Icon `Sparkles` aus `lucide-react`; existiert in `lucide-react@0.292` — sonst `Wand2` und als Concern melden):

```tsx
{currentFolderForFaces && (
  isDescribing ? (
    <GlassButton variant="ghost" onClick={() => void cancelDescriptionScan()} title={t('descriptions.cancel')}>
      {descriptionProgress
        ? t('descriptions.scanning', { current: descriptionProgress.current, total: descriptionProgress.total })
        : t('descriptions.button')}
    </GlassButton>
  ) : (
    <GlassButton
      variant="ghost"
      onClick={() => void openDescriptionDialog(currentFolderForFaces)}
      title={t('descriptions.button')}
    >
      <Sparkles size={18} />
    </GlassButton>
  )
)}
```

mit den Store-Anbindungen im Komponentenkopf (bestehende Hook-Reihenfolge respektieren):

```typescript
const {
  isScanning: isDescribing,
  progress: descriptionProgress,
  openDialog: openDescriptionDialog,
  cancelScan: cancelDescriptionScan,
} = useDescriptionStore();
```

`App.tsx`: `<DescriptionDialog />` neben `<FaceReviewPanel />` mounten. In `useAppInit.ts` (bzw. wo `setupFaceSubscriptions` hängt): `useDescriptionStore.getState().setupDescriptionSubscriptions();`

- [ ] **Step 5: Tests, Lint, Build — müssen bestehen**

Run (aus `Frontend/`): `npm run test -- --run && npm run lint && npm run build`
Expected: PASS / 0 Warnings / Build OK.

- [ ] **Step 6: Commit**

```bash
git add Frontend/src/locales/de/common.json Frontend/src/locales/en/common.json Frontend/src/components/descriptions/ Frontend/src/components/layout/Toolbar.tsx Frontend/src/App.tsx Frontend/src/hooks/useAppInit.ts
git commit -m "Add AI description dialog and toolbar button"
```

---

### Task 8: Gesamtverifikation, Changelog, Smoke-Test-Doku

**Files:**
- Modify: `CHANGELOG.md` (`[Unreleased]` → `### Added`, als erste Einträge)
- Create: `docs/ai-descriptions-smoke-test.md`

- [ ] **Step 1: Backend-Gesamtsuite**

Run (aus `Backend/`): `dotnet test TagFusion.sln`
Expected: PASS, 0 Failures, keine Compiler-Warnungen.

- [ ] **Step 2: Frontend-Gesamtsuite + Lint + Build**

Run (aus `Frontend/`): `npm run test -- --run && npm run lint && npm run build`
Expected: PASS / 0 Warnings / Build OK.

- [ ] **Step 3: Changelog**

```markdown
- Local AI image descriptions via the bundled AiApiServer: manual per-folder run with model/prompt dialog (German templates, editable), skip-or-overwrite choice for existing descriptions, MWG metadata + database mirror
- Global search now also matches AI descriptions (tags OR filename OR description)
```

- [ ] **Step 4: Smoke-Test-Doku**

Neue Datei `docs/ai-descriptions-smoke-test.md`:

```markdown
# KI-Bildbeschreibung — manueller Smoke-Test

Nicht in CI (benötigt laufenden AiApiServer mit GPU). Vor jedem Release durchführen.

## Vorbereitung
1. AiApiServer starten (`AiApiServer\main.py` in dessen venv) und warten,
   bis er auf http://127.0.0.1:50051/status antwortet.
2. Testordner mit ~10 Fotos, davon 2-3 mit vorhandener Beschreibung
   (z. B. vorher von Hand über ExifTool gesetzt).

## Ablauf
1. App starten, Testordner öffnen → Toolbar-Button „Bilder beschreiben".
2. Dialog: Server-Status grün; Modell-Dropdown zeigt nur Beschreibungs-Modelle
   (keine wd-/deepdanbooru-Tagger).
3. Vorlage „Standard" wählen, Prompt anpassbar; Hinweis „X von Y Bildern haben
   bereits eine Beschreibung" mit Überspringen/Überschreiben.
4. Lauf mit „Überspringen" starten → Fortschritt in der Toolbar; erstes Bild kann
   lange dauern (Modell lädt — im Dialog vorher als „Modell wird geladen … %" sichtbar).
5. Nach Abschluss: Toast mit Zahlen; Beschreibungen im Explorer (Eigenschaften →
   Details) und in Adobe Bridge prüfen (MWG: XMP/IPTC/EXIF konsistent).
6. Globale Suche nach einem Wort aus einer neuen Beschreibung → Bild wird gefunden.
7. Zweiter Lauf mit „Überspringen" → alles übersprungen, 0 beschrieben.
8. Lauf starten und AiApiServer währenddessen beenden → nach 3 Fehlern in Folge
   bricht der Lauf ab, Toast meldet es; App bleibt stabil.
9. Gesichter-Scan nach dem Beschreiben → Bilder werden NICHT neu gescannt
   (Beschreiben darf Gesichts-Scans nicht entwerten).
```

- [ ] **Step 5: Commit**

```bash
git add CHANGELOG.md docs/ai-descriptions-smoke-test.md
git commit -m "Document AI descriptions in changelog and add smoke test guide"
```

---

## Hinweise für die Ausführung

- **Reihenfolge:** 1→5 sequenziell (DB → ExifTool → Client → Service → Handler), dann 6→7, Task 8 zuletzt.
- **`AiApiServer/` niemals anfassen oder committen** — Read-only-Nachbarprojekt, bleibt untracked.
- **Contract-Test-Fenster:** `bridgeContract.test.ts` ist nach Task 5 planmäßig rot und MUSS mit Task 6 wieder grün sein (in Task 6 explizit verifiziert).
- **Kein echter Server in Tests:** `IAiCaptionClient` wird überall gemockt; der `AiCaptionClient` selbst testet gegen einen gemockten `HttpMessageHandler`. Der echte Server wird nur im dokumentierten Smoke-Test angefasst.
- **ExifTool-Task 2:** Referenz-Implementierungen (`ReadBatchMetadataAsync`, `WriteTagsAsync`) VOLLSTÄNDIG lesen und deren Idiome übernehmen — nicht raten; der Teststil folgt der bestehenden `ExifToolServiceTests`-Fixture.
