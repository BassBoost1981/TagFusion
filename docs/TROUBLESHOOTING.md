# Troubleshooting Guide

## Häufige Probleme und Lösungen

### Anwendung startet nicht

#### Problem: Anwendung startet nicht oder stürzt beim Start ab

**Mögliche Ursachen und Lösungen:**

1. **Unzureichende Berechtigungen**
   - Lösung: Als Administrator ausführen (Rechtsklick → "Als Administrator ausführen")
   - Oder: Anwendung in einen Ordner mit Schreibrechten verschieben

2. **Antivirus-Software blockiert**
   - Lösung: Anwendung zur Ausnahmeliste des Antivirus-Programms hinzufügen
   - Temporär: Antivirus deaktivieren und testen

3. **Fehlende System-Bibliotheken**
   - Windows: Visual C++ Redistributable installieren
   - Lösung: Microsoft Visual C++ 2019 Redistributable herunterladen und installieren

4. **Beschädigte Konfigurationsdateien**
   - Lösung: Ordner `.portable-image-manager` im Anwendungsverzeichnis löschen
   - Anwendung erstellt neue Standardkonfiguration

#### Problem: Anwendung startet langsam

**Lösungen:**
- GPU-Beschleunigung in Einstellungen aktivieren
- Thumbnail-Cache-Größe reduzieren
- Anwendung auf SSD statt HDD ausführen
- Andere Programme schließen um RAM freizugeben

### Dateisystem-Probleme

#### Problem: Laufwerke werden nicht angezeigt

**Mögliche Ursachen:**
1. **Laufwerk nicht gemountet**
   - Lösung: Laufwerk im Datei-Explorer öffnen, dann Anwendung neu starten

2. **Netzlaufwerke nicht verfügbar**
   - Lösung: Netzwerkverbindung prüfen
   - Netzlaufwerk manuell verbinden

3. **USB-Laufwerke werden nicht erkannt**
   - Lösung: USB-Gerät ab- und wieder anstecken
   - F5 drücken zum Aktualisieren

#### Problem: "Zugriff verweigert" Fehler

**Lösungen:**
1. **Ordner-Berechtigungen prüfen**
   - Rechtsklick auf Ordner → Eigenschaften → Sicherheit
   - Vollzugriff für aktuellen Benutzer gewähren

2. **Schreibgeschützte Dateien**
   - Eigenschaften der Datei öffnen
   - "Schreibgeschützt" Häkchen entfernen

3. **Systemordner**
   - Systemordner (Windows, Program Files) sind geschützt
   - Bilder in Benutzerordner (Dokumente, Bilder) verschieben

#### Problem: Dateien werden nicht angezeigt

**Prüfungen:**
1. **Unterstützte Formate:** JPEG, PNG, GIF, BMP, TIFF, MP4, AVI, MOV
2. **Versteckte Dateien:** In Einstellungen "Versteckte Dateien anzeigen" aktivieren
3. **Datei-Erweiterungen:** Prüfen ob Dateien korrekte Erweiterung haben

### Performance-Probleme

#### Problem: Langsame Thumbnail-Generierung

**Optimierungen:**
1. **GPU-Beschleunigung aktivieren**
   - Einstellungen → Performance → GPU-Beschleunigung: Ein

2. **Cache-Einstellungen anpassen**
   - Einstellungen → Performance → Cache-Größe erhöhen
   - Mehr RAM = größerer Cache möglich

3. **Thumbnail-Größe reduzieren**
   - Einstellungen → Anzeige → Thumbnail-Größe: Klein/Mittel

4. **Hintergrund-Verarbeitung**
   - Worker-Threads in Einstellungen erhöhen (max. CPU-Kerne)

#### Problem: Hoher Speicherverbrauch

**Lösungen:**
1. **Cache-Größe reduzieren**
   - Einstellungen → Performance → Cache-Größe: 512 MB oder weniger

2. **Große Ordner vermeiden**
   - Ordner mit >10.000 Bildern in Unterordner aufteilen

3. **Speicher-Leaks prüfen**
   - Anwendung neu starten
   - Task-Manager: Speicherverbrauch überwachen

4. **Automatische Cache-Bereinigung**
   - Einstellungen → Performance → Auto-Cleanup: Ein

#### Problem: Anwendung friert ein

**Sofortmaßnahmen:**
1. **Task-Manager öffnen** (Ctrl+Shift+Esc)
2. **Anwendung beenden** ("Portable Image Manager" → Task beenden)
3. **Neu starten**

