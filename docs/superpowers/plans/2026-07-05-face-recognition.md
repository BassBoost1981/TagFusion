# Lokale Gesichtserkennung — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TagFusion erkennt Gesichter lokal (FaceAiSharp/ONNX, CPU), gruppiert sie, schlägt bekannte Personen vor und schreibt bestätigte Personennamen als Tags in die Bild-Metadaten.

**Architecture:** Neue Engine-Abstraktion `IFaceEngine` (FaceAiSharp dahinter gekapselt), Migration v4 (`Persons`/`Faces` + Scan-Spalten auf `Images`), serieller `FaceScanService` mit Progress/Completed-Events, reines `FaceMatcher`-Modul für Vorschläge/Clustering, neuer `FaceHandler` mit 7 Bridge-Actions, React-Review-Panel. Spec: `docs/superpowers/specs/2026-07-05-face-recognition-design.md`.

**Tech Stack:** .NET 8 / C# 12, FaceAiSharp.Bundle 0.6.35 (SCRFD + ArcFace via ONNX Runtime, MIT), SixLabors.ImageSharp 3.x, System.Data.SQLite, NUnit + Moq; React/TypeScript, Zustand, i18next, Vitest.

## Global Constraints

- **Bridge-Kontrakt:** Bestehende Actions/Signaturen unverändert. NEUE Actions sind erlaubt und werden in `bridge-actions.json`, `Frontend/src/services/bridgeActions.ts` UND beiden Contract-Tests ergänzt (alphabetisch sortiert, wie die Dateien es vorleben).
- **C#:** Alle I/O async/await; `SemaphoreSlim`/`Interlocked`, niemals `lock`; private Felder `_camelCase`; Interfaces `I`-Präfix; Async-Methoden `Async`-Suffix; DTOs als `record`.
- **Kommentare:** Englisch + Deutsch (dual), wie im Bestand. **UI-Texte/Fehlermeldungen: Deutsch** (i18n: `Frontend/src/locales/de/common.json` ist Standard, `en/common.json` wird mitgepflegt).
- **TypeScript:** strict; ESLint `--max-warnings 0`.
- **Tests:** Backend `dotnet test TagFusion.sln` aus `Backend/`; Frontend `npm run test -- --run` aus `Frontend/`. Testausgabe muss warnungsfrei sein.
- **Schwellenwerte (Spec):** `SuggestionThreshold = 0.50`, `ClusterThreshold = 0.55` — benannte Konstanten in `FaceMatcher`.
- **Face-Status-Strings (Spec):** `unnamed | suggested | confirmed | ignored`.
- **Commit-Stil:** Imperativer englischer Einzeiler.
- **Die Engine ist optional:** Fehlende Modelle dürfen die App NIE am Start hindern (`IsAvailable = false`, Feature deaktiviert).

---

### Task 1: Migration v4 — Persons/Faces-Tabellen + Scan-Spalten

**Files:**
- Modify: `Backend/TagFusion/Database/MigrationRunner.cs` (Migrations-Array ~Zeile 24, neue private Methode)
- Test: `Backend/TagFusion.Tests/Database/MigrationRunnerTests.cs`

**Interfaces:**
- Consumes: v3-Helfer `TableExists(connection, transaction, name)` und `ColumnExists(connection, transaction, table, column)` (existieren seit Feature 1)
- Produces: Tabellen `Persons`, `Faces` (Schema siehe unten); Spalten `Images.FaceScanAt TEXT`, `Images.FaceScanFileTime TEXT`; Helfer `AddColumnIfMissing`

Wie bei v3 gilt: `MigrationRunnerTests` laufen teils auf nackten Verbindungen ohne `Images`-Tabelle — die `ALTER TABLE Images`-Schritte müssen deshalb in einen guarded C#-`DataStep`. Die `CREATE TABLE IF NOT EXISTS`-Statements sind von sich aus idempotent und können ins SQL-Feld.

- [ ] **Step 1: Failing Tests schreiben**

In `MigrationRunnerTests.cs` ergänzen:

```csharp
[Test]
public void MigrationV4_CreatesPersonsAndFacesTables()
{
    new MigrationRunner(_connection, NullLogger.Instance).ApplyMigrations();

    using var cmd = _connection.CreateCommand();
    cmd.CommandText = "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('Persons','Faces')";
    Assert.That(Convert.ToInt32(cmd.ExecuteScalar()), Is.EqualTo(2));
}

[Test]
public void MigrationV4_AddsFaceScanColumnsWhenImagesTableExists()
{
    // Simulate an existing Images table (post-v3 shape, FileName included).
    // Simuliert eine bestehende Images-Tabelle (Stand nach v3, mit FileName).
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
    check.CommandText = "SELECT COUNT(*) FROM pragma_table_info('Images') WHERE name IN ('FaceScanAt','FaceScanFileTime')";
    Assert.That(Convert.ToInt32(check.ExecuteScalar()), Is.EqualTo(2));
}
```

- [ ] **Step 2: Tests ausführen — müssen fehlschlagen**

Run (aus `Backend/`): `dotnet test TagFusion.sln --filter "FullyQualifiedName~MigrationRunnerTests"`
Expected: FAIL — beide neuen Tests (v4 existiert nicht; `Persons`/`Faces` fehlen).

- [ ] **Step 3: Implementierung**

Im Migrations-Array nach dem v3-Eintrag ergänzen:

```csharp
new(4, "Persons/Faces tables and face-scan columns on Images — local face recognition",
    @"CREATE TABLE IF NOT EXISTS Persons (
        Id INTEGER PRIMARY KEY AUTOINCREMENT,
        Name TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS Faces (
        Id INTEGER PRIMARY KEY AUTOINCREMENT,
        ImageId INTEGER NOT NULL,
        X REAL NOT NULL, Y REAL NOT NULL, W REAL NOT NULL, H REAL NOT NULL,
        Embedding BLOB NOT NULL,
        PersonId INTEGER,
        SuggestedPersonId INTEGER,
        SuggestionScore REAL,
        RejectedPersonId INTEGER,
        Status TEXT NOT NULL DEFAULT 'unnamed',
        ScannedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_faces_imageid ON Faces(ImageId);
    CREATE INDEX IF NOT EXISTS idx_faces_status ON Faces(Status);",
    AddFaceScanColumnsToImages)
```

Neue private Methoden (unter `AddFileNameColumnAndBackfill` einordnen):

```csharp
/// <summary>
/// Adds the face-scan bookkeeping columns to Images. Skips gracefully when the
/// Images table is absent (bare test connections) or the columns already exist.
/// Ergänzt die Face-Scan-Spalten auf Images — tolerant gegenüber fehlender
/// Tabelle (nackte Test-Verbindungen) und bereits vorhandenen Spalten.
/// </summary>
private static void AddFaceScanColumnsToImages(SQLiteConnection connection, SQLiteTransaction transaction)
{
    if (!TableExists(connection, transaction, "Images")) return;
    AddColumnIfMissing(connection, transaction, "Images", "FaceScanAt", "TEXT");
    AddColumnIfMissing(connection, transaction, "Images", "FaceScanFileTime", "TEXT");
}

private static void AddColumnIfMissing(SQLiteConnection connection, SQLiteTransaction transaction, string table, string column, string type)
{
    if (ColumnExists(connection, transaction, table, column)) return;
    using var alter = connection.CreateCommand();
    alter.Transaction = transaction;
    alter.CommandText = $"ALTER TABLE {table} ADD COLUMN {column} {type}";
    alter.ExecuteNonQuery();
}
```

- [ ] **Step 4: Tests ausführen — müssen bestehen**

Run: `dotnet test TagFusion.sln`
Expected: PASS komplett (die Bestandstests `ApplyMigrations_*` decken automatisch ab, dass v4 auf nackten Verbindungen und bei Doppel-Lauf nicht scheitert; `AdvancesVersionToLatest` prüft gegen `Migrations.Length`).

- [ ] **Step 5: Commit**

```bash
git add Backend/TagFusion/Database/MigrationRunner.cs Backend/TagFusion.Tests/Database/MigrationRunnerTests.cs
git commit -m "Add Persons and Faces tables via migration v4"
```

---

### Task 2: Face-Persistenz — Models, EmbeddingConverter, Save/Get/Delete

**Files:**
- Create: `Backend/TagFusion/Models/FaceModels.cs`
- Create: `Backend/TagFusion/Database/EmbeddingConverter.cs`
- Modify: `Backend/TagFusion/Database/IDatabaseService.cs`
- Modify: `Backend/TagFusion/Services/DatabaseService.cs` (neue Methoden + `DeleteImagesAsync` erweitern)
- Test: `Backend/TagFusion.Tests/Services/DatabaseServiceTests.cs`

**Interfaces:**
- Consumes: Task 1 (Tabellen/Spalten), bestehende Muster `_writeSemaphore`/`_readSemaphore`, `ParseStoredDateTime`
- Produces (spätere Tasks verlassen sich exakt hierauf):
  - `record NewFace(float X, float Y, float W, float H, float[] Embedding)`
  - `record StoredFace(long Id, long ImageId, string ImagePath, float X, float Y, float W, float H, float[] Embedding, long? PersonId, long? SuggestedPersonId, double? SuggestionScore, long? RejectedPersonId, string Status)`
  - `record PersonInfo(long Id, string Name, int FaceCount)` und `record FaceSuggestionUpdate(long FaceId, long PersonId, double Score)`
  - `static class FaceStatus { Unnamed, Suggested, Confirmed, Ignored }` (String-Konstanten)
  - `EmbeddingConverter.ToBytes(float[]) : byte[]` / `EmbeddingConverter.ToFloats(byte[]) : float[]`
  - `Task SaveFacesAsync(string imagePath, IReadOnlyList<NewFace> faces, DateTime fileLastWriteUtc, CancellationToken cancellationToken = default)`
  - `Task<Dictionary<string, string>> GetFaceScanTimesAsync(List<string> paths, CancellationToken cancellationToken = default)` — Pfad → gespeicherte `FaceScanFileTime` (ISO-String), nur für gescannte Bilder
  - `Task<List<StoredFace>> GetFacesForFolderAsync(string folderPath, CancellationToken cancellationToken = default)` — nur Bilder DIREKT im Ordner (nicht rekursiv)
  - `Task<List<StoredFace>> GetFacesByIdsAsync(List<long> faceIds, CancellationToken cancellationToken = default)`

- [ ] **Step 1: Models und Converter anlegen (kein Test nötig für reine Records)**

`Backend/TagFusion/Models/FaceModels.cs`:

```csharp
namespace TagFusion.Models;

/// <summary>A face detected in an image, ready to persist. Coordinates in original image pixels.
/// Ein erkanntes Gesicht, bereit zum Speichern. Koordinaten in Originalpixeln.</summary>
public record NewFace(float X, float Y, float W, float H, float[] Embedding);

/// <summary>A stored face row joined with its image path.
/// Eine gespeicherte Faces-Zeile inklusive Bildpfad.</summary>
public record StoredFace(
    long Id, long ImageId, string ImagePath,
    float X, float Y, float W, float H,
    float[] Embedding,
    long? PersonId, long? SuggestedPersonId, double? SuggestionScore, long? RejectedPersonId,
    string Status);

/// <summary>A person with the count of confirmed faces.</summary>
public record PersonInfo(long Id, string Name, int FaceCount);

/// <summary>A computed suggestion to persist after matching.</summary>
public record FaceSuggestionUpdate(long FaceId, long PersonId, double Score);

/// <summary>Face status values as stored in SQLite. / Status-Werte wie in SQLite gespeichert.</summary>
public static class FaceStatus
{
    public const string Unnamed = "unnamed";
    public const string Suggested = "suggested";
    public const string Confirmed = "confirmed";
    public const string Ignored = "ignored";
}
```

`Backend/TagFusion/Database/EmbeddingConverter.cs`:

```csharp
namespace TagFusion.Database;

/// <summary>
/// Converts float[] embeddings to/from the BLOB format stored in SQLite
/// (float32 array, platform endianness — the DB never leaves this machine's format family).
/// Konvertiert Embeddings zwischen float[] und dem SQLite-BLOB-Format.
/// </summary>
public static class EmbeddingConverter
{
    public static byte[] ToBytes(float[] embedding)
    {
        var bytes = new byte[embedding.Length * sizeof(float)];
        Buffer.BlockCopy(embedding, 0, bytes, 0, bytes.Length);
        return bytes;
    }

    public static float[] ToFloats(byte[] bytes)
    {
        var floats = new float[bytes.Length / sizeof(float)];
        Buffer.BlockCopy(bytes, 0, floats, 0, bytes.Length);
        return floats;
    }
}
```

- [ ] **Step 2: Failing Tests schreiben**

In `DatabaseServiceTests.cs` neue Region (vor dem `CreateTestImage`-Helper):

```csharp
// ========================================================================
// Faces — Persistenz / persistence
// ========================================================================

private static NewFace TestFace(float x = 10, float y = 20, float seed = 1f)
{
    var embedding = new float[512];
    embedding[0] = seed; // deterministic, distinguishable / deterministisch unterscheidbar
    return new NewFace(x, y, 100, 120, embedding);
}

[Test]
public async Task SaveFaces_RoundTripsThroughFolderQuery()
{
    var mtime = new DateTime(2026, 7, 1, 12, 0, 0, DateTimeKind.Utc);
    await _db.SaveFacesAsync("C:\\fotos\\a.jpg", new[] { TestFace(seed: 0.7f) }, mtime);

    var faces = await _db.GetFacesForFolderAsync("C:\\fotos");

    Assert.That(faces, Has.Count.EqualTo(1));
    Assert.That(faces[0].ImagePath, Is.EqualTo("C:\\fotos\\a.jpg"));
    Assert.That(faces[0].Status, Is.EqualTo(FaceStatus.Unnamed));
    Assert.That(faces[0].Embedding[0], Is.EqualTo(0.7f));
    Assert.That(faces[0].W, Is.EqualTo(100));
}

[Test]
public async Task SaveFaces_Rescan_ReplacesOldFaces()
{
    var mtime = DateTime.UtcNow;
    await _db.SaveFacesAsync("C:\\fotos\\a.jpg", new[] { TestFace(), TestFace(x: 200) }, mtime);
    await _db.SaveFacesAsync("C:\\fotos\\a.jpg", new[] { TestFace(x: 300) }, mtime);

    var faces = await _db.GetFacesForFolderAsync("C:\\fotos");
    Assert.That(faces, Has.Count.EqualTo(1));
    Assert.That(faces[0].X, Is.EqualTo(300));
}

[Test]
public async Task SaveFaces_ImageRowIsCreatedIfMissing_AndScanTimeStored()
{
    var mtime = new DateTime(2026, 7, 1, 12, 0, 0, DateTimeKind.Utc);
    await _db.SaveFacesAsync("C:\\neu\\x.jpg", Array.Empty<NewFace>(), mtime);

    var times = await _db.GetFaceScanTimesAsync(new List<string> { "C:\\neu\\x.jpg", "C:\\neu\\niegescannt.jpg" });

    Assert.That(times, Has.Count.EqualTo(1));
    Assert.That(times["C:\\neu\\x.jpg"], Is.EqualTo(mtime.ToString("o")));
}

[Test]
public async Task GetFacesForFolder_IsNotRecursive()
{
    var mtime = DateTime.UtcNow;
    await _db.SaveFacesAsync("C:\\fotos\\a.jpg", new[] { TestFace() }, mtime);
    await _db.SaveFacesAsync("C:\\fotos\\sub\\b.jpg", new[] { TestFace() }, mtime);

    var faces = await _db.GetFacesForFolderAsync("C:\\fotos");
    Assert.That(faces, Has.Count.EqualTo(1));
    Assert.That(faces[0].ImagePath, Is.EqualTo("C:\\fotos\\a.jpg"));
}

[Test]
public async Task GetFacesByIds_ReturnsRequestedFaces()
{
    await _db.SaveFacesAsync("C:\\fotos\\a.jpg", new[] { TestFace(), TestFace(x: 200) }, DateTime.UtcNow);
    var all = await _db.GetFacesForFolderAsync("C:\\fotos");

    var byIds = await _db.GetFacesByIdsAsync(new List<long> { all[0].Id });
    Assert.That(byIds, Has.Count.EqualTo(1));
    Assert.That(byIds[0].Id, Is.EqualTo(all[0].Id));
}

[Test]
public async Task DeleteImages_AlsoRemovesFaces()
{
    await _db.SaveFacesAsync("C:\\fotos\\weg.jpg", new[] { TestFace() }, DateTime.UtcNow);

    await _db.DeleteImagesAsync(new List<string> { "C:\\fotos\\weg.jpg" });

    var faces = await _db.GetFacesForFolderAsync("C:\\fotos");
    Assert.That(faces, Is.Empty);
}
```

