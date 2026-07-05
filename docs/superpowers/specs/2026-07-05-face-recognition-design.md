# Design: Lokale Gesichtserkennung (Feature 2)

**Datum:** 2026-07-05
**Status:** Entwurf zur Review
**Feature 2 von 3** (Feature 1: globale Suche — umgesetzt; Feature 3: lokale KI-Bildbeschreibung — folgt)

## Ziel

TagFusion erkennt Gesichter in Bildern lokal (keine Cloud), gruppiert sie nach Ähnlichkeit
und schlägt bekannte Personen vor. Nach Bestätigung durch den User wird der Personenname
als **normaler Tag** in die Bild-Metadaten geschrieben — damit greifen Suche,
Adobe-Kompatibilität und Portabilität sofort.

## Getroffene Entscheidungen (mit User abgestimmt)

| Frage | Entscheidung |
|---|---|
| Ergebnis | Personenname als Tag in Metadaten (nach Bestätigung) |
| Automatik | Vorschlagen + Bestätigen — nie ungefragt in Dateien schreiben |
| Zeitpunkt | Manueller Scan pro Ordner (Button, Fortschritt, Abbrechen) |
| Unbekannte Gesichter | Gruppiert nach Ähnlichkeit, ein Name pro Gruppe |
| Technik | Ansatz A: FaceAiSharp; Wechsel auf ONNX pur (B) später möglich → Interface-Grenze |
| Verarbeitung | Komplett lokal, CPU, seriell (1 Bild gleichzeitig) |

## Architektur

```
Toolbar „Gesichter scannen"
  → bridge.scanFacesInFolder ──→ FaceHandler ──→ FaceScanService (seriell)
                                                    ├→ IFaceEngine.AnalyzeAsync   [FaceAiSharpEngine]
                                                    └→ IDatabaseService (Faces/Persons, Migration v4)
  ← faceScanProgress-Events
Review-Panel
  → bridge.getFaceReview  ──→ Vorschläge (bekannte Personen) + Gruppen (Unbekannte)
  → bridge.confirmFaceGroup ─→ Person anlegen/finden → Batch-Tag-Schreiben (bestehende Infra) → Status bestätigt
```

## Komponenten

### 1. `IFaceEngine` + `FaceAiSharpEngine` (Backend/Services)

```csharp
public record DetectedFace(float X, float Y, float Width, float Height, float[] Embedding);

public interface IFaceEngine
{
    /// <summary>True once models are loaded; false disables the feature gracefully.</summary>
    bool IsAvailable { get; }
    Task<IReadOnlyList<DetectedFace>> AnalyzeAsync(string imagePath, CancellationToken ct = default);
}
```

- `FaceAiSharpEngine` kapselt FaceAiSharp vollständig (kein FaceAiSharp-Typ im Rest der App).
  Lädt das Bild per ImageSharp, verkleinert auf max. 1280 px Kantenlänge (Koordinaten werden
  auf Originalmaße zurückgerechnet), führt Erkennung (SCRFD) + Embedding (ArcFace, 512 Floats) aus.
- NuGet: `FaceAiSharp.Bundle` (MIT). Modelle (~100 MB) liegen nach dem Publish neben der Exe.
- Init-Fehler (Modelle fehlen/defekt) → `IsAvailable = false`, Log-Warnung; die App läuft
  normal weiter, Scan-Aufrufe liefern eine deutsche Fehlermeldung.
- Späterer Ansatz B = neue Klasse hinter demselben Interface; DI-Registrierung tauschen.

### 2. Datenmodell — Migration v4 (reines SQL, bestehender MigrationRunner)

```sql
CREATE TABLE Persons (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT NOT NULL UNIQUE
);
CREATE TABLE Faces (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ImageId INTEGER NOT NULL,          -- → Images.Id (Löschen: explizit, wie ImageTags)
    X REAL NOT NULL, Y REAL NOT NULL, W REAL NOT NULL, H REAL NOT NULL,  -- Originalpixel
    Embedding BLOB NOT NULL,           -- 512 × float32, little-endian (2048 Bytes)
    PersonId INTEGER,                  -- gesetzt = bestätigt zugeordnet
    SuggestedPersonId INTEGER,         -- Vorschlag (unbestätigt)
    SuggestionScore REAL,              -- Kosinus-Ähnlichkeit des Vorschlags
    RejectedPersonId INTEGER,          -- abgelehnter Vorschlag — nie wieder dieselbe Person vorschlagen
    Status TEXT NOT NULL DEFAULT 'unnamed',  -- unnamed | suggested | confirmed | ignored
    ScannedAt TEXT NOT NULL
);
CREATE INDEX idx_faces_imageid ON Faces(ImageId);
CREATE INDEX idx_faces_status ON Faces(Status);
ALTER TABLE Images ADD COLUMN FaceScanAt TEXT;          -- wann gescannt
ALTER TABLE Images ADD COLUMN FaceScanFileTime TEXT;    -- Datei-mtime beim Scan
```

