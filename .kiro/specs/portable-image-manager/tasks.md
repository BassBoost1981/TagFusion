# Implementierungsplan

- [x] 1. Projekt-Setup und Grundarchitektur

  - Electron + React + TypeScript Projekt initialisieren
  - Grundlegende Ordnerstruktur erstellen (src/components, src/services, src/repositories)
  - Dependency Injection Container einrichten
  - _Anforderungen: 1.1, 1.4_

- [x] 2. Grundlegende UI-Struktur implementieren

  - [x] 2.1 Hauptfenster mit 3-Spalten-Layout erstellen

    - Electron BrowserWindow konfigurieren
    - React Layout-Komponenten für Left/Center/Right Panel
    - CSS Grid/Flexbox für responsive Spalten-Layout
    - _Anforderungen: 7.1, 7.4_

  - [x] 2.2 Toolbar-Komponente implementieren

    - Navigation-Buttons (Home, Back, Forward) mit State-Management
    - Such-Input-Feld mit Debouncing
    - Filter-Dropdown-Komponente
    - Theme-Toggle und Settings-Button
    - _Anforderungen: 7.1, 7.5, 7.6_

- [ ] 3. Dateisystem-Repository und Services

  - [x] 3.1 File System Repository implementieren

    - Node.js fs/path APIs für Laufwerks-Scanning
    - Rekursive Ordner-Traversierung mit Performance-Optimierung
    - Medienformat-Erkennung (JPEG, PNG, GIF, BMP, TIFF, MP4, AVI, MOV)
    - _Anforderungen: 2.1, 2.2, 2.3_

  - [x] 3.2 Drive Tree Service erstellen

    - Laufwerks-Erkennung für Windows/Mac/Linux
    - Hierarchische Ordnerstruktur-Datenmodell
    - Lazy Loading für große Ordnerbäume
    - _Anforderungen: 2.1, 2.3_

- [x] 4. Linke Spalte (Navigation Panel)

  - [x] 4.1 Favoriten-Komponente implementieren

    - Favoriten-Liste mit Add/Remove-Funktionalität
    - Lokale JSON-Datei für Favoriten-Speicherung
    - Drag & Drop Support für Ordner zu Favoriten
    - _Anforderungen: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 4.2 Laufwerks-Baum-Komponente erstellen

    - Expandable Tree-View mit virtueller Scrolling
    - Lazy Loading von Unterordnern
    - Keyboard-Navigation (Pfeiltasten, Enter)
    - _Anforderungen: 2.1, 2.3, 7.3_

- [x] 5. Mittlere Spalte (Content Grid)

  - [x] 5.1 Grid-Layout-Komponente implementieren

    - Virtualisiertes Grid für Performance bei großen Ordnern
    - Thumbnail-Anzeige für Bilder und Videos
    - Ordner und Dateien gemischt anzeigen
    - Grid/List View-Modi mit Toggle
    - _Anforderungen: 2.3, 2.4, 7.2, 8.4_

  - [x] 5.2 Multi-Selection System implementieren

    - Windows-Standard Selection (Ctrl+Click, Shift+Click)
    - Visual Selection-Feedback
    - Keyboard-Shortcuts für Select All/Clear
    - _Anforderungen: 7.3_

- [x] 6. Thumbnail-Generierung und Caching

  - [x] 6.1 Thumbnail Service implementieren


    - Sharp.js für Bild-Thumbnails
    - FFmpeg.wasm für Video-Thumbnails
    - Worker Threads für Background-Processing
    - _Anforderungen: 2.5, 8.1, 8.3, 8.5_

  - [x] 6.2 Memory-basiertes Caching System

    - LRU-Cache für Thumbnail-Daten im RAM
    - Keine Dateien auf Festplatte erstellen
    - Cache-Invalidierung bei Datei-Änderungen
    - _Anforderungen: 1.5, 8.3_

- [x] 7. Metadaten-Repository und Tag-System

  - [x] 7.1 Metadata Repository implementieren

    - ExifReader für EXIF/XMP-Daten lesen
    - piexifjs für Metadaten schreiben
    - Hierarchische Tag-Struktur in XMP-Format
    - _Anforderungen: 3.2, 3.3, 3.5_

  - [x] 7.2 Tag-Hierarchie-System erstellen

    - Baumstruktur für Kategorie/Unterkategorie/Tag
    - Tag-CRUD-Operationen mit Validierung
    - Tag-zu-Datei-Zuordnung in Metadaten
    - _Anforderungen: 3.1, 3.2, 3.5_

