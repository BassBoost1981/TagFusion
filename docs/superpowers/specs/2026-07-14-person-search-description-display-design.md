# Personen-Suche in der Sidebar & Beschreibungs-Anzeige in der Lightbox

**Datum:** 2026-07-14
**Status:** Genehmigt (User-Review im Chat)

## Ziel

1. Personen, die per Gesichtserkennung bestätigt wurden, sollen im Programm
   auffindbar sein: Personen-Liste in der Sidebar, Klick startet die globale Suche.
2. Die KI-Beschreibung eines Bildes soll im Lightbox-Infopanel sichtbar sein.

## Ausgangslage (Fakten aus dem Code)

- Bestätigte Personennamen werden bereits als normale Tags in die Bilder
  geschrieben (`FaceHandler.ConfirmFaceGroupAsync`), und die globale Suche
  (`DatabaseService.SearchImagesAsync`) durchsucht Tags, Dateinamen und
  Beschreibungen. Personensuche funktioniert also technisch schon — es fehlt UI,
  die zeigt, welche Personen existieren.
- `getPersons` (Bridge) liefert `{ id, name, faceCount }`; `faceStore` hält
  `persons`, lädt sie aber nur beim Öffnen des Review-Panels.
- Beschreibungen liegen in `Images.Description` (DB) und in den Metadaten,
  werden aber nirgends angezeigt.

## Feature 1: Personen-Liste in der Sidebar (frontend-only)

- Neuer Abschnitt „Personen" in `Frontend/src/components/layout/Sidebar.tsx`
  im vorhandenen `glass-section`-Stil, zwischen „Favoriten" und Laufwerken.
- Zeile pro Person: Personen-Icon (Lucide), Name, Gesichtsanzahl.
  Keine Personen → Abschnitt komplett ausgeblendet.
- Klick: Suchfeld auf den Namen setzen und die vorhandene globale Suche
  auslösen (derselbe Pfad wie die Toolbar-Suche: `executeGlobalSearch([name])`).
- Daten: `faceStore` bekommt eine `loadPersons()`-Aktion (nur
  `bridge.getPersons()`); die Sidebar lädt beim Mount. Zusätzlich wird
  `loadPersons()` nach `faceScanCompleted` aufgerufen, damit die Liste ohne
  Panel-Besuch aktuell bleibt. Panel-Aktionen aktualisieren `persons` bereits.
- i18n: neue Keys (de/en), UI-Text Deutsch („Personen").
- Bekannte Eigenheit (bewusst): Substring-Suche — „Anna" trifft auch
  „Annaberg". Konsistent mit dem bestehenden Suchverhalten.

## Feature 2: Beschreibung in der Lightbox

**Backend:**
- `IDatabaseService`/`DatabaseService`: neue Methode
  `Task<string?> GetImageDescriptionAsync(string path, CancellationToken ct = default)`
  — `SELECT Description FROM Images WHERE Path = @Path` über die Read-Connection
  (Semaphore-Muster wie die anderen Reads). Kein Eintrag oder leer → `null`.
- `AiHandler`: neue Bridge-Action `getImageDescription`
  (Payload `{ path: string }`, Antwort-Data: `string | null`).
- `bridge-actions.json`: `"getImageDescription"` alphabetisch einsortieren
  (Registry wird ggf. von Sync-Tests geprüft — Tests laufen lassen).

**Frontend:**
- `bridgeActions.ts` + `bridge.ts`: Action `getImageDescription(path)` mit
  Mock-Antwort für den Browser-Dev-Modus.
- `Lightbox.tsx`: Beim Bildwechsel Beschreibung on-demand laden, pro Pfad
  gecacht (Blättern lädt nicht erneut); Guard gegen Out-of-Order-Antworten
  (nur setzen, wenn der Pfad noch der aktuelle ist). Anzeige im vorhandenen
  Info-Bereich unter den Tags: Label „Beschreibung", längere Texte mit
  max-Höhe und Scroll. Keine Beschreibung → Zeile erscheint nicht.
  Nur Anzeige, kein Editieren.

## Tests

- **Backend (NUnit):** `GetImageDescriptionAsync` (vorhanden/leer/fehlend);
  `AiHandler`-Action-Routing für `getImageDescription`.
- **Frontend (Vitest):** Sidebar-Personenliste (rendert Personen mit Anzahl,
  Klick löst globale Suche aus, leer = Abschnitt ausgeblendet);
  Lightbox zeigt Beschreibung an bzw. lässt die Zeile weg.

## Bewusst weggelassen (YAGNI)

Beschreibung editieren, Personen umbenennen/löschen, Personen-Galerie mit
Gesichts-Avataren, Exakt-Tag-Suche, Beschreibung im Eigenschaften-Modal.