- [ ] **Step 3: Tests ausführen — müssen fehlschlagen**

Run: `dotnet test TagFusion.sln --filter "FullyQualifiedName~DatabaseServiceTests"`
Expected: FAIL — Compile-Error (Methoden existieren nicht).

- [ ] **Step 4: Implementierung**

`IDatabaseService.cs` — am Ende des Interface ergänzen:

```csharp
/// <summary>
/// Replace all faces of an image and record the scan time. Creates a minimal
/// Images row when the image is not indexed yet.
/// Ersetzt alle Gesichter eines Bildes und vermerkt den Scan-Zeitpunkt; legt
/// bei Bedarf eine minimale Images-Zeile an.
/// </summary>
Task SaveFacesAsync(string imagePath, IReadOnlyList<NewFace> faces, DateTime fileLastWriteUtc, CancellationToken cancellationToken = default);

/// <summary>Map path → stored FaceScanFileTime (ISO) for already-scanned images.</summary>
Task<Dictionary<string, string>> GetFaceScanTimesAsync(List<string> paths, CancellationToken cancellationToken = default);

/// <summary>Faces of images directly inside the folder (not recursive).</summary>
Task<List<StoredFace>> GetFacesForFolderAsync(string folderPath, CancellationToken cancellationToken = default);

/// <summary>Load specific faces by id. / Lädt Gesichter per Id.</summary>
Task<List<StoredFace>> GetFacesByIdsAsync(List<long> faceIds, CancellationToken cancellationToken = default);
```

`DatabaseService.cs` — neue Methoden (Muster: Schreiben über `_writeSemaphore` + Transaktion, Lesen über `_readSemaphore`):

```csharp
public async Task SaveFacesAsync(string imagePath, IReadOnlyList<NewFace> faces, DateTime fileLastWriteUtc, CancellationToken cancellationToken = default)
{
    await _writeSemaphore.WaitAsync(cancellationToken);
    try
    {
        using var transaction = _connection.BeginTransaction();
        try
        {
            // Ensure the Images row exists; a face scan may hit images never browsed before.
            // Stellt die Images-Zeile sicher — der Scan kann Bilder vor dem ersten Browsen treffen.
            long imageId;
            using (var ensure = _connection.CreateCommand())
            {
                ensure.Transaction = transaction;
                ensure.CommandText = @"
                    INSERT INTO Images (Path, FileName, LastModified) VALUES (@Path, @FileName, @LastModified)
                    ON CONFLICT(Path) DO NOTHING;
                    SELECT Id FROM Images WHERE Path = @Path;";
                ensure.Parameters.AddWithValue("@Path", imagePath);
                ensure.Parameters.AddWithValue("@FileName", Path.GetFileName(imagePath));
                ensure.Parameters.AddWithValue("@LastModified", fileLastWriteUtc.ToString("o"));
                imageId = (long)(await ensure.ExecuteScalarAsync(cancellationToken))!;
            }

            using (var del = _connection.CreateCommand())
            {
                del.Transaction = transaction;
                del.CommandText = "DELETE FROM Faces WHERE ImageId = @ImageId";
                del.Parameters.AddWithValue("@ImageId", imageId);
                await del.ExecuteNonQueryAsync(cancellationToken);
            }

            using (var ins = _connection.CreateCommand())
            {
                ins.Transaction = transaction;
                ins.CommandText = @"
                    INSERT INTO Faces (ImageId, X, Y, W, H, Embedding, Status, ScannedAt)
                    VALUES (@ImageId, @X, @Y, @W, @H, @Embedding, @Status, @ScannedAt)";
                var pImg = ins.Parameters.Add("@ImageId", System.Data.DbType.Int64);
                var pX = ins.Parameters.Add("@X", System.Data.DbType.Single);
                var pY = ins.Parameters.Add("@Y", System.Data.DbType.Single);
                var pW = ins.Parameters.Add("@W", System.Data.DbType.Single);
                var pH = ins.Parameters.Add("@H", System.Data.DbType.Single);
                var pEmb = ins.Parameters.Add("@Embedding", System.Data.DbType.Binary);
                var pStatus = ins.Parameters.Add("@Status", System.Data.DbType.String);
                var pAt = ins.Parameters.Add("@ScannedAt", System.Data.DbType.String);

                var now = DateTime.UtcNow.ToString("o");
                foreach (var face in faces)
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    pImg.Value = imageId;
                    pX.Value = face.X; pY.Value = face.Y; pW.Value = face.W; pH.Value = face.H;
                    pEmb.Value = EmbeddingConverter.ToBytes(face.Embedding);
                    pStatus.Value = FaceStatus.Unnamed;
                    pAt.Value = now;
                    await ins.ExecuteNonQueryAsync(cancellationToken);
                }
            }

            using (var mark = _connection.CreateCommand())
            {
                mark.Transaction = transaction;
                mark.CommandText = "UPDATE Images SET FaceScanAt = @At, FaceScanFileTime = @FileTime WHERE Id = @Id";
                mark.Parameters.AddWithValue("@At", DateTime.UtcNow.ToString("o"));
                mark.Parameters.AddWithValue("@FileTime", fileLastWriteUtc.ToString("o"));
                mark.Parameters.AddWithValue("@Id", imageId);
                await mark.ExecuteNonQueryAsync(cancellationToken);
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

public async Task<Dictionary<string, string>> GetFaceScanTimesAsync(List<string> paths, CancellationToken cancellationToken = default)
{
    var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    if (paths.Count == 0) return result;

    await _readSemaphore.WaitAsync(cancellationToken);
    try
    {
        for (int i = 0; i < paths.Count; i += _chunkSize)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var chunk = paths.Skip(i).Take(_chunkSize).ToList();
            var placeholders = string.Join(",", chunk.Select((_, idx) => $"@p{idx}"));

            using var cmd = _readConnection.CreateCommand();
            cmd.CommandText = $"SELECT Path, FaceScanFileTime FROM Images WHERE FaceScanFileTime IS NOT NULL AND Path IN ({placeholders})";
            for (int j = 0; j < chunk.Count; j++) cmd.Parameters.AddWithValue($"@p{j}", chunk[j]);

            using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
                result[reader.GetString(0)] = reader.GetString(1);
        }
        return result;
    }
    finally
    {
        _readSemaphore.Release();
    }
}

private const string FaceSelectColumns = @"
    f.Id, f.ImageId, i.Path, f.X, f.Y, f.W, f.H, f.Embedding,
    f.PersonId, f.SuggestedPersonId, f.SuggestionScore, f.RejectedPersonId, f.Status";

private static StoredFace ReadStoredFace(System.Data.Common.DbDataReader reader)
{
    return new StoredFace(
        reader.GetInt64(0),
        reader.GetInt64(1),
        reader.GetString(2),
        reader.GetFloat(3), reader.GetFloat(4), reader.GetFloat(5), reader.GetFloat(6),
        EmbeddingConverter.ToFloats((byte[])reader[7]),
        reader.IsDBNull(8) ? null : reader.GetInt64(8),
        reader.IsDBNull(9) ? null : reader.GetInt64(9),
        reader.IsDBNull(10) ? null : reader.GetDouble(10),
        reader.IsDBNull(11) ? null : reader.GetInt64(11),
        reader.GetString(12));
}

public async Task<List<StoredFace>> GetFacesForFolderAsync(string folderPath, CancellationToken cancellationToken = default)
{
    var results = new List<StoredFace>();
    var normalized = folderPath.TrimEnd('\\');

    await _readSemaphore.WaitAsync(cancellationToken);
    try
    {
        using var cmd = _readConnection.CreateCommand();
        // Prefix match in SQL, exact parent-directory check in C# (non-recursive).
        // SQL-Präfixfilter, exakter Verzeichnis-Check in C# (nicht rekursiv).
        cmd.CommandText = $@"
            SELECT {FaceSelectColumns}
            FROM Faces f JOIN Images i ON f.ImageId = i.Id
            WHERE i.Path LIKE @Prefix ESCAPE '\'";
        cmd.Parameters.AddWithValue("@Prefix", EscapeLikePattern(normalized) + "\\%");

        using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            var face = ReadStoredFace(reader);
            if (string.Equals(Path.GetDirectoryName(face.ImagePath), normalized, StringComparison.OrdinalIgnoreCase))
                results.Add(face);
        }
        return results;
    }
    finally
    {
        _readSemaphore.Release();
    }
}

public async Task<List<StoredFace>> GetFacesByIdsAsync(List<long> faceIds, CancellationToken cancellationToken = default)
{
    var results = new List<StoredFace>();
    if (faceIds.Count == 0) return results;

    await _readSemaphore.WaitAsync(cancellationToken);
    try
    {
        for (int i = 0; i < faceIds.Count; i += _chunkSize)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var chunk = faceIds.Skip(i).Take(_chunkSize).ToList();
            var placeholders = string.Join(",", chunk.Select((_, idx) => $"@p{idx}"));

            using var cmd = _readConnection.CreateCommand();
            cmd.CommandText = $@"
                SELECT {FaceSelectColumns}
                FROM Faces f JOIN Images i ON f.ImageId = i.Id
                WHERE f.Id IN ({placeholders})";
            for (int j = 0; j < chunk.Count; j++) cmd.Parameters.AddWithValue($"@p{j}", chunk[j]);

            using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
                results.Add(ReadStoredFace(reader));
        }
        return results;
    }
    finally
    {
        _readSemaphore.Release();
    }
}
```

In `DeleteImagesAsync` VOR dem `ImageTags`-Delete ein drittes vorbereitetes Kommando ergänzen (gleiches Muster wie `linkCmd`):

```csharp
using var faceCmd = _connection.CreateCommand();
faceCmd.Transaction = transaction;
faceCmd.CommandText = "DELETE FROM Faces WHERE ImageId IN (SELECT Id FROM Images WHERE Path = @Path)";
var faceParam = faceCmd.Parameters.Add("@Path", System.Data.DbType.String);
```

und in der Schleife vor den bestehenden zwei Ausführungen:

```csharp
faceParam.Value = path;
await faceCmd.ExecuteNonQueryAsync(cancellationToken);
```

Benötigte usings prüfen: `DatabaseServiceTests.cs` braucht ggf. `using TagFusion.Database;` (für `EmbeddingConverter`, falls direkt genutzt) — `TagFusion.Models` ist schon da.

- [ ] **Step 5: Tests ausführen — müssen bestehen**

Run: `dotnet test TagFusion.sln`
Expected: PASS komplett.

- [ ] **Step 6: Commit**

```bash
git add Backend/TagFusion/Models/FaceModels.cs Backend/TagFusion/Database/EmbeddingConverter.cs Backend/TagFusion/Database/IDatabaseService.cs Backend/TagFusion/Services/DatabaseService.cs Backend/TagFusion.Tests/Services/DatabaseServiceTests.cs
git commit -m "Add face persistence with embedding storage"
```

---

### Task 3: Personen & Status-Übergänge (DB)

**Files:**
- Modify: `Backend/TagFusion/Database/IDatabaseService.cs`
- Modify: `Backend/TagFusion/Services/DatabaseService.cs`
- Test: `Backend/TagFusion.Tests/Services/DatabaseServiceTests.cs`

**Interfaces:**
- Consumes: Task 2 (Models, `SaveFacesAsync`, `GetFacesForFolderAsync`)
- Produces:
  - `Task<List<PersonInfo>> GetPersonsAsync(CancellationToken cancellationToken = default)`
  - `Task<long> GetOrCreatePersonAsync(string name, CancellationToken cancellationToken = default)`
  - `Task AssignFacesToPersonAsync(List<long> faceIds, long personId, CancellationToken cancellationToken = default)` — setzt `PersonId`, `Status='confirmed'`, löscht `SuggestedPersonId`/`SuggestionScore`
  - `Task RejectFaceSuggestionsAsync(List<long> faceIds, CancellationToken cancellationToken = default)` — `RejectedPersonId = SuggestedPersonId`, Vorschlag gelöscht, `Status='unnamed'` (nur Zeilen mit Status `suggested`)
  - `Task SetFacesIgnoredAsync(List<long> faceIds, CancellationToken cancellationToken = default)`
  - `Task<Dictionary<long, List<float[]>>> GetConfirmedEmbeddingsByPersonAsync(CancellationToken cancellationToken = default)`
  - `Task ApplyFaceSuggestionsAsync(IReadOnlyList<FaceSuggestionUpdate> suggestions, CancellationToken cancellationToken = default)` — setzt `suggested`-Status nur auf Zeilen, die noch `unnamed` sind

- [ ] **Step 1: Failing Tests schreiben**

```csharp
// ========================================================================
// Persons & Face-Status
// ========================================================================

[Test]
public async Task GetOrCreatePerson_IsIdempotent()
{
    var id1 = await _db.GetOrCreatePersonAsync("Max");
    var id2 = await _db.GetOrCreatePersonAsync("Max");
    Assert.That(id2, Is.EqualTo(id1));

    var persons = await _db.GetPersonsAsync();
    Assert.That(persons, Has.Count.EqualTo(1));
    Assert.That(persons[0].Name, Is.EqualTo("Max"));
}

[Test]
public async Task AssignFaces_SetsConfirmedAndClearsSuggestion()
{
    await _db.SaveFacesAsync("C:\\f\\a.jpg", new[] { TestFace() }, DateTime.UtcNow);
    var face = (await _db.GetFacesForFolderAsync("C:\\f"))[0];
    var personId = await _db.GetOrCreatePersonAsync("Max");
    await _db.ApplyFaceSuggestionsAsync(new[] { new FaceSuggestionUpdate(face.Id, personId, 0.8) });

    await _db.AssignFacesToPersonAsync(new List<long> { face.Id }, personId);

    var after = (await _db.GetFacesByIdsAsync(new List<long> { face.Id }))[0];
    Assert.That(after.Status, Is.EqualTo(FaceStatus.Confirmed));
    Assert.That(after.PersonId, Is.EqualTo(personId));
    Assert.That(after.SuggestedPersonId, Is.Null);

    var persons = await _db.GetPersonsAsync();
    Assert.That(persons[0].FaceCount, Is.EqualTo(1));
}

[Test]
public async Task RejectSuggestion_RemembersRejectedPerson()
{
    await _db.SaveFacesAsync("C:\\f\\a.jpg", new[] { TestFace() }, DateTime.UtcNow);
    var face = (await _db.GetFacesForFolderAsync("C:\\f"))[0];
    var personId = await _db.GetOrCreatePersonAsync("Max");
    await _db.ApplyFaceSuggestionsAsync(new[] { new FaceSuggestionUpdate(face.Id, personId, 0.8) });

    await _db.RejectFaceSuggestionsAsync(new List<long> { face.Id });

    var after = (await _db.GetFacesByIdsAsync(new List<long> { face.Id }))[0];
    Assert.That(after.Status, Is.EqualTo(FaceStatus.Unnamed));
    Assert.That(after.SuggestedPersonId, Is.Null);
    Assert.That(after.RejectedPersonId, Is.EqualTo(personId));
}

[Test]
public async Task ApplySuggestions_OnlyTouchesUnnamedFaces()
{
    await _db.SaveFacesAsync("C:\\f\\a.jpg", new[] { TestFace(), TestFace(x: 200) }, DateTime.UtcNow);
    var faces = await _db.GetFacesForFolderAsync("C:\\f");
    var personId = await _db.GetOrCreatePersonAsync("Max");
    await _db.SetFacesIgnoredAsync(new List<long> { faces[0].Id });

    await _db.ApplyFaceSuggestionsAsync(new[]
    {
        new FaceSuggestionUpdate(faces[0].Id, personId, 0.9),  // ignored — must stay ignored
        new FaceSuggestionUpdate(faces[1].Id, personId, 0.9),
    });

    var after = await _db.GetFacesByIdsAsync(faces.Select(f => f.Id).ToList());
    Assert.That(after.Single(f => f.Id == faces[0].Id).Status, Is.EqualTo(FaceStatus.Ignored));
    Assert.That(after.Single(f => f.Id == faces[1].Id).Status, Is.EqualTo(FaceStatus.Suggested));
}

[Test]
public async Task GetConfirmedEmbeddingsByPerson_GroupsCorrectly()
{
    await _db.SaveFacesAsync("C:\\f\\a.jpg", new[] { TestFace(seed: 0.1f), TestFace(x: 200, seed: 0.2f) }, DateTime.UtcNow);
    var faces = await _db.GetFacesForFolderAsync("C:\\f");
    var max = await _db.GetOrCreatePersonAsync("Max");
    await _db.AssignFacesToPersonAsync(faces.Select(f => f.Id).ToList(), max);

    var byPerson = await _db.GetConfirmedEmbeddingsByPersonAsync();

    Assert.That(byPerson, Has.Count.EqualTo(1));
    Assert.That(byPerson[max], Has.Count.EqualTo(2));
}
```