- Rescan überspringt Bilder mit `FaceScanAt`, deren mtime unverändert ist; geänderte Dateien
  werden neu gescannt (alte Faces des Bildes werden dabei ersetzt).
- `DeleteImagesAsync` (Feature 1) löscht künftig auch `Faces`-Zeilen der betroffenen Bilder.
- Neue `IDatabaseService`-Methoden: `SaveFacesAsync`, `GetFacesForReviewAsync`,
  `GetPersonsAsync`, `AssignFacesToPersonAsync`, `SetFaceStatusAsync`,
  `GetConfirmedEmbeddingsByPersonAsync`, `MarkImageFaceScannedAsync`.

### 3. `FaceScanService` (Backend/Services)

- Ein Scan-Lauf pro Zeit (laufender Scan → neuer Start liefert Fehlermeldung „Scan läuft bereits").
- Seriell: pro Bild laden → analysieren → speichern → `faceScanProgress { current, total, faces }`.
- `CancellationTokenSource` pro Lauf; `cancelFaceScan` bricht sauber nach dem aktuellen Bild ab.
- Einzelbild-Fehler: überspringen, zählen, am Ende im Ergebnis melden (`skipped`).
- Nach dem Scan: Vorschlags-Matching (siehe 4), Ergebnis (`Status`, `SuggestedPersonId`,
  `SuggestionScore`) persistiert. Die Gruppierung Unbekannter ist dagegen flüchtig und
  passiert erst bei `getFaceReview`.

### 4. Zuordnung & Gruppierung (`FaceMatcher` — reine, statische Funktionen)

- `CosineSimilarity(float[] a, float[] b)` — Standardformel.
- **Vorschläge:** Für jede bestätigte Person wird der Zentroid (Mittelwert) ihrer bestätigten
  Embeddings gebildet. Neues Gesicht ≥ `SUGGESTION_THRESHOLD` (Default **0.50**) zum besten
  Zentroid → `Status = suggested`, `SuggestedPersonId`, `SuggestionScore`. Gesichter mit
  gesetzter `RejectedPersonId` bekommen diese Person nie erneut vorgeschlagen (nächstbester
  Zentroid über der Schwelle darf trotzdem vorgeschlagen werden).
- **Gruppierung Unbekannter:** Greedy-Clustering — jedes ungruppierte Gesicht startet eine
  Gruppe; weitere Gesichter treten bei Ähnlichkeit ≥ `CLUSTER_THRESHOLD` (Default **0.55**,
  bewusst strenger) zum Gruppen-Zentroid bei. Gruppen sind Review-Artefakte (werden pro
  `getFaceReview` berechnet, nicht persistiert).
- Beide Schwellen sind benannte Konstanten; Feinjustierung über den manuellen Smoke-Test
  (siehe Tests). Werte stammen aus üblichen ArcFace-Erfahrungswerten.

### 5. Bridge (neue Actions — Kontrakt-Erweiterung, kein Bruch)

| Action | Payload | Ergebnis |
|---|---|---|
| `scanFacesInFolder` | `{ path }` | `{ scanned, faces, skipped }` (nach Abschluss) |
| `cancelFaceScan` | – | `true` |
| `getFaceReview` | `{ path }` | `{ suggestions: [{ personId, personName, score, faces: [{ faceId, imagePath, cropBase64 }] }], groups: [{ faces: [...] }] }` |
| `confirmFaceGroup` | `{ faceIds, personName }` | `{ tagged, failed }` — legt Person ggf. an, schreibt Tag via bestehender Batch-Infra, setzt `confirmed` |
| `rejectFaceSuggestion` | `{ faceIds }` | `true` — zurück auf `unnamed` + `RejectedPersonId` gesetzt (landet wieder in Gruppen, dieselbe Person wird diesem Gesicht nie erneut vorgeschlagen) |
| `ignoreFaces` | `{ faceIds }` | `true` — `ignored`, taucht nie wieder auf |
| `getPersons` | – | `[{ id, name, faceCount }]` (für Autocomplete) |

- Event: `faceScanProgress { current, total, faces }`.
- Neuer `FaceHandler : IBridgeHandler`; Einträge in `bridge-actions.json`, `bridgeActions.ts`
  und beiden Contract-Tests (Erweiterung ist erlaubt — nur bestehende Signaturen sind tabu).
- Gesichts-Ausschnitte: Backend cropt per ImageSharp (Rahmen + 20 % Rand, 96 px JPEG,
  Base64 in der Antwort). Kein neuer Cache — Review-Antworten sind klein und flüchtig.

### 6. Tag-Schreiben (Bestätigungsmoment)

`confirmFaceGroup` nutzt exakt den bestehenden Pfad von `updateBatchTag`/`writeBatchTags`
(ExifTool-Batch, Teil-Erfolge, DB-Sync, `batchProgress`-Event): Personenname = Tag-Text,
Operation „add". Fehlgeschlagene Dateien bleiben `suggested`/`unnamed` und werden gemeldet.

**Dokumentierte v1-Grenze:** Person umbenennen ändert nur den Katalog (`Persons.Name`),
nicht rückwirkend die Tags in bereits geschriebenen Dateien. Das Review-Panel weist darauf hin.

### 7. Frontend

- **Toolbar:** Button „Gesichter scannen" (nur aktiv, wenn ein Ordner geöffnet ist und die
  Engine verfügbar ist — Verfügbarkeit kommt über den bestehenden `healthCheck` mit neuem
  Feld `faceEngineOk`). Während des Scans: Fortschritt + Abbrechen.
