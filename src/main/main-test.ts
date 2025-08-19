import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import * as fs from 'fs';
import * as path from 'path';
import { FileSystemService } from './services/FileSystemService';

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

const createWindow = (): void => {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload-simple.js'),
      webSecurity: false, // Disable for testing
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
    console.log('✅ Page loaded successfully');
  });

  // Load the test app
  if (isDev) {
    // In development, load from file system
    const testPath = join(__dirname, '../renderer/test.html');
    console.log('🔧 DEV: Loading test HTML from:', testPath);
    mainWindow.loadFile(testPath);
  } else {
    // In production, load the test file
    const testPath = join(__dirname, '../renderer/test.html');
    console.log('📦 PROD: Loading test HTML from:', testPath);
    console.log('📁 Test file exists:', fs.existsSync(testPath));
    
    if (fs.existsSync(testPath)) {
      mainWindow.loadFile(testPath);
    } else {
      // Fallback: create a simple HTML string
      const fallbackHTML = `
        <!DOCTYPE html>
        <html>
        <head><title>TagFusion Fallback</title></head>
        <body style="font-family: Arial; padding: 20px; background: #f0f0f0;">
          <h1>🔧 TagFusion Fallback Mode</h1>
          <p>Test HTML file not found at: ${testPath}</p>
          <p>But the EXE is working!</p>
          <button onclick="alert('JavaScript works!')">Test JS</button>
        </body>
        </html>
      `;
      mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fallbackHTML)}`);
    }
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    console.log('🎯 Window ready to show');
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  console.log('🚀 Electron app ready');
  createWindow();
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
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

// Basic IPC handlers for testing
ipcMain.handle('app:getVersion', () => {
  console.log('📋 Getting app version');
  return app.getVersion();
});

// File system handlers
ipcMain.handle('fs:getDrives', async () => {
  try {
    console.log('📁 Getting drives');
    const drives = await fileSystemService.getDrives();
    console.log('✅ Found drives:', drives.map(d => `${d.name} (${d.path})`));
    return drives;
  } catch (error) {
    console.error('❌ Error getting drives:', error instanceof Error ? error.message : String(error));
    return [];
  }
});

ipcMain.handle('fs:getDirectoryContents', async (_, dirPath: string) => {
  try {
    console.log('📁 Reading directory:', dirPath);
    const contents = await fileSystemService.getDirectoryContents(dirPath);
    console.log(`✅ Found ${contents.folders.length} folders and ${contents.files.length} files in ${dirPath}`);
    return contents;
  } catch (error) {
    console.error('❌ Error getting directory contents:', error instanceof Error ? error.message : String(error));
    return { folders: [], files: [], path: dirPath };
  }
});

export { mainWindow };