- [x] 8. Rechte Spalte (Properties & Tags)

  - [x] 8.1 Properties-Panel implementieren

    - Datei-Informationen anzeigen (Name, Größe, Datum)
    - EXIF-Daten-Anzeige mit Toggle für technische Details
    - Multi-Selection Support für Batch-Informationen
    - _Anforderungen: 7.1_

  - [x] 8.2 Tag-System-Panel erstellen

    - Hierarchische Tag-Baum-Anzeige
    - Drag & Drop für Tag-zu-Datei-Zuordnung
    - Tag-Erstellung und -Bearbeitung UI
    - _Anforderungen: 3.1, 3.2, 3.4, 3.5_

- [x] 9. Such- und Filter-System

  - [x] 9.1 Globale Suche implementieren

    - Dateiname-Suche mit Fuzzy-Matching
    - Tag-basierte Suche mit Hierarchie-Support
    - Metadaten-Suche (Datum, Kamera, etc.)
    - _Anforderungen: 6.1, 6.2, 6.3_

  - [x] 9.2 Filter-System erstellen

    - Tag-Filter mit hierarchischer Auswahl
    - Dateityp-Filter (Bilder/Videos)
    - Datumsbereich-Filter
    - Bewertungs-Filter
    - _Anforderungen: 6.2, 6.3, 6.4_

- [x] 10. Bewertungssystem implementieren

  - Sterne-Bewertung (1-5) UI-Komponente
  - Bewertungen in EXIF/XMP-Metadaten speichern
  - Bewertungs-Filter in Suche integrieren
  - _Anforderungen: 3.4, 3.6_

- [x] 11. Drag & Drop System

  - [x] 11.1 Drag & Drop Framework implementieren

    - HTML5 Drag & Drop API Integration
    - Visual Feedback für Drop-Zonen
    - Drag-Vorschau mit Datei-Anzahl
    - _Anforderungen: 7.3_

  - [x] 11.2 Drag & Drop Operationen

    - Dateien zu Favoriten ziehen
    - Dateien zwischen Ordnern verschieben
    - Tags auf Dateien ziehen für Tagging
    - Ordner zu Favoriten hinzufügen
    - _Anforderungen: 10.1_

- [x] 12. Kontextmenü-System

  - [x] 12.1 Kontextmenü-Framework erstellen

    - Rechtsklick-Handler für verschiedene Elemente
    - Dynamische Menü-Generierung basierend auf Kontext
    - Keyboard-Shortcuts in Menüs anzeigen
    - _Anforderungen: 7.3_

  - [x] 12.2 Spezifische Kontextmenüs implementieren

    - Datei-Kontextmenü (Bearbeiten, Tags, Bewertung, Löschen)
    - Ordner-Kontextmenü (Öffnen, Favorit, Batch-Tag)
    - Tag-Kontextmenü (Bearbeiten, Löschen, Unterkategorie)
    - _Anforderungen: 3.1, 10.1_

- [x] 13. Keyboard-Shortcuts System

  - Globale Shortcut-Handler implementieren
  - Windows-Standard-Shortcuts (Ctrl+A, Ctrl+C, F2, Delete, etc.)
  - Navigation-Shortcuts (Alt+Left/Right, Alt+Home)
  - Anwendungs-spezifische Shortcuts (F für Favorit, F11 für Vollbild)
  - _Anforderungen: 7.3_

- [x] 14. Bildbearbeitungs-Editor

  - [x] 14.1 Separates Editor-Fenster erstellen

    - Neues Electron BrowserWindow für Editor
    - Editor-Layout mit Toolbar und Preview-Area
    - Tool-spezifische Control-Panels
    - _Anforderungen: 4.1, 4.2, 4.3_

  - [x] 14.2 Bildbearbeitungs-Tools implementieren

    - Helligkeit/Kontrast/Sättigung-Slider mit Live-Preview
    - 90°-Rotation in beide Richtungen
    - Crop-Tool mit Vorschau-Rectangle
    - Undo/Redo-System für alle Operationen
    - _Anforderungen: 4.1, 4.2, 4.3_

  - [x] 14.3 Speicher-System für bearbeitete Bilder

    - Original-Datei unverändert lassen
    - Bearbeitete Kopie mit "_edited"-Suffix erstellen
    - Canvas-zu-File-Export mit Qualitäts-Optionen
    - _Anforderungen: 4.4, 4.5_

