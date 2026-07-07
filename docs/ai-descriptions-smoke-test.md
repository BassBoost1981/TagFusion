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
