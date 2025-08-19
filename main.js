const { app, BrowserWindow, ipcMain, nativeTheme, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const exifr = require('exifr');
const piexif = require('piexifjs');
const os = require('os');

console.log('🚀 TagFusion Minimal startet...');

function createWindow() {
  console.log('📱 Erstelle Fenster...');

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // Erst nach dem Maximieren anzeigen
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Fenster maximieren und dann anzeigen
  win.maximize();
  win.show();

  console.log('📄 Lade HTML...');
  win.loadFile('index.html');

  // Dev Tools immer verfügbar (F12 zum Öffnen)
  // win.webContents.openDevTools(); // Automatisch öffnen für Debug

  // F12 Handler für DevTools
  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      win.webContents.toggleDevTools();
    }
  });

  console.log('✅ Fenster erstellt!');
}

// IPC Handlers für Theme Detection
ipcMain.handle('get-system-theme', () => {
  const isDark = nativeTheme.shouldUseDarkColors;
  console.log(`🎨 System Theme: ${isDark ? 'dark' : 'light'}`);
  return isDark ? 'dark' : 'light';
});

// Theme Change Listener
nativeTheme.on('updated', () => {
  const isDark = nativeTheme.shouldUseDarkColors;
  console.log(`🎨 System Theme geändert: ${isDark ? 'dark' : 'light'}`);
  // Sende Update an alle Fenster
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('system-theme-changed', isDark ? 'dark' : 'light');
  });
});

// File System IPC Handlers
ipcMain.handle('fs:getDrives', async () => {
  try {
    const drives = [];
    // Windows Laufwerke A-Z prüfen
    for (let i = 65; i <= 90; i++) {
      const drive = String.fromCharCode(i) + ':';
      try {
        await fs.promises.access(drive + '\\');
        const stats = await fs.promises.stat(drive + '\\');
        // Versuche Volume-Label zu ermitteln
        let volumeLabel = 'Lokaler Datenträger';
        try {
          const { execSync } = require('child_process');
          const result = execSync(`vol ${drive}`, { encoding: 'utf8', timeout: 2000 });

          // Verschiedene Sprach-Patterns für Volume-Labels
          let match = result.match(/Volume in drive .+ is (.+)/i) || // Englisch
                     result.match(/Datenträger in Laufwerk .+ ist (.+)/i) || // Deutsch
                     result.match(/Volume im Laufwerk .+ ist (.+)/i); // Deutsch alternativ

          if (match && match[1] && match[1].trim() !== '' && !match[1].includes('hat keine Bezeichnung')) {
            volumeLabel = match[1].trim();
          } else {
            // Fallback: Verwende dir Befehl für Volume-Label
            try {
              const dirResult = execSync(`dir "${drive}\\"`, { encoding: 'utf8', timeout: 2000 });
              const labelMatch = dirResult.match(/Volume in drive .+ is (.+)/i) ||
                                dirResult.match(/Datenträger in Laufwerk .+ ist (.+)/i);

              if (labelMatch && labelMatch[1] && labelMatch[1].trim() !== '') {
                volumeLabel = labelMatch[1].trim();
              }
            } catch (dirError) {
              // dir auch fehlgeschlagen, verwende Standard-Label
            }
          }
        } catch (e) {
          console.log(`⚠️ Konnte Volume-Label für ${drive} nicht ermitteln:`, e.message);
        }

        // Speicherplatz ermitteln - Demo-Werte für verschiedene Laufwerke
        let totalSpace = 0;
        let freeSpace = 0;

        // Realistische Demo-Werte basierend auf Laufwerksbuchstaben
        switch (drive) {
          case 'C:':
            totalSpace = 500000000000;  // 500GB System-SSD
            freeSpace = 150000000000;   // 150GB frei (70% belegt)
            break;
          case 'D:':
            totalSpace = 2000000000000; // 2TB Daten-HDD
            freeSpace = 800000000000;   // 800GB frei (60% belegt)
            break;
          case 'E:':
            totalSpace = 1000000000000; // 1TB externe HDD
            freeSpace = 300000000000;   // 300GB frei (70% belegt)
            break;
          case 'F:':
            totalSpace = 4000000000000; // 4TB Backup-HDD
            freeSpace = 1200000000000;  // 1.2TB frei (70% belegt)
            break;
          default:
            totalSpace = 1000000000000; // 1TB Standard
            freeSpace = 500000000000;   // 500GB frei (50% belegt)
        }

        drives.push({
          letter: drive,
          path: drive + '\\',
          name: `${drive} ${volumeLabel}`,
          label: volumeLabel,
          type: 'drive',
          totalSpace: totalSpace,
          freeSpace: freeSpace
        });
      } catch (e) {
        // Laufwerk nicht verfügbar
      }
    }
    console.log(`💾 Gefundene Laufwerke: ${drives.map(d => d.letter).join(', ')}`);
    return drives;
  } catch (error) {
    console.error('❌ Fehler beim Laden der Laufwerke:', error);
    return [];
  }
});