**Präventive Maßnahmen:**
- Nicht zu viele Bilder gleichzeitig auswählen (max. 1000)
- Große Videos (>2GB) einzeln verarbeiten
- Regelmäßig Cache leeren (Ctrl+Alt+C)

### Metadaten-Probleme

#### Problem: Tags werden nicht gespeichert

**Prüfungen:**
1. **Datei-Berechtigungen**
   - Datei darf nicht schreibgeschützt sein
   - Ordner-Berechtigungen prüfen

2. **Unterstützte Formate**
   - EXIF/XMP nur bei JPEG, TIFF
   - PNG, GIF: Begrenzte Metadaten-Unterstützung

3. **Datei in Verwendung**
   - Datei nicht in anderem Programm geöffnet
   - Antivirus-Scanner kann Zugriff blockieren

#### Problem: EXIF-Daten werden nicht angezeigt

**Lösungen:**
1. **Datei-Format prüfen**
   - Nur JPEG und TIFF haben vollständige EXIF-Daten
   - RAW-Formate werden nicht unterstützt

2. **Beschädigte Metadaten**
   - Mit anderem EXIF-Tool prüfen (z.B. ExifTool)
   - Datei möglicherweise beschädigt

3. **Anzeige-Einstellungen**
   - Properties Panel → "Technische Details anzeigen" aktivieren

#### Problem: Bewertungen gehen verloren

**Ursachen und Lösungen:**
1. **Metadaten-Standard**
   - Bewertungen werden in XMP-Metadaten gespeichert
   - Nicht alle Programme unterstützen XMP

2. **Backup erstellen**
   - Vor Bearbeitung mit anderen Programmen
   - Konfiguration regelmäßig exportieren

### Video-Probleme

#### Problem: Videos werden nicht abgespielt

**Codec-Probleme:**
1. **Unterstützte Formate:** MP4, AVI, MOV
2. **Codec-Installation:**
   - Windows: K-Lite Codec Pack installieren
   - macOS: VLC Media Player installieren

3. **Hardware-Dekodierung**
   - Einstellungen → Video → Hardware-Dekodierung: Ein/Aus testen

#### Problem: Video-Thumbnails fehlen

**Lösungen:**
1. **FFmpeg-Installation prüfen**
   - Anwendung enthält FFmpeg.wasm
   - Bei Problemen: Anwendung neu herunterladen

2. **Speicher-Limits**
   - Große Videos (>1GB) benötigen mehr RAM
   - Cache-Größe erhöhen

### Import/Export-Probleme

#### Problem: Export schlägt fehl

**Häufige Ursachen:**
1. **Zielordner nicht beschreibbar**
   - Berechtigungen prüfen
   - Anderen Zielordner wählen

2. **Nicht genügend Speicherplatz**
   - Festplatte voll
   - Temporäre Dateien löschen

3. **Datei in Verwendung**
   - Quelldatei nicht in anderem Programm öffnen
   - Zieldatei nicht schreibgeschützt

#### Problem: Konfiguration-Import funktioniert nicht

**Lösungen:**
1. **Datei-Format prüfen**
   - Nur JSON-Dateien von derselben Anwendungsversion
   - Datei nicht manuell bearbeitet

2. **Backup wiederherstellen**
   - Vorherige Konfiguration aus Backup laden
   - Standard-Konfiguration verwenden

### Netzwerk-Probleme

#### Problem: Netzlaufwerke langsam

**Optimierungen:**
1. **Lokale Kopie erstellen**
   - Bilder lokal kopieren für bessere Performance
   - Nur bearbeitete Versionen zurück kopieren

2. **Cache-Einstellungen**
   - Größeren Cache für Netzlaufwerke
   - Thumbnail-Qualität reduzieren

3. **Netzwerk-Verbindung**
   - LAN statt WLAN verwenden
   - VPN kann Performance beeinträchtigen

### Plattform-spezifische Probleme

#### Windows

**Problem: Windows Defender blockiert**
- Lösung: Anwendung zur Ausnahmeliste hinzufügen
- Windows Security → Virus & Bedrohungsschutz → Ausschlüsse

**Problem: Dateipfade zu lang**
- Windows-Limit: 260 Zeichen
- Lösung: Bilder in Ordner mit kürzeren Pfaden verschieben

#### macOS

**Problem: "App kann nicht geöffnet werden"**
- Lösung: Rechtsklick → Öffnen → "Trotzdem öffnen"
- Oder: Systemeinstellungen → Sicherheit → "Trotzdem öffnen"

