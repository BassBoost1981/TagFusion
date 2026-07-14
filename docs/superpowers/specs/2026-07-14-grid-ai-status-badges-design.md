# Grid-View: KI-Status-Badges (Gesichtsscan & Beschreibung)

**Datum:** 2026-07-14
**Status:** Genehmigt (User-Review im Chat)

## Ziel

Im Grid View soll pro Bildkarte sichtbar sein, ob (a) die Gesichtserkennung bereits
gelaufen ist und (b) eine KI-Beschreibung existiert. Einfacher Erledigt-Status
(ja/nein), immer sichtbar als Mini-Badges.

## Semantik

- **Gesichtsscan erledigt** = `Images.FaceScanAt IS NOT NULL`. Gilt auch bei 0
  gefundenen Gesichtern. `FaceScanFileTime` (Stale-Erkennung) wird im Badge bewusst
  ignoriert — das prüft der Scan selbst beim nächsten Lauf.
- **Beschreibung vorhanden** = `Images.Description` ist nicht NULL und nicht leer.
- Bilder ohne DB-Eintrag (ExifTool-Fallback-Pfad): beide Flags `false` — korrekt,
  denn dort lief noch kein Scan.

## Architektur / Datenfluss

Kein neuer Bridge-Call, kein neues Event — die bestehende Metadaten-Pipeline wird
erweitert:

1. **`ImageMetadata`-Record** (`Backend/TagFusion/Database/IDatabaseService.cs`)
   bekommt zwei Felder: `bool FaceScanned = false`, `bool HasDescription = false`.
2. **`DatabaseService.GetMetadataForPathsAsync`** liest zusätzlich
   `FaceScanAt IS NOT NULL` und `Description IS NOT NULL AND Description != ''`
   in der bestehenden Chunk-Abfrage.
3. **`FileSystemHandler.StartBackgroundMetadataLoad`** serialisiert die Flags im
   `metadataUpdated`-Event mit. Kontrakt pro Pfad:
   `{ tags: string[], rating: number, faceScanned: boolean, hasDescription: boolean }`.
   Der ExifTool-Fallback-Zweig sendet `faceScanned: false, hasDescription: false`.
4. **Frontend `ImageFile`** (`Frontend/src/types/index.ts`) bekommt
   `faceScanned?: boolean` und `hasDescription?: boolean`.
5. **`uiSlice`-Handler für `metadataUpdated`** übernimmt die zwei Felder beim Merge.
6. **`ImageCard`** zeigt oben links neben dem Tag-Badge zwei kleine Icon-Badges im
   selben Glas-Stil: `ScanFace` (Lucide) wenn gescannt, `FileText` wenn Beschreibung
   vorhanden. Nicht erledigt = Icon fehlt (kein Platzhalter). Der Memo-Comparator
   wird um die zwei Skalare erweitert.
7. **Aktualisierung nach Scans:** Nach `faceScanCompleted` (faceStore) bzw.
   `descriptionScanCompleted` (descriptionStore) stößt das Frontend das Neuladen
   der Metadaten für den aktuellen Ordner über den vorhandenen Lademechanismus an,
   damit Badges ohne Ordnerwechsel erscheinen.

## Tests

- **Backend (NUnit):** `GetMetadataForPathsAsync` liefert die Flags korrekt
  (gesetzt/nicht gesetzt, leere Beschreibung zählt als nicht vorhanden).
- **Frontend (Vitest):** `ImageCard` rendert Badges bei gesetzten Flags und
  nicht bei `false`/`undefined`; Merge im `metadataUpdated`-Handler übernimmt
  die Felder.

## Bewusst weggelassen (YAGNI)

Filterung nach Status, Gesichter-Anzahl im Badge, Tooltip mit Beschreibungstext,
Stale-Erkennung im Badge. Alles später nachrüstbar.
