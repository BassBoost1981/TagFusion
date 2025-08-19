import { BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { isDev } from '../utils/environment';
import { MediaFile } from '../../types/global';

export interface FullscreenViewerState {
  currentFile: MediaFile;
  fileList: MediaFile[];
  currentIndex: number;
  zoomLevel: number;
  panOffset: { x: number; y: number };
  slideshowActive: boolean;
  slideshowInterval: number; // seconds
  showInfo: boolean;
}

export class FullscreenViewerService {
  private viewerWindow: BrowserWindow | null = null;
  private currentState: FullscreenViewerState | null = null;
  private slideshowTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.setupIpcHandlers();
  }

  private setupIpcHandlers(): void {
    // Open fullscreen viewer
    ipcMain.handle('viewer:open', async (_, file: MediaFile, fileList: MediaFile[]) => {
      return this.openViewer(file, fileList);
    });

    // Navigation
    ipcMain.handle('viewer:next', async () => {
      return this.nextImage();
    });

    ipcMain.handle('viewer:previous', async () => {
      return this.previousImage();
    });

    ipcMain.handle('viewer:goToIndex', async (_, index: number) => {
      return this.goToIndex(index);
    });

    // Zoom and Pan
    ipcMain.handle('viewer:setZoom', async (_, zoomLevel: number) => {
      return this.setZoom(zoomLevel);
    });

    ipcMain.handle('viewer:setPan', async (_, panOffset: { x: number; y: number }) => {
      return this.setPan(panOffset);
    });

    ipcMain.handle('viewer:resetView', async () => {
      return this.resetView();
    });

    // Slideshow
    ipcMain.handle('viewer:startSlideshow', async (_, interval?: number) => {
      return this.startSlideshow(interval);
    });

    ipcMain.handle('viewer:stopSlideshow', async () => {
      return this.stopSlideshow();
    });

    ipcMain.handle('viewer:setSlideshowInterval', async (_, interval: number) => {
      return this.setSlideshowInterval(interval);
    });

    // Info overlay
    ipcMain.handle('viewer:toggleInfo', async () => {
      return this.toggleInfo();
    });

    ipcMain.handle('viewer:setShowInfo', async (_, show: boolean) => {
      return this.setShowInfo(show);
    });

    // Get current state
    ipcMain.handle('viewer:getState', async () => {
      return this.currentState;
    });

    // Close viewer
    ipcMain.handle('viewer:close', async () => {
      return this.closeViewer();
    });
  }

  public async openViewer(file: MediaFile, fileList: MediaFile[]): Promise<boolean> {
    try {
      // Close existing viewer if open
      if (this.viewerWindow) {
        this.closeViewer();
      }

      // Find current file index in the list
      const currentIndex = fileList.findIndex(f => f.path === file.path);
      if (currentIndex === -1) {
        throw new Error('File not found in file list');
      }

      // Initialize state
      this.currentState = {
        currentFile: file,
        fileList,
        currentIndex,
        zoomLevel: 1,
        panOffset: { x: 0, y: 0 },
        slideshowActive: false,
        slideshowInterval: 3, // 3 seconds default
        showInfo: false,
      };

      // Create fullscreen window
      this.viewerWindow = new BrowserWindow({
        fullscreen: true,
        frame: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          enableRemoteModule: false,
          preload: join(__dirname, 'preload.js'),
        },
        show: false,
        backgroundColor: '#000000',
      });

      // Load the viewer page
      if (isDev) {
        await this.viewerWindow.loadURL('http://localhost:3000/viewer');
      } else {
        await this.viewerWindow.loadFile(join(__dirname, '../renderer/viewer.html'));
      }

      // Show window when ready
      this.viewerWindow.once('ready-to-show', () => {
        this.viewerWindow?.show();
        this.viewerWindow?.focus();
      });

      // Handle window closed
      this.viewerWindow.on('closed', () => {
        this.cleanup();
      });

      return true;
    } catch (error) {
      console.error('Error opening fullscreen viewer:', error);
      return false;
    }
  }

  public nextImage(): boolean {
    if (!this.currentState || this.currentState.fileList.length === 0) {
      return false;
    }

    const nextIndex = (this.currentState.currentIndex + 1) % this.currentState.fileList.length;
    return this.goToIndex(nextIndex);
  }

  public previousImage(): boolean {
    if (!this.currentState || this.currentState.fileList.length === 0) {
      return false;
    }

    const prevIndex = this.currentState.currentIndex === 0 
      ? this.currentState.fileList.length - 1 
      : this.currentState.currentIndex - 1;
    return this.goToIndex(prevIndex);
  }

  public goToIndex(index: number): boolean {
    if (!this.currentState || !this.viewerWindow) {
      return false;
    }

    if (index < 0 || index >= this.currentState.fileList.length) {
      return false;
    }

    this.currentState.currentIndex = index;
    this.currentState.currentFile = this.currentState.fileList[index];

    // Reset zoom and pan when changing images
    this.currentState.zoomLevel = 1;
    this.currentState.panOffset = { x: 0, y: 0 };

    // Notify renderer of state change
    this.viewerWindow.webContents.send('viewer:stateChanged', this.currentState);

    return true;
  }

  public setZoom(zoomLevel: number): boolean {
    if (!this.currentState || !this.viewerWindow) {
      return false;
    }

    // Clamp zoom level between 0.1 and 10
    this.currentState.zoomLevel = Math.max(0.1, Math.min(10, zoomLevel));

    // Notify renderer of state change
    this.viewerWindow.webContents.send('viewer:stateChanged', this.currentState);

    return true;
  }

  public setPan(panOffset: { x: number; y: number }): boolean {
    if (!this.currentState || !this.viewerWindow) {
      return false;
    }

    this.currentState.panOffset = panOffset;

    // Notify renderer of state change
    this.viewerWindow.webContents.send('viewer:stateChanged', this.currentState);

    return true;
  }

  public resetView(): boolean {
    if (!this.currentState || !this.viewerWindow) {
      return false;
    }

    this.currentState.zoomLevel = 1;
    this.currentState.panOffset = { x: 0, y: 0 };

    // Notify renderer of state change
    this.viewerWindow.webContents.send('viewer:stateChanged', this.currentState);

    return true;
  }

  public startSlideshow(interval?: number): boolean {
    if (!this.currentState || !this.viewerWindow) {
      return false;
    }

    if (interval) {
      this.currentState.slideshowInterval = Math.max(1, interval);
    }

    this.currentState.slideshowActive = true;

    // Start slideshow timer
    this.slideshowTimer = setInterval(() => {
      this.nextImage();
    }, this.currentState.slideshowInterval * 1000);

    // Notify renderer of state change
    this.viewerWindow.webContents.send('viewer:stateChanged', this.currentState);

    return true;
  }

  public stopSlideshow(): boolean {
    if (!this.currentState || !this.viewerWindow) {
      return false;
    }

    this.currentState.slideshowActive = false;

    if (this.slideshowTimer) {
      clearInterval(this.slideshowTimer);
      this.slideshowTimer = null;
    }

    // Notify renderer of state change
    this.viewerWindow.webContents.send('viewer:stateChanged', this.currentState);

    return true;
  }

  public setSlideshowInterval(interval: number): boolean {
    if (!this.currentState) {
      return false;
    }

    this.currentState.slideshowInterval = Math.max(1, interval);

    // If slideshow is active, restart with new interval
    if (this.currentState.slideshowActive) {
      this.stopSlideshow();
      this.startSlideshow();
    }

    return true;
  }

  public toggleInfo(): boolean {
    if (!this.currentState || !this.viewerWindow) {
      return false;
    }

    this.currentState.showInfo = !this.currentState.showInfo;

    // Notify renderer of state change
    this.viewerWindow.webContents.send('viewer:stateChanged', this.currentState);

    return true;
  }

  public setShowInfo(show: boolean): boolean {
    if (!this.currentState || !this.viewerWindow) {
      return false;
    }

    this.currentState.showInfo = show;

    // Notify renderer of state change
    this.viewerWindow.webContents.send('viewer:stateChanged', this.currentState);

    return true;
  }

  public closeViewer(): boolean {
    if (this.viewerWindow) {
      this.viewerWindow.close();
      // Immediately cleanup since we're explicitly closing
      this.cleanup();
      return true;
    }
    return false;
  }

  private cleanup(): void {
    if (this.slideshowTimer) {
      clearInterval(this.slideshowTimer);
      this.slideshowTimer = null;
    }

    this.viewerWindow = null;
    this.currentState = null;
  }

  public isOpen(): boolean {
    return this.viewerWindow !== null && !this.viewerWindow.isDestroyed();
  }

  public getCurrentState(): FullscreenViewerState | null {
    return this.currentState;
  }
}