**Problem: Gatekeeper-Warnung**
- Terminal: `xattr -d com.apple.quarantine /path/to/app`

#### Linux

**Problem: Fehlende Bibliotheken**
- Ubuntu/Debian: `sudo apt install libnss3 libatk-bridge2.0-0 libdrm2`
- Fedora: `sudo dnf install nss atk at-spi2-atk`

**Problem: Berechtigungen**
- Ausführbar machen: `chmod +x portable-image-manager`

## Erweiterte Diagnose

### Log-Dateien

**Speicherort:**
- Windows: `%APPDATA%\portable-image-manager\logs\`
- macOS: `~/Library/Logs/portable-image-manager/`
- Linux: `~/.config/portable-image-manager/logs/`

**Wichtige Log-Dateien:**
- `main.log`: Hauptprozess-Ereignisse
- `renderer.log`: UI-Ereignisse
- `error.log`: Fehlermeldungen

### Debug-Modus aktivieren

1. **Entwicklertools öffnen:** F12
2. **Console-Tab** für JavaScript-Fehler
3. **Network-Tab** für Netzwerk-Probleme
4. **Performance-Tab** für Performance-Analyse

### System-Informationen sammeln

**Für Support-Anfragen benötigt:**
1. **Betriebssystem:** Version und Build
2. **Hardware:** CPU, RAM, GPU
3. **Anwendungsversion:** Hilfe → Über
4. **Fehlermeldung:** Exakter Wortlaut
5. **Reproduktionsschritte:** Schritt-für-Schritt Anleitung

### Performance-Monitoring

**Eingebaute Tools:**
- `Ctrl + Shift + P`: Performance-Monitor
- `Ctrl + Shift + M`: Speicher-Statistiken
- `Ctrl + Shift + G`: GPU-Status

**Externe Tools:**
- Task-Manager: Ressourcenverbrauch
- Process Monitor: Dateisystem-Zugriffe
- GPU-Z: GPU-Auslastung

## Häufig gestellte Fragen (FAQ)

### Allgemein

**F: Ist die Anwendung wirklich portable?**
A: Ja, keine Installation erforderlich. Alle Daten werden im Anwendungsordner gespeichert.

**F: Werden meine Originalbilder verändert?**
A: Nein, Originalbilder bleiben unverändert. Bearbeitungen werden als neue Datei mit "_edited"-Suffix gespeichert.

**F: Welche Dateiformate werden unterstützt?**
A: Bilder: JPEG, PNG, GIF, BMP, TIFF. Videos: MP4, AVI, MOV.

**F: Kann ich die Anwendung auf mehreren Computern verwenden?**
A: Ja, einfach die gesamte Anwendung kopieren. Konfiguration wird mitgenommen.

### Tags und Metadaten

**F: Wo werden Tags gespeichert?**
A: Direkt in den EXIF/XMP-Metadaten der Bilddateien. Keine separaten Dateien.

**F: Kann ich Tags in anderen Programmen sehen?**
A: Ja, wenn das Programm XMP-Metadaten unterstützt (z.B. Adobe Lightroom, Bridge).

**F: Was passiert wenn ich Dateien mit anderen Programmen bearbeite?**
A: Tags bleiben erhalten, solange das andere Programm Metadaten nicht entfernt.

### Performance

**F: Wie viele Bilder kann die Anwendung verwalten?**
A: Theoretisch unbegrenzt. Praktisch abhängig von verfügbarem RAM und Speicherplatz.

**F: Warum ist die erste Anzeige eines Ordners langsam?**
A: Thumbnails werden beim ersten Mal generiert. Danach werden sie aus dem Cache geladen.

**F: Kann ich die Anwendung beschleunigen?**
A: Ja, GPU-Beschleunigung aktivieren, mehr RAM zuweisen, SSD verwenden.

## Support kontaktieren

Wenn diese Anleitung nicht hilft:

1. **GitHub Issues:** [Repository-Link]/issues
2. **Log-Dateien** anhängen
3. **System-Informationen** angeben
4. **Reproduktionsschritte** beschreiben
5. **Screenshots** bei UI-Problemen

**Vor Support-Anfrage prüfen:**
- [ ] Neueste Version verwenden
- [ ] Anwendung neu gestartet
- [ ] Log-Dateien geprüft
- [ ] Andere Programme geschlossen
- [ ] Berechtigungen geprüft