- **Review-Panel** (`FaceReviewPanel`, neuer `faceStore` mit Zustand):
  - Sektion „Vorschläge": pro Person eine Karte „Ist das {Name}?" mit Gesichts-Crops,
    Buttons Bestätigen / Ablehnen (pro Karte, nicht pro Einzelgesicht).
  - Sektion „Unbekannte Gesichter": pro Gruppe Crops + Namensfeld mit Autocomplete
    (aus `getPersons`) + Bestätigen; „Ignorieren"-Button pro Gruppe.
  - UI-Texte deutsch, bestehende Glass-Komponenten, Toasts über `toastStore`.
- Nach Bestätigung: Grid-Metadaten aktualisieren (bestehender `metadataUpdated`-Fluss greift
  über den DB-Sync automatisch beim nächsten Laden; zusätzlich lokales Update wie bei Batch-Tags).

## Fehlerbehandlung

- Engine nicht verfügbar → `scanFacesInFolder` wirft `BridgeException` („Gesichtserkennung
  nicht verfügbar — Modelldateien fehlen."); Toolbar-Button ist bereits deaktiviert (healthCheck).
- Scan läuft bereits → deutsche Fehlermeldung, kein zweiter Lauf.
- Einzelbild-Fehler → überspringen + zählen, Log-Warnung, Scan läuft weiter.
- Tag-Schreibfehler → Teil-Erfolge wie bei Batch-Tags (bestehendes Muster), Rest bleibt unbestätigt.

## Testplan

- **`FaceMatcher`** (pur): CosineSimilarity-Grenzfälle, Vorschlag ab Schwelle, bester Zentroid
  gewinnt, Clustering-Gruppenbildung, strengere Cluster-Schwelle, leere Eingaben.
- **`FaceScanService`** mit Mock-`IFaceEngine` (deterministische Embeddings): Skip unveränderter
  Bilder, Rescan bei geänderter mtime ersetzt alte Faces, Abbruch, Einzelbild-Fehler zählt skip,
  Progress-Events.
- **Migration v4:** Tabellen + Spalten entstehen, idempotent, Bestands-DB bleibt intakt.
- **`DatabaseService`:** neue Methoden (Round-Trip Embedding-BLOB, Statusübergänge,
  `DeleteImagesAsync` räumt Faces mit).
- **`FaceHandler`** mit Mocks: Payload-Parsing, confirm→Batch-Tag-Aufruf, Fehlerpfade.
- **Frontend (Vitest):** faceStore-Logik, Review-Panel-Rendering mit Mock-Daten,
  Bridge-Mocks für neue Actions; Contract-Tests beidseitig erweitert.
- **Manueller Smoke-Test** (dokumentiert, nicht in CI): kleiner Testordner mit echten Fotos,
  echte Engine, prüft Erkennungsqualität und Schwellenwerte.

## Bewusst nicht in v1

- Gesichtsrahmen-Overlay in Lightbox/Grid
- Personen zusammenführen; Umbenennen mit Rückwirkung auf Datei-Tags
- Automatischer Rescan bei Dateiänderungen (FolderWatcher-Kopplung)
- GPU-Beschleunigung, Ansatz B (ONNX pur) — vorbereitet durch `IFaceEngine`
- Batch-Scan über Ordnerbäume
