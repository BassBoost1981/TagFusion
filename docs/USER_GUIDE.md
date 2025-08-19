# Portable Image Manager - Benutzerhandbuch

## Überblick

Der Portable Image Manager ist eine vollständig portable Desktop-Anwendung zur Verwaltung, Organisation und Bearbeitung von Bildern und Videos. Die Anwendung funktioniert ohne Installation und kann direkt von einem USB-Stick oder beliebigen Ordner gestartet werden.

## Erste Schritte

### Installation

Keine Installation erforderlich! Einfach die `.exe`-Datei herunterladen und ausführen.

### Systemanforderungen

- **Windows:** Windows 10 oder höher
- **macOS:** macOS 10.14 oder höher  
- **Linux:** Ubuntu 18.04 oder höher
- **RAM:** Mindestens 4 GB (8 GB empfohlen für große Bildersammlungen)
- **Festplatte:** 200 MB freier Speicherplatz für die Anwendung

### Erste Verwendung

1. Starten Sie die Anwendung durch Doppelklick auf die ausführbare Datei
2. Die Anwendung zeigt automatisch alle verfügbaren Laufwerke im linken Bereich
3. Navigieren Sie zu einem Ordner mit Bildern oder Videos
4. Die Medien werden automatisch als Miniaturansichten angezeigt

## Benutzeroberfläche

### Hauptfenster-Layout

Das Hauptfenster ist in vier Bereiche unterteilt:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Toolbar                                  │
├─────────────┬─────────────────────────────┬─────────────────────┤
│ Navigation  │      Content Grid           │   Properties &      │
│ Panel       │   (Bilder & Videos)         │   Tag System        │
│             │                             │                     │
│ • Favoriten │ Miniaturansichten           │ • Datei-Info        │
│ • Laufwerke │ von Bildern und Videos      │ • EXIF-Daten        │
│             │                             │ • Tag-Hierarchie    │
└─────────────┴─────────────────────────────┴─────────────────────┘
```

### Toolbar

Die Toolbar enthält folgende Elemente:

- **🏠 Home:** Zurück zur Startansicht
- **⬅️ Zurück / ➡️ Vor:** Navigation durch besuchte Ordner
- **🔍 Suche:** Globale Suche nach Dateinamen, Tags und Metadaten
- **🏷️ Filter:** Erweiterte Filter für Tags, Datum, Dateityp und Bewertung
- **⚙️ Einstellungen:** Anwendungseinstellungen
- **🌙/☀️ Theme:** Wechsel zwischen hellem und dunklem Design

## Grundfunktionen

### Navigation

#### Ordner durchsuchen
- Klicken Sie auf Ordner im linken Bereich, um zu navigieren
- Verwenden Sie die Zurück/Vor-Buttons in der Toolbar
- Doppelklicken Sie auf Ordner im Content Grid

#### Favoriten verwalten
1. Navigieren Sie zu einem gewünschten Ordner
2. Drücken Sie **F** oder ziehen Sie den Ordner in den Favoriten-Bereich
3. Zum Entfernen: Rechtsklick auf Favorit → "Entfernen"

### Bilder und Videos anzeigen

#### Miniaturansichten
- Alle unterstützten Medien werden automatisch als Miniaturansichten angezeigt
- Unterstützte Formate: JPEG, PNG, GIF, BMP, TIFF, MP4, AVI, MOV

#### Vollbildansicht
- **Doppelklick** auf ein Bild/Video für Vollbildansicht
- **F11** für Vollbild-Modus
- **Pfeiltasten** für Navigation zwischen Bildern
- **ESC** zum Beenden

#### Diashow
1. Wählen Sie Bilder aus oder navigieren Sie zu einem Ordner
2. Drücken Sie **F11** für Vollbildansicht
3. Drücken Sie **Leertaste** zum Starten/Stoppen der Diashow
4. Geschwindigkeit in Einstellungen anpassbar

### Bildbearbeitung

#### Editor öffnen
- **Rechtsklick** auf Bild → "Bearbeiten"
- **Enter** bei ausgewähltem Bild
- Öffnet separates Editor-Fenster

#### Verfügbare Tools
- **Helligkeit/Kontrast/Sättigung:** Schieberegler für Anpassungen
- **Rotation:** 90°-Drehungen in beide Richtungen
- **Zuschnitt:** Rechteck-Tool mit Vorschau
- **Rückgängig/Wiederholen:** Vollständige Bearbeitungshistorie

#### Speichern
- **Original bleibt unverändert**
- Bearbeitete Version wird mit "_edited"-Suffix gespeichert
- Beispiel: `foto.jpg` → `foto_edited.jpg`

## Organisation mit Tags

### Tag-System verstehen

Das Tag-System verwendet eine hierarchische Struktur:
```
Natur (Kategorie)
├── Landschaft (Unterkategorie)
│   ├── Berge (Tag)
│   └── Seen (Tag)
└── Tiere (Unterkategorie)
    ├── Vögel (Tag)
    └── Säugetiere (Tag)
