import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { FileSystemService } from './services/FileSystemService';
import { ThumbnailService } from './services/ThumbnailService';

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

const createWindow = (): void => {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload-simple.js'),
      webSecurity: false, // Temporarily disable for debugging
    },
    show: false,
    titleBarStyle: 'default',
  });

  // Add comprehensive error handling
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('❌ Failed to load:', errorCode, errorDescription, validatedURL);
  });

  mainWindow.webContents.on('crashed', (event, killed) => {
    console.error('❌ Renderer crashed:', killed);
  });

  mainWindow.webContents.on('unresponsive', () => {
    console.error('❌ Renderer became unresponsive');
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('✅ Page finished loading');
  });

  mainWindow.webContents.on('dom-ready', () => {
    console.log('✅ DOM ready');
  });

  // Listen for console messages from renderer
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`🖥️ Renderer [${level}]:`, message);
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    const htmlPath = join(__dirname, '../renderer/index.html');
    console.log('🔍 Loading HTML from:', htmlPath);
    console.log('📁 HTML file exists:', require('fs').existsSync(htmlPath));

    // Try to load the main React app
    mainWindow.loadFile(htmlPath).then(() => {
      console.log('✅ HTML file loaded successfully');

      // Wait a bit and check if React loaded
      setTimeout(() => {
        mainWindow?.webContents.executeJavaScript(`
          // Check if React app loaded
          const root = document.getElementById('root');
          const hasContent = root && root.children.length > 0;

          if (!hasContent) {
            // React didn't load, show error info
            document.body.innerHTML = \`
              <div style="font-family: Arial; padding: 20px; background: #f8f9fa;">
                <h1>🔧 TagFusion Debug</h1>
                <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 10px 0;">
                  <h3>⚠️ React App konnte nicht geladen werden</h3>
                  <p><strong>HTML geladen:</strong> ✅ Erfolgreich</p>
                  <p><strong>React Mount:</strong> ❌ Fehlgeschlagen</p>
                  <p><strong>Root Element:</strong> \${root ? '✅ Gefunden' : '❌ Nicht gefunden'}</p>
                </div>
                <div style="background: #d1ecf1; padding: 15px; border-radius: 5px; margin: 10px 0;">
                  <h4>🔍 Debugging Info:</h4>
                  <p><strong>User Agent:</strong> \${navigator.userAgent}</p>
                  <p><strong>Location:</strong> \${window.location.href}</p>
                  <p><strong>Scripts:</strong> \${document.scripts.length}</p>
                  <p><strong>Stylesheets:</strong> \${document.styleSheets.length}</p>
                </div>
                <button onclick="window.electronAPI?.fileSystem?.getDrives().then(d => alert('Laufwerke: ' + d.length))"
                        style="background: #28a745; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
                  Test Electron API
                </button>
              </div>
            \`;
          }

          return hasContent;
        `).then((hasContent) => {
          console.log('🎯 React app loaded:', hasContent);
        }).catch((error) => {
          console.error('❌ Error checking React app:', error);
        });
      }, 2000);

    }).catch((error) => {
      console.error('❌ Failed to load HTML file:', error);

      // Fallback to a simple working page
      const fallbackHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>TagFusion Fallback</title>
          <style>
            body { font-family: Arial; padding: 20px; background: #f0f0f0; }
            .container { max-width: 800px; margin: 0 auto; text-align: center; }
            .error { background: #f8d7da; padding: 20px; border-radius: 10px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🎯 TagFusion Fallback</h1>
            <div class="error">
              <h2>❌ HTML-Datei konnte nicht geladen werden</h2>
              <p>Pfad: ${htmlPath}</p>
              <p>Fehler: ${error.message}</p>
            </div>
          </div>
        </body>
        </html>
      `;
      mainWindow?.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fallbackHTML)}`);
    });
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// This method will be called when Electron has finished initialization
app.whenReady().then(createWindow);

// Quit when all windows are closed
app.on('window-all-closed', async () => {
  // Cleanup services
  await thumbnailService.shutdown();
  
  // On macOS it is common for applications to stay active until explicitly quit
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS re-create a window when the dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (_, contents) => {
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
});

// Initialize services
const fileSystemService = new FileSystemService();
const thumbnailService = new ThumbnailService();

// Basic IPC handlers for testing
ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

// Real file system handlers
ipcMain.handle('fs:getDrives', async () => {
  try {
    const drives = await fileSystemService.getDrives();
    console.log('Found drives:', drives.map(d => `${d.name} (${d.path})`));
    return drives;
  } catch (error) {
    console.error('Error getting drives:', error instanceof Error ? error.message : String(error));
    return [];
  }
});

ipcMain.handle('fs:getDirectoryContents', async (_, dirPath: string) => {
  try {
    console.log('📁 Reading directory:', dirPath);
    const contents = await fileSystemService.getDirectoryContents(dirPath);
    console.log(`📊 Found ${contents.folders.length} folders and ${contents.files.length} files in ${dirPath}`);
    
    // Log first few files for debugging
    if (contents.files.length > 0) {
      console.log('📄 Sample files:', contents.files.slice(0, 3).map(f => f.name));
    }
    
    return contents;
  } catch (error) {
    console.error('❌ Error getting directory contents:', error instanceof Error ? error.message : String(error));
    return { folders: [], files: [], path: dirPath };
  }
});

// Favorites handlers
ipcMain.handle('favorites:getFavorites', async () => {
  return [
    { id: '1', name: 'Pictures', path: 'C:\\Users\\User\\Pictures\\', dateAdded: new Date(), order: 0 },
    { id: '2', name: 'Documents', path: 'C:\\Users\\User\\Documents\\', dateAdded: new Date(), order: 1 },
  ];
});

ipcMain.handle('favorites:addFavorite', async (_, name: string, path: string) => {
  console.log('Add favorite:', { name, path });
  return { success: true };
});

ipcMain.handle('favorites:removeFavorite', async (_, id: string) => {
  console.log('Remove favorite:', id);
  return { success: true };
});

ipcMain.handle('favorites:updateFavorite', async (_, id: string, updates: any) => {
  console.log('Update favorite:', { id, updates });
  return { success: true };
});

ipcMain.handle('favorites:reorderFavorites', async (_, favoriteIds: string[]) => {
  console.log('Reorder favorites:', favoriteIds);
  return { success: true };
});

// Metadata handlers
ipcMain.handle('metadata:read', async (_, filePath: string) => {
  console.log('📋 Reading metadata for:', filePath);
  
  try {
    const stats = await fs.promises.stat(filePath);
    const fileName = path.basename(filePath);
    const extension = path.extname(filePath).toLowerCase();
    
    // Basic file information
    const metadata: any = {
      fileName,
      fileSize: stats.size,
      dateCreated: stats.birthtime,
      dateModified: stats.mtime,
      format: extension.substring(1).toUpperCase(),
      tags: [],
      rating: 0,
    };

    // For images, try to get dimensions using Sharp
    if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'].includes(extension)) {
      try {
        const imageInfo = await sharp(filePath).metadata();
        metadata.dimensions = {
          width: imageInfo.width || 0,
          height: imageInfo.height || 0
        };
        
        // Mock some camera info for demonstration
        metadata.cameraInfo = {
          make: 'Unknown',
          model: 'Unknown',
          aperture: 'f/2.8',
          shutterSpeed: '1/125s',
          iso: 400,
          focalLength: '50mm',
          flash: false,
        };
      } catch (error) {
        console.warn('Could not read image metadata:', error);
      }
    }

    console.log('✅ Metadata read successfully:', metadata);
    return metadata;
  } catch (error) {
    console.error('❌ Error reading metadata:', error);
    return {
      fileName: path.basename(filePath),
      fileSize: 0,
      dateCreated: new Date(),
      dateModified: new Date(),
      format: 'Unknown',
      tags: [],
      rating: 0,
    };
  }
});

ipcMain.handle('metadata:write', async (_, filePath: string, metadata: any) => {
  console.log('Write metadata to', filePath, metadata);
});

ipcMain.handle('metadata:writeRating', async (_, filePath: string, rating: number) => {
  console.log('Write rating to', filePath, rating);
  return { success: true };
});

ipcMain.handle('metadata:writeTags', async (_, filePath: string, tags: any[]) => {
  console.log('Write tags to', filePath, tags);
  return { success: true };
});

// Rating handlers
ipcMain.handle('rating:get', async (_, filePath: string) => {
  console.log('Get rating for', filePath);
  // Mock rating - in real implementation, this would read from EXIF/XMP
  return Math.floor(Math.random() * 5) + 1; // Random rating 1-5
});

ipcMain.handle('rating:set', async (_, filePath: string, rating: number) => {
  console.log('Set rating for', filePath, 'to', rating);
  return { success: true };
});

ipcMain.handle('rating:setBatch', async (_, filePaths: string[], rating: number) => {
  console.log('Set batch rating for', filePaths.length, 'files to', rating);
  return { success: true };
});

ipcMain.handle('rating:getAverage', async (_, filePaths: string[]) => {
  console.log('Get average rating for', filePaths.length, 'files');
  // Mock average rating
  return Math.floor(Math.random() * 5) + 1;
});

// Viewer handlers
ipcMain.handle('viewer:openFullscreen', async (_, filePath: string, fileList?: string[]) => {
  console.log('🖼️ Opening fullscreen viewer for:', filePath);
  try {
    // In a real implementation, this would open a new fullscreen window
    // For now, we'll just log and return success
    console.log('📁 File list:', fileList?.length || 0, 'files');
    return { success: true };
  } catch (error) {
    console.error('❌ Error opening fullscreen viewer:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('viewer:close', async () => {
  console.log('🚪 Closing fullscreen viewer');
  return { success: true };
});

// Editor handlers
ipcMain.handle('editor:openImage', async (_, filePath: string) => {
  console.log('✏️ Opening image editor for:', filePath);
  try {
    // In a real implementation, this would open the image editor window
    console.log('🖼️ Editor would open for:', filePath);
    return { success: true };
  } catch (error) {
    console.error('❌ Error opening image editor:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// Thumbnail handlers
ipcMain.handle('image:generateThumbnail', async (_, filePath: string, size: number) => {
  console.log('🖼️ Thumbnail request:', filePath, 'size:', size);
  try {
    const result = await thumbnailService.generateThumbnail(filePath, size);
    console.log('✅ Thumbnail generated successfully for:', filePath);
    return result;
  } catch (error) {
    console.error('❌ Error generating thumbnail:', error instanceof Error ? error.message : String(error));
    const fallback = thumbnailService.generatePlaceholderThumbnail(filePath, size, 'image');
    console.log('🔄 Using fallback thumbnail for:', filePath);
    return fallback;
  }
});

export { mainWindow };