import { BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { isDev } from '../utils/environment';
import { MediaFile, ImageOperation } from '../../types/global';
import { ImageProcessingService } from './ImageProcessingService';

export class ImageEditorService {
  private editorWindows: Map<string, BrowserWindow> = new Map();
  private imageProcessingService: ImageProcessingService;

  constructor() {
    this.imageProcessingService = new ImageProcessingService();
    this.setupIpcHandlers();
  }

  private setupIpcHandlers(): void {
    ipcMain.handle('editor:open', async (_, file: MediaFile) => {
      return this.openEditor(file);
    });

    ipcMain.handle('editor:close', async (_, filePath: string) => {
      return this.closeEditor(filePath);
    });

    ipcMain.handle('editor:save', async (_, filePath: string, operations: ImageOperation[]) => {
      return this.saveEditedImage(filePath, operations);
    });

    ipcMain.handle('editor:getWindowId', async (_, filePath: string) => {
      const window = this.editorWindows.get(filePath);
      return window ? window.id : null;
    });

    ipcMain.handle('editor:saveCanvas', async (_, canvasDataUrl: string, outputPath: string, quality?: number) => {
      return this.saveCanvasToFile(canvasDataUrl, outputPath, quality);
    });
  }

  public async openEditor(file: MediaFile): Promise<{ success: boolean; windowId?: number; error?: string }> {
    try {
      // Check if editor is already open for this file
      if (this.editorWindows.has(file.path)) {
        const existingWindow = this.editorWindows.get(file.path);
        if (existingWindow && !existingWindow.isDestroyed()) {
          existingWindow.focus();
          return { success: true, windowId: existingWindow.id };
        } else {
          // Clean up destroyed window reference
          this.editorWindows.delete(file.path);
        }
      }

      // Create new editor window
      const editorWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        title: `Image Editor - ${file.name}`,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          enableRemoteModule: false,
          preload: join(__dirname, '../preload.js'),
        },
        show: false,
        titleBarStyle: 'default',
        parent: BrowserWindow.getFocusedWindow() || undefined,
        modal: false,
      });

      // Load the editor page
      if (isDev) {
        await editorWindow.loadURL(`http://localhost:3000/editor?file=${encodeURIComponent(file.path)}`);
        editorWindow.webContents.openDevTools();
      } else {
        await editorWindow.loadFile(join(__dirname, '../renderer/editor.html'), {
          query: { file: file.path }
        });
      }

      // Show window when ready
      editorWindow.once('ready-to-show', () => {
        editorWindow.show();
      });

      // Handle window close
      editorWindow.on('closed', () => {
        this.editorWindows.delete(file.path);
      });

      // Store window reference
      this.editorWindows.set(file.path, editorWindow);

      return { success: true, windowId: editorWindow.id };
    } catch (error) {
      console.error('Error opening editor:', error);
      return { success: false, error: error.message };
    }
  }

  public closeEditor(filePath: string): { success: boolean; error?: string } {
    try {
      const window = this.editorWindows.get(filePath);
      if (window && !window.isDestroyed()) {
        window.close();
      }
      this.editorWindows.delete(filePath);
      return { success: true };
    } catch (error) {
      console.error('Error closing editor:', error);
      return { success: false, error: error.message };
    }
  }

  public async saveEditedImage(filePath: string, operations: ImageOperation[]): Promise<{ success: boolean; outputPath?: string; error?: string }> {
    try {
      const outputPath = this.generateEditedFilePath(filePath);
      
      // Use the image processing service to apply operations and save
      const result = await this.imageProcessingService.processAndSaveImage(
        filePath,
        outputPath,
        operations,
        90 // Quality setting
      );
      
      if (result.success) {
        return { success: true, outputPath };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error saving edited image:', error);
      return { success: false, error: error.message };
    }
  }

  private generateEditedFilePath(originalPath: string): string {
    const lastDotIndex = originalPath.lastIndexOf('.');
    if (lastDotIndex === -1) {
      // No extension found
      return `${originalPath}_edited`;
    }
    const basePath = originalPath.substring(0, lastDotIndex);
    const extension = originalPath.substring(lastDotIndex);
    return `${basePath}_edited${extension}`;
  }

  public getOpenEditors(): string[] {
    return Array.from(this.editorWindows.keys()).filter(filePath => {
      const window = this.editorWindows.get(filePath);
      return window && !window.isDestroyed();
    });
  }

  public closeAllEditors(): void {
    for (const [filePath, window] of this.editorWindows) {
      if (window && !window.isDestroyed()) {
        try {
          window.close();
        } catch (error) {
          console.error(`Error closing editor window for ${filePath}:`, error);
        }
      }
    }
    this.editorWindows.clear();
  }

  public async saveCanvasToFile(canvasDataUrl: string, outputPath: string, quality: number = 90): Promise<{ success: boolean; error?: string }> {
    try {
      return await this.imageProcessingService.saveCanvasToFile(canvasDataUrl, outputPath, quality);
    } catch (error) {
      console.error('Error saving canvas to file:', error);
      return { success: false, error: error.message };
    }
  }
}