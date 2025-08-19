# Changelog

Alle wichtigen Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/),
und dieses Projekt folgt [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Hinzugefügt
- Vollständige Dokumentation (Benutzerhandbuch, Keyboard Shortcuts, Troubleshooting, Build-Anweisungen)

## [1.0.0] - 2024-01-XX

### Hinzugefügt
- Vollständig portable Desktop-Anwendung ohne Installation
- 3-Spalten-Layout (Navigation, Content Grid, Properties/Tags)
- Hierarchisches Tag-System mit Kategorien und Unterkategorien
- Integrierter Bildbearbeiter in separatem Fenster
- Vollbild-Viewer mit Diashow-Funktionalität
- Metadaten-Integration (EXIF/XMP) direkt in Bilddateien
- Multi-Format-Unterstützung (JPEG, PNG, GIF, BMP, TIFF, MP4, AVI, MOV)
- GPU-beschleunigte Bildverarbeitung und Thumbnail-Generierung
- Intelligentes Memory-basiertes Caching-System
- Drag & Drop-Unterstützung für alle Operationen
- Umfassendes Keyboard-Shortcuts-System
- Multi-Selection mit Windows-Standard-Verhalten
- Globale Suche und erweiterte Filter-Funktionen
- Bewertungssystem (1-5 Sterne) in Metadaten
- Favoriten-System für häufig verwendete Ordner
- Import/Export-System für Konfiguration und Bilder
- Internationalisierung (Deutsch/Englisch)
- Light/Dark Theme mit automatischer Systemerkennung
- Kontextmenü-System für alle UI-Elemente
- Performance-Optimierungen für große Bildersammlungen
- Video-Unterstützung mit HTML5 Player und FFmpeg.wasm
- Umfassende Test-Suite (Unit, Integration, Performance)

### Technische Features
- Electron + React + TypeScript Architektur
- Dependency Injection Container
- Repository Pattern für Datenbank-Zugriff
- Service Layer für Geschäftslogik
- Worker Threads für Background-Processing
- WebGL-Shader für GPU-beschleunigte Filter
- Memory Leak Prevention
- Hardware-Detection mit CPU-Fallback
- Portable Packaging für alle Plattformen

### Sicherheit
- Keine Registry-Einträge oder System-Dateien
- Keine Netzwerk-Verbindungen erforderlich
- Lokale Datenverarbeitung ohne Cloud-Abhängigkeiten
- Sichere Metadaten-Verarbeitung

## [0.9.0] - 2024-01-XX (Beta)

### Hinzugefügt
- Beta-Version mit Kern-Funktionalität
- Grundlegende UI-Struktur
- Dateisystem-Navigation
- Thumbnail-Generierung
- Tag-System Grundlagen

### Geändert
- Performance-Verbesserungen
- UI/UX-Optimierungen

### Behoben
- Speicher-Leaks bei großen Bildersammlungen
- Thumbnail-Generierung für Videos
- Metadaten-Schreibfehler bei schreibgeschützten Dateien

## [0.8.0] - 2024-01-XX (Alpha)

### Hinzugefügt
- Alpha-Version für interne Tests
- Grundlegende Bildanzeige
- Ordner-Navigation
- Erste Tag-Implementierung

### Bekannte Probleme
- Performance-Probleme bei großen Ordnern
- Unvollständige Metadaten-Unterstützung
- Fehlende Keyboard-Shortcuts

## Versionsschema

Dieses Projekt verwendet [Semantic Versioning](https://semver.org/):

- **MAJOR** Version für inkompatible API-Änderungen
- **MINOR** Version für neue Funktionalität (rückwärtskompatibel)
- **PATCH** Version für Bugfixes (rückwärtskompatibel)

### Kategorien

- **Hinzugefügt** für neue Features
- **Geändert** für Änderungen an bestehender Funktionalität
- **Veraltet** für Features, die bald entfernt werden
- **Entfernt** für entfernte Features
- **Behoben** für Bugfixes
- **Sicherheit** für Sicherheits-relevante Änderungen

## Migration Guide

### Von 0.9.x zu 1.0.0

**Konfiguration:**
- Alte Konfigurationsdateien werden automatisch migriert
- Backup der alten Konfiguration wird erstellt
- Neue Features sind standardmäßig aktiviert

**Tag-System:**
- Bestehende Tags werden in neue Hierarchie-Struktur konvertiert
- Flache Tag-Listen werden als Unterkategorien unter "Allgemein" eingeordnet
- Manuelle Reorganisation nach Migration empfohlen

**Performance:**
- Thumbnail-Cache wird neu erstellt (einmalig längere Ladezeit)
- GPU-Beschleunigung ist standardmäßig aktiviert
- Memory-Limits wurden angepasst (mehr RAM-Verbrauch möglich)

### Von 0.8.x zu 0.9.x

**Breaking Changes:**
- Konfigurationsdatei-Format geändert
- Tag-Speicherung von JSON-Dateien zu EXIF/XMP migriert
- UI-Layout komplett überarbeitet

**Migration:**
- Automatische Migration beim ersten Start
- Backup aller Konfigurationsdateien empfohlen
- Tags müssen möglicherweise neu zugewiesen werden

## Roadmap

### Version 1.1.0 (Q2 2024)
- [ ] RAW-Format-Unterstützung (CR2, NEF, ARW)
- [ ] Erweiterte Bildbearbeitung (Filter, Effekte)
- [ ] Batch-Operationen für Metadaten
- [ ] Verbesserte Performance für sehr große Sammlungen

### Version 1.2.0 (Q3 2024)
- [ ] Cloud-Synchronisation (Google Drive, Dropbox)
- [ ] Gesichtserkennung und -tagging
- [ ] GPS-Karten-Integration
- [ ] Plugin-System für Erweiterungen

### Version 2.0.0 (Q4 2024)
- [ ] Vollständige UI-Überarbeitung
- [ ] Machine Learning für automatisches Tagging
- [ ] Erweiterte Video-Bearbeitung
- [ ] Multi-User-Unterstützung

## Support

Bei Fragen zu Versionsänderungen:

- **GitHub Issues:** Für spezifische Probleme mit neuen Versionen
- **Migration Guide:** Detaillierte Anweisungen für größere Updates
- **Rollback:** Anweisungen zum Zurücksetzen auf vorherige Version

## Danksagungen

Besonderer Dank an alle Mitwirkenden, Beta-Tester und die Open-Source-Community für ihre wertvollen Beiträge zu diesem Projekt.