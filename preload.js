const { contextBridge, ipcRenderer } = require('electron');

console.log('🔧 Preload script geladen');

// Sichere APIs für den Renderer bereitstellen
contextBridge.exposeInMainWorld('electronAPI', {
  // File System APIs
  fileSystem: {
    // Laufwerke abrufen
    getDrives: () => ipcRenderer.invoke('fs:getDrives'),

    // Ordnerinhalt abrufen (Ordner + Bilder)
    getDirectoryContents: (path) => ipcRenderer.invoke('fs:getDirectoryContents', path),

    // Nur Ordner abrufen (für Baumstruktur)
    getDirectories: (path) => ipcRenderer.invoke('fs:getDirectories', path),

    // Datei-Informationen abrufen
    getFileInfo: (path) => ipcRenderer.invoke('fs:getFileInfo', path),

    // Prüfen ob Pfad existiert
    pathExists: (path) => ipcRenderer.invoke('fs:pathExists', path)
  },
  
  // System APIs
  system: {
    // Plattform-Info
    getPlatform: () => ipcRenderer.invoke('system:getPlatform'),

    // App-Version
    getVersion: () => ipcRenderer.invoke('system:getVersion'),

    // System Theme abfragen
    getSystemTheme: () => ipcRenderer.invoke('get-system-theme'),

    // Theme Change Events empfangen
    onSystemThemeChanged: (callback) => {
      ipcRenderer.on('system-theme-changed', (event, theme) => callback(theme));
    },

    // Theme Change Listener entfernen
    removeSystemThemeListener: () => {
      ipcRenderer.removeAllListeners('system-theme-changed');
    }
  },
  
  // Debugging
  debug: {
    log: (message) => ipcRenderer.invoke('debug:log', message)
  },

  // Metadaten APIs
  metadata: {
    // Vollständige Metadaten lesen
    read: (filePath) => ipcRenderer.invoke('metadata:read', filePath),

    // Vollständige Metadaten schreiben
    write: (filePath, metadata) => ipcRenderer.invoke('metadata:write', filePath, metadata),

    // Nur Tags aus Datei lesen
    readTags: (filePath) => ipcRenderer.invoke('metadata:readTags', filePath),

    // Nur Tags in Datei schreiben
    writeTags: (filePath, tags) => ipcRenderer.invoke('metadata:writeTags', filePath, tags),

    // Bewertung lesen
    readRating: (filePath) => ipcRenderer.invoke('metadata:readRating', filePath),

    // Bewertung schreiben
    writeRating: (filePath, rating) => ipcRenderer.invoke('metadata:writeRating', filePath, rating),

    // EXIF-Daten lesen
    readEXIF: (filePath) => ipcRenderer.invoke('metadata:readEXIF', filePath)
  },

  // Portable Data APIs (JSON files next to EXE)
  data: {
    // JSON-Datei lesen
    readJSON: (filename) => ipcRenderer.invoke('data:readJSON', filename),

    // JSON-Datei schreiben
    writeJSON: (filename, data) => ipcRenderer.invoke('data:writeJSON', filename, data),

    // Prüfen ob Datei existiert
    exists: (filename) => ipcRenderer.invoke('data:exists', filename),

    // App-Verzeichnis abrufen
    getAppDir: () => ipcRenderer.invoke('data:getAppDir')
  },

  // Import/Export APIs
  importExport: {
    // Datei-Dialog zum Exportieren öffnen
    showSaveDialog: (options) => ipcRenderer.invoke('dialog:showSave', options),

    // Datei-Dialog zum Importieren öffnen
    showOpenDialog: (options) => ipcRenderer.invoke('dialog:showOpen', options),

    // Datei exportieren
    exportFile: (filePath, data) => ipcRenderer.invoke('export:file', filePath, data),

    // Datei importieren
    importFile: (filePath) => ipcRenderer.invoke('import:file', filePath)
  }
});

console.log('✅ Electron APIs bereitgestellt');
