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
