# Design-Dokument

## Überblick

Das portable Bildverwaltungsprogramm wird als Desktop-Anwendung entwickelt, die vollständig ohne Installation funktioniert. Die Architektur fokussiert sich auf Performance, Portabilität und eine saubere Trennung zwischen UI, Geschäftslogik und Dateisystem-Operationen.

## Architektur

### Technologie-Stack

**Frontend Framework:** Electron mit React/TypeScript

- Ermöglicht native Desktop-Anwendung mit Web-Technologien
- Plattformübergreifend (Windows, macOS, Linux)
- GPU-Hardwarebeschleunigung durch Chromium
- Einfache Portabilität als einzelne ausführbare Datei

**Bildverarbeitung:** Sharp.js + Canvas API

- Sharp.js für serverseitige Bildoperationen (Thumbnails, Resize)
- Canvas API für GPU-beschleunigte Bildbearbeitung
- WebGL für performante Filter und Transformationen

**Metadaten-Verarbeitung:** ExifReader + piexifjs

- ExifReader für das Lesen von EXIF/XMP-Daten
- piexifjs für das Schreiben von Metadaten
- Unterstützung für hierarchische Tags in XMP-Format

**Video-Unterstützung:** HTML5 Video API + FFmpeg.wasm

- Native HTML5-Videowiedergabe für gängige Formate
- FFmpeg.wasm für Thumbnail-Generierung aus Videos
- Hardware-Dekodierung wo verfügbar

### UI-Layout (Toolbar + 3-Spalten-Design)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                Main Window                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                 Toolbar                                        │
│ [🏠] [⬅️] [➡️] | [🔍 Search...] [🏷️ Filter by Tags ▼] [⚙️] [🌙/☀️]           │
├─────────────────┬─────────────────────────────────────┬─────────────────────────┤
│   Left Panel    │           Center Panel              │      Right Panel       │
│   (Navigation)  │         (Content Grid)              │    (Properties/Tags)    │
│                 │                                     │                         │
│ ┌─────────────┐ │ ┌─────────────────────────────────┐ │ ┌─────────────────────┐ │
│ │ Favorites   │ │ │                                 │ │ │    Properties       │ │
│ │ - Folder 1  │ │ │  [📁] [📁] [🖼️] [🖼️] [🎥]      │ │ │ Name: image.jpg     │ │
│ │ - Folder 2  │ │ │                                 │ │ │ Size: 2.5 MB        │ │
│ └─────────────┘ │ │  [🖼️] [🖼️] [📁] [🖼️] [🖼️]      │ │ │ Date: 2024-01-15    │ │
│                 │ │                                 │ │ │ Resolution: 1920x1080│ │
│ ┌─────────────┐ │ │  [🎥] [🖼️] [🖼️] [🖼️] [📁]      │ │ └─────────────────────┘ │
│ │Drive Tree   │ │ │                                 │ │                         │
│ │📁 C:\       │ │ │         Grid Layout             │ │ ┌─────────────────────┐ │
│ │ 📁Documents │ │ │    (Folders + Media Files)      │ │ │    Tag System       │ │
│ │ 📁Pictures  │ │ │                                 │ │ │                     │ │
│ │📁 D:\       │ │ │                                 │ │ │ 📁 Natur            │ │
│ │📁 USB (E:)  │ │ │                                 │ │ │  📁 Landschaft      │ │
│ │             │ │ │                                 │ │ │   🏷️ Berge          │ │
│ └─────────────┘ │ └─────────────────────────────────┘ │ │   🏷️ Seen           │ │
│                 │                                     │ │  📁 Tiere           │ │
│                 │                                     │ │   🏷️ Vögel          │ │
│                 │                                     │ │                     │ │
│                 │                                     │ └─────────────────────┘ │
└─────────────────┴─────────────────────────────────────┴─────────────────────────┘
```

### Architektur-Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                       │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐│
│  │  Left Panel     │ │  Center Panel   │ │  Right Panel    ││
│  │ (Navigation)    │ │ (Content Grid)  │ │(Properties/Tags)││
│  └─────────────────┘ └─────────────────┘ └─────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Business Logic Layer                     │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐│
│  │ File Manager    │ │ Tag Manager     │ │ Image Processor ││
│  │ Service         │ │ Service         │ │ Service         ││
│  └─────────────────┘ └─────────────────┘ └─────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      Data Access Layer                      │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐│
│  │ File System     │ │ Metadata        │ │ Configuration   ││
│  │ Repository      │ │ Repository      │ │ Repository      ││
│  └─────────────────┘ └─────────────────┘ └─────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Komponenten und Schnittstellen

### 1. File System Repository

**Verantwortlichkeiten:**

- Laufwerks- und Ordnerstruktur scannen
- Unterstützte Medienformate erkennen
- Dateisystem-Operationen (Kopieren, Verschieben)

**Schnittstellen:**

```typescript
interface IFileSystemRepository {
  getDrives(): Promise<DriveInfo[]>;
  getDirectoryTree(path: string): Promise<DirectoryNode[]>;
  getDirectoryContents(path: string): Promise<DirectoryContent>;
  copyFile(source: string, destination: string): Promise<void>;
}

