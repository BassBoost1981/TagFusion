# TagFusion Professional Readiness

Stand: 2026-05-27

## Status

TagFusion ist technisch näher an einer professionell nutzbaren App, aber noch nicht vollständig freigegeben.

Erledigt:
- Recovery-Backups vor destruktiven Datei- und Metadatenoperationen.
- Manifest unter `backups\manifest.jsonl` mit Operation, Quelle, Backup-Pfad, Zeitstempel und Größe.
- Tests für Backup-Erstellung, Backup-Grenzen, Rename-Recovery und Log-Schreibung.
- Lokaler synthetischer 10k-Datensatz-Test.
- Release-Build mit Artefaktprüfung und klarer Warnung bei fehlender Signatur.
- Installer-Skript prüft Signatur, Publish-Vollständigkeit und Inno Setup.

Offen:
- Realer NAS-Test auf dem Ugreen-Pfad.
- Code Signing, weil kein Zertifikat vorhanden ist.
- Installer-Kompilierung auf einer Maschine mit Inno Setup.

## Performance-Test

Skript:

```powershell
.\Tools\Test-ProfessionalReadiness.ps1 -DatasetPath ".tmp\synthetic-images-10k" -CreateSynthetic -Count 10000 -Subfolders 50 -ExifSampleCount 100
```

Lokaler Lauf:
- Dateien gefunden: 10000
- Enumeration: 228 ms
- ExifTool-Sample: 100 Dateien in 250 ms
- Report: `.tmp\professional-readiness\performance-20260527-214413.json`

NAS-Lauf, sobald der Ugreen-Testordner existiert:

```powershell
.\Tools\Test-ProfessionalReadiness.ps1 -DatasetPath "\\SERVER\SHARE\TagFusionTest" -CreateSynthetic -Count 10000 -Subfolders 50 -ExifSampleCount 100
```

Abbruchkriterien:
- Skript findet weniger Dateien als erstellt.
- ExifTool-Lauf endet mit Exitcode ungleich 0.
- Enumeration bleibt reproduzierbar extrem langsam und macht die App im gleichen Ordner unbedienbar.
- NAS-Test zeigt Zugriffsfehler, Pfadlängenprobleme oder instabile Ergebnisse.

## Backup und Recovery

Gesicherte Operationen:
- Datei/Ordner verschieben
- Datei/Ordner löschen
- Datei/Ordner umbenennen
- Bildtransformation
- Tag-/Rating-Schreibvorgänge per ExifTool

Konfiguration:

```json
"Backup": {
  "Enabled": true,
  "Directory": "backups",
  "RetentionDays": 30,
  "MaxFileSizeMb": 512
}
```

Recovery-Ablauf:
1. App schließen.
2. `backups\manifest.jsonl` öffnen.
3. Eintrag anhand `operation`, `sourcePath` und `createdAt` suchen.
4. Wenn `backupPath` gesetzt ist, Datei manuell zurück nach `sourcePath` kopieren.
5. App starten und Ordner erneut prüfen.

Grenzen:
- Große Dateien über `MaxFileSizeMb` werden nur im Manifest protokolliert, nicht kopiert.
- Ordner werden nicht rekursiv kopiert; es gibt nur einen Manifest-Eintrag.
- Das ist ein Recovery-Schutz, kein vollständiges Undo-System.

## Release und Installer

Release-Build:

```powershell
.\build_release.ps1
```

Geprüft:
- Frontend-Production-Build läuft.
- `wwwroot` wird synchronisiert.
- Backend wird self-contained für `win-x64` publiziert.
- `TagFusion.exe` und `wwwroot\index.html` werden nach dem Publish geprüft.
- Ohne Zertifikat wird der Build als `NotSigned` gemeldet.

Signierter Release-Build, wenn später ein Zertifikat vorhanden ist:

```powershell
$env:CERT_PFX = "C:\path\to\cert.pfx"
$env:CERT_PASS = "password"
.\build_release.ps1 -RequireSigned
```

Installer:

```powershell
.\build_installer.ps1
```

Aktueller Befund:
- `TagFusion.exe` ist nicht signiert.
- Inno Setup ist auf dieser Maschine nicht installiert.
- Installer-Kompilierung ist deshalb noch nicht verifiziert.

## Manuelle QA-Checkliste

Vorbereitung:
- Frischen Release-Build erstellen.
- Testordner lokal und auf Ugreen NAS bereitstellen.
- App mit leerem Profil starten.
- Log-Ordner und Backup-Ordner vor Testbeginn notieren.

Basisfunktionen:
- Ordner öffnen.
- 10k-Testordner laden.
- Suche, Sortierung, Auswahl und Mehrfachauswahl prüfen.
- Lightbox öffnen und schließen.
- Tag-Bibliothek öffnen, Tag erstellen, umbenennen, löschen.
- Tags auf Einzelbild und Mehrfachauswahl anwenden.
- Rating ändern.
- App schließen und neu starten, Persistenz prüfen.

Dateioperationen:
- Datei umbenennen, Backup-Manifest prüfen.
- Datei löschen, Papierkorb und Backup-Manifest prüfen.
- Datei verschieben, Ziel und Manifest prüfen.
- Konfliktfall testen: Zielname existiert bereits.

Recovery:
- Vor Metadaten-Schreibvorgang Backup-Eintrag bestätigen.
- Backup-Datei manuell zurückkopieren.
- App neu starten und Datei erneut prüfen.

Crash-/Robustheit:
- App während Thumbnail-/Ordnerlauf schließen.
- App während langer NAS-Enumeration schließen.
- Fehlerhaften oder nicht erreichbaren NAS-Pfad öffnen.
- Schreibgeschützte Datei taggen.
- Logdatei auf Fehler prüfen.

Release:
- Installer auf sauberer Windows-VM installieren.
- WebView2-Fallback prüfen.
- App über Startmenü und Desktop-Shortcut starten.
- Uninstall ausführen und Restdaten bewerten.
- Signaturstatus prüfen.

Freigabe erst, wenn:
- Backend- und Frontend-Tests grün sind.
- NAS-Test dokumentiert ist.
- Installer auf sauberem Windows-System installiert und deinstalliert wurde.
- Bei Metadaten- und Dateioperationen ein Recovery-Pfad vorhanden ist.
- Code Signing vorhanden ist oder die Unsigned-Einschränkung bewusst akzeptiert wurde.
