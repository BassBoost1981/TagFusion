import { ipcMain, BrowserWindow } from 'electron';
import { ExportService, ExportSettings, ExportProgress } from '../services/ExportService';
import { MediaFile } from '../../types/global';

export class ExportHandlers {
  private exportService: ExportService;
  private currentExportCancelled = false;

  constructor() {
    this.exportService = new ExportService();
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Single file export
    ipcMain.handle('export:single', async (_, file: MediaFile, settings: ExportSettings) => {
      try {
        return await this.exportService.exportSingleFile(file, settings);
      } catch (error) {
        console.error('Export single file error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown export error'
        };
      }
    });

    // Multiple files export with progress
    ipcMain.handle('export:multiple', async (event, files: MediaFile[], settings: ExportSettings) => {
      try {
        this.currentExportCancelled = false;
        
        // Set up progress callback
        this.exportService.setProgressCallback((progress: ExportProgress) => {
          if (this.currentExportCancelled) {
            return;
          }
          
          // Send progress to renderer
          const senderWindow = BrowserWindow.fromWebContents(event.sender);
          if (senderWindow && !senderWindow.isDestroyed()) {
            senderWindow.webContents.send('export:progress', progress);
          }
        });

        const result = await this.exportService.exportMultipleFiles(files, settings);
        
        // Clear progress callback
        this.exportService.setProgressCallback(undefined);
        
        return result;
      } catch (error) {
        console.error('Export multiple files error:', error);
        
        // Clear progress callback on error
        this.exportService.setProgressCallback(undefined);
        
        return {
          success: false,
          results: [],
          totalFiles: 0,
          successfulFiles: 0,
          failedFiles: files.length,
          errors: [error instanceof Error ? error.message : 'Unknown export error']
        };
      }
    });

    // Select output directory
    ipcMain.handle('export:selectDirectory', async () => {
      try {
        return await this.exportService.selectOutputDirectory();
      } catch (error) {
        console.error('Select directory error:', error);
        return null;
      }
    });

    // Cancel export
    ipcMain.handle('export:cancel', async () => {
      try {
        this.currentExportCancelled = true;
        return true;
      } catch (error) {
        console.error('Cancel export error:', error);
        return false;
      }
    });

    // Remove progress listener (cleanup)
    ipcMain.handle('export:removeProgressListener', async () => {
      this.exportService.setProgressCallback(undefined);
      return true;
    });

    // Get preset settings
    ipcMain.handle('export:getPresets', async () => {
      return this.exportService.getPresetSettings();
    });
  }
}

// Export singleton instance
export const exportHandlers = new ExportHandlers();