- [ ] **Step 2: Tests ausführen — müssen fehlschlagen**

Run: `dotnet test TagFusion.sln --filter "FullyQualifiedName~DatabaseServiceTests"`
Expected: FAIL — Compile-Error.

- [ ] **Step 3: Implementierung**

`IDatabaseService.cs` (mit dualen Doku-Kommentaren wie im Bestand, sinngemäß zu den Produces-Beschreibungen oben) und `DatabaseService.cs`:

```csharp
public async Task<List<PersonInfo>> GetPersonsAsync(CancellationToken cancellationToken = default)
{
    var persons = new List<PersonInfo>();
    await _readSemaphore.WaitAsync(cancellationToken);
    try
    {
        using var cmd = _readConnection.CreateCommand();
        cmd.CommandText = @"
            SELECT p.Id, p.Name, COUNT(f.Id)
            FROM Persons p
            LEFT JOIN Faces f ON f.PersonId = p.Id AND f.Status = 'confirmed'
            GROUP BY p.Id, p.Name
            ORDER BY p.Name";
        using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
            persons.Add(new PersonInfo(reader.GetInt64(0), reader.GetString(1), reader.GetInt32(2)));
        return persons;
    }
    finally { _readSemaphore.Release(); }
}

public async Task<long> GetOrCreatePersonAsync(string name, CancellationToken cancellationToken = default)
{
    await _writeSemaphore.WaitAsync(cancellationToken);
    try
    {
        using var cmd = _connection.CreateCommand();
        cmd.CommandText = "INSERT OR IGNORE INTO Persons (Name) VALUES (@Name); SELECT Id FROM Persons WHERE Name = @Name;";
        cmd.Parameters.AddWithValue("@Name", name);
        return (long)(await cmd.ExecuteScalarAsync(cancellationToken))!;
    }
    finally { _writeSemaphore.Release(); }
}

/// <summary>Run one UPDATE per face id inside a single transaction. / Ein UPDATE pro Face-Id in einer Transaktion.</summary>
private async Task UpdateFacesAsync(List<long> faceIds, string setClause, Action<SQLiteCommand>? addParams, CancellationToken cancellationToken)
{
    if (faceIds.Count == 0) return;
    await _writeSemaphore.WaitAsync(cancellationToken);
    try
    {
        using var transaction = _connection.BeginTransaction();
        try
        {
            using var cmd = _connection.CreateCommand();
            cmd.Transaction = transaction;
            cmd.CommandText = $"UPDATE Faces SET {setClause} WHERE Id = @Id";
            addParams?.Invoke(cmd);
            var idParam = cmd.Parameters.Add("@Id", System.Data.DbType.Int64);
            foreach (var id in faceIds)
            {
                cancellationToken.ThrowIfCancellationRequested();
                idParam.Value = id;
                await cmd.ExecuteNonQueryAsync(cancellationToken);
            }
            transaction.Commit();
        }
        catch { transaction.Rollback(); throw; }
    }
    finally { _writeSemaphore.Release(); }
}

public Task AssignFacesToPersonAsync(List<long> faceIds, long personId, CancellationToken cancellationToken = default)
    => UpdateFacesAsync(faceIds,
        "PersonId = @PersonId, Status = 'confirmed', SuggestedPersonId = NULL, SuggestionScore = NULL",
        cmd => cmd.Parameters.AddWithValue("@PersonId", personId),
        cancellationToken);

public Task RejectFaceSuggestionsAsync(List<long> faceIds, CancellationToken cancellationToken = default)
    => UpdateFacesAsync(faceIds,
        "RejectedPersonId = SuggestedPersonId, SuggestedPersonId = NULL, SuggestionScore = NULL, Status = 'unnamed'",
        addParams: null,
        cancellationToken);

public Task SetFacesIgnoredAsync(List<long> faceIds, CancellationToken cancellationToken = default)
    => UpdateFacesAsync(faceIds,
        "Status = 'ignored', SuggestedPersonId = NULL, SuggestionScore = NULL",
        addParams: null,
        cancellationToken);

public async Task<Dictionary<long, List<float[]>>> GetConfirmedEmbeddingsByPersonAsync(CancellationToken cancellationToken = default)
{
    var result = new Dictionary<long, List<float[]>>();
    await _readSemaphore.WaitAsync(cancellationToken);
    try
    {
        using var cmd = _readConnection.CreateCommand();
        cmd.CommandText = "SELECT PersonId, Embedding FROM Faces WHERE Status = 'confirmed' AND PersonId IS NOT NULL";
        using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            var personId = reader.GetInt64(0);
            if (!result.TryGetValue(personId, out var list))
                result[personId] = list = new List<float[]>();
            list.Add(EmbeddingConverter.ToFloats((byte[])reader[1]));
        }
        return result;
    }
    finally { _readSemaphore.Release(); }
}

public async Task ApplyFaceSuggestionsAsync(IReadOnlyList<FaceSuggestionUpdate> suggestions, CancellationToken cancellationToken = default)
{
    if (suggestions.Count == 0) return;
    await _writeSemaphore.WaitAsync(cancellationToken);
    try
    {
        using var transaction = _connection.BeginTransaction();
        try
        {
            using var cmd = _connection.CreateCommand();
            cmd.Transaction = transaction;
            // Only faces still unnamed take a suggestion — never overwrite user decisions.
            // Nur unbenannte Gesichter erhalten Vorschläge — Nutzerentscheidungen bleiben unberührt.
            cmd.CommandText = @"
                UPDATE Faces SET Status = 'suggested', SuggestedPersonId = @PersonId, SuggestionScore = @Score
                WHERE Id = @Id AND Status = 'unnamed'";
            var pPerson = cmd.Parameters.Add("@PersonId", System.Data.DbType.Int64);
            var pScore = cmd.Parameters.Add("@Score", System.Data.DbType.Double);
            var pId = cmd.Parameters.Add("@Id", System.Data.DbType.Int64);
            foreach (var s in suggestions)
            {
                cancellationToken.ThrowIfCancellationRequested();
                pPerson.Value = s.PersonId; pScore.Value = s.Score; pId.Value = s.FaceId;
                await cmd.ExecuteNonQueryAsync(cancellationToken);
            }
            transaction.Commit();
        }
        catch { transaction.Rollback(); throw; }
    }
    finally { _writeSemaphore.Release(); }
}
```

Hinweis: `UpdateFacesAsync` braucht `using System.Data.SQLite;` — ist in `DatabaseService.cs` bereits vorhanden.

- [ ] **Step 4: Tests ausführen — müssen bestehen**

Run: `dotnet test TagFusion.sln`
Expected: PASS komplett.

- [ ] **Step 5: Commit**

```bash
git add Backend/TagFusion/Database/IDatabaseService.cs Backend/TagFusion/Services/DatabaseService.cs Backend/TagFusion.Tests/Services/DatabaseServiceTests.cs
git commit -m "Add person catalog and face status transitions"
```

---

### Task 4: FaceMatcher — Vorschläge & Clustering (pur)

**Files:**
- Create: `Backend/TagFusion/Services/FaceMatcher.cs`
- Test: `Backend/TagFusion.Tests/Services/FaceMatcherTests.cs` (neu)

**Interfaces:**
- Consumes: `StoredFace`, `FaceSuggestionUpdate` (Task 2)
- Produces:
  - `FaceMatcher.SuggestionThreshold = 0.50` / `FaceMatcher.ClusterThreshold = 0.55` (public const double)
  - `double CosineSimilarity(float[] a, float[] b)`
  - `float[] Centroid(IReadOnlyList<float[]> embeddings)`
  - `List<FaceSuggestionUpdate> ComputeSuggestions(IReadOnlyList<StoredFace> unnamedFaces, IReadOnlyDictionary<long, List<float[]>> confirmedByPerson, double threshold = SuggestionThreshold)`
  - `List<List<StoredFace>> ClusterUnknown(IReadOnlyList<StoredFace> faces, double threshold = ClusterThreshold)`

- [ ] **Step 1: Failing Tests schreiben**

Neue Datei `Backend/TagFusion.Tests/Services/FaceMatcherTests.cs`:

```csharp
using NUnit.Framework;
using TagFusion.Models;
using TagFusion.Services;

namespace TagFusion.Tests.Services;

[TestFixture]
public class FaceMatcherTests
{
    private static float[] Vec(params float[] values)
    {
        var v = new float[512];
        Array.Copy(values, v, values.Length);
        return v;
    }

    private static StoredFace Face(long id, float[] embedding, long? rejectedPersonId = null) =>
        new(id, 1, "C:\\a.jpg", 0, 0, 10, 10, embedding, null, null, null, rejectedPersonId, FaceStatus.Unnamed);

    [Test]
    public void CosineSimilarity_ParallelVectorsAreOne_OrthogonalAreZero()
    {
        Assert.That(FaceMatcher.CosineSimilarity(Vec(1, 0), Vec(2, 0)), Is.EqualTo(1.0).Within(1e-6));
        Assert.That(FaceMatcher.CosineSimilarity(Vec(1, 0), Vec(0, 1)), Is.EqualTo(0.0).Within(1e-6));
    }

    [Test]
    public void CosineSimilarity_ZeroVector_ReturnsZero()
    {
        Assert.That(FaceMatcher.CosineSimilarity(Vec(0), Vec(1, 0)), Is.EqualTo(0.0));
    }

    [Test]
    public void Centroid_AveragesComponentWise()
    {
        var centroid = FaceMatcher.Centroid(new[] { Vec(1, 0), Vec(0, 1) });
        Assert.That(centroid[0], Is.EqualTo(0.5f).Within(1e-6));
        Assert.That(centroid[1], Is.EqualTo(0.5f).Within(1e-6));
    }

    [Test]
    public void ComputeSuggestions_BestPersonAboveThresholdWins()
    {
        var confirmed = new Dictionary<long, List<float[]>>
        {
            [1] = new() { Vec(1, 0) },          // Person 1: Richtung e1
            [2] = new() { Vec(0, 1) },          // Person 2: Richtung e2
        };
        var face = Face(10, Vec(0.9f, 0.1f));

        var suggestions = FaceMatcher.ComputeSuggestions(new[] { face }, confirmed);

        Assert.That(suggestions, Has.Count.EqualTo(1));
        Assert.That(suggestions[0].PersonId, Is.EqualTo(1));
        Assert.That(suggestions[0].Score, Is.GreaterThan(FaceMatcher.SuggestionThreshold));
    }

    [Test]
    public void ComputeSuggestions_BelowThreshold_NoSuggestion()
    {
        var confirmed = new Dictionary<long, List<float[]>> { [1] = new() { Vec(1, 0) } };
        var face = Face(10, Vec(0.1f, 0.9f)); // similarity ≈ 0.11

        Assert.That(FaceMatcher.ComputeSuggestions(new[] { face }, confirmed), Is.Empty);
    }

    [Test]
    public void ComputeSuggestions_SkipsRejectedPerson_ButAllowsNextBest()
    {
        var confirmed = new Dictionary<long, List<float[]>>
        {
            [1] = new() { Vec(1, 0) },
            [2] = new() { Vec(0.8f, 0.6f) }, // ähnlich genug zu (0.9, 0.1)? cos = (0.72+0.06)/1 = 0.78 → ja
        };
        var face = Face(10, Vec(0.9f, 0.1f), rejectedPersonId: 1);

        var suggestions = FaceMatcher.ComputeSuggestions(new[] { face }, confirmed);

        Assert.That(suggestions, Has.Count.EqualTo(1));
        Assert.That(suggestions[0].PersonId, Is.EqualTo(2));
    }

    [Test]
    public void ClusterUnknown_GroupsSimilarFaces_SeparatesDissimilar()
    {
        var faces = new[]
        {
            Face(1, Vec(1, 0)),
            Face(2, Vec(0.95f, 0.05f)),
            Face(3, Vec(0, 1)),
        };

        var groups = FaceMatcher.ClusterUnknown(faces);

        Assert.That(groups, Has.Count.EqualTo(2));
        Assert.That(groups.Single(g => g.Count == 2).Select(f => f.Id), Is.EquivalentTo(new long[] { 1, 2 }));
    }

    [Test]
    public void ClusterUnknown_EmptyInput_EmptyOutput()
    {
        Assert.That(FaceMatcher.ClusterUnknown(Array.Empty<StoredFace>()), Is.Empty);
    }
}
```

- [ ] **Step 2: Tests ausführen — müssen fehlschlagen**

Run: `dotnet test TagFusion.sln --filter "FullyQualifiedName~FaceMatcherTests"`
Expected: FAIL — Compile-Error (Klasse existiert nicht).

- [ ] **Step 3: Implementierung**

Neue Datei `Backend/TagFusion/Services/FaceMatcher.cs`:

```csharp
using TagFusion.Models;

namespace TagFusion.Services;

/// <summary>
/// Pure matching logic for face embeddings: suggestions against known persons
/// and greedy similarity clustering for unknown faces. No I/O — fully unit-testable.
/// Reine Matching-Logik: Vorschläge gegen bekannte Personen und Greedy-Clustering
/// unbekannter Gesichter. Kein I/O — vollständig testbar.
/// </summary>
public static class FaceMatcher
{
    /// <summary>Minimum cosine similarity to suggest a known person. / Schwelle für Personen-Vorschläge.</summary>
    public const double SuggestionThreshold = 0.50;

    /// <summary>Minimum cosine similarity to join an unknown-face group (stricter on purpose).
    /// Schwelle fürs Gruppieren Unbekannter — bewusst strenger.</summary>
    public const double ClusterThreshold = 0.55;

    public static double CosineSimilarity(float[] a, float[] b)
    {
        double dot = 0, normA = 0, normB = 0;
        for (int i = 0; i < a.Length; i++)
        {
            dot += (double)a[i] * b[i];
            normA += (double)a[i] * a[i];
            normB += (double)b[i] * b[i];
        }
        if (normA == 0 || normB == 0) return 0;
        return dot / (Math.Sqrt(normA) * Math.Sqrt(normB));
    }

    public static float[] Centroid(IReadOnlyList<float[]> embeddings)
    {
        var result = new float[embeddings[0].Length];
        foreach (var e in embeddings)
            for (int i = 0; i < result.Length; i++)
                result[i] += e[i];
        for (int i = 0; i < result.Length; i++)
            result[i] /= embeddings.Count;
        return result;
    }

    public static List<FaceSuggestionUpdate> ComputeSuggestions(
        IReadOnlyList<StoredFace> unnamedFaces,
        IReadOnlyDictionary<long, List<float[]>> confirmedByPerson,
        double threshold = SuggestionThreshold)
    {
        var suggestions = new List<FaceSuggestionUpdate>();
        if (confirmedByPerson.Count == 0) return suggestions;

        var centroids = confirmedByPerson.ToDictionary(kvp => kvp.Key, kvp => Centroid(kvp.Value));

        foreach (var face in unnamedFaces)
        {
            long bestPerson = 0;
            double bestScore = threshold;
            foreach (var (personId, centroid) in centroids)
            {
                // Never re-suggest a person the user already rejected for this face.
                // Eine vom User abgelehnte Person wird diesem Gesicht nie erneut vorgeschlagen.
                if (face.RejectedPersonId == personId) continue;

                var score = CosineSimilarity(face.Embedding, centroid);
                if (score >= bestScore)
                {
                    bestScore = score;
                    bestPerson = personId;
                }
            }
            if (bestPerson != 0)
                suggestions.Add(new FaceSuggestionUpdate(face.Id, bestPerson, bestScore));
        }
        return suggestions;
    }

    public static List<List<StoredFace>> ClusterUnknown(
        IReadOnlyList<StoredFace> faces,
        double threshold = ClusterThreshold)
    {
        var groups = new List<(List<StoredFace> Members, List<float[]> Embeddings)>();

        foreach (var face in faces)
        {
            List<StoredFace>? best = null;
            double bestScore = threshold;
            foreach (var (members, embeddings) in groups)
            {
                var score = CosineSimilarity(face.Embedding, Centroid(embeddings));
                if (score >= bestScore)
                {
                    bestScore = score;
                    best = members;
                }
            }

            if (best != null)
            {
                best.Add(face);
                groups.First(g => g.Members == best).Embeddings.Add(face.Embedding);
            }
            else
            {
                groups.Add((new List<StoredFace> { face }, new List<float[]> { face.Embedding }));
            }
        }

        return groups.Select(g => g.Members).ToList();
    }
}
```

