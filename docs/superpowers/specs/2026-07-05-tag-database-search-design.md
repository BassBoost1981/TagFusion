# Design: Globale Tag- und Dateinamen-Suche (Teilwort, case-insensitiv)

**Datum:** 2026-07-05
**Status:** Entwurf zur Review
**Feature 1 von 3** (danach geplant: Gesichtserkennung, lokale KI-Bildbeschreibung — jeweils eigene Specs)

## Ziel

Die globale Suche soll alle jemals in TagFusion erfassten Bilder über ihre Tags **und**
Dateinamen finden — mit Teilwort-Treffern und ohne Beachtung der Groß-/Kleinschreibung.
Beispiel: „url" findet Bilder mit Tag „Urlaub" oder „Urlaubsreise" sowie Dateien wie
`Urlaub_2024.jpg`.

## Ausgangslage

Die Infrastruktur existiert bereits zu großen Teilen:

- SQLite-Schema `Images` / `Tags` / `ImageTags` (`DatabaseService.InitializeDatabase`)
- Bilder landen passiv in der DB: beim Öffnen eines Ordners (`FileSystemHandler`,
  ExifTool-Fallback), beim Tag-Schreiben (`TagHandler`), beim Import (`TagExportService`)
- Globale Suche vorhanden: Toolbar-Globus → `searchImages` → `DatabaseService.SearchImagesAsync`
  → Ergebnisse ersetzen das Grid (`uiSlice.executeGlobalSearch`, `ImageGrid`)

**Schwächen heute:**

1. Suchtext wird als *ein* exakter Tag behandelt — kein Teilwort, case-sensitiv
2. Keine Mehrbegriff-Suche über das Suchfeld
3. Dateinamen werden global nicht durchsucht
4. Verschobene/gelöschte Dateien bleiben als tote Einträge in DB und Suchergebnissen

## Getroffene Entscheidungen (mit User abgestimmt)

| Frage | Entscheidung |
|---|---|
| Indexierung | Passiv wie bisher (beim Durchsuchen/Taggen) — **kein** Hintergrund-Crawler |
| Such-Verhalten | Freitext, Teilwort, case-insensitiv; mehrere Begriffe = UND |
| Suchumfang | Tags **und** Dateinamen |
| Tote Einträge | Automatisch aufräumen bei der Suche (mit Laufwerk-Schutzregel) |
| Technik | SQL-`LIKE`-Suche (kein FTS5, kein In-Memory-Index) |

## Architektur

Keine neuen Komponenten — die bestehenden werden erweitert:

```
Toolbar (Begriffe zerlegen)
  → uiSlice.executeGlobalSearch(terms, minRating)
    → bridge.searchImages          [Payload-Form unverändert]
      → TagHandler.SearchImagesAsync
        → DatabaseService.SearchImagesAsync   [neue LIKE-Semantik]
        → Existenz-Check + Auto-Cleanup       [neu]
      ← nur existierende Treffer
```

## Komponenten im Detail

### 1. Migration v3: `FileName`-Spalte

- `ALTER TABLE Images ADD COLUMN FileName TEXT NOT NULL DEFAULT ''`
- Backfill der Bestandsdaten aus `Path` in C# (`Path.GetFileName`)
- Dafür wird der `MigrationRunner` minimal erweitert: das `Migration`-Record bekommt einen
  optionalen C#-Schritt (`Action<SQLiteConnection, SQLiteTransaction>`), der nach dem SQL
  **in derselben Transaktion** läuft. Bestehende Migrationen bleiben unverändert.
- `SaveImageAsync` / `SaveImagesBatchAsync` schreiben `FileName` ab sofort mit.
- Kein Index auf `FileName` — `LIKE '%…%'` kann ohnehin keinen nutzen (YAGNI).

### 2. Case-insensitives Matching inkl. Umlaute

SQLites eingebautes `LIKE`/`lower()` ist nur für ASCII case-insensitiv — „käfer" fände
„Käfer" nicht. Lösung: eine per `SQLiteFunction` registrierte C#-Funktion `lower_inv`
(`ToLowerInvariant`), die in der Such-Query auf `Tags.Name` und `Images.FileName`
angewendet wird. Suchbegriffe werden in C# ebenfalls invariant kleingeschrieben.

### 3. Neue Suchsemantik in `SearchImagesAsync`

Signatur bleibt `(List<string>? terms, int? minRating, int limit, int offset)` —
der Parameter heißt künftig `terms` statt `tags`. Pro Begriff gilt:

```sql
( EXISTS (SELECT 1 FROM ImageTags it JOIN Tags t ON it.TagId = t.Id
          WHERE it.ImageId = i.Id AND lower_inv(t.Name) LIKE @termN ESCAPE '\')
  OR lower_inv(i.FileName) LIKE @termN ESCAPE '\' )
```