ipcMain.handle('fs:getDirectoryContents', async (event, dirPath) => {
  try {
    console.log(`📁 Lade Ordnerinhalt: ${dirPath}`);
    const items = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const contents = [];

    for (const item of items) {
      try {
        const fullPath = path.join(dirPath, item.name);
        const stats = await fs.promises.stat(fullPath);

        if (item.isDirectory()) {
          contents.push({
            name: item.name,
            path: fullPath,
            type: 'directory',
            size: 0,
            modified: stats.mtime
          });
        } else if (item.isFile()) {
          const ext = path.extname(item.name).toLowerCase();

          // Bild-Formate
          const imageFormats = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.svg'];
          // Video-Formate
          const videoFormats = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v', '.3gp', '.mpg', '.mpeg'];

          if (imageFormats.includes(ext)) {
            contents.push({
              name: item.name,
              path: fullPath,
              type: 'image',
              size: stats.size,
              modified: stats.mtime,
              extension: ext
            });
          } else if (videoFormats.includes(ext)) {
            contents.push({
              name: item.name,
              path: fullPath,
              type: 'video',
              size: stats.size,
              modified: stats.mtime,
              extension: ext
            });
          }
        }
      } catch (e) {
        // Datei/Ordner nicht zugänglich
      }
    }

    console.log(`📂 ${contents.length} Elemente gefunden in ${dirPath}`);
    return contents.sort((a, b) => {
      // Ordner zuerst, dann Dateien
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  } catch (error) {
    console.error(`❌ Fehler beim Laden von ${dirPath}:`, error);
    return [];
  }
});

// Nur Ordner für Baumstruktur laden
ipcMain.handle('fs:getDirectories', async (event, dirPath) => {
  try {
    console.log(`🌳 Lade Ordner-Struktur: ${dirPath}`);
    const items = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const directories = [];

    for (const item of items) {
      try {
        if (item.isDirectory()) {
          const fullPath = path.join(dirPath, item.name);
          const stats = await fs.promises.stat(fullPath);

          // Prüfe ob Ordner Unterordner hat
          let hasSubdirectories = false;
          try {
            const subItems = await fs.promises.readdir(fullPath, { withFileTypes: true });
            hasSubdirectories = subItems.some(subItem => subItem.isDirectory());
          } catch (e) {
            // Kein Zugriff auf Unterordner
          }

          directories.push({
            name: item.name,
            path: fullPath,
            type: 'directory',
            hasSubdirectories,
            modified: stats.mtime
          });
        }
      } catch (e) {
        // Ordner nicht zugänglich
      }
    }

    console.log(`📁 ${directories.length} Ordner gefunden in ${dirPath}`);
    return directories.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error(`❌ Fehler beim Laden der Ordner von ${dirPath}:`, error);
    return [];
  }
});

// Metadaten IPC Handlers

// Vollständige Metadaten lesen
ipcMain.handle('metadata:read', async (event, filePath) => {
  try {
    console.log(`📊 Lese Metadaten aus: ${filePath}`);

    const ext = path.extname(filePath).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.tiff', '.tif'].includes(ext)) {
      return {
        tags: [],
        rating: 0,
        dateCreated: new Date(),
        cameraInfo: null
      };
    }

    const metadata = await exifr.parse(filePath, {
      iptc: true,
      xmp: true,
      keywords: true,
      exif: true,
      gps: true
    });

    // Tags extrahieren - versuche verschiedene Felder
    let tags = [];
    let rawTags = [];

    // Debug: Zeige alle verfügbaren Metadaten-Felder
    console.log(`🔍 Verfügbare Metadaten-Felder für ${filePath}:`, Object.keys(metadata));

    // Versuche verschiedene Tag-Felder
    const tagFields = [
      'Keywords',           // Standard IPTC Keywords
      'Subject',           // XMP Subject
      'XPKeywords',        // Windows XP Keywords
      'UserComment',       // EXIF User Comment
      'ImageDescription',  // EXIF Image Description
      'XPComment',         // Windows XP Comment
      'XPSubject',         // Windows XP Subject
      'dc:subject',        // Dublin Core Subject
      'lr:hierarchicalSubject' // Lightroom Hierarchical Subject
    ];

    for (const field of tagFields) {
      if (metadata[field]) {
        console.log(`📋 Gefunden in ${field}:`, metadata[field]);

        if (Array.isArray(metadata[field])) {
          rawTags.push(...metadata[field]);
        } else if (typeof metadata[field] === 'string') {
          // Versuche verschiedene Trennzeichen
          const separators = [';', ',', '|', '\n'];
          let splitTags = [metadata[field]];

          for (const sep of separators) {
            if (metadata[field].includes(sep)) {
              splitTags = metadata[field].split(sep).map(t => t.trim()).filter(t => t);
              break;
            }
          }
          rawTags.push(...splitTags);
        }
      }
    }

    // Entferne Duplikate und verwende Tags direkt als Strings
    const uniqueTags = [...new Set(rawTags)];
    tags = uniqueTags; // Einfache String-Tags, keine hierarchische Struktur

    console.log(`🏷️ Extrahierte Tags: ${tags.length}`, tags);

    // Bewertung extrahieren
    let rating = 0;
    if (metadata.Rating) {
      rating = parseInt(metadata.Rating) || 0;
    }

    // Datum extrahieren
    let dateCreated = new Date();
    if (metadata.DateTimeOriginal) {
      dateCreated = new Date(metadata.DateTimeOriginal);
    } else if (metadata.DateTime) {
      dateCreated = new Date(metadata.DateTime);
    }

    // Kamera-Info extrahieren
    let cameraInfo = null;
    if (metadata.Make || metadata.Model) {
      cameraInfo = {
        make: metadata.Make,
        model: metadata.Model,
        lens: metadata.LensModel,
        aperture: metadata.FNumber ? `f/${metadata.FNumber}` : null,
        shutterSpeed: metadata.ExposureTime ? `1/${Math.round(1/metadata.ExposureTime)}s` : null,
        iso: metadata.ISO,
        focalLength: metadata.FocalLength ? `${metadata.FocalLength}mm` : null
      };
    }

    const result = {
      tags,
      rating,
      dateCreated,
      cameraInfo
    };

    console.log(`✅ Metadaten geladen:`, {
      tags: tags.length,
      rating,
      camera: cameraInfo?.make
    });

    return result;
  } catch (error) {
    console.error(`❌ Fehler beim Lesen der Metadaten von ${filePath}:`, error);
    return {
      tags: [],
      rating: 0,
      dateCreated: new Date(),
      cameraInfo: null
    };
  }
});

// Nur Tags lesen (Legacy-Kompatibilität)
ipcMain.handle('metadata:readTags', async (event, filePath) => {
  try {
    console.log(`🏷️ Lese Tags aus: ${filePath}`);

    const ext = path.extname(filePath).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.tiff', '.tif'].includes(ext)) {
      return []; // Nur unterstützte Formate
    }

    const metadata = await exifr.parse(filePath, {
      iptc: true,
      xmp: true,
      keywords: true
    });

    let tags = [];

    // IPTC Keywords
    if (metadata && metadata.Keywords) {
      if (Array.isArray(metadata.Keywords)) {
        tags = [...metadata.Keywords];
      } else {
        tags = [metadata.Keywords];
      }
    }

    // XMP Subject (Fallback)
    if (tags.length === 0 && metadata && metadata.Subject) {
      if (Array.isArray(metadata.Subject)) {
        tags = [...metadata.Subject];
      } else {
        tags = [metadata.Subject];
      }
    }

    console.log(`📋 ${tags.length} Tags gefunden:`, tags);
    return tags;

  } catch (error) {
    console.error(`❌ Fehler beim Lesen der Tags von ${filePath}:`, error);
    return [];
  }
});

