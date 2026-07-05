# Globale Tag- und Dateinamen-Suche — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die globale Suche findet alle in der DB erfassten Bilder per Teilwort-Suche (case-insensitiv inkl. Umlauten) über Tag-Namen UND Dateinamen; tote Einträge werden beim Suchen automatisch aufgeräumt.

**Architecture:** Bestehende Komponenten werden erweitert: Migration v3 ergänzt eine `FileName`-Spalte, `DatabaseService.SearchImagesAsync` bekommt `LIKE`-Semantik mit einer registrierten `lower_inv`-SQLite-Funktion, der `TagHandler` filtert/löscht tote Einträge nach der Abfrage, das Frontend zerlegt den Suchtext in Begriffe. Spec: `docs/superpowers/specs/2026-07-05-tag-database-search-design.md`.

**Tech Stack:** .NET 8 / C# 12, System.Data.SQLite, NUnit + Moq; React/TypeScript, Zustand, Vitest.

## Global Constraints

- **Bridge-Kontrakt unverändert:** Action `searchImages`, Payload-Form `{ tags, minRating, limit, offset }` — der Schlüssel heißt weiterhin `tags`, nur die Semantik wird „Suchbegriffe".
- **C#:** Alle I/O async/await; `SemaphoreSlim`, niemals `lock`; private Felder `_camelCase`; Interfaces mit `I`-Präfix; Async-Methoden mit `Async`-Suffix.
- **Kommentare:** Englisch + Deutsch (dual), wie im Bestand.
- **UI-Texte/Fehlermeldungen:** Deutsch.
- **TypeScript:** strict; ESLint mit `--max-warnings 0` muss grün sein.
- **Backend-Tests:** `dotnet test TagFusion.sln` aus `Backend/` ausführen. **Frontend:** `npm run test -- --run <datei>` aus `Frontend/` (`--run` = kein Watch-Mode).
- **Commit-Stil:** Imperativer englischer Einzeiler wie im Bestand (z. B. „Add FileName column migration"), Body optional deutsch.

---

### Task 1: Migration v3 — `FileName`-Spalte mit C#-Backfill

**Files:**
- Modify: `Backend/TagFusion/Database/MigrationRunner.cs`
- Modify: `Backend/TagFusion/Services/DatabaseService.cs` (nur `InitializeDatabase`, Zeile ~100)
- Test: `Backend/TagFusion.Tests/Database/MigrationRunnerTests.cs`

**Interfaces:**
- Consumes: bestehendes `Migration`-Record, `ApplyMigrations()`
- Produces: `Migration`-Record mit optionalem `Action<SQLiteConnection, SQLiteTransaction>? DataStep`; Spalte `Images.FileName TEXT NOT NULL DEFAULT ''` existiert nach Migration in jeder DB (alt wie neu)

Hintergrund: `MigrationRunnerTests` laufen auf leeren Verbindungen **ohne** `Images`-Tabelle, und `InitializeDatabase` legt bei frischen DBs die Tabelle **vor** den Migrationen an. Die Migration muss daher idempotent in C# prüfen: Tabelle fehlt → überspringen; Spalte existiert → überspringen; sonst `ALTER TABLE` + Backfill.

- [ ] **Step 1: Failing Tests schreiben**

In `MigrationRunnerTests.cs` ergänzen:

```csharp
[Test]
public void MigrationV3_OldSchema_AddsAndBackfillsFileName()
{
    // Simulate a pre-v3 database: Images table without FileName, with existing rows.
    // Simuliert eine Alt-DB: Images-Tabelle ohne FileName-Spalte, mit Bestandsdaten.
    using (var cmd = _connection.CreateCommand())
    {
        cmd.CommandText = @"
            CREATE TABLE Images (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Path TEXT NOT NULL UNIQUE,
                LastModified TEXT NOT NULL,
                Rating INTEGER DEFAULT 0,
                Width INTEGER DEFAULT 0,
                Height INTEGER DEFAULT 0,
                DateTaken TEXT
            );
            INSERT INTO Images (Path, LastModified) VALUES ('C:\Fotos\Käfer Übung.jpg', '2026-01-01T00:00:00.0000000Z');
            INSERT INTO Images (Path, LastModified) VALUES ('D:\a\b\IMG_0001.JPG', '2026-01-01T00:00:00.0000000Z');";
        cmd.ExecuteNonQuery();
    }

    new MigrationRunner(_connection, NullLogger.Instance).ApplyMigrations();

    using var check = _connection.CreateCommand();
    check.CommandText = "SELECT FileName FROM Images ORDER BY Id";
    using var reader = check.ExecuteReader();
    var fileNames = new List<string>();
    while (reader.Read()) fileNames.Add(reader.GetString(0));

    Assert.That(fileNames, Is.EqualTo(new[] { "Käfer Übung.jpg", "IMG_0001.JPG" }));
}

[Test]
public void MigrationV3_ColumnAlreadyExists_IsNoOp()
{
    // Fresh databases get FileName via InitializeDatabase — migration must not fail.
    // Frische DBs haben FileName schon — die Migration darf dann nicht fehlschlagen.
    using (var cmd = _connection.CreateCommand())
    {
        cmd.CommandText = @"
            CREATE TABLE Images (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Path TEXT NOT NULL UNIQUE,
                FileName TEXT NOT NULL DEFAULT '',
                LastModified TEXT NOT NULL
            );
            INSERT INTO Images (Path, FileName, LastModified) VALUES ('C:\x.jpg', 'x.jpg', '2026-01-01T00:00:00.0000000Z');";
        cmd.ExecuteNonQuery();
    }

    var runner = new MigrationRunner(_connection, NullLogger.Instance);
    Assert.DoesNotThrow(() => runner.ApplyMigrations());

    using var check = _connection.CreateCommand();
    check.CommandText = "SELECT FileName FROM Images";
    Assert.That(check.ExecuteScalar(), Is.EqualTo("x.jpg"));
}
```

- [ ] **Step 2: Tests ausführen — müssen fehlschlagen**

Run (aus `Backend/`): `dotnet test TagFusion.sln --filter "FullyQualifiedName~MigrationRunnerTests"`
Expected: FAIL — `MigrationV3_OldSchema_AddsAndBackfillsFileName` scheitert mit „no such column: FileName" (v3 existiert noch nicht).

- [ ] **Step 3: Implementierung**

In `MigrationRunner.cs` — `using System.IO;` oben ergänzen, Record erweitern, Migration v3 anfügen, `DataStep` in `ApplyMigrations` ausführen:

```csharp
/// <summary>
/// Represents a single database migration step. DataStep runs after Sql
/// inside the same transaction — for backfills that need C# logic.
/// Ein Migrationsschritt. DataStep läuft nach dem SQL in derselben Transaktion.
/// </summary>
internal record Migration(int Version, string Description, string Sql,
    Action<SQLiteConnection, SQLiteTransaction>? DataStep = null);
```

Migrations-Array am Ende ergänzen (Komma nach v2-Eintrag nicht vergessen):

```csharp
new(3, "FileName column on Images — enables global filename search (C# step, idempotent)",
    "",
    AddFileNameColumnAndBackfill)
```

Neue private Methoden in `MigrationRunner`:

```csharp
/// <summary>
/// Adds Images.FileName and backfills it from Path. Skips gracefully when the
/// Images table is absent (bare test connections) or the column already exists
/// (fresh databases created with the current base schema).
/// Ergänzt Images.FileName und befüllt sie aus Path — idempotent und tolerant
/// gegenüber fehlender Tabelle (nackte Test-Verbindungen) oder vorhandener Spalte.
/// </summary>
private static void AddFileNameColumnAndBackfill(SQLiteConnection connection, SQLiteTransaction transaction)
{
    if (!TableExists(connection, transaction, "Images")) return;
    if (ColumnExists(connection, transaction, "Images", "FileName")) return;

    using (var alter = connection.CreateCommand())
    {
        alter.Transaction = transaction;
        alter.CommandText = "ALTER TABLE Images ADD COLUMN FileName TEXT NOT NULL DEFAULT ''";
        alter.ExecuteNonQuery();
    }

    var updates = new List<(long Id, string FileName)>();
    using (var select = connection.CreateCommand())
    {
        select.Transaction = transaction;
        select.CommandText = "SELECT Id, Path FROM Images";
        using var reader = select.ExecuteReader();
        while (reader.Read())
            updates.Add((reader.GetInt64(0), Path.GetFileName(reader.GetString(1))));
    }

    using var update = connection.CreateCommand();
    update.Transaction = transaction;
    update.CommandText = "UPDATE Images SET FileName = @FileName WHERE Id = @Id";
    var nameParam = update.Parameters.Add("@FileName", System.Data.DbType.String);
    var idParam = update.Parameters.Add("@Id", System.Data.DbType.Int64);
    foreach (var (id, fileName) in updates)
    {
        nameParam.Value = fileName;
        idParam.Value = id;
        update.ExecuteNonQuery();
    }
}

private static bool TableExists(SQLiteConnection connection, SQLiteTransaction transaction, string name)
{
    using var cmd = connection.CreateCommand();
    cmd.Transaction = transaction;
    cmd.CommandText = "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=@name";
    cmd.Parameters.AddWithValue("@name", name);
    return Convert.ToInt32(cmd.ExecuteScalar()) > 0;
}

private static bool ColumnExists(SQLiteConnection connection, SQLiteTransaction transaction, string table, string column)
{
    using var cmd = connection.CreateCommand();
    cmd.Transaction = transaction;
    cmd.CommandText = $"PRAGMA table_info({table})";
    using var reader = cmd.ExecuteReader();
    while (reader.Read())
    {
        if (string.Equals(reader.GetString(1), column, StringComparison.OrdinalIgnoreCase))
            return true;
    }
    return false;
}
```

In `ApplyMigrations()` direkt nach dem SQL-Block (vor dem `versionCmd`) einfügen:

```csharp
// Run optional C# data step inside the same transaction (e.g. backfills).
migration.DataStep?.Invoke(_connection, transaction);
```

In `DatabaseService.InitializeDatabase()` (Zeile ~101) die `Images`-Tabelle um die Spalte erweitern, damit frische DBs sie sofort haben:

```csharp
CREATE TABLE IF NOT EXISTS Images (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Path TEXT NOT NULL UNIQUE,
    FileName TEXT NOT NULL DEFAULT '',
    LastModified TEXT NOT NULL,
    Rating INTEGER DEFAULT 0,
    Width INTEGER DEFAULT 0,
    Height INTEGER DEFAULT 0,
    DateTaken TEXT
);
```

- [ ] **Step 4: Tests ausführen — müssen bestehen**

Run: `dotnet test TagFusion.sln --filter "FullyQualifiedName~MigrationRunnerTests"`
Expected: PASS, alle (inkl. der drei Bestandstests — `ApplyMigrations_AdvancesVersionToLatest` prüft gegen `Migrations.Length` und passt sich automatisch an).

Zusätzlich Gesamtsuite: `dotnet test TagFusion.sln` — Expected: PASS (die neue Spalte bricht keine `SELECT *`-Reader, sie lesen per `GetOrdinal`/Spaltenname).

- [ ] **Step 5: Commit**

```bash
git add Backend/TagFusion/Database/MigrationRunner.cs Backend/TagFusion/Services/DatabaseService.cs Backend/TagFusion.Tests/Database/MigrationRunnerTests.cs
git commit -m "Add FileName column via migration v3 with C# backfill step"
```

---

### Task 2: `lower_inv`-Funktion + Teilwort-Suchsemantik über Tags

**Files:**
- Create: `Backend/TagFusion/Database/LowerInvariantSqliteFunction.cs`
- Modify: `Backend/TagFusion/Services/DatabaseService.cs` (`SearchImagesAsync`, Zeile ~449; statischer Konstruktor)
- Modify: `Backend/TagFusion/Database/IDatabaseService.cs` (Signatur/Doku `SearchImagesAsync`)
- Test: `Backend/TagFusion.Tests/Services/DatabaseServiceTests.cs`

**Interfaces:**
- Consumes: Task 1 (`FileName`-Spalte existiert; hier noch ungenutzt)
- Produces: `Task<List<ImageFile>> SearchImagesAsync(List<string>? terms, int? minRating, int limit = 200, int offset = 0, CancellationToken cancellationToken = default)` — jeder Begriff = Teilwort-Match (case-insensitiv inkl. Umlauten) auf Tag-Namen, Begriffe UND-verknüpft; `internal static string DatabaseService.EscapeLikePattern(string term)`

- [ ] **Step 1: Failing Tests schreiben**

In `DatabaseServiceTests.cs` neue Region vor dem `CreateTestImage`-Helper:

```csharp
// ========================================================================
// SearchImagesAsync — Teilwort-Suche / partial-match search
// ========================================================================

[Test]
public async Task Search_PartialTerm_MatchesTagSubstring()
{
    await _db.SaveImageAsync(CreateTestImage("C:\\t\\1.jpg", new[] { "Urlaubsreise" }));
    await _db.SaveImageAsync(CreateTestImage("C:\\t\\2.jpg", new[] { "Arbeit" }));

    var results = await _db.SearchImagesAsync(new List<string> { "urlaub" }, null);

    Assert.That(results, Has.Count.EqualTo(1));
    Assert.That(results[0].Path, Is.EqualTo("C:\\t\\1.jpg"));
}

[Test]
public async Task Search_UmlautTerm_IsCaseInsensitive()
{
    // Built-in SQLite LIKE is ASCII-only case-insensitive — this needs lower_inv.
    // SQLites LIKE kann Umlaute nicht case-insensitiv — dafür gibt es lower_inv.
    await _db.SaveImageAsync(CreateTestImage("C:\\t\\1.jpg", new[] { "Käfer" }));

    var results = await _db.SearchImagesAsync(new List<string> { "KÄFER" }, null);

    Assert.That(results, Has.Count.EqualTo(1));
}

[Test]
public async Task Search_MultipleTerms_AreAndCombined()
{
    await _db.SaveImageAsync(CreateTestImage("C:\\t\\1.jpg", new[] { "Urlaub", "Strand" }));
    await _db.SaveImageAsync(CreateTestImage("C:\\t\\2.jpg", new[] { "Urlaub" }));

    var results = await _db.SearchImagesAsync(new List<string> { "urlaub", "strand" }, null);

    Assert.That(results, Has.Count.EqualTo(1));
    Assert.That(results[0].Path, Is.EqualTo("C:\\t\\1.jpg"));
}

[Test]
public async Task Search_LikeWildcardsInTerm_AreEscaped()
{
    await _db.SaveImageAsync(CreateTestImage("C:\\t\\1.jpg", new[] { "50%" }));
    await _db.SaveImageAsync(CreateTestImage("C:\\t\\2.jpg", new[] { "50x" }));

    var results = await _db.SearchImagesAsync(new List<string> { "50%" }, null);

    // Unescaped, '%' would match both tags. / Ohne Escaping träfe '%' beide Tags.
    Assert.That(results, Has.Count.EqualTo(1));
    Assert.That(results[0].Path, Is.EqualTo("C:\\t\\1.jpg"));
}

[Test]
public async Task Search_TermPlusMinRating_BothApply()
{
    await _db.SaveImageAsync(CreateTestImage("C:\\t\\1.jpg", new[] { "Urlaub" }, 5));
    await _db.SaveImageAsync(CreateTestImage("C:\\t\\2.jpg", new[] { "Urlaub" }, 2));

    var results = await _db.SearchImagesAsync(new List<string> { "urlaub" }, 4);

    Assert.That(results, Has.Count.EqualTo(1));
    Assert.That(results[0].Path, Is.EqualTo("C:\\t\\1.jpg"));
}

[Test]
public void EscapeLikePattern_EscapesBackslashPercentUnderscore()
{
    Assert.That(DatabaseService.EscapeLikePattern(@"a%b_c\d"), Is.EqualTo(@"a\%b\_c\\d"));
}
```

- [ ] **Step 2: Tests ausführen — müssen fehlschlagen**

Run: `dotnet test TagFusion.sln --filter "FullyQualifiedName~DatabaseServiceTests"`
Expected: FAIL — Compile-Error (`EscapeLikePattern` existiert nicht). Nach Stub: Teilwort-Tests scheitern, weil die alte Suche exakt vergleicht.

- [ ] **Step 3: Implementierung**

Neue Datei `Backend/TagFusion/Database/LowerInvariantSqliteFunction.cs`:

```csharp
using System.Data.SQLite;

namespace TagFusion.Database;

/// <summary>
/// Culture-invariant lowercase for SQLite queries. SQLite's built-in lower()
/// and LIKE are only case-insensitive for ASCII — German umlauts (Ä→ä) need this.
/// Kultur-invariantes Lowercase für SQLite — eingebautes lower()/LIKE kann keine Umlaute.
/// </summary>
[SQLiteFunction(Name = "lower_inv", Arguments = 1, FuncType = FunctionType.Scalar)]
public class LowerInvariantSqliteFunction : SQLiteFunction
{
    public override object Invoke(object[] args)
        => args[0] is string s ? s.ToLowerInvariant() : args[0];
}
```

In `DatabaseService` einen statischen Konstruktor ergänzen (vor den Instanz-Konstruktoren; Registrierung wirkt auf danach geöffnete Verbindungen):

```csharp
static DatabaseService()
{
    // Bind lower_inv to every connection opened afterwards.
    // Registriert lower_inv für alle danach geöffneten Verbindungen.
    SQLiteFunction.RegisterFunction(typeof(LowerInvariantSqliteFunction));
}
```

`SearchImagesAsync` in `DatabaseService.cs` — Parameter `tags` → `terms` umbenennen und den Bedingungsblock ersetzen (der `minRating`-Block und alles ab `whereClause` bleiben unverändert):

```csharp
public async Task<List<ImageFile>> SearchImagesAsync(List<string>? terms, int? minRating, int limit = 200, int offset = 0, CancellationToken cancellationToken = default)
{
    await _readSemaphore.WaitAsync(cancellationToken);
    try
    {
        var conditions = new List<string>();
        using var command = _readConnection.CreateCommand();

        if (minRating.HasValue && minRating.Value > 0)
        {
            conditions.Add("i.Rating >= @MinRating");
            command.Parameters.AddWithValue("@MinRating", minRating.Value);
        }

        if (terms != null && terms.Count > 0)
        {
            // Each term must match at least one tag name (substring, case-insensitive).
            // Terms are AND-combined. / Jeder Begriff muss einen Tag treffen; UND-verknüpft.
            for (int t = 0; t < terms.Count; t++)
            {
                conditions.Add($@"EXISTS (
                    SELECT 1 FROM ImageTags it
                    JOIN Tags tg ON it.TagId = tg.Id
                    WHERE it.ImageId = i.Id AND lower_inv(tg.Name) LIKE @term{t} ESCAPE '\')");
                command.Parameters.AddWithValue($"@term{t}",
                    "%" + EscapeLikePattern(terms[t].ToLowerInvariant()) + "%");
            }
        }

        var whereClause = conditions.Count > 0 ? "WHERE " + string.Join(" AND ", conditions) : "";
        // ... Rest der Methode unverändert (SELECT, Reader-Schleife, Tag-Nachladen) ...
```

Dazu die neue Hilfsmethode in `DatabaseService`:

```csharp
/// <summary>
/// Escape LIKE wildcards in user input so they match literally (used with ESCAPE '\').
/// Escaped LIKE-Wildcards in Nutzereingaben, damit sie wörtlich matchen.
/// </summary>
internal static string EscapeLikePattern(string term)
    => term.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");
```

In `IDatabaseService.cs` die Signatur samt Doku anpassen:

```csharp
/// <summary>
/// Search images: each term must match a tag name as substring (case-insensitive
/// incl. umlauts). Terms are AND-combined; minRating filters additionally.
/// Suche: jeder Begriff als Teilwort auf Tag-Namen (case-insensitiv inkl. Umlauten),
/// Begriffe UND-verknüpft; minRating filtert zusätzlich.
/// </summary>
Task<List<ImageFile>> SearchImagesAsync(List<string>? terms, int? minRating, int limit = 200, int offset = 0, CancellationToken cancellationToken = default);
```

- [ ] **Step 4: Tests ausführen — müssen bestehen**

Run: `dotnet test TagFusion.sln`
Expected: PASS komplett. Hinweis: `TagHandlerTests` kompilieren unverändert (positionale Argumente, Parametername egal).

- [ ] **Step 5: Commit**

```bash
git add Backend/TagFusion/Database/LowerInvariantSqliteFunction.cs Backend/TagFusion/Services/DatabaseService.cs Backend/TagFusion/Database/IDatabaseService.cs Backend/TagFusion.Tests/Services/DatabaseServiceTests.cs
git commit -m "Add partial-match tag search with invariant lowercase SQLite function"
```

---

### Task 3: Dateinamen persistieren und in der Suche matchen

**Files:**
- Modify: `Backend/TagFusion/Services/DatabaseService.cs` (`SaveImageInternalNoTxAsync` Zeile ~232, `SearchImagesAsync`-Bedingung aus Task 2)
- Test: `Backend/TagFusion.Tests/Services/DatabaseServiceTests.cs`

**Interfaces:**
- Consumes: Task 1 (Spalte), Task 2 (Suchsemantik, `EscapeLikePattern`, `lower_inv`)
- Produces: Suchbegriff trifft, wenn Tag **oder** Dateiname passt; `Images.FileName` wird bei jedem Save geschrieben (Fallback `Path.GetFileName`)

- [ ] **Step 1: Failing Tests schreiben**

```csharp
[Test]
public async Task Search_MatchesFileNameSubstring()
{
    await _db.SaveImageAsync(CreateTestImage("C:\\fotos\\IMG_2024_Sylt.jpg", Array.Empty<string>()));
    await _db.SaveImageAsync(CreateTestImage("C:\\fotos\\anders.jpg", Array.Empty<string>()));

    var results = await _db.SearchImagesAsync(new List<string> { "sylt" }, null);

    Assert.That(results, Has.Count.EqualTo(1));
    Assert.That(results[0].Path, Is.EqualTo("C:\\fotos\\IMG_2024_Sylt.jpg"));
}

[Test]
public async Task Search_TermMatchesTagOrFileName()
{
    await _db.SaveImageAsync(CreateTestImage("C:\\t\\strand.jpg", Array.Empty<string>()));
    await _db.SaveImageAsync(CreateTestImage("C:\\t\\2.jpg", new[] { "Strandtag" }));
    await _db.SaveImageAsync(CreateTestImage("C:\\t\\3.jpg", new[] { "Berge" }));

    var results = await _db.SearchImagesAsync(new List<string> { "strand" }, null);

    Assert.That(results, Has.Count.EqualTo(2));
}

[Test]
public async Task SaveImage_EmptyFileName_DerivesFromPath()
{
    // Some call sites build ImageFile manually without FileName — must still be searchable.
    // Manche Aufrufer setzen FileName nicht — der Fallback aus Path muss greifen.
    var image = CreateTestImage("C:\\t\\Sonnenuntergang.jpg", Array.Empty<string>());
    image.FileName = string.Empty;

    await _db.SaveImageAsync(image);
    var results = await _db.SearchImagesAsync(new List<string> { "sonnenuntergang" }, null);

    Assert.That(results, Has.Count.EqualTo(1));
}
```

- [ ] **Step 2: Tests ausführen — müssen fehlschlagen**

Run: `dotnet test TagFusion.sln --filter "FullyQualifiedName~DatabaseServiceTests"`
Expected: FAIL — alle drei neuen Tests (FileName wird weder geschrieben noch durchsucht).

- [ ] **Step 3: Implementierung**

In `SaveImageInternalNoTxAsync` das INSERT/UPDATE erweitern:

```csharp
cmd.CommandText = @"
    INSERT INTO Images (Path, FileName, LastModified, Rating, Width, Height, DateTaken)
    VALUES (@Path, @FileName, @LastModified, @Rating, @Width, @Height, @DateTaken)
    ON CONFLICT(Path) DO UPDATE SET
        FileName = @FileName,
        LastModified = @LastModified,
        Rating = @Rating,
        Width = @Width,
        Height = @Height,
        DateTaken = @DateTaken
    RETURNING Id;
";
cmd.Parameters.AddWithValue("@Path", image.Path);
cmd.Parameters.AddWithValue("@FileName",
    string.IsNullOrEmpty(image.FileName) ? Path.GetFileName(image.Path) : image.FileName);
// ... übrige Parameter unverändert ...
```

In `SearchImagesAsync` (Task-2-Bedingung) den Dateinamen als ODER-Zweig ergänzen:

```csharp
conditions.Add($@"(EXISTS (
        SELECT 1 FROM ImageTags it
        JOIN Tags tg ON it.TagId = tg.Id
        WHERE it.ImageId = i.Id AND lower_inv(tg.Name) LIKE @term{t} ESCAPE '\')
    OR lower_inv(i.FileName) LIKE @term{t} ESCAPE '\')");
```

- [ ] **Step 4: Tests ausführen — müssen bestehen**

Run: `dotnet test TagFusion.sln`
Expected: PASS komplett.

- [ ] **Step 5: Commit**

```bash
git add Backend/TagFusion/Services/DatabaseService.cs Backend/TagFusion.Tests/Services/DatabaseServiceTests.cs
git commit -m "Persist FileName on save and include filenames in global search"
```

---

### Task 4: `DeleteImagesAsync` für tote Einträge

**Files:**
- Modify: `Backend/TagFusion/Database/IDatabaseService.cs`
- Modify: `Backend/TagFusion/Services/DatabaseService.cs`
- Test: `Backend/TagFusion.Tests/Services/DatabaseServiceTests.cs`

**Interfaces:**
- Consumes: bestehendes Schema, `_writeSemaphore`-Muster
- Produces: `Task DeleteImagesAsync(List<string> paths, CancellationToken cancellationToken = default)` — entfernt `Images`-Zeilen samt `ImageTags`-Links in einer Transaktion; `Tags`-Zeilen bleiben

- [ ] **Step 1: Failing Tests schreiben**

```csharp
// ========================================================================
// DeleteImagesAsync
// ========================================================================

[Test]
public async Task DeleteImages_RemovesImageAndItIsNoLongerFound()
{
    await _db.SaveImageAsync(CreateTestImage("C:\\t\\weg.jpg", new[] { "Urlaub" }));
    await _db.SaveImageAsync(CreateTestImage("C:\\t\\bleibt.jpg", new[] { "Urlaub" }));

    await _db.DeleteImagesAsync(new List<string> { "C:\\t\\weg.jpg" });

    Assert.That(await _db.GetImageAsync("C:\\t\\weg.jpg"), Is.Null);
    var results = await _db.SearchImagesAsync(new List<string> { "urlaub" }, null);
    Assert.That(results, Has.Count.EqualTo(1));
    Assert.That(results[0].Path, Is.EqualTo("C:\\t\\bleibt.jpg"));
}

[Test]
public async Task DeleteImages_EmptyList_NoOp()
{
    Assert.DoesNotThrowAsync(() => _db.DeleteImagesAsync(new List<string>()));
}

[Test]
public async Task DeleteImages_UnknownPath_DoesNotThrow()
{
    Assert.DoesNotThrowAsync(() => _db.DeleteImagesAsync(new List<string> { "C:\\gibtsnicht.jpg" }));
}
```

- [ ] **Step 2: Tests ausführen — müssen fehlschlagen**

Run: `dotnet test TagFusion.sln --filter "FullyQualifiedName~DatabaseServiceTests"`
Expected: FAIL — Compile-Error, `DeleteImagesAsync` existiert nicht (Interface + Klasse).

- [ ] **Step 3: Implementierung**

`IDatabaseService.cs`:

```csharp
/// <summary>
/// Delete image rows and their tag links for the given paths (stale entries).
/// Tag rows themselves are kept. Löscht Bild-Einträge samt Tag-Verknüpfungen;
/// die Tags selbst bleiben erhalten.
/// </summary>
Task DeleteImagesAsync(List<string> paths, CancellationToken cancellationToken = default);
```

`DatabaseService.cs` (Muster wie `ForgetThumbnailAccessAsync` — explizites Link-Löschen, kein Verlass auf FK-Cascade, da `PRAGMA foreign_keys` nicht gesetzt wird):

```csharp
public async Task DeleteImagesAsync(List<string> paths, CancellationToken cancellationToken = default)
{
    if (paths.Count == 0) return;

    await _writeSemaphore.WaitAsync(cancellationToken);
    try
    {
        using var transaction = _connection.BeginTransaction();
        try
        {
            using var linkCmd = _connection.CreateCommand();
            linkCmd.Transaction = transaction;
            linkCmd.CommandText = "DELETE FROM ImageTags WHERE ImageId IN (SELECT Id FROM Images WHERE Path = @Path)";
            var linkParam = linkCmd.Parameters.Add("@Path", System.Data.DbType.String);

            using var imgCmd = _connection.CreateCommand();
            imgCmd.Transaction = transaction;
            imgCmd.CommandText = "DELETE FROM Images WHERE Path = @Path";
            var imgParam = imgCmd.Parameters.Add("@Path", System.Data.DbType.String);

            foreach (var path in paths)
            {
                cancellationToken.ThrowIfCancellationRequested();
                linkParam.Value = path;
                await linkCmd.ExecuteNonQueryAsync(cancellationToken);
                imgParam.Value = path;
                await imgCmd.ExecuteNonQueryAsync(cancellationToken);
            }
            transaction.Commit();
        }
        catch
        {
            transaction.Rollback();
            throw;
        }
    }
    finally
    {
        _writeSemaphore.Release();
    }
}
```

- [ ] **Step 4: Tests ausführen — müssen bestehen**

Run: `dotnet test TagFusion.sln`
Expected: PASS komplett (Moq-basierte Handler-Tests kompilieren weiter — `Mock<IDatabaseService>` erzeugt das neue Member automatisch).

- [ ] **Step 5: Commit**

```bash
git add Backend/TagFusion/Database/IDatabaseService.cs Backend/TagFusion/Services/DatabaseService.cs Backend/TagFusion.Tests/Services/DatabaseServiceTests.cs
git commit -m "Add DeleteImagesAsync for removing stale image entries"
```

---

### Task 5: `SearchResultCleaner` — Partition existierend/löschbar/versteckt

**Files:**
- Create: `Backend/TagFusion/Services/SearchResultCleaner.cs`
- Test: `Backend/TagFusion.Tests/Services/SearchResultCleanerTests.cs` (neu)

**Interfaces:**
- Consumes: `TagFusion.Models.ImageFile` (nur `Path`)
- Produces: `SearchResultCleaner.Partition(IReadOnlyList<ImageFile> results, Func<string,bool> isRootAvailable, Func<string,bool> fileExists)` → `CleanupResult(List<ImageFile> Visible, List<string> DeletablePaths)`; `SearchResultCleaner.IsRootAvailable(string root)` als Produktions-Check

- [ ] **Step 1: Failing Tests schreiben**

Neue Datei `Backend/TagFusion.Tests/Services/SearchResultCleanerTests.cs`:

```csharp
using NUnit.Framework;
using TagFusion.Models;
using TagFusion.Services;

namespace TagFusion.Tests.Services;

[TestFixture]
public class SearchResultCleanerTests
{
    private static ImageFile Img(string path) => new() { Path = path };

    [Test]
    public void Partition_ExistingFile_IsVisible()
    {
        var result = SearchResultCleaner.Partition(
            new[] { Img("C:\\a.jpg") }, _ => true, _ => true);

        Assert.That(result.Visible, Has.Count.EqualTo(1));
        Assert.That(result.DeletablePaths, Is.Empty);
    }

    [Test]
    public void Partition_MissingFileOnAvailableRoot_IsDeletable()
    {
        var result = SearchResultCleaner.Partition(
            new[] { Img("C:\\weg.jpg") }, _ => true, _ => false);

        Assert.That(result.Visible, Is.Empty);
        Assert.That(result.DeletablePaths, Is.EqualTo(new[] { "C:\\weg.jpg" }));
    }

    [Test]
    public void Partition_MissingFileOnUnavailableRoot_IsHiddenButNotDeletable()
    {
        // Unplugged external drive: hide from results, never delete from DB.
        // Abgestöpselte externe Platte: ausblenden, aber nie aus der DB löschen.
        var result = SearchResultCleaner.Partition(
            new[] { Img("E:\\extern\\foto.jpg") }, _ => false, _ => false);

        Assert.That(result.Visible, Is.Empty);
        Assert.That(result.DeletablePaths, Is.Empty);
    }

    [Test]
    public void Partition_ChecksEachRootOnlyOnce()
    {
        var rootChecks = new List<string>();
        var images = new[] { Img("C:\\a.jpg"), Img("C:\\b.jpg"), Img("D:\\c.jpg") };

        SearchResultCleaner.Partition(images,
            root => { rootChecks.Add(root); return true; },
            _ => true);

        Assert.That(rootChecks, Has.Count.EqualTo(2)); // C:\ und D:\ je einmal
    }

    [Test]
    public void Partition_MixedRoots_PartitionsIndependently()
    {
        var images = new[] { Img("C:\\da.jpg"), Img("C:\\weg.jpg"), Img("E:\\offline.jpg") };

        var result = SearchResultCleaner.Partition(images,
            root => root.StartsWith("C", StringComparison.OrdinalIgnoreCase),
            path => path == "C:\\da.jpg");

        Assert.That(result.Visible.Select(i => i.Path), Is.EqualTo(new[] { "C:\\da.jpg" }));
        Assert.That(result.DeletablePaths, Is.EqualTo(new[] { "C:\\weg.jpg" }));
    }
}
```

- [ ] **Step 2: Tests ausführen — müssen fehlschlagen**

Run: `dotnet test TagFusion.sln --filter "FullyQualifiedName~SearchResultCleanerTests"`
Expected: FAIL — Compile-Error, Klasse existiert nicht.

- [ ] **Step 3: Implementierung**

Neue Datei `Backend/TagFusion/Services/SearchResultCleaner.cs`:

```csharp
using System.IO;
using TagFusion.Models;

namespace TagFusion.Services;

/// <summary>
/// Filters search results to files that still exist and decides which stale
/// DB entries are safe to delete. Files on unavailable roots (unplugged drives,
/// offline shares) are hidden from results but never deleted from the database.
/// Filtert Suchergebnisse auf existierende Dateien. Einträge auf nicht
/// verfügbaren Laufwerken werden nur ausgeblendet, nie gelöscht.
/// </summary>
public static class SearchResultCleaner
{
    public record CleanupResult(List<ImageFile> Visible, List<string> DeletablePaths);

    public static CleanupResult Partition(
        IReadOnlyList<ImageFile> results,
        Func<string, bool> isRootAvailable,
        Func<string, bool> fileExists)
    {
        var visible = new List<ImageFile>();
        var deletable = new List<string>();
        var rootCache = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);

        foreach (var image in results)
        {
            var root = Path.GetPathRoot(image.Path) ?? string.Empty;
            if (!rootCache.TryGetValue(root, out var available))
            {
                available = !string.IsNullOrEmpty(root) && isRootAvailable(root);
                rootCache[root] = available;
            }

            if (!available) continue;               // hide only / nur ausblenden
            if (fileExists(image.Path)) visible.Add(image);
            else deletable.Add(image.Path);         // root online, file gone → safe to delete
        }

        return new CleanupResult(visible, deletable);
    }

    /// <summary>
    /// Production root check: drive letters via DriveInfo.IsReady; UNC shares via
    /// Directory.Exists bounded to 2s (dead shares can block for a long time).
    /// Produktions-Check: Laufwerke via IsReady, UNC-Shares mit 2s-Schranke.
    /// </summary>
    public static bool IsRootAvailable(string root)
    {
        try
        {
            if (root.StartsWith(@"\\", StringComparison.Ordinal))
            {
                var probe = Task.Run(() => Directory.Exists(root));
                return probe.Wait(TimeSpan.FromSeconds(2)) && probe.Result;
            }
            return new DriveInfo(root).IsReady;
        }
        catch
        {
            return false;
        }
    }
}
```

- [ ] **Step 4: Tests ausführen — müssen bestehen**

Run: `dotnet test TagFusion.sln --filter "FullyQualifiedName~SearchResultCleanerTests"`
Expected: PASS (5 Tests).

- [ ] **Step 5: Commit**

```bash
git add Backend/TagFusion/Services/SearchResultCleaner.cs Backend/TagFusion.Tests/Services/SearchResultCleanerTests.cs
git commit -m "Add SearchResultCleaner for stale search result partitioning"
```

---

### Task 6: Auto-Cleanup im `TagHandler` verdrahten

**Files:**
- Modify: `Backend/TagFusion/Bridge/Handlers/TagHandler.cs` (`SearchImagesAsync`, Zeile ~137)
- Modify: `Backend/TagFusion.Tests/Bridge/Handlers/TagHandlerTests.cs` (bestehende `SearchImages_*`-Tests anpassen + neue)

**Interfaces:**
- Consumes: Task 4 (`IDatabaseService.DeleteImagesAsync`), Task 5 (`SearchResultCleaner`)
- Produces: `searchImages`-Bridge-Action liefert nur existierende Dateien; tote Einträge auf verfügbaren Laufwerken werden aus der DB entfernt

**Achtung:** Die bestehenden Tests `SearchImages_PassesAllParameters_Correctly`, `SearchImages_NullPayload_UsesDefaults`, `SearchImages_ZeroMinRating_TreatedAsNull` (Zeilen ~175–245) nutzen Fantasie-Pfade wie `C:\Photos\a.jpg` — nach dem Cleanup würden diese als „fehlend auf verfügbarem Laufwerk" herausgefiltert und die Asserts brechen. Sie müssen auf echte Temp-Dateien (`CreateTempFile()`-Helper existiert bereits) umgestellt werden.

- [ ] **Step 1: Bestehende Tests anpassen + Failing Tests schreiben**

In `SearchImages_PassesAllParameters_Correctly` die Zeilen

```csharp
var expectedImages = new List<ImageFile>
{
    new() { Path = @"C:\Photos\a.jpg", Tags = new List<string> { "Nature" } }
};
```

ersetzen durch:

```csharp
var existingFile = CreateTempFile();
var expectedImages = new List<ImageFile>
{
    new() { Path = existingFile, Tags = new List<string> { "Nature" } }
};
```

(`SearchImages_NullPayload_UsesDefaults` und `SearchImages_ZeroMinRating_TreatedAsNull` liefern leere Listen und brauchen keine Änderung.)

Neue Tests am Ende der `searchImages`-Region:

```csharp
[Test]
public async Task SearchImages_MissingFile_FilteredAndDeletedFromDb()
{
    var existing = CreateTempFile();
    var missing = Path.Combine(Path.GetTempPath(), Guid.NewGuid() + ".jpg");

    _databaseService
        .Setup(s => s.SearchImagesAsync(It.IsAny<List<string>>(), null, 200, 0, It.IsAny<CancellationToken>()))
        .ReturnsAsync(new List<ImageFile>
        {
            new() { Path = existing },
            new() { Path = missing }
        });

    var tagsJson = JsonSerializer.Deserialize<JsonElement>("[\"urlaub\"]");
    var result = await _handler.HandleAsync("searchImages", new Dictionary<string, object> { ["tags"] = tagsJson });

    var images = (List<ImageFile>)result!;
    Assert.That(images, Has.Count.EqualTo(1));
    Assert.That(images[0].Path, Is.EqualTo(existing));

    _databaseService.Verify(
        s => s.DeleteImagesAsync(
            It.Is<List<string>>(p => p.Count == 1 && p[0] == missing),
            It.IsAny<CancellationToken>()),
        Times.Once);
}

[Test]
public async Task SearchImages_CleanupFailure_StillReturnsFilteredResults()
{
    var existing = CreateTempFile();
    var missing = Path.Combine(Path.GetTempPath(), Guid.NewGuid() + ".jpg");

    _databaseService
        .Setup(s => s.SearchImagesAsync(It.IsAny<List<string>>(), null, 200, 0, It.IsAny<CancellationToken>()))
        .ReturnsAsync(new List<ImageFile> { new() { Path = existing }, new() { Path = missing } });
    _databaseService
        .Setup(s => s.DeleteImagesAsync(It.IsAny<List<string>>(), It.IsAny<CancellationToken>()))
        .ThrowsAsync(new Exception("DB locked"));

    var tagsJson = JsonSerializer.Deserialize<JsonElement>("[\"urlaub\"]");
    var result = await _handler.HandleAsync("searchImages", new Dictionary<string, object> { ["tags"] = tagsJson });

    // Cleanup errors are non-fatal — filtered results still come back.
    // Cleanup-Fehler sind nicht fatal — gefilterte Ergebnisse kommen trotzdem.
    var images = (List<ImageFile>)result!;
    Assert.That(images, Has.Count.EqualTo(1));
}

[Test]
public async Task SearchImages_NoMissingFiles_DoesNotDelete()
{
    var existing = CreateTempFile();
    _databaseService
        .Setup(s => s.SearchImagesAsync(It.IsAny<List<string>>(), null, 200, 0, It.IsAny<CancellationToken>()))
        .ReturnsAsync(new List<ImageFile> { new() { Path = existing } });

    var tagsJson = JsonSerializer.Deserialize<JsonElement>("[\"x\"]");
    await _handler.HandleAsync("searchImages", new Dictionary<string, object> { ["tags"] = tagsJson });

    _databaseService.Verify(
        s => s.DeleteImagesAsync(It.IsAny<List<string>>(), It.IsAny<CancellationToken>()),
        Times.Never);
}
```

- [ ] **Step 2: Tests ausführen — müssen fehlschlagen**

Run: `dotnet test TagFusion.sln --filter "FullyQualifiedName~TagHandlerTests"`
Expected: FAIL — die neuen Tests scheitern (Handler filtert nicht, löscht nicht); die angepassten Bestandstests bestehen weiterhin.

- [ ] **Step 3: Implementierung**

In `TagHandler.cs` oben `using System.IO;` ergänzen. Das Ende von `SearchImagesAsync` ersetzen:

```csharp
        var results = await _databaseService.SearchImagesAsync(terms, minRating, limit, offset);

        // Auto-cleanup: hide files that no longer exist; forget them in the DB only
        // when their drive is online (protects unplugged external drives).
        // Auto-Cleanup: fehlende Dateien ausblenden; DB-Löschung nur bei
        // verbundenem Laufwerk (schützt abgestöpselte externe Platten).
        var cleanup = SearchResultCleaner.Partition(results, SearchResultCleaner.IsRootAvailable, File.Exists);
        if (cleanup.DeletablePaths.Count > 0)
        {
            try
            {
                await _databaseService.DeleteImagesAsync(cleanup.DeletablePaths);
                _logger.LogInformation("Removed {Count} stale image entries during search", cleanup.DeletablePaths.Count);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Stale-entry cleanup failed — returning filtered results anyway");
            }
        }

        return cleanup.Visible;
```

Dabei die lokale Variable `tags` in `SearchImagesAsync` zu `terms` umbenennen (Payload-Schlüssel `"tags"` bleibt!).

- [ ] **Step 4: Tests ausführen — müssen bestehen**

Run: `dotnet test TagFusion.sln`
Expected: PASS komplett (inkl. `BridgeContractTests` — Action-Namen unverändert).

- [ ] **Step 5: Commit**

```bash
git add Backend/TagFusion/Bridge/Handlers/TagHandler.cs Backend/TagFusion.Tests/Bridge/Handlers/TagHandlerTests.cs
git commit -m "Auto-clean stale image entries during global search"
```

---

### Task 7: Frontend — Begriff-Zerlegung und Verdrahtung

**Files:**
- Create: `Frontend/src/utils/searchTerms.ts`
- Create: `Frontend/src/utils/searchTerms.test.ts`
- Modify: `Frontend/src/components/layout/Toolbar.tsx` (`handleGlobalSearch`, Zeile ~113)
- Modify: `Frontend/src/services/bridge.ts` (`searchImages`, Zeile ~292)
- Modify: `Frontend/src/stores/slices/uiSlice.ts` (`executeGlobalSearch`, Zeilen ~56 + ~124)

**Interfaces:**
- Consumes: Backend-Suchsemantik (Tasks 2/3/6); Payload-Schlüssel bleibt `tags`
- Produces: `parseSearchTerms(query: string): string[]`; `bridge.searchImages(terms?, minRating?, limit?, offset?)`; `executeGlobalSearch(terms?, minRating?)`

- [ ] **Step 1: Failing Test schreiben**

Neue Datei `Frontend/src/utils/searchTerms.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseSearchTerms } from './searchTerms';

describe('parseSearchTerms', () => {
  it('splits on whitespace', () => {
    expect(parseSearchTerms('urlaub strand')).toEqual(['urlaub', 'strand']);
  });

  it('splits on commas with optional spaces', () => {
    expect(parseSearchTerms('urlaub, strand,meer')).toEqual(['urlaub', 'strand', 'meer']);
  });

  it('collapses repeated separators and trims', () => {
    expect(parseSearchTerms('  urlaub,,   strand  ')).toEqual(['urlaub', 'strand']);
  });

  it('removes duplicate terms', () => {
    expect(parseSearchTerms('strand strand')).toEqual(['strand']);
  });

  it('returns empty array for empty or whitespace-only input', () => {
    expect(parseSearchTerms('')).toEqual([]);
    expect(parseSearchTerms('   ')).toEqual([]);
  });
});
```

- [ ] **Step 2: Test ausführen — muss fehlschlagen**

Run (aus `Frontend/`): `npm run test -- --run searchTerms`
Expected: FAIL — Modul `./searchTerms` existiert nicht.

- [ ] **Step 3: Implementierung**

Neue Datei `Frontend/src/utils/searchTerms.ts`:

```typescript
/**
 * Split a raw search query into terms: comma- or whitespace-separated,
 * trimmed, empties and duplicates removed.
 * Zerlegt den Suchtext in Begriffe (Komma/Leerzeichen), entfernt Leere und Duplikate.
 */
export function parseSearchTerms(query: string): string[] {
  return [
    ...new Set(
      query
        .split(/[,\s]+/)
        .map((t) => t.trim())
        .filter(Boolean)
    ),
  ];
}
```

`Toolbar.tsx` — Import ergänzen und `handleGlobalSearch` ersetzen:

```typescript
import { parseSearchTerms } from '../../utils/searchTerms';
```

```typescript
// Execute global cross-folder search via backend DB.
// Terms are AND-combined; each matches tags or filenames (substring).
const handleGlobalSearch = () => {
  const terms = parseSearchTerms(searchQuery);
  const minRating = filterRating ?? undefined;
  if (terms.length > 0 || minRating) {
    executeGlobalSearch(terms.length > 0 ? terms : undefined, minRating);
  }
};
```

`bridge.ts` — `searchImages` ersetzen (Payload-Schlüssel `tags` bleibt — Bridge-Kontrakt):

```typescript
  // Global search — each term matches tags or filenames (substring, case-insensitive).
  // Payload key stays `tags` for bridge-contract stability; semantics are "search terms".
  async searchImages(terms?: string[], minRating?: number, limit?: number, offset?: number): Promise<ImageFile[]> {
    return this.send<ImageFile[]>(BRIDGE_ACTIONS.SEARCH_IMAGES, { tags: terms, minRating, limit, offset });
  }
```

`uiSlice.ts` — Interface-Deklaration (Zeile ~56) und Implementierung (Zeile ~124) umbenennen:

```typescript
  // Global search: search DB across all folders by terms (tags/filenames) and rating
  executeGlobalSearch: (terms?: string[], minRating?: number) => Promise<void>;
```

```typescript
  executeGlobalSearch: async (terms, minRating) => {
    set({ isGlobalSearch: true, isSearching: true });
    try {
      const results = await bridge.searchImages(terms, minRating, 200);
      set({ searchResults: results, isSearching: false });
    } catch (error) {
      set({ isSearching: false, error: (error as Error).message });
    }
  },
```

- [ ] **Step 4: Tests, Lint und Build — müssen bestehen**

Run (aus `Frontend/`):
1. `npm run test -- --run` — Expected: PASS (alle, inkl. `bridgeContract.test.ts`)
2. `npm run lint` — Expected: 0 Warnings/Errors
3. `npm run build` — Expected: TypeScript-Check + Vite-Build erfolgreich

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/utils/searchTerms.ts Frontend/src/utils/searchTerms.test.ts Frontend/src/components/layout/Toolbar.tsx Frontend/src/services/bridge.ts Frontend/src/stores/slices/uiSlice.ts
git commit -m "Split global search input into terms for partial-match search"
```

---

### Task 8: Gesamtverifikation + Changelog

**Files:**
- Modify: `CHANGELOG.md` (Abschnitt `[Unreleased]`)

**Interfaces:**
- Consumes: alle vorherigen Tasks
- Produces: grüne Gesamtsuiten beider Seiten, dokumentierte Änderung

- [ ] **Step 1: Backend-Gesamtsuite**

Run (aus `Backend/`): `dotnet test TagFusion.sln`
Expected: PASS, 0 Failures.

- [ ] **Step 2: Frontend-Gesamtsuite + Lint + Build**

Run (aus `Frontend/`): `npm run test -- --run && npm run lint && npm run build`
Expected: PASS / 0 Warnings / Build OK.

- [ ] **Step 3: Changelog-Eintrag**

In `CHANGELOG.md` unter `## [Unreleased]` → `### Added` als erste Einträge ergänzen:

```markdown
- Global search matches partial tag names AND filenames, case-insensitive incl. umlauts; multiple terms are AND-combined (comma/space separated)
- Stale database entries (files deleted outside the app) are cleaned up automatically during global search; entries on unplugged drives are preserved
```

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md
git commit -m "Document global partial-match search in changelog"
```

---

## Hinweise für die Ausführung

- **Reihenfolge einhalten:** Tasks 1→6 bauen aufeinander auf (Spalte → Semantik → Dateiname → Delete → Cleaner → Handler). Task 7 braucht nur den unveränderten Bridge-Kontrakt und könnte parallel zu 4–6 laufen; im Zweifel sequenziell.
- **`lower_inv`-Registrierung** ist global (statischer Konstruktor) und wirkt auf alle danach geöffneten Verbindungen — auch die In-Memory-Test-DBs.
- **Nicht anfassen:** `bridge-actions.json`, `bridgeActions.ts`, `BridgeContractTests.cs` — es kommen keine neuen Actions hinzu.
- Der unveränderte Rest von `SearchImagesAsync` (Reader-Schleife, `GetTagsInternalAsync`-Nachladen) bleibt wie im Bestand; nur der Bedingungsaufbau ändert sich.