- [ ] **Step 4: Tests ausführen — müssen bestehen**

Run: `dotnet test TagFusion.sln --filter "FullyQualifiedName~FaceMatcherTests"`
Expected: PASS (8 Tests).

- [ ] **Step 5: Commit**

```bash
git add Backend/TagFusion/Services/FaceMatcher.cs Backend/TagFusion.Tests/Services/FaceMatcherTests.cs
git commit -m "Add pure face matching and clustering logic"
```

---

### Task 5: IFaceEngine, FaceAiSharpEngine, FaceGeometry, DI, healthCheck

**Files:**
- Modify: `Backend/TagFusion/TagFusion.csproj` (PackageReference)
- Create: `Backend/TagFusion/Services/IFaceEngine.cs`
- Create: `Backend/TagFusion/Services/FaceGeometry.cs`
- Create: `Backend/TagFusion/Services/FaceAiSharpEngine.cs`
- Modify: `Backend/TagFusion/App.xaml.cs` (DI, bei den anderen `AddSingleton`-Zeilen ~70-89)
- Modify: `Backend/TagFusion/Services/DiagnosticsService.cs` (`FaceEngineOk`)
- Test: `Backend/TagFusion.Tests/Services/FaceGeometryTests.cs` (neu)

**Interfaces:**
- Consumes: `DetectedFace` wird hier definiert; FaceAiSharp-API (verifiziert): `FaceAiSharpBundleFactory.CreateFaceDetectorWithLandmarks()`, `.CreateFaceEmbeddingsGenerator()`; `DetectFaces(Image<Rgb24>)` → `IReadOnlyCollection<FaceDetectorResult>` mit `readonly record struct FaceDetectorResult(RectangleF Box, IReadOnlyList<PointF>? Landmarks, float? Confidence)`; `AlignFaceUsingLandmarks(Image<Rgb24> face, IReadOnlyList<PointF> landmarks)` (**mutiert in-place** → Clone pro Gesicht!); `GenerateEmbedding(Image<Rgb24> alignedFace)` → `float[]`
- Produces:
  - `record DetectedFace(float X, float Y, float Width, float Height, float[] Embedding)` (in `IFaceEngine.cs`)
  - `interface IFaceEngine { bool IsAvailable { get; } Task<IReadOnlyList<DetectedFace>> AnalyzeAsync(string imagePath, CancellationToken cancellationToken = default); }`
  - `FaceGeometry.ComputeDownscale(int width, int height, int maxDim) : double` (nie > 1.0)
  - `FaceGeometry.ToOriginal(RectangleF box, double scale) : (float X, float Y, float W, float H)`
  - DI: `IFaceEngine` als Singleton; `HealthReport.FaceEngineOk : bool` (fließt NICHT in `AllOk` ein — Feature ist optional)

- [ ] **Step 1: NuGet-Paket ergänzen**

In `TagFusion.csproj` bei den anderen `PackageReference`-Einträgen:

```xml
<PackageReference Include="FaceAiSharp.Bundle" Version="0.6.35" />
```

Run: `dotnet restore TagFusion.sln` (aus `Backend/`) — Expected: Restore OK (Paket ist groß, erster Restore dauert).

- [ ] **Step 2: Failing Tests für FaceGeometry schreiben**

Neue Datei `Backend/TagFusion.Tests/Services/FaceGeometryTests.cs`:

```csharp
using NUnit.Framework;
using SixLabors.ImageSharp;
using TagFusion.Services;

namespace TagFusion.Tests.Services;

[TestFixture]
public class FaceGeometryTests
{
    [Test]
    public void ComputeDownscale_LargeImage_ScalesToMaxDim()
    {
        Assert.That(FaceGeometry.ComputeDownscale(2560, 1440, 1280), Is.EqualTo(0.5).Within(1e-9));
    }

    [Test]
    public void ComputeDownscale_SmallImage_NeverUpscales()
    {
        Assert.That(FaceGeometry.ComputeDownscale(640, 480, 1280), Is.EqualTo(1.0));
    }

    [Test]
    public void ToOriginal_RescalesBoxBackToOriginalPixels()
    {
        var (x, y, w, h) = FaceGeometry.ToOriginal(new RectangleF(10, 20, 30, 40), 0.5);
        Assert.That(x, Is.EqualTo(20f));
        Assert.That(y, Is.EqualTo(40f));
        Assert.That(w, Is.EqualTo(60f));
        Assert.That(h, Is.EqualTo(80f));
    }
}
```

- [ ] **Step 3: Test ausführen — muss fehlschlagen**

Run: `dotnet test TagFusion.sln --filter "FullyQualifiedName~FaceGeometryTests"`
Expected: FAIL — Compile-Error.

- [ ] **Step 4: Implementierung**

`Backend/TagFusion/Services/IFaceEngine.cs`:

```csharp
namespace TagFusion.Services;

/// <summary>A detected face: bounding box in ORIGINAL image pixels plus its embedding.
/// Ein erkanntes Gesicht: Rahmen in Originalpixeln plus Embedding.</summary>
public record DetectedFace(float X, float Y, float Width, float Height, float[] Embedding);

/// <summary>
/// Local face detection + embedding engine. Implementations must never throw from
/// their constructor — a missing model results in IsAvailable = false instead.
/// Lokale Gesichts-Engine. Konstruktoren dürfen nie werfen — fehlende Modelle
/// bedeuten IsAvailable = false, die App läuft ohne das Feature weiter.
/// </summary>
public interface IFaceEngine
{
    bool IsAvailable { get; }
    Task<IReadOnlyList<DetectedFace>> AnalyzeAsync(string imagePath, CancellationToken cancellationToken = default);
}
```

`Backend/TagFusion/Services/FaceGeometry.cs`:

```csharp
using SixLabors.ImageSharp;

namespace TagFusion.Services;

/// <summary>Pure coordinate math for the face pipeline. / Reine Koordinaten-Mathematik.</summary>
public static class FaceGeometry
{
    /// <summary>Scale factor to fit into maxDim; never upscales (max 1.0).</summary>
    public static double ComputeDownscale(int width, int height, int maxDim)
        => Math.Min(1.0, (double)maxDim / Math.Max(width, height));

    /// <summary>Convert a box detected on the downscaled image back to original pixels.</summary>
    public static (float X, float Y, float W, float H) ToOriginal(RectangleF box, double scale)
        => ((float)(box.X / scale), (float)(box.Y / scale), (float)(box.Width / scale), (float)(box.Height / scale));
}
```

`Backend/TagFusion/Services/FaceAiSharpEngine.cs`:

```csharp
using FaceAiSharp;
using Microsoft.Extensions.Logging;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace TagFusion.Services;

/// <summary>
/// IFaceEngine backed by FaceAiSharp (SCRFD detection + ArcFace embeddings via ONNX, CPU).
/// FaceAiSharp types never leave this class — swapping to a raw-ONNX engine later
/// only means writing a new implementation of IFaceEngine.
/// IFaceEngine auf Basis von FaceAiSharp. FaceAiSharp-Typen verlassen diese Klasse nie.
/// </summary>
public sealed class FaceAiSharpEngine : IFaceEngine
{
    private const int MaxDimension = 1280;

    private readonly IFaceDetectorWithLandmarks? _detector;
    private readonly IFaceEmbeddingsGenerator? _embedder;
    private readonly ILogger<FaceAiSharpEngine> _logger;
    private readonly SemaphoreSlim _inferenceLock = new(1, 1);

    public bool IsAvailable { get; }

    public FaceAiSharpEngine(ILogger<FaceAiSharpEngine> logger)
    {
        _logger = logger;
        try
        {
            _detector = FaceAiSharpBundleFactory.CreateFaceDetectorWithLandmarks();
            _embedder = FaceAiSharpBundleFactory.CreateFaceEmbeddingsGenerator();
            IsAvailable = true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Face engine unavailable — models missing or failed to load");
            IsAvailable = false;
        }
    }

    public async Task<IReadOnlyList<DetectedFace>> AnalyzeAsync(string imagePath, CancellationToken cancellationToken = default)
    {
        if (!IsAvailable)
            throw new InvalidOperationException("Face engine is not available");

        // Serialize inference: one image at a time keeps CPU load predictable.
        // Serielle Inferenz — hält die CPU-Last vorhersehbar.
        await _inferenceLock.WaitAsync(cancellationToken);
        try
        {
            return await Task.Run(() => Analyze(imagePath, cancellationToken), cancellationToken);
        }
        finally
        {
            _inferenceLock.Release();
        }
    }

    private List<DetectedFace> Analyze(string imagePath, CancellationToken ct)
    {
        using var image = Image.Load<Rgb24>(imagePath);
        var scale = FaceGeometry.ComputeDownscale(image.Width, image.Height, MaxDimension);
        if (scale < 1.0)
            image.Mutate(x => x.Resize((int)(image.Width * scale), (int)(image.Height * scale)));

        var results = new List<DetectedFace>();
        foreach (var face in _detector!.DetectFaces(image))
        {
            ct.ThrowIfCancellationRequested();
            if (face.Landmarks is null || face.Landmarks.Count == 0) continue;

            // AlignFaceUsingLandmarks mutates the image — clone per face.
            // AlignFaceUsingLandmarks verändert das Bild — pro Gesicht klonen.
            using var clone = image.Clone();
            _embedder!.AlignFaceUsingLandmarks(clone, face.Landmarks);
            var embedding = _embedder.GenerateEmbedding(clone);

            var (x, y, w, h) = FaceGeometry.ToOriginal(face.Box, scale);
            results.Add(new DetectedFace(x, y, w, h, embedding));
        }
        return results;
    }
}
```

`App.xaml.cs` — bei den Service-Registrierungen ergänzen:

```csharp
services.AddSingleton<IFaceEngine, FaceAiSharpEngine>();
```

`DiagnosticsService.cs` — Konstruktor um `IFaceEngine faceEngine` erweitern (Feld `_faceEngine`), in `CheckHealthAsync` vor der `AllOk`-Zeile:

```csharp
// Face engine is optional — informational only, never part of AllOk.
// Die Gesichts-Engine ist optional — nur informativ, fließt nie in AllOk ein.
report.FaceEngineOk = _faceEngine.IsAvailable;
```

und in `HealthReport`:

```csharp
/// <summary>Local face engine loaded? / Lokale Gesichts-Engine geladen?</summary>
public bool FaceEngineOk { get; set; }
```

**Achtung:** Bestehende `DiagnosticsService`-Verwender (DI + evtl. Tests) bekommen den neuen Ctor-Parameter — Compilerfehler zeigen alle Stellen; in Tests einen Mock (`Mock<IFaceEngine>` mit `IsAvailable == false`) übergeben.

- [ ] **Step 5: Tests ausführen — müssen bestehen**

Run: `dotnet test TagFusion.sln`
Expected: PASS komplett (FaceAiSharp wird nirgends instanziiert in Tests — nur `FaceGeometry` wird getestet).

- [ ] **Step 6: Commit**

```bash
git add Backend/TagFusion/TagFusion.csproj Backend/TagFusion/Services/IFaceEngine.cs Backend/TagFusion/Services/FaceGeometry.cs Backend/TagFusion/Services/FaceAiSharpEngine.cs Backend/TagFusion/App.xaml.cs Backend/TagFusion/Services/DiagnosticsService.cs Backend/TagFusion.Tests/Services/FaceGeometryTests.cs
git commit -m "Add face engine abstraction with FaceAiSharp implementation"
```

---

### Task 6: FaceScanService — serieller Ordner-Scan

**Files:**
- Create: `Backend/TagFusion/Services/FaceScanService.cs`
- Modify: `Backend/TagFusion/App.xaml.cs` (DI: `services.AddSingleton<FaceScanService>();`)
- Test: `Backend/TagFusion.Tests/Services/FaceScanServiceTests.cs` (neu)

**Interfaces:**
- Consumes: `IFaceEngine` (Task 5), `IDatabaseService.SaveFacesAsync`/`GetFaceScanTimesAsync`/`GetFacesForFolderAsync`/`GetConfirmedEmbeddingsByPersonAsync`/`ApplyFaceSuggestionsAsync` (Tasks 2/3), `FaceMatcher` (Task 4), `IFileSystemService.GetImagesAsync(string folderPath, CancellationToken)` (Bestand)
- Produces:
  - `record ScanSummary(int Scanned, int Faces, int Skipped, bool Cancelled)` (verschachtelt in `FaceScanService`)
  - `bool StartScan(string folderPath)` — false, wenn bereits ein Scan läuft
  - `void Cancel()`
  - `bool IsScanning { get; }`
  - `event Action<int, int, int>? Progress` (current, total, facesSoFar)
  - `event Action<FaceScanService.ScanSummary>? Completed`
  - `internal Task? CurrentScanForTests { get; }`

- [ ] **Step 1: Failing Tests schreiben**

Neue Datei `Backend/TagFusion.Tests/Services/FaceScanServiceTests.cs`:

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
public class FaceScanServiceTests
{
    private Mock<IFaceEngine> _engine = null!;
    private Mock<IDatabaseService> _db = null!;
    private Mock<IFileSystemService> _fs = null!;
    private FaceScanService _service = null!;
    private List<string> _tempFiles = null!;