- `@termN` = `%<begriff>%`, LIKE-Wildcards (`%`, `_`, `\`) im User-Input werden escaped
- Mehrere Begriffe: alle Bedingungen mit `AND` verknüpft
- `minRating`, `ORDER BY LastModified DESC`, `LIMIT/OFFSET` unverändert

**Bridge-Kontrakt:** Action-Name `searchImages` und Payload-Form
`{ tags, minRating, limit, offset }` bleiben identisch; nur die *Bedeutung* von `tags`
erweitert sich von „exakte Tags" zu „Suchbegriffe". Das Frontend ist der einzige Client;
die Contract-Tests beider Seiten bleiben strukturell gültig.

### 4. Auto-Cleanup toter Einträge (im `TagHandler` nach der DB-Abfrage)

1. Treffer nach Pfad-Wurzel gruppieren (`Path.GetPathRoot`)
2. Verfügbarkeit **pro Wurzel einmal** prüfen (`DriveInfo.IsReady` für Laufwerksbuchstaben;
   UNC-Pfade mit kurzem Timeout via `Directory.Exists`, bei Timeout „nicht verfügbar")
3. Wurzel nicht verfügbar → Treffer nur aus den **Ergebnissen** ausblenden, DB unangetastet
   (Schutz für abgestöpselte externe Platten / Netzlaufwerke)
4. Wurzel verfügbar → `File.Exists` pro Datei; fehlende Dateien aus Ergebnissen entfernen
   **und** per neuem `IDatabaseService.DeleteImagesAsync(paths)` aus der DB löschen
5. `DeleteImagesAsync` entfernt `Images`-Zeilen samt `ImageTags`-Verknüpfungen — explizites
   Löschen in einer Transaktion, ohne Verlass auf FK-Cascade (SQLite-FKs sind per Default aus;
   ob `PRAGMA foreign_keys` hier aktiv ist, wird bei der Umsetzung geprüft)
6. Verwaiste `Tags`-Zeilen (Tag ohne Bilder) bleiben stehen — unschädlich, ggf. späteres
   Aufräumen; sie erscheinen weiterhin in `getAllTags`-Vorschlägen
7. Cleanup-Fehler sind nie fatal: loggen, Suche liefert trotzdem (ohne die fehlenden Dateien)

### 5. Frontend

- `Toolbar.handleGlobalSearch`: Suchtext an Komma **oder** Leerzeichen zerlegen, trimmen,
  Leerstrings filtern → `executeGlobalSearch(terms, minRating)`
- `uiSlice.executeGlobalSearch` / `bridge.searchImages`: reichen `string[]` durch (tun sie
  strukturell schon — nur Semantik/Benennung anpassen), Mock-Antwort in `bridge.ts` angleichen
- Suche bleibt **explizit** (Enter / Globus-Button) — kein Search-as-you-type gegen die DB
- Ergebnisdarstellung, „Suche verlassen", Pagination (limit 200): unverändert

## Fehlerbehandlung

- Bestehendes Muster: `BridgeException` → deutsche Nutzermeldung als Toast, Details ins Log
- Leere Begriffliste + kein Rating-Filter → wie bisher: Suche wird gar nicht ausgelöst (Frontend-Guard)
- Cleanup-Fehler: loggen, nicht werfen (siehe oben)

## Testplan

**Backend (NUnit):**
- `DatabaseServiceTests`: Teilwort-Treffer, Case-Insensitivität inkl. Umlauten („käfer"→„Käfer"),
  Mehrbegriff-UND, Dateinamen-Treffer, LIKE-Wildcard-Escaping (`50%`-Tag), Pagination,
  `DeleteImagesAsync` entfernt Bild + Verknüpfungen
- `MigrationRunnerTests`: v3 legt Spalte an und befüllt Bestandspfade korrekt (inkl. Umlaute,
  Leerzeichen); C#-Schritt läuft transaktional (Fehler → Rollback)
- `TagHandlerTests`: Payload-Parsing, Cleanup blendet fehlende Dateien aus (Temp-Dateien),
  DB-Löschung nur bei verfügbarer Wurzel

**Frontend (Vitest):**
- Begriff-Zerlegung (Komma, Leerzeichen, Mehrfach-Whitespace, leere Eingabe)
- `uiSlice.executeGlobalSearch` mit Begriff-Array, Bridge-Mock angepasst

## Bewusst nicht enthalten

- Hintergrund-Crawler / Ordner-Registrierung (Entscheidung: passiv reicht)
- FTS5 / Volltext-Ranking (bei Bedarf späterer Umstieg möglich)
- ODER-Verknüpfung, Anführungszeichen-Syntax, Suche in Beschreibungen (ggf. mit Feature 3)
- Entfernen verwaister Tags