- [x] 15. Vollbild-Viewer

  - [x] 15.1 Vollbild-Viewer-Fenster erstellen

    - Fullscreen Electron Window
    - Bild-Navigation mit Pfeiltasten
    - Zoom und Pan-Funktionalität
    - _Anforderungen: 7.2, 7.3_

  - [x] 15.2 Diashow-Funktionalität

    - Automatische Bild-Progression mit Timer
    - Play/Pause-Kontrollen
    - Diashow-Geschwindigkeit-Einstellungen
    - _Anforderungen: 7.2_

  - [x] 15.3 Overlay-Informationen

    - Datei-Informationen einblendbar
    - EXIF-Daten-Anzeige
    - Tag und Bewertungs-Anzeige
    - _Anforderungen: 7.1_

- [x] 16. Export und Sharing

  - [x] 16.1 Export-Dialog implementieren

    - Größen-Auswahl (Original, Web, Custom)
    - Qualitäts-Einstellungen
    - Metadaten-Erhaltung-Option
    - _Anforderungen: 5.1, 5.4_

  - [x] 16.2 Batch-Export-System

    - Multi-Selection für Export
    - Progress-Bar für Batch-Operationen
    - Zielordner-Auswahl
    - _Anforderungen: 5.2, 5.3_

- [x] 17. Konfiguration und Import/Export

  - [x] 17.1 Configuration Repository implementieren

    - JSON-basierte Konfigurationsdateien
    - Tag-Hierarchie Export/Import
    - Favoriten und Einstellungen Export
    - _Anforderungen: 9.1, 9.2, 9.3, 10.5_

  - [x] 17.2 Import/Export-UI erstellen

    - Export-Dialog für Konfigurationen
    - Import-Dialog mit Konflikt-Behandlung
    - Merge/Overwrite-Optionen
    - _Anforderungen: 9.4, 9.5_

- [x] 18. Internationalisierung

  - [x] 18.1 i18n-Framework einrichten

    - React-i18next Integration
    - Sprachdatei-Struktur (JSON)
    - Namespace-Trennung für verschiedene UI-Bereiche
    - _Anforderungen: 11.1, 11.2_

  - [x] 18.2 Sprach-Detection und Fallback

    - Automatische Systemsprache-Erkennung
    - Fallback auf Englisch wenn Sprache nicht verfügbar
    - Sprach-Umschaltung in Settings
    - _Anforderungen: 11.3, 11.4, 11.5_

- [x] 19. Theme-System

  - Light/Dark Mode Implementation
  - CSS Custom Properties für Theme-Variablen
  - Automatische System-Theme-Erkennung
  - Theme-Persistierung in Konfiguration
  - _Anforderungen: 7.5, 7.6_

- [x] 20. Performance-Optimierungen

  - [x] 20.1 GPU-Beschleunigung implementieren

    - WebGL-Shader für Bildbearbeitung
    - Canvas Offscreen Rendering
    - Hardware-Detection mit CPU-Fallback
    - _Anforderungen: 8.1, 8.2, 8.5_

  - [x] 20.2 Memory Management

    - Thumbnail-Cache mit LRU-Eviction
    - Large File Handling mit Progressive Loading
    - Memory Leak Prevention
    - _Anforderungen: 8.3, 8.4_

- [x] 21. Video-Unterstützung

  - HTML5 Video Player Integration
  - Video-Thumbnail-Generierung mit FFmpeg.wasm
  - Video-Metadaten-Extraktion
  - Video-Playback-Controls
  - _Anforderungen: 2.4, 8.2_

- [x] 22. Portable Packaging

  - [x] 22.1 Electron Builder Konfiguration

    - Single-File Executable für Windows
    - Portable App ohne Installation
    - Alle Dependencies einbetten
    - _Anforderungen: 1.1, 1.2, 1.3, 1.4_

  - [x] 22.2 Portable Daten-Management

    - Konfigurationsdateien relativ zur .exe speichern
    - Keine Registry-Einträge oder System-Dateien
    - Cleanup beim Beenden sicherstellen
    - _Anforderungen: 1.2, 1.5_

- [x] 23. Testing und Qualitätssicherung

  - [x] 23.1 Unit Tests schreiben

    - Repository-Tests mit Mock-Dateisystem
    - Service-Tests mit Dependency Injection
    - Utility-Function-Tests
    - _Anforderungen: Alle_

  - [x] 23.2 Integration Tests implementieren

    - End-to-End UI-Tests mit Electron Testing
    - Metadaten-Roundtrip-Tests
    - Performance-Tests für große Ordner
    - _Anforderungen: Alle_

- [x] 24. Dokumentation und Finalisierung

  - Benutzer-Dokumentation erstellen
  - Keyboard-Shortcuts-Referenz
  - Troubleshooting-Guide
  - Build und Deployment-Anweisungen
  - _Anforderungen: Alle_