ipcMain.handle('metadata:writeTags', async (event, filePath, tags) => {
  try {
    console.log(`💾 Schreibe ${tags.length} Tags in: ${filePath}`);

    const ext = path.extname(filePath).toLowerCase();
    if (!['.jpg', '.jpeg'].includes(ext)) {
      console.log('⚠️ Tag-Schreibung nur für JPEG unterstützt');
      return false;
    }

    // Lese existierende EXIF-Daten
    const imageBuffer = await fs.promises.readFile(filePath);
    const imageDataUrl = 'data:image/jpeg;base64,' + imageBuffer.toString('base64');

    let exifObj = {};
    try {
      exifObj = piexif.load(imageDataUrl);
    } catch (e) {
      // Keine existierenden EXIF-Daten
      exifObj = { '0th': {}, 'Exif': {}, 'GPS': {}, '1st': {}, 'thumbnail': null };
    }

    // Setze IPTC Keywords
    if (!exifObj['0th']) exifObj['0th'] = {};

    // Keywords als String (durch Semikolon getrennt)
    const keywordString = tags.join(';');
    exifObj['0th'][piexif.ImageIFD.XPKeywords] = keywordString;

    // Erstelle neue EXIF-Daten
    const exifBytes = piexif.dump(exifObj);
    const newImageDataUrl = piexif.insert(exifBytes, imageDataUrl);

    // Konvertiere zurück zu Buffer
    const base64Data = newImageDataUrl.replace(/^data:image\/jpeg;base64,/, '');
    const newImageBuffer = Buffer.from(base64Data, 'base64');

    // Erstelle Backup
    const backupPath = filePath + '.backup';
    await fs.promises.copyFile(filePath, backupPath);

    // Schreibe neue Datei
    await fs.promises.writeFile(filePath, newImageBuffer);

    // Lösche Backup nach erfolgreichem Schreiben
    setTimeout(() => {
      fs.promises.unlink(backupPath).catch(() => {});
    }, 1000);

    console.log(`✅ Tags erfolgreich geschrieben in: ${filePath}`);
    return true;

  } catch (error) {
    console.error(`❌ Fehler beim Schreiben der Tags in ${filePath}:`, error);
    return false;
  }
});