interface DirectoryContent {
  folders: FolderItem[];
  mediaFiles: MediaFile[];
  path: string;
}

interface FolderItem {
  name: string;
  path: string;
  hasSubfolders: boolean;
  mediaCount: number;
}

interface MediaFile {
  path: string;
  name: string;
  extension: string;
  size: number;
  dateModified: Date;
  type: 'image' | 'video';
  thumbnailPath?: string;
}
```

### 2. Metadata Repository

**Verantwortlichkeiten:**

- EXIF/XMP-Metadaten lesen und schreiben
- Hierarchische Tags verwalten
- Bewertungen speichern

**Schnittstellen:**

```typescript
interface IMetadataRepository {
  readMetadata(filePath: string): Promise<MediaMetadata>;
  writeMetadata(filePath: string, metadata: MediaMetadata): Promise<void>;
  extractTags(filePath: string): Promise<HierarchicalTag[]>;
  writeTags(filePath: string, tags: HierarchicalTag[]): Promise<void>;
}

interface HierarchicalTag {
  category: string;
  subcategory?: string;
  tag: string;
  fullPath: string; // "Natur/Landschaft/Berge"
}

interface MediaMetadata {
  tags: HierarchicalTag[];
  rating: number; // 1-5 stars
  dateCreated: Date;
  cameraInfo?: CameraInfo;
}
```

### 3. Configuration Repository

**Verantwortlichkeiten:**

- Anwendungseinstellungen verwalten
- Favoriten speichern
- Tag-Hierarchien exportieren/importieren

**Schnittstellen:**

```typescript
interface IConfigurationRepository {
  loadSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<void>;
  exportConfiguration(): Promise<ConfigurationExport>;
  importConfiguration(config: ConfigurationExport): Promise<void>;
}

interface AppSettings {
  language: string;
  theme: 'light' | 'dark' | 'system';
  favorites: FavoriteFolder[];
  tagHierarchy: TagHierarchyNode[];
}

interface ConfigurationExport {
  version: string;
  settings: AppSettings;
  tagDefinitions: TagHierarchyNode[];
  exportDate: Date;
}
```

### 4. Image Processor Service

**Verantwortlichkeiten:**

- Thumbnail-Generierung
- Bildbearbeitungsoperationen
- GPU-beschleunigte Transformationen
- Separates Editor-Fenster Management

**Schnittstellen:**

```typescript
interface IImageProcessorService {
  generateThumbnail(filePath: string, size: number): Promise<string>; // Base64
  processImage(filePath: string, operations: ImageOperation[]): Promise<string>;
  applyFilter(imageData: ImageData, filter: FilterType): Promise<ImageData>;
  openEditor(file: MediaFile): Promise<void>; // Öffnet separates Editor-Fenster
  saveEditedImage(originalPath: string, operations: ImageOperation[]): Promise<string>;
}