```

### Tags erstellen
1. Rechtsklick im Tag-Bereich → "Neue Kategorie/Tag"
2. Namen eingeben und Hierarchie-Ebene wählen
3. Tags werden automatisch in der Baumstruktur angeordnet

### Bilder taggen
- **Drag & Drop:** Ziehen Sie Tags auf Bilder oder umgekehrt
- **Rechtsklick:** Bild → "Tags hinzufügen"
- **Batch-Tagging:** Mehrere Bilder auswählen und gemeinsam taggen

### Bewertungen vergeben
- **Rechtsklick** auf Bild → "Bewertung" → 1-5 Sterne
- **Tastenkürzel:** 1-5 Tasten bei ausgewähltem Bild
- Bewertungen werden in EXIF-Metadaten gespeichert

## Suche und Filter

### Globale Suche
- **Ctrl+F** oder Suchfeld in Toolbar verwenden
- Sucht in: Dateinamen, Tags, EXIF-Daten
- Unterstützt Teilwort-Suche und Wildcards

### Filter verwenden
1. Klicken Sie auf **🏷️ Filter** in der Toolbar
2. Wählen Sie gewünschte Kriterien:
   - **Tags:** Hierarchische Tag-Auswahl
   - **Dateityp:** Nur Bilder oder nur Videos
   - **Datum:** Datumsbereich festlegen
   - **Bewertung:** Mindestbewertung wählen

### Erweiterte Suche
- **Tag-Hierarchie:** Suche nach "Natur" findet auch "Natur/Landschaft/Berge"
- **EXIF-Suche:** Nach Kamera-Modell, Aufnahmedatum, etc.
- **Kombinierte Filter:** Mehrere Kriterien gleichzeitig verwenden

## Import und Export

### Bilder exportieren
1. Wählen Sie gewünschte Bilder aus
2. **Rechtsklick** → "Exportieren"
3. Wählen Sie:
   - **Größe:** Original, Web-optimiert, oder benutzerdefiniert
   - **Qualität:** Komprimierungsgrad
   - **Metadaten:** EXIF-Daten beibehalten oder entfernen
   - **Zielordner:** Ausgabeordner wählen

### Konfiguration sichern
1. **Einstellungen** → "Konfiguration exportieren"
2. Speichert: Favoriten, Tag-Hierarchie, Einstellungen
3. Zum Importieren: "Konfiguration importieren" verwenden

## Einstellungen

### Sprache ändern
1. **⚙️ Einstellungen** → "Sprache"
2. Verfügbare Sprachen: Deutsch, Englisch
3. Neustart nicht erforderlich

### Theme anpassen
- **🌙/☀️** Button in Toolbar für schnellen Wechsel
- **Automatisch:** Folgt System-Theme
- **Hell/Dunkel:** Manuell festlegen

### Performance-Einstellungen
- **Thumbnail-Größe:** Größere Thumbnails = mehr Speicherverbrauch
- **Cache-Größe:** Mehr Cache = schnellere Navigation
- **GPU-Beschleunigung:** Ein/Aus (automatische Erkennung)

## Tipps und Tricks

### Effizienter Workflow
1. **Favoriten nutzen:** Häufig verwendete Ordner als Favoriten speichern
2. **Batch-Operationen:** Mehrere Bilder gleichzeitig bearbeiten
3. **Tastenkürzel lernen:** Siehe Keyboard-Shortcuts-Referenz
4. **Tag-Hierarchie planen:** Logische Struktur vor dem Taggen erstellen

### Performance optimieren
- **Große Ordner:** Unterordner verwenden statt alles in einen Ordner
- **Regelmäßig aufräumen:** Ungenutzte Tags und Favoriten entfernen
- **SSD verwenden:** Für bessere Performance bei großen Bildersammlungen

### Portabilität nutzen
- **USB-Stick:** Anwendung und Bilder auf demselben Stick
- **Cloud-Sync:** Konfiguration in Cloud-Ordner speichern
- **Backup:** Regelmäßig Konfiguration exportieren

## Fehlerbehebung

Siehe [Troubleshooting Guide](TROUBLESHOOTING.md) für detaillierte Lösungen.

## Weitere Hilfe

- **Keyboard Shortcuts:** Siehe [Keyboard-Shortcuts-Referenz](KEYBOARD_SHORTCUTS.md)
- **Build-Anweisungen:** Siehe [Build und Deployment](BUILD_DEPLOYMENT.md)
- **GitHub Issues:** Für Bugs und Feature-Requests