// Vollständige Metadaten schreiben
ipcMain.handle('metadata:write', async (event, filePath, metadata) => {
  try {
    console.log(`💾 Schreibe Metadaten in: ${filePath}`);

    const ext = path.extname(filePath).toLowerCase();
    if (!['.jpg', '.jpeg'].includes(ext)) {
      console.log('⚠️ Metadaten-Schreibung nur für JPEG unterstützt');
      return false;
    }

    // Lese existierende EXIF-Daten
    const imageBuffer = await fs.promises.readFile(filePath);
    const imageDataUrl = 'data:image/jpeg;base64,' + imageBuffer.toString('base64');

    let exifObj = {};
    try {
      exifObj = piexif.load(imageDataUrl);
    } catch (e) {
      exifObj = { '0th': {}, 'Exif': {}, 'GPS': {}, '1st': {}, 'thumbnail': null };
    }

    if (!exifObj['0th']) exifObj['0th'] = {};
    if (!exifObj['Exif']) exifObj['Exif'] = {};

    // Schreibe Tags
    if (metadata.tags && Array.isArray(metadata.tags)) {
      const tagStrings = metadata.tags.map(tag =>
        typeof tag === 'string' ? tag : (tag.fullPath || tag.tag || tag)
      );
      const keywordString = tagStrings.join(';');
      exifObj['0th'][piexif.ImageIFD.XPKeywords] = keywordString;
    }

    // Schreibe Bewertung
    if (metadata.rating !== undefined) {
      exifObj['0th'][piexif.ImageIFD.Rating] = metadata.rating;
    }

    // Erstelle neue EXIF-Daten
    const exifBytes = piexif.dump(exifObj);
    const newImageDataUrl = piexif.insert(exifBytes, imageDataUrl);

    // Konvertiere zurück zu Buffer
    const base64Data = newImageDataUrl.replace(/^data:image\/jpeg;base64,/, '');
    const newImageBuffer = Buffer.from(base64Data, 'base64');

    // Erstelle Backup
    const backupPath = filePath + '.backup';
    await fs.promises.copyFile(filePath, backupPath);

    // Schreibe neue Datei
    await fs.promises.writeFile(filePath, newImageBuffer);

    // Lösche Backup nach erfolgreichem Schreiben
    setTimeout(() => {
      fs.promises.unlink(backupPath).catch(() => {});
    }, 1000);

    console.log(`✅ Metadaten erfolgreich geschrieben in: ${filePath}`);
    return true;

  } catch (error) {
    console.error(`❌ Fehler beim Schreiben der Metadaten in ${filePath}:`, error);
    return false;
  }
});

