# Portable Image Manager - Dokumentation

Willkommen zur umfassenden Dokumentation des Portable Image Managers. Diese Sammlung enthält alle Informationen, die Sie für die Verwendung, Entwicklung und Wartung der Anwendung benötigen.

## 📚 Dokumentations-Übersicht

### Für Benutzer

| Dokument | Beschreibung | Zielgruppe |
|----------|--------------|------------|
| **[Benutzerhandbuch](USER_GUIDE.md)** | Vollständige Anleitung zur Verwendung der Anwendung | Alle Benutzer |
| **[Keyboard Shortcuts](KEYBOARD_SHORTCUTS.md)** | Komplette Referenz aller Tastenkürzel | Alle Benutzer |
| **[Troubleshooting Guide](TROUBLESHOOTING.md)** | Lösungen für häufige Probleme und Fehlerbehebung | Alle Benutzer |

### Für Entwickler

| Dokument | Beschreibung | Zielgruppe |
|----------|--------------|------------|
| **[Build & Deployment](BUILD_DEPLOYMENT.md)** | Anweisungen für Build-Prozess und Deployment | Entwickler |
| **[Portable Packaging](PORTABLE_PACKAGING.md)** | Spezifische Anweisungen für portable Builds | Entwickler |

## 🚀 Schnelleinstieg

### Für neue Benutzer
1. Lesen Sie das **[Benutzerhandbuch](USER_GUIDE.md)** für eine vollständige Einführung
2. Schauen Sie sich die **[Keyboard Shortcuts](KEYBOARD_SHORTCUTS.md)** für effiziente Bedienung an
3. Bei Problemen konsultieren Sie den **[Troubleshooting Guide](TROUBLESHOOTING.md)**

### Für Entwickler
1. Folgen Sie den Anweisungen in **[Build & Deployment](BUILD_DEPLOYMENT.md)** für die Entwicklungsumgebung
2. Lesen Sie **[Portable Packaging](PORTABLE_PACKAGING.md)** für portable Builds
3. Studieren Sie die Architektur-Dokumentation im Hauptverzeichnis

## 📖 Dokumentations-Standards

### Sprache
- **Primärsprache:** Deutsch (da die Anwendung primär für deutschsprachige Benutzer entwickelt wurde)
- **Sekundärsprache:** Englisch (für internationale Entwickler)
- **Code-Kommentare:** Englisch
- **Benutzeroberfläche:** Mehrsprachig (Deutsch/Englisch)

### Format
- **Markdown:** Alle Dokumentation in Markdown-Format
- **Struktur:** Konsistente Überschriften-Hierarchie
- **Links:** Relative Links zwischen Dokumenten
- **Code-Beispiele:** Syntax-Highlighting für bessere Lesbarkeit

### Wartung
- **Aktualität:** Dokumentation wird bei jeder Feature-Änderung aktualisiert
- **Versionierung:** Dokumentation folgt der Anwendungsversion
- **Review:** Alle Dokumentations-Änderungen werden reviewed

## 🔍 Inhalts-Index

### Funktionen und Features

#### Grundfunktionen
- **Navigation:** Laufwerks-Baum, Favoriten, Ordner-Navigation
- **Anzeige:** Miniaturansichten, Vollbild-Viewer, Diashow
- **Organisation:** Hierarchisches Tag-System, Bewertungen
- **Bearbeitung:** Grundlegende Bildbearbeitung in separatem Fenster

#### Erweiterte Funktionen
- **Suche und Filter:** Globale Suche, erweiterte Filter
- **Import/Export:** Konfiguration, Bilder exportieren
- **Performance:** GPU-Beschleunigung, intelligentes Caching
- **Portabilität:** Keine Installation, USB-Stick-fähig

### Technische Aspekte

#### Architektur
- **Frontend:** Electron + React + TypeScript
- **Backend:** Node.js Services und Repositories
- **Datenbank:** Metadaten direkt in Bilddateien (EXIF/XMP)
- **Caching:** Memory-basiert, keine Festplatten-Dateien

#### Unterstützte Formate
- **Bilder:** JPEG, PNG, GIF, BMP, TIFF
- **Videos:** MP4, AVI, MOV
- **Metadaten:** EXIF, XMP, IPTC

## 🛠️ Entwickler-Ressourcen

