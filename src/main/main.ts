import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { isDev } from './utils/environment';

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null;

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
      preload: join(__dirname, 'preload.js'),
    },
    show: false,
    titleBarStyle: 'default',
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
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
app.on('window-all-closed', () => {
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

// Import repositories and services
import { FileSystemRepository } from './repositories/FileSystemRepository';
import { MetadataRepository } from './repositories/MetadataRepository';
import { ThumbnailManagerService } from './services/ThumbnailManagerService';
import { ImageEditorService } from './services/ImageEditorService';
import { FullscreenViewerService } from './services/FullscreenViewerService';
import { VideoHandlers } from './ipc/videoHandlers';
import { exportHandlers } from './ipc/exportHandlers';
import { PortableDataService } from './services/PortableDataService';
import { ConfigurationRepository } from './repositories/ConfigurationRepository';

// Initialize portable data service first
const portableDataService = new PortableDataService();

// Initialize repositories and services with portable data service
const fileSystemRepository = new FileSystemRepository();
const metadataRepository = new MetadataRepository();
const thumbnailManagerService = new ThumbnailManagerService();
const configurationRepository = new ConfigurationRepository(portableDataService);
const imageEditorService = new ImageEditorService();
const fullscreenViewerService = new FullscreenViewerService();
const videoHandlers = new VideoHandlers();

// IPC handlers
ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

// File System handlers
ipcMain.handle('fs:getDrives', async () => {
  try {
    return await fileSystemRepository.getDrives();
  } catch (error) {
    console.error('Error getting drives:', error instanceof Error ? error.message : String(error));
    return [];
  }
});

ipcMain.handle('fs:getDirectoryContents', async (_, path: string) => {
  try {
    return await fileSystemRepository.getDirectoryContents(path);
  } catch (error) {
    console.error('Error getting directory contents:', error);
    return { folders: [], mediaFiles: [], path };
  }
});

ipcMain.handle('fs:getDirectoryTree', async (_, path: string, maxDepth?: number) => {
  try {
    return await fileSystemRepository.getDirectoryTree(path, maxDepth);
  } catch (error) {
    console.error('Error getting directory tree:', error);
    return [];
  }
});

ipcMain.handle('fs:copyFile', async (_, source: string, destination: string) => {
  try {
    await fileSystemRepository.copyFile(source, destination);
    return { success: true };
  } catch (error) {
    console.error('Error copying file:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs:moveFile', async (_, source: string, destination: string) => {
  try {
    await fileSystemRepository.moveFile(source, destination);
    return { success: true };
  } catch (error) {
    console.error('Error moving file:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs:deleteFile', async (_, filePath: string) => {
  try {
    await fileSystemRepository.deleteFile(filePath);
    return { success: true };
  } catch (error) {
    console.error('Error deleting file:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs:createDirectory', async (_, path: string) => {
  try {
    await fileSystemRepository.createDirectory(path);
    return { success: true };
  } catch (error) {
    console.error('Error creating directory:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs:deleteDirectory', async (_, path: string) => {
  try {
    await fileSystemRepository.deleteDirectory(path);
    return { success: true };
  } catch (error) {
    console.error('Error deleting directory:', error);
    return { success: false, error: error.message };
  }
});

// Metadata handlers
ipcMain.handle('metadata:read', async (_, filePath: string) => {
  try {
    return await metadataRepository.readMetadata(filePath);
  } catch (error) {
    console.error('Error reading metadata:', error);
    return null;
  }
});

ipcMain.handle('metadata:write', async (_, filePath: string, metadata: any) => {
  try {
    await metadataRepository.writeMetadata(filePath, metadata);
    return { success: true };
  } catch (error) {
    console.error('Error writing metadata:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('metadata:readExif', async (_, filePath: string) => {
  try {
    return await metadataRepository.readExifData(filePath);
  } catch (error) {
    console.error('Error reading EXIF data:', error);
    return null;
  }
});

// Thumbnail handlers
ipcMain.handle('image:generateThumbnail', async (_, filePath: string, size: number) => {
  try {
    return await thumbnailManagerService.getThumbnail(filePath, { width: size, height: size });
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    return '';
  }
});

ipcMain.handle('config:load', async () => {
  try {
    return await configurationRepository.loadSettings();
  } catch (error) {
    console.error('Error loading configuration:', error);
    return {
      language: 'en',
      theme: 'system',
      favorites: [],
      tagHierarchy: [],
      thumbnailSize: 150,
      viewMode: 'grid',
    };
  }
});

ipcMain.handle('config:save', async (_, settings: any) => {
  try {
    await configurationRepository.saveSettings(settings);
    return { success: true };
  } catch (error) {
    console.error('Error saving configuration:', error);
    return { success: false, error: error.message };
  }
});

// Portable data service handlers
ipcMain.handle('portable:getStorageStats', async () => {
  return portableDataService.getStorageStats();
});

ipcMain.handle('portable:isPortableMode', async () => {
  return portableDataService.isPortableMode();
});

ipcMain.handle('portable:clearCache', async () => {
  try {
    portableDataService.clearCacheData();
    return { success: true };
  } catch (error) {
    console.error('Error clearing cache:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('portable:clearTemp', async () => {
  try {
    portableDataService.clearTempData();
    return { success: true };
  } catch (error) {
    console.error('Error clearing temp data:', error);
    return { success: false, error: error.message };
  }
});

// Tag system handlers
ipcMain.handle('tags:getHierarchy', async () => {
  try {
    return await metadataRepository.getTagHierarchy();
  } catch (error) {
    console.error('Error getting tag hierarchy:', error);
    return [];
  }
});

ipcMain.handle('tags:createTag', async (_, parentId: string | null, name: string) => {
  try {
    return await metadataRepository.createTag(parentId, name);
  } catch (error) {
    console.error('Error creating tag:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('tags:updateTag', async (_, tagId: string, name: string) => {
  try {
    await metadataRepository.updateTag(tagId, name);
    return { success: true };
  } catch (error) {
    console.error('Error updating tag:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('tags:deleteTag', async (_, tagId: string) => {
  try {
    await metadataRepository.deleteTag(tagId);
    return { success: true };
  } catch (error) {
    console.error('Error deleting tag:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('tags:assignToFiles', async (_, filePaths: string[], tagIds: string[]) => {
  try {
    await metadataRepository.assignTagsToFiles(filePaths, tagIds);
    return { success: true };
  } catch (error) {
    console.error('Error assigning tags to files:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('tags:removeFromFiles', async (_, filePaths: string[], tagIds: string[]) => {
  try {
    await metadataRepository.removeTagsFromFiles(filePaths, tagIds);
    return { success: true };
  } catch (error) {
    console.error('Error removing tags from files:', error);
    return { success: false, error: error.message };
  }
});

// Rating handlers
ipcMain.handle('rating:setRating', async (_, filePath: string, rating: number) => {
  try {
    await metadataRepository.setFileRating(filePath, rating);
    return { success: true };
  } catch (error) {
    console.error('Error setting rating:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('rating:getRating', async (_, filePath: string) => {
  try {
    return await metadataRepository.getFileRating(filePath);
  } catch (error) {
    console.error('Error getting rating:', error);
    return 0;
  }
});

ipcMain.handle('rating:setBatchRating', async (_, filePaths: string[], rating: number) => {
  try {
    await metadataRepository.setBatchRating(filePaths, rating);
    return { success: true };
  } catch (error) {
    console.error('Error setting batch rating:', error);
    return { success: false, error: error.message };
  }
});

export { mainWindow };