    [SetUp]
    public void SetUp()
    {
        _engine = new Mock<IFaceEngine>();
        _engine.SetupGet(e => e.IsAvailable).Returns(true);
        _db = new Mock<IDatabaseService>();
        _fs = new Mock<IFileSystemService>();
        _tempFiles = new List<string>();

        // Default: no prior scans, no confirmed persons, empty folder faces.
        _db.Setup(d => d.GetFaceScanTimesAsync(It.IsAny<List<string>>(), It.IsAny<CancellationToken>()))
           .ReturnsAsync(new Dictionary<string, string>());
        _db.Setup(d => d.GetFacesForFolderAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
           .ReturnsAsync(new List<StoredFace>());
        _db.Setup(d => d.GetConfirmedEmbeddingsByPersonAsync(It.IsAny<CancellationToken>()))
           .ReturnsAsync(new Dictionary<long, List<float[]>>());

        _service = new FaceScanService(_engine.Object, _db.Object, _fs.Object, NullLogger<FaceScanService>.Instance);
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

    private async Task<FaceScanService.ScanSummary> RunScanAsync(string folder)
    {
        FaceScanService.ScanSummary? summary = null;
        var done = new TaskCompletionSource();
        _service.Completed += s => { summary = s; done.TrySetResult(); };

        Assert.That(_service.StartScan(folder), Is.True);
        await done.Task.WaitAsync(TimeSpan.FromSeconds(10));
        return summary!;
    }

    [Test]
    public async Task Scan_AnalyzesEveryImage_AndSavesFaces_WithProgressEvents()
    {
        var p1 = CreateTempImage();
        var p2 = CreateTempImage();
        SetupFolder(p1, p2);
        _engine.Setup(e => e.AnalyzeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
               .ReturnsAsync(new List<DetectedFace> { new(1, 2, 3, 4, new float[512]) });
        var progressEvents = new List<(int Current, int Total, int Faces)>();
        _service.Progress += (c, t, f) => progressEvents.Add((c, t, f));

        var summary = await RunScanAsync("C:\\egal");

        Assert.That(progressEvents, Has.Count.EqualTo(2));
        Assert.That(progressEvents[1], Is.EqualTo((2, 2, 2)));
        Assert.That(summary.Scanned, Is.EqualTo(2));
        Assert.That(summary.Faces, Is.EqualTo(2));
        Assert.That(summary.Cancelled, Is.False);
        _db.Verify(d => d.SaveFacesAsync(p1, It.Is<IReadOnlyList<NewFace>>(f => f.Count == 1), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()), Times.Once);
        _db.Verify(d => d.SaveFacesAsync(p2, It.IsAny<IReadOnlyList<NewFace>>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Test]
    public async Task Scan_SkipsUnchangedImages()
    {
        var p1 = CreateTempImage();
        SetupFolder(p1);
        var mtime = File.GetLastWriteTimeUtc(p1).ToString("o");
        _db.Setup(d => d.GetFaceScanTimesAsync(It.IsAny<List<string>>(), It.IsAny<CancellationToken>()))
           .ReturnsAsync(new Dictionary<string, string> { [p1] = mtime });

        var summary = await RunScanAsync("C:\\egal");

        Assert.That(summary.Scanned, Is.EqualTo(0));
        _engine.Verify(e => e.AnalyzeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Test]
    public async Task Scan_BrokenImage_CountsAsSkipped_AndContinues()
    {
        var p1 = CreateTempImage();
        var p2 = CreateTempImage();
        SetupFolder(p1, p2);
        _engine.Setup(e => e.AnalyzeAsync(p1, It.IsAny<CancellationToken>())).ThrowsAsync(new InvalidOperationException("kaputt"));
        _engine.Setup(e => e.AnalyzeAsync(p2, It.IsAny<CancellationToken>())).ReturnsAsync(new List<DetectedFace>());

        var summary = await RunScanAsync("C:\\egal");

        Assert.That(summary.Skipped, Is.EqualTo(1));
        Assert.That(summary.Scanned, Is.EqualTo(1));
    }

    [Test]
    public async Task Scan_SecondStartWhileRunning_ReturnsFalse()
    {
        var p1 = CreateTempImage();
        SetupFolder(p1);
        var block = new TaskCompletionSource<IReadOnlyList<DetectedFace>>();
        _engine.Setup(e => e.AnalyzeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>())).Returns(block.Task);

        Assert.That(_service.StartScan("C:\\egal"), Is.True);
        Assert.That(_service.StartScan("C:\\egal"), Is.False);
        Assert.That(_service.IsScanning, Is.True);

        block.SetResult(new List<DetectedFace>());
        await _service.CurrentScanForTests!;
        Assert.That(_service.IsScanning, Is.False);
    }

    [Test]
    public async Task Scan_AppliesSuggestionsAfterCompletion()
    {
        var p1 = CreateTempImage();
        SetupFolder(p1);
        var emb = new float[512]; emb[0] = 1f;
        _engine.Setup(e => e.AnalyzeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
               .ReturnsAsync(new List<DetectedFace> { new(1, 2, 3, 4, emb) });
        _db.Setup(d => d.GetFacesForFolderAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
           .ReturnsAsync(new List<StoredFace> { new(1, 1, p1, 1, 2, 3, 4, emb, null, null, null, null, FaceStatus.Unnamed) });
        _db.Setup(d => d.GetConfirmedEmbeddingsByPersonAsync(It.IsAny<CancellationToken>()))
           .ReturnsAsync(new Dictionary<long, List<float[]>> { [7] = new() { emb } });

        await RunScanAsync("C:\\egal");

        _db.Verify(d => d.ApplyFaceSuggestionsAsync(
            It.Is<IReadOnlyList<FaceSuggestionUpdate>>(s => s.Count == 1 && s[0].PersonId == 7),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Test]
    public async Task Cancel_StopsScan_AndReportsCancelled()
    {
        var p1 = CreateTempImage();
        var p2 = CreateTempImage();
        SetupFolder(p1, p2);
        _engine.Setup(e => e.AnalyzeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
               .Returns(async (string _, CancellationToken ct) =>
               {
                   _service.Cancel();
                   ct.ThrowIfCancellationRequested();
                   return (IReadOnlyList<DetectedFace>)new List<DetectedFace>();
               });

        var summary = await RunScanAsync("C:\\egal");

        Assert.That(summary.Cancelled, Is.True);
    }
}
```

- [ ] **Step 2: Tests ausführen — müssen fehlschlagen**

Run: `dotnet test TagFusion.sln --filter "FullyQualifiedName~FaceScanServiceTests"`
Expected: FAIL — Compile-Error.

- [ ] **Step 3: Implementierung**

Neue Datei `Backend/TagFusion/Services/FaceScanService.cs`:

```csharp
using System.IO;
using Microsoft.Extensions.Logging;
using TagFusion.Database;
using TagFusion.Models;

namespace TagFusion.Services;

/// <summary>
/// Runs one manual face scan at a time over a folder's images: analyze serially,
/// persist faces, then compute suggestions against known persons.
/// Führt einen manuellen Gesichts-Scan pro Zeit aus: seriell analysieren,
/// speichern, danach Vorschläge gegen bekannte Personen berechnen.
/// </summary>
public sealed class FaceScanService
{
    public record ScanSummary(int Scanned, int Faces, int Skipped, bool Cancelled);

    private readonly IFaceEngine _engine;
    private readonly IDatabaseService _databaseService;
    private readonly IFileSystemService _fileSystemService;
    private readonly ILogger<FaceScanService> _logger;

    private int _running; // 0 = idle, 1 = scanning (Interlocked)
    private CancellationTokenSource? _cts;
    private Task? _currentScan;

    public event Action<int, int, int>? Progress;   // current, total, facesSoFar
    public event Action<ScanSummary>? Completed;

    public bool IsScanning => Interlocked.CompareExchange(ref _running, 0, 0) == 1;

    internal Task? CurrentScanForTests => _currentScan;

    public FaceScanService(
        IFaceEngine engine,
        IDatabaseService databaseService,
        IFileSystemService fileSystemService,
        ILogger<FaceScanService> logger)
    {
        _engine = engine;
        _databaseService = databaseService;
        _fileSystemService = fileSystemService;
        _logger = logger;
    }

    /// <summary>Start a scan; returns false when one is already running.</summary>
    public bool StartScan(string folderPath)
    {
        if (Interlocked.CompareExchange(ref _running, 1, 0) != 0)
            return false;

        _cts = new CancellationTokenSource();
        _currentScan = Task.Run(() => RunScanAsync(folderPath, _cts.Token));
        return true;
    }

    public void Cancel() => _cts?.Cancel();

    private async Task RunScanAsync(string folderPath, CancellationToken ct)
    {
        int scanned = 0, faces = 0, skipped = 0;
        bool cancelled = false;

        try
        {
            var images = await _fileSystemService.GetImagesAsync(folderPath, ct);
            var paths = images.Select(i => i.Path).ToList();
            var scanTimes = await _databaseService.GetFaceScanTimesAsync(paths, ct);

            // Only new or changed files. / Nur neue oder geänderte Dateien.
            var todo = new List<string>();
            foreach (var path in paths)
            {
                var mtime = File.GetLastWriteTimeUtc(path).ToString("o");
                if (scanTimes.TryGetValue(path, out var stored) && stored == mtime) continue;
                todo.Add(path);
            }

            var total = todo.Count;
            for (int i = 0; i < total; i++)
            {
                ct.ThrowIfCancellationRequested();
                var path = todo[i];
                try
                {
                    var detected = await _engine.AnalyzeAsync(path, ct);
                    var newFaces = detected
                        .Select(d => new NewFace(d.X, d.Y, d.Width, d.Height, d.Embedding))
                        .ToList();
                    await _databaseService.SaveFacesAsync(path, newFaces, File.GetLastWriteTimeUtc(path), ct);
                    scanned++;
                    faces += newFaces.Count;
                }
                catch (OperationCanceledException)
                {
                    throw;
                }
                catch (Exception ex)
                {
                    skipped++;
                    _logger.LogWarning(ex, "Face scan skipped {Path}", path);
                }
                Progress?.Invoke(i + 1, total, faces);
            }

            // Suggestions for everything unnamed in this folder.
            // Vorschläge für alles Unbenannte in diesem Ordner.
            var folderFaces = await _databaseService.GetFacesForFolderAsync(folderPath, ct);
            var unnamed = folderFaces.Where(f => f.Status == FaceStatus.Unnamed).ToList();
            if (unnamed.Count > 0)
            {
                var confirmed = await _databaseService.GetConfirmedEmbeddingsByPersonAsync(ct);
                var suggestions = FaceMatcher.ComputeSuggestions(unnamed, confirmed);
                if (suggestions.Count > 0)
                    await _databaseService.ApplyFaceSuggestionsAsync(suggestions, ct);
            }
        }
        catch (OperationCanceledException)
        {
            cancelled = true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Face scan failed for {Folder}", folderPath);
        }
        finally
        {
            _cts?.Dispose();
            _cts = null;
            Interlocked.Exchange(ref _running, 0);
            Completed?.Invoke(new ScanSummary(scanned, faces, skipped, cancelled));
        }
    }
}
```

In `App.xaml.cs` bei den Registrierungen: `services.AddSingleton<FaceScanService>();`

- [ ] **Step 4: Tests ausführen — müssen bestehen**

Run: `dotnet test TagFusion.sln`
Expected: PASS komplett.

- [ ] **Step 5: Commit**

```bash
git add Backend/TagFusion/Services/FaceScanService.cs Backend/TagFusion/App.xaml.cs Backend/TagFusion.Tests/Services/FaceScanServiceTests.cs
git commit -m "Add serial folder face scan service with progress events"
```

---

### Task 7: FaceCropHelper — Gesichts-Ausschnitte als Base64

**Files:**
- Create: `Backend/TagFusion/Services/FaceCropHelper.cs`
- Test: `Backend/TagFusion.Tests/Services/FaceCropHelperTests.cs` (neu)

**Interfaces:**
- Consumes: SixLabors.ImageSharp (Bestand)
- Produces:
  - `FaceCropHelper.ComputeCropRectangle(int imageWidth, int imageHeight, float x, float y, float w, float h, float marginFactor) : Rectangle` — quadratisch um die Box-Mitte, Kantenlänge `max(w,h) * (1 + 2*marginFactor)`, an Bildgrenzen geklemmt, min. 1×1
  - `FaceCropHelper.CreateCropBase64Async(string imagePath, float x, float y, float w, float h, int targetSize = 96, float marginFactor = 0.2f, CancellationToken ct = default) : Task<string>` — JPEG-Base64

- [ ] **Step 1: Failing Tests schreiben**

Neue Datei `Backend/TagFusion.Tests/Services/FaceCropHelperTests.cs`:

```csharp
using System.IO;
using NUnit.Framework;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using TagFusion.Services;

namespace TagFusion.Tests.Services;

[TestFixture]
public class FaceCropHelperTests
{
    [Test]
    public void ComputeCropRectangle_SquareAroundCenter_WithMargin()
    {
        // Box 100x50 at (200, 100) → side = 100 * 1.4 = 140, centered on (250, 125)
        var rect = FaceCropHelper.ComputeCropRectangle(1000, 1000, 200, 100, 100, 50, 0.2f);
        Assert.That(rect.Width, Is.EqualTo(140));
        Assert.That(rect.Height, Is.EqualTo(140));
        Assert.That(rect.X, Is.EqualTo(180));
        Assert.That(rect.Y, Is.EqualTo(55));
    }

    [Test]
    public void ComputeCropRectangle_ClampsAtImageEdges()
    {
        var rect = FaceCropHelper.ComputeCropRectangle(100, 100, 0, 0, 90, 90, 0.2f);
        Assert.That(rect.X, Is.GreaterThanOrEqualTo(0));
        Assert.That(rect.Y, Is.GreaterThanOrEqualTo(0));
        Assert.That(rect.Right, Is.LessThanOrEqualTo(100));
        Assert.That(rect.Bottom, Is.LessThanOrEqualTo(100));
    }

    [Test]
    public async Task CreateCropBase64_ProducesDecodableJpeg()
    {
        var path = Path.Combine(Path.GetTempPath(), Guid.NewGuid() + ".png");
        try
        {
            using (var img = new Image<Rgb24>(200, 200))
                await img.SaveAsPngAsync(path);

            var base64 = await FaceCropHelper.CreateCropBase64Async(path, 50, 50, 40, 40);

            var bytes = Convert.FromBase64String(base64);
            using var crop = Image.Load(bytes);
            Assert.That(crop.Width, Is.EqualTo(96));
            Assert.That(crop.Height, Is.EqualTo(96));
        }
        finally
        {
            if (File.Exists(path)) File.Delete(path);
        }
    }
}
```

- [ ] **Step 2: Tests ausführen — müssen fehlschlagen**

Run: `dotnet test TagFusion.sln --filter "FullyQualifiedName~FaceCropHelperTests"`
Expected: FAIL — Compile-Error.

- [ ] **Step 3: Implementierung**

Neue Datei `Backend/TagFusion/Services/FaceCropHelper.cs`:

```csharp
using System.IO;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace TagFusion.Services;

/// <summary>
/// Produces small square face crops as Base64 JPEG for the review UI.
/// Erzeugt kleine quadratische Gesichts-Ausschnitte als Base64-JPEG für das Review-Panel.
/// </summary>
public static class FaceCropHelper
{
    public static Rectangle ComputeCropRectangle(int imageWidth, int imageHeight, float x, float y, float w, float h, float marginFactor)
    {
        var side = Math.Max(w, h) * (1 + 2 * marginFactor);
        var centerX = x + w / 2;
        var centerY = y + h / 2;

        var left = (int)Math.Round(centerX - side / 2);
        var top = (int)Math.Round(centerY - side / 2);
        var size = (int)Math.Round(side);

        // Clamp to image bounds, keep at least 1x1. / An Bildgrenzen klemmen, min. 1x1.
        left = Math.Max(0, Math.Min(left, imageWidth - 1));
        top = Math.Max(0, Math.Min(top, imageHeight - 1));
        size = Math.Max(1, Math.Min(size, Math.Min(imageWidth - left, imageHeight - top)));

        return new Rectangle(left, top, size, size);
    }

    public static async Task<string> CreateCropBase64Async(
        string imagePath, float x, float y, float w, float h,
        int targetSize = 96, float marginFactor = 0.2f, CancellationToken ct = default)
    {
        using var image = await Image.LoadAsync<Rgb24>(imagePath, ct);
        var rect = ComputeCropRectangle(image.Width, image.Height, x, y, w, h, marginFactor);
        image.Mutate(ctx => ctx.Crop(rect).Resize(targetSize, targetSize));

        using var ms = new MemoryStream();
        await image.SaveAsJpegAsync(ms, ct);
        return Convert.ToBase64String(ms.ToArray());
    }
}
```

- [ ] **Step 4: Tests ausführen — müssen bestehen**

Run: `dotnet test TagFusion.sln --filter "FullyQualifiedName~FaceCropHelperTests"`
Expected: PASS (3 Tests).

- [ ] **Step 5: Commit**

```bash
git add Backend/TagFusion/Services/FaceCropHelper.cs Backend/TagFusion.Tests/Services/FaceCropHelperTests.cs
git commit -m "Add face crop helper for review thumbnails"
```

---

### Task 8: FaceHandler + Bridge-Verdrahtung + Kontraktdateien

**Files:**
- Create: `Backend/TagFusion/Bridge/Handlers/FaceHandler.cs`
- Modify: `Backend/TagFusion/Bridge/WebViewBridge.cs` (Ctor-Parameter, Handler-Array, Event-Verdrahtung)
- Modify: `Backend/TagFusion/MainWindow.xaml.cs` (`ResolveServices`-Tuple ~Zeile 127 + Destrukturierung ~Zeile 230 + `new WebViewBridge(...)` ~Zeile 236)
- Modify: `bridge-actions.json` (Repo-Root)
- Modify: `Frontend/src/services/bridgeActions.ts`
- Test: `Backend/TagFusion.Tests/Bridge/Handlers/FaceHandlerTests.cs` (neu)
- Verify (keine Änderung erwartet): `Backend/TagFusion.Tests/Bridge/BridgeContractTests.cs`, `Frontend/src/services/bridgeContract.test.ts` — beide lesen `bridge-actions.json` bzw. die Kataloge; falls einer eine harte Liste enthält, dort die 7 neuen Actions ergänzen

**Interfaces:**
- Consumes: `FaceScanService` (Task 6), `IFaceEngine` (Task 5), `IDatabaseService`-Face-Methoden (Tasks 2/3), `FaceMatcher.ClusterUnknown` (Task 4), `FaceCropHelper` (Task 7), `IExifToolService` + `TagHelper` (Bestand), `PayloadHelper` (Bestand)
- Produces: Bridge-Actions `scanFacesInFolder`, `cancelFaceScan`, `getFaceReview`, `confirmFaceGroup`, `rejectFaceSuggestion`, `ignoreFaces`, `getPersons`; Events `faceScanProgress { current, total, faces }`, `faceScanCompleted { scanned, faces, skipped, cancelled }`

**Bewusste Entscheidung (dokumentiert):** `confirmFaceGroup` spiegelt die Add-Tag-Logik aus `TagHandler.UpdateBatchTagAsync` (~15 Zeilen: Tags lesen → dedupliziert ergänzen → schreiben → `SaveImageAsync`) als private Methode, statt `TagHandler` umzubauen. Ein gemeinsamer Helper würde den unabhängigen `TagHandler` in einem Gesichts-Task anfassen — das Duplikat ist klein, benannt und im Code kommentiert.

- [ ] **Step 1: Kontraktdateien erweitern**

In `bridge-actions.json` alphabetisch einsortieren: `"cancelFaceScan"`, `"confirmFaceGroup"`, `"getFaceReview"`, `"getPersons"`, `"ignoreFaces"`, `"rejectFaceSuggestion"`, `"scanFacesInFolder"`.

In `Frontend/src/services/bridgeActions.ts` alphabetisch einsortieren:

```typescript
  CANCEL_FACE_SCAN: 'cancelFaceScan',
  CONFIRM_FACE_GROUP: 'confirmFaceGroup',
  GET_FACE_REVIEW: 'getFaceReview',
  GET_PERSONS: 'getPersons',
  IGNORE_FACES: 'ignoreFaces',
  REJECT_FACE_SUGGESTION: 'rejectFaceSuggestion',
  SCAN_FACES_IN_FOLDER: 'scanFacesInFolder',
```

Run: `dotnet test TagFusion.sln --filter "FullyQualifiedName~BridgeContractTests"` und (aus `Frontend/`) `npm run test -- --run bridgeContract`
Expected: FAIL beidseitig — die Contract-Tests melden die 7 Actions als unbekannt, solange der Backend-Handler fehlt (genau das ist der rote TDD-Zustand; falls einer der beiden Tests stattdessen schon grün ist, notieren und weiter).

- [ ] **Step 2: Failing Handler-Tests schreiben**

Neue Datei `Backend/TagFusion.Tests/Bridge/Handlers/FaceHandlerTests.cs`:

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
public class FaceHandlerTests
{
    private Mock<IFaceEngine> _engine = null!;
    private Mock<IDatabaseService> _db = null!;
    private Mock<IExifToolService> _exifTool = null!;
    private Mock<IFileSystemService> _fs = null!;
    private FaceScanService _scanService = null!;
    private FaceHandler _handler = null!;
    private List<string> _tempFiles = null!;

    [SetUp]
    public void SetUp()
    {
        _engine = new Mock<IFaceEngine>();
        _engine.SetupGet(e => e.IsAvailable).Returns(true);
        _db = new Mock<IDatabaseService>();
        _exifTool = new Mock<IExifToolService>();
        _fs = new Mock<IFileSystemService>();
        _tempFiles = new List<string>();
        _scanService = new FaceScanService(_engine.Object, _db.Object, _fs.Object, NullLogger<FaceScanService>.Instance);
        _handler = new FaceHandler(_scanService, _engine.Object, _db.Object, _exifTool.Object, NullLogger<FaceHandler>.Instance);
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

    private static Dictionary<string, object> Payload(string json)
        => JsonSerializer.Deserialize<Dictionary<string, object>>(json)!
            .ToDictionary(kvp => kvp.Key, kvp => (object)kvp.Value);

    [Test]
    public void ScanFaces_EngineUnavailable_ThrowsGermanMessage()
    {
        _engine.SetupGet(e => e.IsAvailable).Returns(false);

        var ex = Assert.ThrowsAsync<TagFusion.Bridge.BridgeException>(
            () => _handler.HandleAsync("scanFacesInFolder", Payload("{\"path\":\"C:\\\\fotos\"}")));
        Assert.That(ex!.UserMessage, Does.Contain("nicht verfügbar"));
    }

    [Test]
    public async Task GetPersons_MapsToCamelCasePayload()
    {
        _db.Setup(d => d.GetPersonsAsync(It.IsAny<CancellationToken>()))
           .ReturnsAsync(new List<PersonInfo> { new(1, "Max", 3) });

        var result = await _handler.HandleAsync("getPersons", null);

        var list = (IEnumerable<object>)result!;
        Assert.That(list.Count(), Is.EqualTo(1));
    }

    [Test]
    public async Task ConfirmFaceGroup_WritesTag_AndAssignsOnlySucceededFaces()
    {
        var okPath = CreateTempImage();
        var failPath = CreateTempImage();
        var faces = new List<StoredFace>
        {
            new(1, 1, okPath, 0, 0, 1, 1, new float[512], null, null, null, null, FaceStatus.Unnamed),
            new(2, 2, failPath, 0, 0, 1, 1, new float[512], null, null, null, null, FaceStatus.Unnamed),
        };
        _db.Setup(d => d.GetFacesByIdsAsync(It.IsAny<List<long>>(), It.IsAny<CancellationToken>())).ReturnsAsync(faces);
        _db.Setup(d => d.GetOrCreatePersonAsync("Max", It.IsAny<CancellationToken>())).ReturnsAsync(42L);
        _exifTool.Setup(e => e.ReadTagsAsync(It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync(new List<string>());
        _exifTool.Setup(e => e.ReadRatingAsync(It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync(0);
        _exifTool.Setup(e => e.WriteTagsAsync(okPath, It.IsAny<List<string>>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);
        _exifTool.Setup(e => e.WriteTagsAsync(failPath, It.IsAny<List<string>>(), It.IsAny<CancellationToken>())).ReturnsAsync(false);

        var payload = Payload("{\"faceIds\":[1,2],\"personName\":\"Max\"}");
        var result = await _handler.HandleAsync("confirmFaceGroup", payload);

        _db.Verify(d => d.AssignFacesToPersonAsync(
            It.Is<List<long>>(ids => ids.Count == 1 && ids[0] == 1), 42L, It.IsAny<CancellationToken>()), Times.Once);
        _exifTool.Verify(e => e.WriteTagsAsync(okPath, It.Is<List<string>>(t => t.Contains("Max")), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Test]
    public async Task RejectAndIgnore_DelegateToDatabase()
    {
        await _handler.HandleAsync("rejectFaceSuggestion", Payload("{\"faceIds\":[5]}"));
        _db.Verify(d => d.RejectFaceSuggestionsAsync(It.Is<List<long>>(ids => ids[0] == 5), It.IsAny<CancellationToken>()), Times.Once);

        await _handler.HandleAsync("ignoreFaces", Payload("{\"faceIds\":[6]}"));
        _db.Verify(d => d.SetFacesIgnoredAsync(It.Is<List<long>>(ids => ids[0] == 6), It.IsAny<CancellationToken>()), Times.Once);
    }
}
```

Hinweis: Sollte `PayloadHelper` bereits eine Methode zum Extrahieren von Long-Listen haben, diese nutzen; andernfalls entsteht sie in diesem Task (siehe Implementierung). Die JSON-Payload-Konvertierung im Test entspricht dem Muster der bestehenden `TagHandlerTests` (JsonElement-Werte).

- [ ] **Step 3: Tests ausführen — müssen fehlschlagen**

Run: `dotnet test TagFusion.sln --filter "FullyQualifiedName~FaceHandlerTests"`
Expected: FAIL — Compile-Error (`FaceHandler` existiert nicht).

- [ ] **Step 4: Implementierung**

Neue Datei `Backend/TagFusion/Bridge/Handlers/FaceHandler.cs`:

```csharp
using System.IO;
using Microsoft.Extensions.Logging;
using TagFusion.Database;
using TagFusion.Models;
using TagFusion.Services;

namespace TagFusion.Bridge.Handlers;

/// <summary>
/// Handles face recognition actions: scanning, review, confirmation.
/// Verarbeitet Gesichtserkennungs-Actions: Scan, Review, Bestätigung.
/// </summary>
public class FaceHandler : IBridgeHandler
{
    /// <summary>Max face crops embedded per group in a review response. / Max. Crops pro Gruppe.</summary>
    private const int MaxCropsPerGroup = 8;

    private readonly FaceScanService _scanService;
    private readonly IFaceEngine _engine;
    private readonly IDatabaseService _databaseService;
    private readonly IExifToolService _exifToolService;
    private readonly ILogger<FaceHandler> _logger;

    private static readonly HashSet<string> _supported = new(StringComparer.Ordinal)
    {
        "scanFacesInFolder", "cancelFaceScan", "getFaceReview",
        "confirmFaceGroup", "rejectFaceSuggestion", "ignoreFaces", "getPersons"
    };

    public IReadOnlySet<string> SupportedActions => _supported;

    public FaceHandler(
        FaceScanService scanService,
        IFaceEngine engine,
        IDatabaseService databaseService,
        IExifToolService exifToolService,
        ILogger<FaceHandler> logger)
    {
        _scanService = scanService;
        _engine = engine;
        _databaseService = databaseService;
        _exifToolService = exifToolService;
        _logger = logger;
    }

    public async Task<object?> HandleAsync(string action, Dictionary<string, object>? payload)
    {
        return action switch
        {
            "scanFacesInFolder" => StartScan(payload),
            "cancelFaceScan" => CancelScan(),
            "getFaceReview" => await GetFaceReviewAsync(payload),
            "confirmFaceGroup" => await ConfirmFaceGroupAsync(payload),
            "rejectFaceSuggestion" => await RejectAsync(payload),
            "ignoreFaces" => await IgnoreAsync(payload),
            "getPersons" => await GetPersonsAsync(),
            _ => throw new NotSupportedException($"Unknown action: {action}")
        };
    }

    private object StartScan(Dictionary<string, object>? payload)
    {
        if (!_engine.IsAvailable)
            throw new BridgeException(
                "Gesichtserkennung nicht verfügbar — Modelldateien fehlen.",
                internalMessage: "Face engine unavailable");

        var path = PayloadHelper.GetString(payload ?? new(), "path");
        if (string.IsNullOrWhiteSpace(path) || !Directory.Exists(path))
            throw new BridgeException("Ordner nicht gefunden.", internalMessage: $"Folder not found: {path}");

        if (!_scanService.StartScan(path))
            throw new BridgeException("Ein Gesichter-Scan läuft bereits.", internalMessage: "Scan already running");

        return true;
    }

    private object CancelScan()
    {
        _scanService.Cancel();
        return true;
    }

    private async Task<object> GetFaceReviewAsync(Dictionary<string, object>? payload)
    {
        var path = PayloadHelper.GetString(payload ?? new(), "path");
        var faces = await _databaseService.GetFacesForFolderAsync(path);
        var persons = (await _databaseService.GetPersonsAsync()).ToDictionary(p => p.Id, p => p.Name);

        // Suggestions grouped by suggested person. / Vorschläge nach Person gruppiert.
        var suggestions = new List<object>();
        foreach (var group in faces.Where(f => f.Status == FaceStatus.Suggested && f.SuggestedPersonId.HasValue)
                                   .GroupBy(f => f.SuggestedPersonId!.Value))
        {
            if (!persons.TryGetValue(group.Key, out var name)) continue;
            var members = group.ToList();
            suggestions.Add(new
            {
                personId = group.Key,
                personName = name,
                score = members.Max(f => f.SuggestionScore ?? 0),
                faceIds = members.Select(f => f.Id).ToList(),
                sample = await BuildCropsAsync(members),
            });
        }

        // Unknown faces clustered by similarity. / Unbekannte nach Ähnlichkeit gruppiert.
        var unnamed = faces.Where(f => f.Status == FaceStatus.Unnamed).ToList();
        var groups = new List<object>();
        foreach (var cluster in FaceMatcher.ClusterUnknown(unnamed))
        {
            groups.Add(new
            {
                faceIds = cluster.Select(f => f.Id).ToList(),
                sample = await BuildCropsAsync(cluster),
            });
        }

        return new { suggestions, groups };
    }

    private async Task<List<object>> BuildCropsAsync(IReadOnlyList<StoredFace> faces)
    {
        var crops = new List<object>();
        foreach (var face in faces.Take(MaxCropsPerGroup))
        {
            try
            {
                var crop = await FaceCropHelper.CreateCropBase64Async(face.ImagePath, face.X, face.Y, face.W, face.H);
                crops.Add(new { faceId = face.Id, imagePath = face.ImagePath, crop });
            }
            catch (Exception ex)
            {
                // A missing/broken source image must not break the whole review.
                // Ein fehlendes/defektes Bild darf das Review nicht abbrechen.
                _logger.LogWarning(ex, "Face crop failed for {Path}", face.ImagePath);
            }
        }
        return crops;
    }

    private async Task<object> ConfirmFaceGroupAsync(Dictionary<string, object>? payload)
    {
        var faceIds = PayloadHelper.ExtractLongList(payload?.GetValueOrDefault("faceIds"));
        var personName = PayloadHelper.GetString(payload ?? new(), "personName").Trim();
        if (faceIds.Count == 0 || string.IsNullOrWhiteSpace(personName))
            throw new BridgeException("Name oder Gesichter fehlen.", internalMessage: "confirmFaceGroup: empty faceIds or personName");

        var personId = await _databaseService.GetOrCreatePersonAsync(personName);
        var faces = await _databaseService.GetFacesByIdsAsync(faceIds);
        var pathsToTag = faces.Select(f => f.ImagePath).Distinct(StringComparer.OrdinalIgnoreCase).ToList();

        // Intentional small mirror of TagHandler.UpdateBatchTagAsync's add branch —
        // a shared helper would couple the independent handlers for ~15 lines.
        // Bewusste kleine Spiegelung der Add-Logik aus TagHandler.UpdateBatchTagAsync.
        var succeeded = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var failed = 0;
        foreach (var path in pathsToTag)
        {
            try
            {
                var existing = await _exifToolService.ReadTagsAsync(path);
                var updated = TagHelper.DeduplicateTags(existing.Append(personName));
                if (await _exifToolService.WriteTagsAsync(path, updated))
                {
                    succeeded.Add(path);
                    var image = Models.ImageFile.FromPath(path, updated, await _exifToolService.ReadRatingAsync(path));
                    await _databaseService.SaveImageAsync(image);
                }
                else
                {
                    failed++;
                }
            }
            catch (Exception ex)
            {
                failed++;
                _logger.LogError(ex, "Person tag write failed for {Path}", path);
            }
        }

        var confirmedFaceIds = faces.Where(f => succeeded.Contains(f.ImagePath)).Select(f => f.Id).ToList();
        if (confirmedFaceIds.Count > 0)
            await _databaseService.AssignFacesToPersonAsync(confirmedFaceIds, personId);

        return new { tagged = succeeded.Count, failed };
    }

    private async Task<object> RejectAsync(Dictionary<string, object>? payload)
    {
        var faceIds = PayloadHelper.ExtractLongList(payload?.GetValueOrDefault("faceIds"));
        await _databaseService.RejectFaceSuggestionsAsync(faceIds);
        return true;
    }

    private async Task<object> IgnoreAsync(Dictionary<string, object>? payload)
    {
        var faceIds = PayloadHelper.ExtractLongList(payload?.GetValueOrDefault("faceIds"));
        await _databaseService.SetFacesIgnoredAsync(faceIds);
        return true;
    }

    private async Task<object> GetPersonsAsync()
    {
        var persons = await _databaseService.GetPersonsAsync();
        return persons.Select(p => new { id = p.Id, name = p.Name, faceCount = p.FaceCount }).ToList();
    }
}
```

In `PayloadHelper.cs` (falls nicht vorhanden) ergänzen — Muster von `ExtractStringList` übernehmen:

```csharp
/// <summary>Extract a list of longs from a JsonElement/array payload value.</summary>
public static List<long> ExtractLongList(object? value)
{
    var result = new List<long>();
    if (value is System.Text.Json.JsonElement el && el.ValueKind == System.Text.Json.JsonValueKind.Array)
    {
        foreach (var item in el.EnumerateArray())
            if (item.TryGetInt64(out var l)) result.Add(l);
    }
    return result;
}
```

`WebViewBridge.cs`:
1. Ctor-Signatur um `FaceScanService faceScanService, IFaceEngine faceEngine` erweitern (nach `duplicateDetectionService`).
2. Im Handler-Array ergänzen:
```csharp
new FaceHandler(
    faceScanService, faceEngine, databaseService, exifToolService,
    loggerFactory.CreateLogger<FaceHandler>()),
```
3. Nach der `folderWatcherService.FilesChanged`-Verdrahtung:
```csharp
// Face scan progress → frontend events. / Scan-Fortschritt als Events ans Frontend.
faceScanService.Progress += (current, total, faces) =>
    SendEvent("faceScanProgress", new { current, total, faces });
faceScanService.Completed += summary =>
    SendEvent("faceScanCompleted", new { scanned = summary.Scanned, faces = summary.Faces, skipped = summary.Skipped, cancelled = summary.Cancelled });
```

`MainWindow.xaml.cs`: In `ResolveServices` (~Zeile 127) zwei Einträge ergänzen: `_serviceProvider.GetRequiredService<FaceScanService>()`, `_serviceProvider.GetRequiredService<IFaceEngine>()`; die Tuple-Destrukturierung (~Zeile 230) und den `new WebViewBridge(...)`-Aufruf (~Zeile 236) entsprechend erweitern (`faceScanService`, `faceEngine` vor `bridgeLogger` einfügen — exakt dieselbe Reihenfolge wie im Ctor).

- [ ] **Step 5: Tests ausführen — müssen bestehen**

Run: `dotnet test TagFusion.sln` und (aus `Frontend/`) `npm run test -- --run bridgeContract`
Expected: Backend PASS komplett (inkl. `BridgeContractTests` mit den 7 neuen Actions); Frontend-Contract-Test PASS.

- [ ] **Step 6: Commit**

```bash
git add Backend/TagFusion/Bridge/Handlers/FaceHandler.cs Backend/TagFusion/Bridge/Handlers/PayloadHelper.cs Backend/TagFusion/Bridge/WebViewBridge.cs Backend/TagFusion/MainWindow.xaml.cs bridge-actions.json Frontend/src/services/bridgeActions.ts Backend/TagFusion.Tests/Bridge/Handlers/FaceHandlerTests.cs
git commit -m "Add face bridge handler with scan, review and confirm actions"
```

---

### Task 9: Frontend — Typen, Bridge-Methoden, faceStore

**Files:**
- Modify: `Frontend/src/types/index.ts` (Face-Typen)
- Modify: `Frontend/src/services/bridge.ts` (7 Methoden + healthCheck-Feld + Mocks)
- Create: `Frontend/src/stores/faceStore.ts`
- Test: `Frontend/src/stores/__tests__/faceStore.test.ts` (neu)

**Interfaces:**
- Consumes: Bridge-Actions/Events aus Task 8
- Produces:
  - Typen: `FaceCrop { faceId: number; imagePath: string; crop: string }`, `FaceSuggestion { personId: number; personName: string; score: number; faceIds: number[]; sample: FaceCrop[] }`, `UnknownFaceGroup { faceIds: number[]; sample: FaceCrop[] }`, `FaceReview { suggestions: FaceSuggestion[]; groups: UnknownFaceGroup[] }`, `Person { id: number; name: string; faceCount: number }`
  - Bridge: `scanFacesInFolder(path): Promise<boolean>`, `cancelFaceScan(): Promise<boolean>`, `getFaceReview(path): Promise<FaceReview>`, `confirmFaceGroup(faceIds, personName): Promise<{ tagged: number; failed: number }>`, `rejectFaceSuggestion(faceIds): Promise<boolean>`, `ignoreFaces(faceIds): Promise<boolean>`, `getPersons(): Promise<Person[]>`
  - `useFaceStore`: State `{ engineAvailable: boolean | null; isScanning: boolean; progress: { current: number; total: number; faces: number } | null; review: FaceReview | null; isPanelOpen: boolean; persons: Person[] }`; Actions `checkEngine()`, `startScan(path)`, `cancelScan()`, `loadReview(path)`, `confirmGroup(faceIds, personName, path)`, `rejectSuggestion(faceIds, path)`, `ignoreGroup(faceIds, path)`, `closePanel()`, `setupFaceSubscriptions()`

- [ ] **Step 1: Failing Store-Test schreiben**

Neue Datei `Frontend/src/stores/__tests__/faceStore.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFaceStore } from '../faceStore';
import { bridge } from '../../services/bridge';

vi.mock('../../services/bridge', () => ({
  bridge: {
    scanFacesInFolder: vi.fn(),
    cancelFaceScan: vi.fn(),
    getFaceReview: vi.fn(),
    confirmFaceGroup: vi.fn(),
    rejectFaceSuggestion: vi.fn(),
    ignoreFaces: vi.fn(),
    getPersons: vi.fn(),
    healthCheck: vi.fn(),
    on: vi.fn(),
  },
}));

const mockedBridge = vi.mocked(bridge);

describe('faceStore', () => {
  beforeEach(() => {
    useFaceStore.setState({
      engineAvailable: null,
      isScanning: false,
      progress: null,
      review: null,
      isPanelOpen: false,
      persons: [],
    });
    vi.clearAllMocks();
  });

  it('startScan sets isScanning and calls the bridge', async () => {
    mockedBridge.scanFacesInFolder.mockResolvedValue(true);

    await useFaceStore.getState().startScan('C:\\fotos');

    expect(mockedBridge.scanFacesInFolder).toHaveBeenCalledWith('C:\\fotos');
    expect(useFaceStore.getState().isScanning).toBe(true);
  });

  it('loadReview stores review data and opens the panel', async () => {
    mockedBridge.getFaceReview.mockResolvedValue({ suggestions: [], groups: [] });
    mockedBridge.getPersons.mockResolvedValue([{ id: 1, name: 'Max', faceCount: 2 }]);

    await useFaceStore.getState().loadReview('C:\\fotos');

    const state = useFaceStore.getState();
    expect(state.review).toEqual({ suggestions: [], groups: [] });
    expect(state.persons).toHaveLength(1);
    expect(state.isPanelOpen).toBe(true);
  });

  it('confirmGroup calls bridge and reloads the review', async () => {
    mockedBridge.confirmFaceGroup.mockResolvedValue({ tagged: 2, failed: 0 });
    mockedBridge.getFaceReview.mockResolvedValue({ suggestions: [], groups: [] });
    mockedBridge.getPersons.mockResolvedValue([]);

    await useFaceStore.getState().confirmGroup([1, 2], 'Max', 'C:\\fotos');

    expect(mockedBridge.confirmFaceGroup).toHaveBeenCalledWith([1, 2], 'Max');
    expect(mockedBridge.getFaceReview).toHaveBeenCalledWith('C:\\fotos');
  });

  it('checkEngine reads faceEngineOk from healthCheck', async () => {
    mockedBridge.healthCheck.mockResolvedValue({ faceEngineOk: true } as never);

    await useFaceStore.getState().checkEngine();

    expect(useFaceStore.getState().engineAvailable).toBe(true);
  });
});
```

- [ ] **Step 2: Test ausführen — muss fehlschlagen**

Run (aus `Frontend/`): `npm run test -- --run faceStore`
Expected: FAIL — Modul `../faceStore` existiert nicht.

- [ ] **Step 3: Implementierung**

`Frontend/src/types/index.ts` — am Ende ergänzen:

```typescript
// Face recognition types / Gesichtserkennung
export interface FaceCrop {
  faceId: number;
  imagePath: string;
  crop: string; // Base64 JPEG (96px)
}

export interface FaceSuggestion {
  personId: number;
  personName: string;
  score: number;
  faceIds: number[];
  sample: FaceCrop[];
}

export interface UnknownFaceGroup {
  faceIds: number[];
  sample: FaceCrop[];
}

export interface FaceReview {
  suggestions: FaceSuggestion[];
  groups: UnknownFaceGroup[];
}

export interface Person {
  id: number;
  name: string;
  faceCount: number;
}
```

`Frontend/src/services/bridge.ts`:
1. Import erweitern: `FaceReview`, `Person` zum Typ-Import hinzufügen.
2. Im `healthCheck`-Rückgabetyp `faceEngineOk: boolean;` ergänzen und im Mock (`case 'healthCheck'`) `faceEngineOk: false,` hinzufügen.
3. Neue Methoden (nach `searchImages` einordnen):

```typescript
  // Face recognition — manual folder scan, review, confirmation
  // Gesichtserkennung — manueller Ordner-Scan, Review, Bestätigung
  async scanFacesInFolder(path: string): Promise<boolean> {
    return this.send<boolean>(BRIDGE_ACTIONS.SCAN_FACES_IN_FOLDER, { path });
  }

  async cancelFaceScan(): Promise<boolean> {
    return this.send<boolean>(BRIDGE_ACTIONS.CANCEL_FACE_SCAN);
  }

  async getFaceReview(path: string): Promise<FaceReview> {
    return this.send<FaceReview>(BRIDGE_ACTIONS.GET_FACE_REVIEW, { path });
  }

  async confirmFaceGroup(faceIds: number[], personName: string): Promise<{ tagged: number; failed: number }> {
    return this.send<{ tagged: number; failed: number }>(BRIDGE_ACTIONS.CONFIRM_FACE_GROUP, { faceIds, personName });
  }

  async rejectFaceSuggestion(faceIds: number[]): Promise<boolean> {
    return this.send<boolean>(BRIDGE_ACTIONS.REJECT_FACE_SUGGESTION, { faceIds });
  }

  async ignoreFaces(faceIds: number[]): Promise<boolean> {
    return this.send<boolean>(BRIDGE_ACTIONS.IGNORE_FACES, { faceIds });
  }

  async getPersons(): Promise<Person[]> {
    return this.send<Person[]>(BRIDGE_ACTIONS.GET_PERSONS, undefined);
  }
```

4. Browser-Mocks im `switch` ergänzen:

```typescript
      case 'scanFacesInFolder':
      case 'cancelFaceScan':
      case 'rejectFaceSuggestion':
      case 'ignoreFaces':
        return true;
      case 'getFaceReview':
        return { suggestions: [], groups: [] };
      case 'getPersons':
        return [];
```

Neue Datei `Frontend/src/stores/faceStore.ts`:

```typescript
import { create } from 'zustand';
import { bridge } from '../services/bridge';
import type { FaceReview, Person } from '../types';
import { useToastStore } from './toastStore';

let subscriptionsInitialized = false;

interface FaceState {
  engineAvailable: boolean | null; // null = not yet checked / noch nicht geprüft
  isScanning: boolean;
  progress: { current: number; total: number; faces: number } | null;
  review: FaceReview | null;
  isPanelOpen: boolean;
  persons: Person[];

  checkEngine: () => Promise<void>;
  startScan: (path: string) => Promise<void>;
  cancelScan: () => Promise<void>;
  loadReview: (path: string) => Promise<void>;
  confirmGroup: (faceIds: number[], personName: string, path: string) => Promise<void>;
  rejectSuggestion: (faceIds: number[], path: string) => Promise<void>;
  ignoreGroup: (faceIds: number[], path: string) => Promise<void>;
  closePanel: () => void;
  setupFaceSubscriptions: (getCurrentFolder: () => string | null) => void;
}

export const useFaceStore = create<FaceState>((set, get) => ({
  engineAvailable: null,
  isScanning: false,
  progress: null,
  review: null,
  isPanelOpen: false,
  persons: [],

  checkEngine: async () => {
    try {
      const health = await bridge.healthCheck();
      set({ engineAvailable: health.faceEngineOk });
    } catch {
      set({ engineAvailable: false });
    }
  },

  startScan: async (path) => {
    try {
      await bridge.scanFacesInFolder(path);
      set({ isScanning: true, progress: null });
    } catch (error) {
      useToastStore.getState().warning((error as Error).message);
    }
  },

  cancelScan: async () => {
    await bridge.cancelFaceScan();
  },

  loadReview: async (path) => {
    const [review, persons] = await Promise.all([bridge.getFaceReview(path), bridge.getPersons()]);
    set({ review, persons, isPanelOpen: true });
  },

  confirmGroup: async (faceIds, personName, path) => {
    try {
      const result = await bridge.confirmFaceGroup(faceIds, personName);
      const toast = useToastStore.getState();
      if (result.failed > 0) {
        toast.warning(`${result.tagged} Bilder getaggt, ${result.failed} fehlgeschlagen`);
      } else {
        toast.success(`${result.tagged} Bilder mit "${personName}" getaggt`);
      }
      await get().loadReview(path);
    } catch (error) {
      useToastStore.getState().warning((error as Error).message);
    }
  },

  rejectSuggestion: async (faceIds, path) => {
    await bridge.rejectFaceSuggestion(faceIds);
    await get().loadReview(path);
  },

  ignoreGroup: async (faceIds, path) => {
    await bridge.ignoreFaces(faceIds);
    await get().loadReview(path);
  },

  closePanel: () => set({ isPanelOpen: false, review: null }),

  setupFaceSubscriptions: (getCurrentFolder) => {
    if (subscriptionsInitialized) return;
    subscriptionsInitialized = true;

    bridge.on('faceScanProgress', (data) => {
      const { current, total, faces } = data as { current: number; total: number; faces: number };
      set({ progress: { current, total, faces } });
    });

    bridge.on('faceScanCompleted', (data) => {
      const { scanned, faces, cancelled } = data as {
        scanned: number; faces: number; skipped: number; cancelled: boolean;
      };
      set({ isScanning: false, progress: null });
      const toast = useToastStore.getState();
      if (cancelled) {
        toast.warning('Gesichter-Scan abgebrochen');
        return;
      }
      toast.success(`Scan fertig: ${faces} Gesichter in ${scanned} Bildern`);
      const folder = getCurrentFolder();
      if (folder) void get().loadReview(folder);
    });
  },
}));
```

- [ ] **Step 4: Tests, Lint — müssen bestehen**

Run (aus `Frontend/`): `npm run test -- --run` und `npm run lint`
Expected: PASS / 0 Warnings.

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/types/index.ts Frontend/src/services/bridge.ts Frontend/src/stores/faceStore.ts Frontend/src/stores/__tests__/faceStore.test.ts
git commit -m "Add face store and bridge methods for face recognition"
```

---

### Task 10: Frontend — Toolbar-Button + FaceReviewPanel + Übersetzungen

**Files:**
- Modify: `Frontend/src/locales/de/common.json` + `Frontend/src/locales/en/common.json` (Abschnitt `faces`)
- Create: `Frontend/src/components/faces/FaceReviewPanel.tsx`
- Create: `Frontend/src/components/faces/index.ts`
- Modify: `Frontend/src/components/layout/Toolbar.tsx` (Scan-Button + Fortschritt)
- Modify: `Frontend/src/App.tsx` (Panel mounten, `setupFaceSubscriptions` + `checkEngine` in der Init — dort, wo `setupSubscriptions` bereits aufgerufen wird; falls das in `useAppInit` passiert, dort)
- Test: `Frontend/src/components/faces/FaceReviewPanel.test.tsx` (neu)

**Interfaces:**
- Consumes: `useFaceStore` (Task 9), bestehende Glass-Komponenten (`GlassModal`, `GlassButton`, `GlassInput` aus `../ui/glass`), `useCurrentFolder` (appStore), i18next `useTranslation`
- Produces: sichtbares Feature — Scan-Button in der Toolbar, Review-Panel

- [ ] **Step 1: Übersetzungen ergänzen**

In `Frontend/src/locales/de/common.json` (Top-Level-Schlüssel `faces`):

```json
"faces": {
  "scan": "Gesichter scannen",
  "scanning": "Scanne Gesichter… {{current}}/{{total}}",
  "cancel": "Abbrechen",
  "reviewTitle": "Gesichter überprüfen",
  "suggestionsHeading": "Vorschläge",
  "suggestionQuestion": "Ist das {{name}}?",
  "confirm": "Bestätigen",
  "reject": "Ablehnen",
  "unknownHeading": "Unbekannte Gesichter",
  "groupSize": "{{count}} Gesichter",
  "namePlaceholder": "Name eingeben…",
  "ignore": "Ignorieren",
  "empty": "Keine offenen Gesichter in diesem Ordner.",
  "renameHint": "Hinweis: Ein bestätigter Name wird als Tag in die Dateien geschrieben. Späteres Umbenennen einer Person ändert bereits geschriebene Tags nicht."
}
```

In `Frontend/src/locales/en/common.json` sinngemäß auf Englisch (gleiche Schlüssel):

```json
"faces": {
  "scan": "Scan faces",
  "scanning": "Scanning faces… {{current}}/{{total}}",
  "cancel": "Cancel",
  "reviewTitle": "Review faces",
  "suggestionsHeading": "Suggestions",
  "suggestionQuestion": "Is this {{name}}?",
  "confirm": "Confirm",
  "reject": "Reject",
  "unknownHeading": "Unknown faces",
  "groupSize": "{{count}} faces",
  "namePlaceholder": "Enter name…",
  "ignore": "Ignore",
  "empty": "No open faces in this folder.",
  "renameHint": "Note: a confirmed name is written into the files as a tag. Renaming a person later does not change tags already written."
}
```

- [ ] **Step 2: Failing Component-Test schreiben**

Neue Datei `Frontend/src/components/faces/FaceReviewPanel.test.tsx` (Muster an bestehenden Component-Tests wie `ImageCard.test.tsx` orientieren — gleiche Test-Setup-Imports):

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FaceReviewPanel } from './FaceReviewPanel';
import { useFaceStore } from '../../stores/faceStore';

vi.mock('../../services/bridge', () => ({
  bridge: {
    getFaceReview: vi.fn(),
    getPersons: vi.fn(),
    confirmFaceGroup: vi.fn(),
    rejectFaceSuggestion: vi.fn(),
    ignoreFaces: vi.fn(),
    healthCheck: vi.fn(),
    on: vi.fn(),
  },
}));

describe('FaceReviewPanel', () => {
  beforeEach(() => {
    useFaceStore.setState({
      isPanelOpen: true,
      review: {
        suggestions: [
          { personId: 1, personName: 'Max', score: 0.8, faceIds: [1, 2], sample: [{ faceId: 1, imagePath: 'C:\\a.jpg', crop: 'QUJD' }] },
        ],
        groups: [{ faceIds: [3], sample: [{ faceId: 3, imagePath: 'C:\\b.jpg', crop: 'QUJD' }] }],
      },
      persons: [{ id: 1, name: 'Max', faceCount: 2 }],
    });
  });

  it('renders suggestion question and unknown group', () => {
    render(<FaceReviewPanel />);

    expect(screen.getByText(/Max/)).toBeInTheDocument();
    expect(screen.getAllByRole('img').length).toBeGreaterThanOrEqual(2);
  });

  it('renders nothing when panel is closed', () => {
    useFaceStore.setState({ isPanelOpen: false });
    const { container } = render(<FaceReviewPanel />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 3: Test ausführen — muss fehlschlagen**

Run: `npm run test -- --run FaceReviewPanel`
Expected: FAIL — Komponente existiert nicht.

- [ ] **Step 4: Implementierung**

Neue Datei `Frontend/src/components/faces/FaceReviewPanel.tsx`:

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X, EyeOff } from 'lucide-react';
import { useFaceStore } from '../../stores/faceStore';
import { useCurrentFolder } from '../../stores/appStore';
import { GlassModal, GlassButton, GlassInput } from '../ui/glass';
import type { FaceCrop } from '../../types';

// Small strip of face crops. / Kleine Leiste mit Gesichts-Ausschnitten.
function CropStrip({ crops }: { crops: FaceCrop[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {crops.map((c) => (
        <img
          key={c.faceId}
          src={`data:image/jpeg;base64,${c.crop}`}
          alt={c.imagePath}
          title={c.imagePath}
          className="h-16 w-16 rounded-lg object-cover"
        />
      ))}
    </div>
  );
}

export function FaceReviewPanel() {
  const { t } = useTranslation();
  const currentFolder = useCurrentFolder();
  const { isPanelOpen, review, persons, confirmGroup, rejectSuggestion, ignoreGroup, closePanel } = useFaceStore();
  const [groupNames, setGroupNames] = useState<Record<number, string>>({});

  if (!isPanelOpen || !review || !currentFolder) return null;

  const isEmpty = review.suggestions.length === 0 && review.groups.length === 0;

  return (
    <GlassModal isOpen={isPanelOpen} onClose={closePanel} title={t('faces.reviewTitle')}>
      <div className="flex max-h-[70vh] flex-col gap-6 overflow-y-auto p-1">
        {isEmpty && <p className="text-sm opacity-70">{t('faces.empty')}</p>}

        {review.suggestions.length > 0 && (
          <section className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold uppercase opacity-70">{t('faces.suggestionsHeading')}</h3>
            {review.suggestions.map((s) => (
              <div key={`${s.personId}-${s.faceIds[0]}`} className="flex flex-col gap-2 rounded-xl border border-white/10 p-3">
                <p className="font-medium">
                  {t('faces.suggestionQuestion', { name: s.personName })}{' '}
                  <span className="text-xs opacity-60">({t('faces.groupSize', { count: s.faceIds.length })})</span>
                </p>
                <CropStrip crops={s.sample} />
                <div className="flex gap-2">
                  <GlassButton onClick={() => void confirmGroup(s.faceIds, s.personName, currentFolder)}>
                    <Check size={16} /> {t('faces.confirm')}
                  </GlassButton>
                  <GlassButton variant="ghost" onClick={() => void rejectSuggestion(s.faceIds, currentFolder)}>
                    <X size={16} /> {t('faces.reject')}
                  </GlassButton>
                </div>
              </div>
            ))}
          </section>
        )}

        {review.groups.length > 0 && (
          <section className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold uppercase opacity-70">{t('faces.unknownHeading')}</h3>
            {review.groups.map((g, index) => (
              <div key={g.faceIds[0]} className="flex flex-col gap-2 rounded-xl border border-white/10 p-3">
                <p className="text-xs opacity-60">{t('faces.groupSize', { count: g.faceIds.length })}</p>
                <CropStrip crops={g.sample} />
                <div className="flex items-center gap-2">
                  <GlassInput
                    value={groupNames[index] ?? ''}
                    onChange={(e) => setGroupNames((prev) => ({ ...prev, [index]: e.target.value }))}
                    placeholder={t('faces.namePlaceholder')}
                    list={`persons-${index}`}
                  />
                  <datalist id={`persons-${index}`}>
                    {persons.map((p) => (
                      <option key={p.id} value={p.name} />
                    ))}
                  </datalist>
                  <GlassButton
                    disabled={!(groupNames[index] ?? '').trim()}
                    onClick={() => void confirmGroup(g.faceIds, (groupNames[index] ?? '').trim(), currentFolder)}
                  >
                    <Check size={16} /> {t('faces.confirm')}
                  </GlassButton>
                  <GlassButton variant="ghost" onClick={() => void ignoreGroup(g.faceIds, currentFolder)}>
                    <EyeOff size={16} /> {t('faces.ignore')}
                  </GlassButton>
                </div>
              </div>
            ))}
          </section>
        )}

        <p className="text-xs opacity-50">{t('faces.renameHint')}</p>
      </div>
    </GlassModal>
  );
}
```

`Frontend/src/components/faces/index.ts`:

```typescript
export { FaceReviewPanel } from './FaceReviewPanel';
```

**Anpassung an die realen Glass-Komponenten:** Vor dem Schreiben die Props von `GlassModal`/`GlassButton`/`GlassInput` in `Frontend/src/components/ui/glass/` nachschlagen (Prop-Namen wie `isOpen`/`open`, `variant`-Werte, Input-`onChange`-Signatur) und den obigen Code exakt daran ausrichten — die Struktur bleibt, nur Prop-Namen dürfen abweichen. Gleiches gilt für den Test (`GlassModal` rendert evtl. über ein Portal — dann `screen`-Queries statt `container`).

`Toolbar.tsx` — Scan-Button ergänzen: Import `ScanFace` von `lucide-react`, `useFaceStore` importieren. Im Komponentenkörper:

```typescript
const currentFolderForFaces = useCurrentFolder();
const { engineAvailable, isScanning, progress, checkEngine, startScan, cancelScan } = useFaceStore();

useEffect(() => {
  if (engineAvailable === null) void checkEngine();
}, [engineAvailable, checkEngine]);
```

Bei den anderen Toolbar-Buttons (gleicher Stil wie der Globus-Button, Zeile ~380):

```tsx
{currentFolderForFaces && (
  isScanning ? (
    <GlassButton variant="ghost" onClick={() => void cancelScan()} title={t('faces.cancel')}>
      {progress
        ? t('faces.scanning', { current: progress.current, total: progress.total })
        : t('faces.scan')}
    </GlassButton>
  ) : (
    <GlassButton
      variant="ghost"
      disabled={engineAvailable === false}
      onClick={() => void startScan(currentFolderForFaces)}
      title={t('faces.scan')}
    >
      <ScanFace size={18} />
    </GlassButton>
  )
)}
```

(Existierende Hooks wie `useCurrentFolder` sind in der Toolbar ggf. schon importiert — dann wiederverwenden, nicht doppeln.)

`App.tsx`: `<FaceReviewPanel />` neben den anderen Modals/Overlays mounten. Beim bestehenden Subscriptions-Setup (`setupSubscriptions`-Aufruf, vermutlich in `useAppInit`): direkt daneben

```typescript
useFaceStore.getState().setupFaceSubscriptions(() => useAppStore.getState().currentFolder ?? null);
```

- [ ] **Step 5: Tests, Lint, Build — müssen bestehen**

Run (aus `Frontend/`): `npm run test -- --run && npm run lint && npm run build`
Expected: PASS / 0 Warnings / Build OK.

- [ ] **Step 6: Commit**

```bash
git add Frontend/src/locales/de/common.json Frontend/src/locales/en/common.json Frontend/src/components/faces/ Frontend/src/components/layout/Toolbar.tsx Frontend/src/App.tsx
git commit -m "Add face scan button and review panel UI"
```

---

### Task 11: Gesamtverifikation, Changelog, Smoke-Test-Doku

**Files:**
- Modify: `CHANGELOG.md` (`[Unreleased]` → `### Added`)
- Create: `docs/face-recognition-smoke-test.md`

**Interfaces:**
- Consumes: alle vorherigen Tasks

- [ ] **Step 1: Backend-Gesamtsuite**

Run (aus `Backend/`): `dotnet test TagFusion.sln`
Expected: PASS, 0 Failures, keine neuen Compiler-Warnungen.

- [ ] **Step 2: Frontend-Gesamtsuite + Lint + Build**

Run (aus `Frontend/`): `npm run test -- --run && npm run lint && npm run build`
Expected: PASS / 0 Warnings / Build OK.

- [ ] **Step 3: Changelog-Eintrag**

In `CHANGELOG.md` unter `## [Unreleased]` → `### Added` als erste Einträge:

```markdown
- Local face recognition: manual per-folder scan (FaceAiSharp/ONNX, fully offline), similarity-grouped naming, suggestions for known persons with confirm/reject, confirmed names written as regular tags
- Face data stored in SQLite (Persons/Faces, migration v4); face engine is optional — the app runs normally without model files
```

- [ ] **Step 4: Smoke-Test-Doku schreiben**

Neue Datei `docs/face-recognition-smoke-test.md`:

```markdown
# Gesichtserkennung — manueller Smoke-Test

Nicht in CI (echte ONNX-Modelle, ~100 MB). Vor jedem Release einmal durchführen.

## Vorbereitung
1. Release-Build erstellen (`./build_release.ps1`) und prüfen, dass im Publish-Ordner
   ONNX-Modelldateien neben der Exe liegen (FaceAiSharp.Bundle kopiert sie beim Publish).
2. Testordner mit ~20 Fotos: mind. 2 Personen, je mehrere Bilder, 1-2 Bilder ohne Gesichter,
   1 absichtlich defekte Datei (z. B. .txt in .jpg umbenannt).

## Ablauf
1. App starten, Testordner öffnen → Toolbar-Button „Gesichter scannen" ist aktiv.
2. Scan starten → Fortschritt zählt hoch; defekte Datei bricht den Scan NICHT ab.
3. Nach Abschluss öffnet sich das Review-Panel: unbekannte Gesichter sind gruppiert;
   Gruppen entsprechen (grob) den echten Personen. Falls Gruppen zu grob/fein:
   `FaceMatcher.ClusterThreshold` justieren (höher = strengere Gruppen).
4. Eine Gruppe benennen („Max") → Toast bestätigt; Tags per Explorer/Adobe prüfen.
5. Ordner mit weiteren Fotos derselben Person scannen → Vorschlag „Ist das Max?"
   erscheint. Falls zu selten: `FaceMatcher.SuggestionThreshold` senken (min. ~0.45).
6. Vorschlag ablehnen → nach erneutem Scan wird dieselbe Person NICHT wieder vorgeschlagen.
7. Rescan desselben Ordners ohne Änderungen → sofort fertig (0 gescannt, alles übersprungen).
8. Modelle testweise wegbenennen → App startet normal, Button zeigt deaktivierten Zustand.
```

- [ ] **Step 5: Commit**

```bash
git add CHANGELOG.md docs/face-recognition-smoke-test.md
git commit -m "Document face recognition in changelog and add smoke test guide"
```

---

## Hinweise für die Ausführung

- **Reihenfolge:** 1→8 strikt sequenziell (Schema → Persistenz → Matching → Engine → Scan → Crops → Handler). 9→10 nach 8. Task 11 zuletzt.
- **FaceAiSharp wird in Unit-Tests NIE instanziiert** — nur `FaceGeometry` und Mocks. Die echte Engine wird ausschließlich über den dokumentierten Smoke-Test geprüft.
- **`AlignFaceUsingLandmarks` mutiert das Bild in-place** — deshalb der Clone pro Gesicht in `FaceAiSharpEngine.Analyze`. Nicht wegoptimieren.
- **Contract-Tests:** Beide lesen/prüfen die Action-Kataloge. Neue Actions sind eine Erweiterung — bestehende Einträge nie umbenennen.
- **Glass-Komponenten-Props** in Task 10 vor Verwendung nachschlagen (exakte Prop-Namen), Struktur des gezeigten Codes beibehalten.
- **Threshold-Konstanten** (`0.50`/`0.55`) sind Startwerte; Feinjustierung nur über den Smoke-Test, nie ad hoc im Code verstreuen.