### Code-Struktur
```text
src/
├── main/                 # Electron Main Process
│   ├── services/         # Backend-Services
│   ├── repositories/     # Datenbank-Zugriff
│   └── ipc/             # IPC-Handler
├── renderer/            # Electron Renderer Process
│   ├── src/
│   │   ├── components/  # React-Komponenten
│   │   ├── services/    # Frontend-Services
│   │   ├── hooks/       # Custom React Hooks
│   │   └── i18n/        # Internationalisierung
│   └── index.html
└── types/               # TypeScript-Definitionen
```

### Testing-Strategie
- **Unit Tests:** Vitest für Services und Utilities
- **Integration Tests:** Electron Testing für E2E-Workflows
- **Performance Tests:** Für große Bildersammlungen
- **UI Tests:** React Testing Library für Komponenten

### Build-Pipeline
- **Development:** Hot-Reload mit Vite
- **Production:** Optimierte Builds mit Webpack
- **Portable:** Electron-Builder für plattformspezifische Executables
- **CI/CD:** GitHub Actions für automatische Builds

## 📋 Checklisten

### Für neue Features
- [ ] Anforderungen dokumentiert
- [ ] Design-Dokument erstellt
- [ ] Implementation geplant
- [ ] Tests geschrieben
- [ ] Code implementiert
- [ ] Dokumentation aktualisiert
- [ ] Benutzerhandbuch erweitert
- [ ] Keyboard Shortcuts dokumentiert

### Für Releases
- [ ] Alle Tests bestehen
- [ ] Performance-Tests erfolgreich
- [ ] Dokumentation vollständig
- [ ] Build für alle Plattformen
- [ ] Portable Executables getestet
- [ ] Release Notes erstellt
- [ ] Troubleshooting Guide aktualisiert

## 🔗 Externe Ressourcen

### Technologie-Dokumentation
- **[Electron](https://www.electronjs.org/docs)** - Desktop-App-Framework
- **[React](https://react.dev/learn)** - UI-Bibliothek
- **[TypeScript](https://www.typescriptlang.org/docs/)** - Typisierte JavaScript-Erweiterung
- **[Vite](https://vitejs.dev/guide/)** - Build-Tool
- **[Vitest](https://vitest.dev/guide/)** - Testing-Framework

### Bildverarbeitung
- **[Sharp.js](https://sharp.pixelplumbing.com/)** - Hochperformante Bildverarbeitung
- **[ExifReader](https://github.com/mattiasw/ExifReader)** - EXIF-Metadaten lesen
- **[piexifjs](https://github.com/hMatoba/piexifjs)** - EXIF-Metadaten schreiben
- **[FFmpeg.wasm](https://ffmpegwasm.netlify.app/)** - Video-Verarbeitung im Browser

## 📞 Support und Community

### Hilfe erhalten
1. **Dokumentation durchsuchen** - Oft finden Sie hier bereits die Antwort
2. **GitHub Issues** - Für Bugs und Feature-Requests
3. **GitHub Discussions** - Für allgemeine Fragen und Diskussionen
4. **Email-Support** - Für spezifische Probleme

### Zur Community beitragen
- **Bug Reports:** Detaillierte Beschreibung mit Reproduktionsschritten
- **Feature Requests:** Klare Beschreibung des gewünschten Features
- **Code Contributions:** Pull Requests mit Tests und Dokumentation
- **Dokumentation:** Verbesserungen und Ergänzungen willkommen

## 📈 Metriken und Analytics

### Dokumentations-Qualität
- **Vollständigkeit:** Alle Features dokumentiert
- **Aktualität:** Regelmäßige Updates bei Änderungen
- **Verständlichkeit:** Klare Sprache und Struktur
- **Beispiele:** Praktische Code-Beispiele und Screenshots

### Benutzer-Feedback
- **GitHub Issues:** Tracking von dokumentationsbezogenen Problemen
- **Surveys:** Regelmäßige Umfragen zur Dokumentations-Qualität
- **Analytics:** Tracking der meist-gelesenen Dokumentations-Seiten

---

**Diese Dokumentation wird kontinuierlich gepflegt und erweitert. Bei Fragen oder Verbesserungsvorschlägen erstellen Sie gerne ein GitHub Issue.**