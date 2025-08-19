import { MediaFile } from '../../../types/global';

export interface ExportSettings {
  size: 'original' | 'web' | 'custom';
  customWidth?: number;
  customHeight?: number;
  quality: number;
  format: 'jpeg' | 'png' | 'webp';
  preserveMetadata: boolean;
  outputDirectory: string;
  filenamePrefix?: string;
  filenameSuffix?: string;
}

export interface ExportProgress {
  current: number;
  total: number;
  currentFile: string;
  completed: boolean;
  error?: string;
}

export interface ExportResult {
  success: boolean;
  outputPath?: string;
  error?: string;
  originalSize?: number;
  exportedSize?: number;
}

export interface BatchExportResult {
  success: boolean;
  results: ExportResult[];
  totalFiles: number;
  successfulFiles: number;
  failedFiles: number;
  errors: string[];
}

export class ExportAPI {
  static async exportSingleFile(file: MediaFile, settings: ExportSettings): Promise<ExportResult> {
    try {
      return await window.electronAPI.invoke('export:single', file, settings);
    } catch (error) {
      console.error('Export single file error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown export error'
      };
    }
  }

  static async exportMultipleFiles(
    files: MediaFile[], 
    settings: ExportSettings,
    onProgress?: (progress: ExportProgress) => void
  ): Promise<BatchExportResult> {
    try {
      // Set up progress listener if provided
      if (onProgress) {
        const progressListener = (progress: ExportProgress) => {
          onProgress(progress);
        };
        
        window.electronAPI.on('export:progress', progressListener);
        
        // Clean up listener when done
        const cleanup = () => {
          window.electronAPI.invoke('export:removeProgressListener');
        };
        
        try {
          const result = await window.electronAPI.invoke('export:multiple', files, settings);
          cleanup();
          return result;
        } catch (error) {
          cleanup();
          throw error;
        }
      } else {
        return await window.electronAPI.invoke('export:multiple', files, settings);
      }
    } catch (error) {
      console.error('Export multiple files error:', error);
      return {
        success: false,
        results: [],
        totalFiles: 0,
        successfulFiles: 0,
        failedFiles: files.length,
        errors: [error instanceof Error ? error.message : 'Unknown export error']
      };
    }
  }

  static async selectOutputDirectory(): Promise<string | null> {
    try {
      return await window.electronAPI.invoke('export:selectDirectory');
    } catch (error) {
      console.error('Select directory error:', error);
      return null;
    }
  }

  static getPresetSettings(): { [key: string]: Partial<ExportSettings> } {
    return {
      'web-high': {
        size: 'web',
        quality: 85,
        format: 'jpeg',
        preserveMetadata: false
      },
      'web-medium': {
        size: 'web',
        quality: 70,
        format: 'jpeg',
        preserveMetadata: false
      },
      'web-low': {
        size: 'web',
        quality: 50,
        format: 'jpeg',
        preserveMetadata: false
      },
      'original-compressed': {
        size: 'original',
        quality: 85,
        format: 'jpeg',
        preserveMetadata: true
      },
      'thumbnail': {
        size: 'custom',
        customWidth: 300,
        customHeight: 300,
        quality: 80,
        format: 'jpeg',
        preserveMetadata: false
      }
    };
  }

  static async cancelExport(): Promise<boolean> {
    try {
      return await window.electronAPI.invoke('export:cancel');
    } catch (error) {
      console.error('Cancel export error:', error);
      return false;
    }
  }
}