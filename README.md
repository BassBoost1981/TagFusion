# TagFusion 🏷️

<p align="center">
  <img src="assets/Logo.png" alt="TagFusion Logo" width="150">
</p>

**TagFusion** ist ein modernes, natives Windows-Tool zur professionellen Bild-Verwaltung und -Verschlagwortung (Tagging). Das Tool schreibt Tags direkt in die Metadaten der Bilddateien (EXIF/IPTC/XMP), sodass die Verschlagwortung portabel und kompatibel mit Adobe-Produkten sowie dem Windows Explorer ist.

---

## ✨ Features

### 🖼️ Bildverwaltung
- **3-Spalten-Layout**: Vertraut wie der Windows Explorer
  - **Linke Spalte**: Laufwerksbaum und Favoriten-Navigation
  - **Mitte**: Bildraster mit Thumbnails
  - **Rechte Spalte**: Tag-Panel für schnelles Zuweisen
- **Sortierung**: Nach Name, Datum, Bewertung
- **Zoom-Steuerung**: Flexible Thumbnail-Größenanpassung (50%-200%)
- **Lightbox**: Vollbildansicht für detaillierte Betrachtung
- **Ordner-Navigation**: Durchsuchen lokaler Laufwerke und NAS-Systeme

### 🏷️ Tagging-System
- **Metadaten-konforme Tags**: Schreibt in XMP, IPTC und Windows System.Keywords
- **Hierarchische Tag-Bibliothek**: Kategorien und Unterkategorien
- **Batch-Tagging**: Mehrere Bilder gleichzeitig taggen
- **⭐ 5-Sterne-Bewertung**: Bewertungen direkt in Bild-Metadaten speichern

### 🎨 Modernes UI
- **Glasmorphismus-Design**: Premium-Look mit Transparenz-Effekten
- **Dark Mode**: Augenfreundlich auch bei langer Nutzung
- **Animationen**: Flüssige Übergänge mit Framer Motion
- **Cyan-Akzentfarbe**: Konsistentes, modernes Farbschema

### 📁 Datei-Operationen
- **Kontextmenü**: Rechtsklick für schnellen Zugriff
- **Kopieren/Ausschneiden/Einfügen**: Volle Zwischenablage-Unterstützung
- **Umbenennen**: F2 oder über Kontextmenü
- **Löschen**: Mit Bestätigungsdialog
- **Im Explorer öffnen**: Schnellzugriff auf den Dateispeicherort
- **Eigenschaften anzeigen**: Detaillierte Dateiinformationen

### ⌨️ Tastaturkürzel
| Kürzel | Aktion |
|--------|--------|
| `Strg+A` | Alle auswählen |
| `Strg+C` | Kopieren |
| `Strg+X` | Ausschneiden |
| `Strg+V` | Einfügen |
| `F2` | Umbenennen |
| `Del` | Löschen |
| `Alt+Enter` | Eigenschaften |
| `Escape` | Auswahl aufheben |
| `Strg++` | Vergrößern |
| `Strg+-` | Verkleinern |
| `Strg+0` | Zoom zurücksetzen |

---

## 🏗️ Architektur

TagFusion verwendet eine hybride Architektur:

```
┌─────────────────────────────────────────────────────────┐
│                   TagFusion.exe                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              WPF Host Application               │   │
│  │  (.NET 8, Windows Desktop)                      │   │
│  │                                                  │   │
│  │  ┌───────────────────────────────────────────┐  │   │
│  │  │            WebView2 Control               │  │   │
│  │  │  ┌─────────────────────────────────────┐  │  │   │
│  │  │  │       React Frontend (Vite)         │  │  │   │
│  │  │  │  TypeScript + TailwindCSS + Motion  │  │  │   │
│  │  │  └─────────────────────────────────────┘  │  │   │
│  │  └───────────────────────────────────────────┘  │   │
│  │                     ↕ Bridge                    │   │
│  │  ┌───────────────────────────────────────────┐  │   │
│  │  │            C# Backend Services            │  │   │
│  │  │  • FileSystemService (Ordner, Dateien)    │  │   │
│  │  │  • ExifToolService (Metadaten R/W)        │  │   │
│  │  │  • ThumbnailService (Vorschaubilder)      │  │   │
│  │  │  • TagService (Tag-Bibliothek)            │  │   │
│  │  │  • DatabaseService (SQLite Cache)          │  │   │
│  │  │  • ImageEditService (Drehen, Spiegeln)    │  │   │
│  │  │  • FileOperationService (Kopieren, etc.)  │  │   │
│  │  └───────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Backend (C# / .NET 8 WPF)
- **MainWindow.xaml.cs**: Host für WebView2 mit Splash-Screen
- **WebViewBridge.cs**: Bidirektionale Kommunikation Frontend ↔ Backend
- **Services**: Alle Geschäftslogik (siehe oben)
- **Models**: Datenmodelle (ImageFile, FolderItem, Tag, etc.)

### Frontend (React + TypeScript)
- **Vite** als Build-Tool
- **TailwindCSS** für Styling
- **Framer Motion** für Animationen
- **Zustand** für State Management
- **Lucide React** für Icons

---

## 📁 Projektstruktur

```
TagFusion/
├── assets/                    # Logo und Icons
│   ├── Logo.ico
│   └── Logo.png
├── Backend/
│   ├── TagFusion/
│   │   ├── Bridge/            # WebView2 ↔ React Kommunikation
│   │   │   └── WebViewBridge.cs
│   │   ├── Database/          # SQLite Datenbank
│   │   ├── Models/            # Datenmodelle
│   │   │   ├── FolderItem.cs
│   │   │   ├── GridItem.cs
│   │   │   ├── ImageFile.cs
│   │   │   ├── Settings.cs
│   │   │   └── Tag.cs
│   │   ├── Services/          # Business Logic
│   │   │   ├── DatabaseService.cs
│   │   │   ├── ExifToolService.cs
│   │   │   ├── FileOperationService.cs
│   │   │   ├── FileSystemService.cs
│   │   │   ├── ImageEditService.cs
│   │   │   ├── TagService.cs
│   │   │   └── ThumbnailService.cs
│   │   ├── wwwroot/           # Kompiliertes Frontend (Produktion)
│   │   ├── App.xaml(.cs)
│   │   ├── MainWindow.xaml(.cs)
│   │   └── TagFusion.csproj
│   └── TagFusion.sln
├── Frontend/
│   ├── public/                # Statische Assets
│   ├── src/
│   │   ├── components/        # React-Komponenten
│   │   │   ├── dashboard/     # Dashboard-Widgets
│   │   │   ├── images/        # ImageGrid, ImageCard, FolderCard
│   │   │   ├── layout/        # Sidebar, MainContent, TagPanel, Toolbar
│   │   │   ├── lightbox/      # Vollbild-Ansicht
│   │   │   ├── tags/          # Tag-Manager
│   │   │   └── ui/            # Wiederverwendbare UI-Komponenten
│   │   │       └── glass/     # Glasmorphismus-Komponenten
│   │   ├── hooks/             # React Hooks
│   │   ├── services/          # Frontend-Services
│   │   ├── stores/            # Zustand State Management
│   │   │   ├── appStore.ts
│   │   │   ├── clipboardStore.ts
│   │   │   ├── contextMenuStore.ts
│   │   │   ├── lightboxStore.ts
│   │   │   ├── modalStore.ts
│   │   │   ├── settingsStore.ts
│   │   │   └── tagStore.ts
│   │   ├── styles/            # CSS Dateien
│   │   ├── types/             # TypeScript Typen
│   │   ├── utils/             # Hilfsfunktionen
│   │   ├── App.tsx            # Haupt-App-Komponente
│   │   └── main.tsx           # Entry Point
│   ├── package.json
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── vite.config.ts
├── Tools/                     # ExifTool und andere Tools
├── build_release.ps1          # Release Build Script
└── README.md
```

---

## 🚀 Installation & Entwicklung

### Voraussetzungen
- **Windows 10/11** (64-bit)
- **.NET 8 SDK** ([Download](https://dotnet.microsoft.com/download/dotnet/8.0))
- **Node.js 18+** ([Download](https://nodejs.org/))
- **WebView2 Runtime** (auf Windows 10/11 meist vorinstalliert)

### Development Setup

1. **Repository klonen**
   ```bash
   git clone <repository-url>
   cd TagFusion
   ```

2. **Frontend starten**
   ```bash
   cd Frontend
   npm install
   npm run dev
   ```
   Das Frontend läuft nun auf `http://localhost:5173`

3. **Backend starten** (in einem neuen Terminal)
   ```bash
   cd Backend/TagFusion
   dotnet run
   ```
   Das Backend öffnet automatisch ein Fenster mit dem Frontend.

### Production Build

Verwende das mitgelieferte Build-Script:

```powershell
./build_release.ps1
```

Das Script:
1. Baut das Frontend (`npm run build`)
2. Kopiert das Frontend in `Backend/TagFusion/wwwroot`
3. Publiziert das Backend als Single-File EXE
4. Ausgabe: `Backend/TagFusion/bin/Release/net8.0-windows/win-x64/publish/TagFusion.exe`

**Wichtig**: Die `wwwroot`-Ordner muss sich neben der EXE befinden!

---

## 🛠️ Technologie-Stack

### Backend
| Technologie | Version | Zweck |
|------------|---------|-------|
| .NET | 8.0 | Framework |
| WPF | - | Windows UI Host |
| WebView2 | 1.0.2592.51 | Chromium Browser Control |
| Newtonsoft.Json | 13.0.3 | JSON Serialisierung |
| SQLite | 1.0.118 | Lokale Datenbank/Cache |
| System.Drawing.Common | 8.0.0 | Bildverarbeitung |

### Frontend
| Technologie | Version | Zweck |
|------------|---------|-------|
| React | 18.2.0 | UI Framework |
| TypeScript | 5.3.0 | Typsicherheit |
| Vite | 5.0.0 | Build Tool |
| TailwindCSS | 3.4.0 | Styling |
| Framer Motion | 12.23.25 | Animationen |
| Zustand | 4.4.7 | State Management |
| Lucide React | 0.292.0 | Icons |

---

## 🎯 Roadmap

- [ ] Drag & Drop für Tags
- [ ] Mehrsprachigkeit (i18n)
- [ ] Export/Import der Tag-Bibliothek
- [ ] PDF-Matrix-Export
- [ ] Bildvergleich (Side-by-Side)
- [ ] Gesichtserkennung (AI)
- [ ] Cloud-Sync (OneDrive, Google Drive)

---

## 📄 Lizenz

Dieses Projekt ist unter der MIT-Lizenz lizenziert.

---

## 🤝 Beitragen

Beiträge sind willkommen! Bitte erstelle einen Pull Request oder öffne ein Issue für Bugs und Feature-Requests.

---

<p align="center">
  <b>Made with ❤️ for photographers and digital asset managers</b>
</p>