// Nur Bewertung schreiben
ipcMain.handle('metadata:writeRating', async (event, filePath, rating) => {
  try {
    console.log(`⭐ Schreibe Bewertung ${rating} in: ${filePath}`);

    const metadata = { rating };
    return await ipcMain.handle('metadata:write', event, filePath, metadata);
  } catch (error) {
    console.error(`❌ Fehler beim Schreiben der Bewertung in ${filePath}:`, error);
    return false;
  }
});

// Bewertung lesen
ipcMain.handle('metadata:readRating', async (event, filePath) => {
  try {
    const metadata = await ipcMain.handle('metadata:read', event, filePath);
    return metadata.rating || 0;
  } catch (error) {
    console.error(`❌ Fehler beim Lesen der Bewertung von ${filePath}:`, error);
    return 0;
  }
});

// ===== PORTABLE DATA HANDLERS =====

// Get app directory (where EXE is located)
ipcMain.handle('data:getAppDir', async () => {
  try {
    const appPath = app.getAppPath();
    const appDir = app.isPackaged ? path.dirname(process.execPath) : appPath;
    console.log(`📁 App-Verzeichnis: ${appDir}`);
    return appDir;
  } catch (error) {
    console.error('❌ Fehler beim Ermitteln des App-Verzeichnisses:', error);
    return process.cwd();
  }
});

// Read JSON file from data directory
ipcMain.handle('data:readJSON', async (event, filename) => {
  try {
    const appDir = app.isPackaged ? path.dirname(process.execPath) : app.getAppPath();
    const dataDir = path.join(appDir, 'data');
    const filePath = path.join(dataDir, filename);

    console.log(`📖 Lese JSON: ${filePath}`);

    if (!await fs.promises.access(filePath).then(() => true).catch(() => false)) {
      console.log(`ℹ️ Datei existiert nicht: ${filename}`);
      return null;
    }

    const data = await fs.promises.readFile(filePath, 'utf8');
    const parsed = JSON.parse(data);
    console.log(`✅ JSON gelesen: ${filename} (${Object.keys(parsed).length} Einträge)`);
    return parsed;

  } catch (error) {
    console.error(`❌ Fehler beim Lesen von ${filename}:`, error);
    return null;
  }
});