interface ImageOperation {
  type: 'brightness' | 'contrast' | 'saturation' | 'rotate' | 'crop' | 'resize';
  value: number | CropArea | RotationAngle;
  timestamp: Date;
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RotationAngle {
  degrees: 90 | 180 | 270;
}
```

## Datenmodelle

### Tag-Hierarchie-System

```typescript
interface TagHierarchyNode {
  id: string;
  name: string;
  parent?: string;
  children: TagHierarchyNode[];
  level: number; // 0=Category, 1=Subcategory, 2=Tag
}

// Beispiel-Struktur:
// Natur (Category, Level 0)
//   ├── Landschaft (Subcategory, Level 1)
//   │   ├── Berge (Tag, Level 2)
//   │   └── Seen (Tag, Level 2)
//   └── Tiere (Subcategory, Level 1)
//       ├── Vögel (Tag, Level 2)
//       └── Säugetiere (Tag, Level 2)
```

### Favoriten-System

```typescript
interface FavoriteFolder {
  id: string;
  name: string;
  path: string;
  dateAdded: Date;
  order: number;
}
```

### Thumbnail-Cache

```typescript
interface ThumbnailCache {
  filePath: string;
  thumbnailData: string; // Base64
  fileSize: number;
  dateModified: Date;
  cacheDate: Date;
}
```

## Fehlerbehandlung

### Dateisystem-Fehler

- **Zugriff verweigert:** Benutzerfreundliche Meldung mit Lösungsvorschlägen
- **Datei nicht gefunden:** Automatische Bereinigung von Referenzen
- **Laufwerk nicht verfügbar:** Graceful Degradation der Laufwerksliste

### Metadaten-Fehler

- **Schreibgeschützte Dateien:** Warnung anzeigen, Operation überspringen
- **Korrupte Metadaten:** Fallback auf Dateiname und -datum
- **Nicht unterstützte Formate:** Nur Anzeige, keine Metadaten-Bearbeitung

### Performance-Fehler

- **Speicher-Limits:** Intelligente Thumbnail-Cache-Verwaltung
- **GPU-Fehler:** Fallback auf CPU-Verarbeitung
- **Große Dateien:** Progressiver Ladevorgang mit Abbruch-Option

## Testing-Strategie

### Unit Tests

- **Repositories:** Mock-Dateisystem für isolierte Tests
- **Services:** Dependency Injection für Testbarkeit
- **Utilities:** Reine Funktionen für einfache Tests

### Integration Tests

- **Metadaten-Operationen:** Echte Testdateien mit bekannten Metadaten
- **Dateisystem-Operationen:** Temporäre Testordner
- **Import/Export:** Roundtrip-Tests für Datenintegrität

### Performance Tests

- **Große Ordner:** Simulierte Ordner mit 10.000+ Bildern
- **Thumbnail-Generierung:** Batch-Verarbeitung unter Zeitlimits
- **Memory Leaks:** Langzeit-Tests mit Speicher-Monitoring

### UI Tests

- **Responsive Design:** Verschiedene Bildschirmgrößen
- **Accessibility:** Tastaturnavigation und Screen Reader
- **Theme-Switching:** Light/Dark Mode Konsistenz

## Internationalisierung

### Struktur

```
/locales
  /en
    - common.json (Buttons, Menüs)
    - errors.json (Fehlermeldungen)
    - tooltips.json (Hilfe-Texte)
  /de
    - common.json
    - errors.json
    - tooltips.json
```

### Implementierung

- **React-i18next:** Für dynamische Übersetzungen
- **Namespace-Trennung:** Logische Gruppierung der Texte
- **Pluralisierung:** Automatische Singular/Plural-Behandlung
- **Fallback-Kette:** en -> Browser-Sprache -> Systemsprache

## UI-Komponenten Details

### Toolbar

**Navigation-Buttons:**

```typescript
interface ToolbarComponent {
  currentPath: string;
  canGoBack: boolean;
  canGoForward: boolean;
  searchQuery: string;
  activeFilters: FilterCriteria;
  onHomeClick: () => void;
  onBackClick: () => void;
  onForwardClick: () => void;
  onSearchChange: (query: string) => void;
  onFilterChange: (filters: FilterCriteria) => void;
  onSettingsClick: () => void;
  onThemeToggle: () => void;
}

interface FilterCriteria {
  tags: HierarchicalTag[];
  dateRange?: { from: Date; to: Date };
  fileTypes: ('image' | 'video')[];
  rating?: number;
}
```

**Such- und Filter-Funktionen:**

- **Globale Suche** - Dateinamen, Tags und Metadaten durchsuchen
- **Tag-Filter** - Dropdown mit hierarchischer Tag-Auswahl
- **Erweiterte Filter** - Datum, Dateityp, Bewertung
- **Schnellfilter** - Häufig verwendete Filterkombinationen

### Linke Spalte (Navigation Panel)

**Favoriten-Bereich:**

```typescript
interface FavoritesComponent {
  favorites: FavoriteFolder[];
  onFavoriteClick: (folder: FavoriteFolder) => void;
  onAddFavorite: (path: string) => void;
  onRemoveFavorite: (id: string) => void;
}
```

**Laufwerks-Baum:**

```typescript
interface DriveTreeComponent {
  drives: DriveInfo[];
  expandedNodes: Set<string>;
  selectedPath: string;
  onNodeSelect: (path: string) => void;
  onNodeExpand: (path: string) => void;
}
```

### Mittlere Spalte (Content Grid)

**Grid-Layout:**

```typescript
interface ContentGridComponent {
  items: (FolderItem | MediaFile)[];
  viewMode: 'grid' | 'list';
  selectedItems: Set<string>;
  selectionManager: MultiSelectionManager;
  onItemSelect: (item: FolderItem | MediaFile, event: MouseEvent) => void;
  onItemDoubleClick: (item: FolderItem | MediaFile) => void; // Ordner: navigieren, Media: Editor öffnen
  onItemEdit: (file: MediaFile) => void; // Öffnet separates Editor-Fenster
  onContextMenu: (item: FolderItem | MediaFile, event: MouseEvent) => void;
  onDragStart: (items: (FolderItem | MediaFile)[]) => void;
  onDrop: (items: (FolderItem | MediaFile)[], target: DropTarget) => void;
}

interface GridItemComponent {
  item: FolderItem | MediaFile;
  isSelected: boolean;
  thumbnailSize: number;
  showFileName: boolean;
}
```

### Rechte Spalte (Properties & Tags)

**Properties-Panel:**

```typescript
interface PropertiesComponent {
  selectedItem?: MediaFile;
  selectedItems?: MediaFile[]; // Für Multi-Selection
  metadata?: MediaMetadata;
  exifData?: EXIFData;
  showTechnicalDetails: boolean;
  onMetadataChange: (metadata: Partial<MediaMetadata>) => void;
  onEditClick: (file: MediaFile) => void; // Öffnet Editor-Fenster
  onFullscreenClick: (file: MediaFile) => void; // Öffnet Vollbild-Viewer
  onToggleTechnicalDetails: () => void;
  onBatchOperation: (operation: BatchOperation, items: MediaFile[]) => void;
}
```

**Tag-System-Panel:**

```typescript
interface TagSystemComponent {
  tagHierarchy: TagHierarchyNode[];
  selectedTags: HierarchicalTag[];
  onTagSelect: (tag: HierarchicalTag) => void;
  onTagCreate: (parentId: string, name: string) => void;
  onTagDelete: (tagId: string) => void;
  onTagEdit: (tagId: string, newName: string) => void;
  onContextMenu: (tag: HierarchicalTag, event: MouseEvent) => void;
  onDragStart: (tag: HierarchicalTag) => void;
  onDrop: (files: MediaFile[], tag: HierarchicalTag) => void;
  onBatchTag: (files: MediaFile[], tags: HierarchicalTag[]) => void;
}
```

### Separates Editor-Fenster

**Image Editor Window:**

```typescript
interface ImageEditorWindow {
  file: MediaFile;
  originalImage: ImageData;
  editedImage: ImageData;
  editHistory: ImageOperation[];
  onSave: (operations: ImageOperation[]) => void;
  onCancel: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

interface ImageEditorToolbar {
  tools: EditorTool[];
  activeTool: EditorTool;
  onToolSelect: (tool: EditorTool) => void;
  onReset: () => void;
  onSaveAs: () => void;
}

interface EditorTool {
  id: string;
  name: string;
  icon: string;
  type: 'brightness' | 'contrast' | 'saturation' | 'rotate' | 'crop' | 'resize';
  component: React.ComponentType<ToolProps>;
}
```

**Editor-Layout:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    Image Editor Window                         │
├─────────────────────────────────────────────────────────────────┤
│ [💾] [↶] [↷] | [☀️] [🔆] [🎨] [↻] [✂️] [📏] | [↶ Undo] [↷ Redo] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                    Image Preview Area                           │
│                   (with zoom controls)                          │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│              Tool-specific Controls Panel                      │
│  [Brightness: ████████░░] [Contrast: ██████░░░░]              │
│  [Saturation: ███████░░░] [Reset] [Apply]                     │
└─────────────────────────────────────────────────────────────────┘
```

## Erweiterte Benutzerinteraktion

### Keyboard Shortcuts (Windows Standard)

```typescript
interface KeyboardShortcuts {
  // Navigation
  'Ctrl+O': 'openFolder';
  'Alt+Left': 'goBack';
  'Alt+Right': 'goForward';
  'Alt+Home': 'goHome';
  
  // Auswahl
  'Ctrl+A': 'selectAll';
  'Ctrl+Click': 'multiSelect';
  'Shift+Click': 'rangeSelect';
  'Escape': 'clearSelection';
  
  // Dateien
  'F2': 'rename';
  'Delete': 'deleteFile';
  'Ctrl+C': 'copy';
  'Ctrl+V': 'paste';
  'Ctrl+X': 'cut';
  
  // Ansicht
  'F11': 'fullscreenViewer';
  'Ctrl+Plus': 'zoomIn';
  'Ctrl+Minus': 'zoomOut';
  'Ctrl+0': 'zoomReset';
  
  // Favoriten
  'F': 'addToFavorites';
  'Ctrl+D': 'addToFavorites';
  
  // Suche
  'Ctrl+F': 'focusSearch';
  'F3': 'findNext';
  'Shift+F3': 'findPrevious';
}
```

### Drag & Drop System

```typescript
interface DragDropHandlers {
  // Bilder zu Favoriten
  onDragToFavorites: (files: MediaFile[], targetFavorite: FavoriteFolder) => void;
  
  // Bilder zwischen Ordnern
  onDragToFolder: (files: MediaFile[], targetFolder: FolderItem) => void;
  
  // Tags zu Bildern
  onDragTagToFiles: (tag: HierarchicalTag, files: MediaFile[]) => void;
  
  // Bilder zu Tags (für Tagging)
  onDragFilesToTag: (files: MediaFile[], tag: HierarchicalTag) => void;
  
  // Ordner zu Favoriten
  onDragFolderToFavorites: (folder: FolderItem) => void;
}

interface DragDropVisualFeedback {
  showDropZone: boolean;
  dropZoneType: 'folder' | 'favorite' | 'tag';
  isValidDrop: boolean;
  previewText: string;
}
```

### Kontextmenüs

```typescript
interface ContextMenus {
  // Datei-Kontextmenü
  fileContextMenu: {
    items: [
      { label: 'Bearbeiten', action: 'edit', shortcut: 'Enter' },
      { label: 'Vollbild anzeigen', action: 'fullscreen', shortcut: 'F11' },
      { separator: true },
      { label: 'Tags hinzufügen', action: 'addTags' },
      { label: 'Bewertung', submenu: [
        { label: '⭐', action: 'rate', value: 1 },
        { label: '⭐⭐', action: 'rate', value: 2 },
        { label: '⭐⭐⭐', action: 'rate', value: 3 },
        { label: '⭐⭐⭐⭐', action: 'rate', value: 4 },
        { label: '⭐⭐⭐⭐⭐', action: 'rate', value: 5 }
      ]},
      { separator: true },
      { label: 'Kopieren', action: 'copy', shortcut: 'Ctrl+C' },
      { label: 'Ausschneiden', action: 'cut', shortcut: 'Ctrl+X' },
      { label: 'Löschen', action: 'delete', shortcut: 'Delete' },
      { separator: true },
      { label: 'Eigenschaften', action: 'properties' }
    ]
  };
  
  // Ordner-Kontextmenü
  folderContextMenu: {
    items: [
      { label: 'Öffnen', action: 'open', shortcut: 'Enter' },
      { label: 'Als Favorit hinzufügen', action: 'addFavorite', shortcut: 'F' },
      { separator: true },
      { label: 'Alle Bilder taggen', action: 'batchTag' },
      { separator: true },
      { label: 'Eigenschaften', action: 'properties' }
    ]
  };
  
  // Tag-Kontextmenü
  tagContextMenu: {
    items: [
      { label: 'Bearbeiten', action: 'editTag' },
      { label: 'Neue Unterkategorie', action: 'addSubcategory' },
      { separator: true },
      { label: 'Löschen', action: 'deleteTag' },
      { separator: true },
      { label: 'Exportieren', action: 'exportTag' }
    ]
  };
}
```

### Multi-Selection System

```typescript
interface MultiSelectionManager {
  selectedItems: Set<string>;
  selectionMode: 'single' | 'multi' | 'range';
  
  // Standard Windows-Verhalten
  handleClick: (item: MediaFile | FolderItem, event: MouseEvent) => void;
  handleCtrlClick: (item: MediaFile | FolderItem) => void; // Multi-Select
  handleShiftClick: (item: MediaFile | FolderItem) => void; // Range-Select
  
  // Batch-Operationen
  batchTag: (items: MediaFile[], tags: HierarchicalTag[]) => void;
  batchRate: (items: MediaFile[], rating: number) => void;
  batchExport: (items: MediaFile[], settings: ExportSettings) => void;
  batchDelete: (items: (MediaFile | FolderItem)[]) => void;
}
```

### Vollbild-Viewer

```typescript
interface FullscreenViewer {
  currentFile: MediaFile;
  fileList: MediaFile[];
  currentIndex: number;
  
  // Navigation
  nextImage: () => void; // Pfeil rechts
  previousImage: () => void; // Pfeil links
  
  // Zoom und Pan
  zoomLevel: number;
  panOffset: { x: number; y: number };
  
  // Diashow
  slideshowActive: boolean;
  slideshowInterval: number; // Sekunden
  
  // Overlay-Informationen
  showInfo: boolean;
  infoData: {
    filename: string;
    resolution: string;
    fileSize: string;
    dateCreated: string;
    tags: HierarchicalTag[];
    rating: number;
  };
}
```

### EXIF-Metadaten Anzeige

```typescript
interface EXIFData {
  // Kamera-Informationen
  camera: {
    make?: string; // Canon, Nikon, etc.
    model?: string; // EOS 5D Mark IV
    lens?: string; // EF 24-70mm f/2.8L
  };
  
  // Aufnahme-Einstellungen
  settings: {
    aperture?: string; // f/2.8
    shutterSpeed?: string; // 1/125s
    iso?: number; // 400
    focalLength?: string; // 50mm
    flash?: boolean;
  };
  
  // Datum und Ort
  location: {
    dateTime?: Date;
    gps?: {
      latitude: number;
      longitude: number;
      altitude?: number;
    };
  };
  
  // Technische Details
  technical: {
    colorSpace?: string; // sRGB, Adobe RGB
    whiteBalance?: string; // Auto, Daylight
    meteringMode?: string; // Matrix, Center-weighted
  };
}

interface PropertiesComponentExtended extends PropertiesComponent {
  exifData?: EXIFData;
  showTechnicalDetails: boolean;
  onToggleTechnicalDetails: () => void;
}
```

## Performance-Optimierungen

### Thumbnail-Generierung

- **Worker Threads:** Parallele Verarbeitung ohne UI-Blockierung
- **Lazy Loading:** Thumbnails nur bei Bedarf generieren
- **Memory Management:** LRU-Cache für Thumbnail-Daten
- **Progressive Loading:** Niedrige Qualität zuerst, dann hochauflösend

### Große Ordner

- **Virtualisierung:** Nur sichtbare Items rendern
- **Batch Processing:** Metadaten in Chunks laden
- **Debounced Search:** Verzögerte Suche bei Texteingabe
- **Background Indexing:** Metadaten im Hintergrund scannen

### GPU-Beschleunigung

- **WebGL Shaders:** Custom Filter für Bildbearbeitung
- **Canvas Offscreen:** Rendering ohne DOM-Manipulation
- **Hardware Detection:** Fallback-Strategien für schwache GPUs
- **Memory Pooling:** Wiederverwendung von GPU-Buffern