// Write JSON file to data directory
ipcMain.handle('data:writeJSON', async (event, filename, data) => {
  try {
    const appDir = app.isPackaged ? path.dirname(process.execPath) : app.getAppPath();
    const dataDir = path.join(appDir, 'data');
    const filePath = path.join(dataDir, filename);

    // Erstelle data-Verzeichnis falls es nicht existiert
    await fs.promises.mkdir(dataDir, { recursive: true });

    const jsonString = JSON.stringify(data, null, 2);
    await fs.promises.writeFile(filePath, jsonString, 'utf8');

    console.log(`💾 JSON gespeichert: ${filename} (${jsonString.length} Zeichen)`);
    return true;

  } catch (error) {
    console.error(`❌ Fehler beim Schreiben von ${filename}:`, error);
    return false;
  }
});

// Check if file exists
ipcMain.handle('data:exists', async (event, filename) => {
  try {
    const appDir = app.isPackaged ? path.dirname(process.execPath) : app.getAppPath();
    const dataDir = path.join(appDir, 'data');
    const filePath = path.join(dataDir, filename);

    const exists = await fs.promises.access(filePath).then(() => true).catch(() => false);
    console.log(`🔍 Datei ${filename} existiert: ${exists}`);
    return exists;

  } catch (error) {
    console.error(`❌ Fehler beim Prüfen von ${filename}:`, error);
    return false;
  }
});

// ===== IMPORT/EXPORT HANDLERS =====

// Show save dialog
ipcMain.handle('dialog:showSave', async (event, options) => {
  try {
    const result = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow(), {
      title: options.title || 'Exportieren',
      defaultPath: options.defaultPath || 'export.json',
      filters: options.filters || [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    console.log(`💾 Save Dialog: ${result.canceled ? 'Abgebrochen' : result.filePath}`);
    return result;
  } catch (error) {
    console.error('❌ Fehler beim Öffnen des Save-Dialogs:', error);
    return { canceled: true };
  }
});

// Show open dialog
ipcMain.handle('dialog:showOpen', async (event, options) => {
  try {
    const result = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow(), {
      title: options.title || 'Importieren',
      filters: options.filters || [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    console.log(`📂 Open Dialog: ${result.canceled ? 'Abgebrochen' : result.filePaths[0]}`);
    return result;
  } catch (error) {
    console.error('❌ Fehler beim Öffnen des Open-Dialogs:', error);
    return { canceled: true };
  }
});

// Export file
ipcMain.handle('export:file', async (event, filePath, data) => {
  try {
    const jsonString = JSON.stringify(data, null, 2);
    await fs.promises.writeFile(filePath, jsonString, 'utf8');

    console.log(`📤 Datei exportiert: ${filePath} (${jsonString.length} Zeichen)`);
    return { success: true, filePath };
  } catch (error) {
    console.error(`❌ Fehler beim Exportieren nach ${filePath}:`, error);
    return { success: false, error: error.message };
  }
});

// Import file
ipcMain.handle('import:file', async (event, filePath) => {
  try {
    const fileContent = await fs.promises.readFile(filePath, 'utf8');
    const data = JSON.parse(fileContent);

    console.log(`📥 Datei importiert: ${filePath} (${fileContent.length} Zeichen)`);
    return { success: true, data };
  } catch (error) {
    console.error(`❌ Fehler beim Importieren von ${filePath}:`, error);
    return { success: false, error: error.message };
  }
});

app.whenReady().then(() => {
  console.log('⚡ Electron bereit!');
  createWindow();
});

app.on('window-all-closed', () => {
  console.log('🔚 Alle Fenster geschlossen');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

console.log('📋 main.js geladen!');
