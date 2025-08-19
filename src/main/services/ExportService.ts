import { promises as fs } from 'fs';
import { join, dirname, extname, basename } from 'path';
import sharp from 'sharp';
import { MediaFile } from '../../types/global';

export interface ExportSettings {
  size: 'original' | 'web' | 'custom';
  customWidth?: number;
  customHeight?: number;
  quality: number; // 1-100
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

export class ExportService {
  private progressCallback?: (progress: ExportProgress) => void;

  setProgressCallback(callback: (progress: ExportProgress) => void): void {
    this.progressCallback = callback;
  }

  async exportSingleFile(file: MediaFile, settings: ExportSettings): Promise<ExportResult> {
    try {
      // Only support image files for now
      if (file.type !== 'image') {
        return {
          success: false,
          error: 'Only image files are supported for export'
        };
      }

      // Ensure output directory exists
      await this.ensureDirectoryExists(settings.outputDirectory);

      // Generate output filename
      const outputFilename = this.generateOutputFilename(file, settings);
      const outputPath = join(settings.outputDirectory, outputFilename);

      // Get original file size
      const originalStats = await fs.stat(file.path);
      const originalSize = originalStats.size;

      // Process the image
      let sharpInstance = sharp(file.path);

      // Apply size settings
      if (settings.size === 'web') {
        sharpInstance = sharpInstance.resize(1920, 1080, {
          fit: 'inside',
          withoutEnlargement: true
        });
      } else if (settings.size === 'custom' && settings.customWidth && settings.customHeight) {
        sharpInstance = sharpInstance.resize(settings.customWidth, settings.customHeight, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }

      // Apply format and quality settings
      switch (settings.format) {
        case 'jpeg':
          sharpInstance = sharpInstance.jpeg({ 
            quality: settings.quality,
            mozjpeg: true
          });
          break;
        case 'png':
          sharpInstance = sharpInstance.png({ 
            quality: settings.quality,
            compressionLevel: Math.round((100 - settings.quality) / 10)
          });
          break;
        case 'webp':
          sharpInstance = sharpInstance.webp({ 
            quality: settings.quality
          });
          break;
      }

      // Handle metadata preservation
      if (!settings.preserveMetadata) {
        sharpInstance = sharpInstance.withMetadata(false);
      }

      // Save the processed image
      await sharpInstance.toFile(outputPath);

      // Get exported file size
      const exportedStats = await fs.stat(outputPath);
      const exportedSize = exportedStats.size;

      return {
        success: true,
        outputPath,
        originalSize,
        exportedSize
      };

    } catch (error) {
      console.error('Export error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown export error'
      };
    }
  }

  async exportMultipleFiles(files: MediaFile[], settings: ExportSettings): Promise<BatchExportResult> {
    const results: ExportResult[] = [];
    const errors: string[] = [];
    let successfulFiles = 0;
    let failedFiles = 0;

    // Filter to only image files
    const imageFiles = files.filter(file => file.type === 'image');
    
    if (imageFiles.length === 0) {
      return {
        success: false,
        results: [],
        totalFiles: 0,
        successfulFiles: 0,
        failedFiles: 0,
        errors: ['No image files found to export']
      };
    }

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      
      // Report progress
      if (this.progressCallback) {
        this.progressCallback({
          current: i + 1,
          total: imageFiles.length,
          currentFile: file.name,
          completed: false
        });
      }

      try {
        const result = await this.exportSingleFile(file, settings);
        results.push(result);

        if (result.success) {
          successfulFiles++;
        } else {
          failedFiles++;
          if (result.error) {
            errors.push(`${file.name}: ${result.error}`);
          }
        }
      } catch (error) {
        failedFiles++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${file.name}: ${errorMessage}`);
        results.push({
          success: false,
          error: errorMessage
        });
      }
    }

    // Report completion
    if (this.progressCallback) {
      this.progressCallback({
        current: imageFiles.length,
        total: imageFiles.length,
        currentFile: '',
        completed: true
      });
    }

    return {
      success: successfulFiles > 0,
      results,
      totalFiles: imageFiles.length,
      successfulFiles,
      failedFiles,
      errors
    };
  }

  async selectOutputDirectory(): Promise<string | null> {
    const { dialog } = require('electron');
    
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Export Directory'
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  private generateOutputFilename(file: MediaFile, settings: ExportSettings): string {
    const originalName = basename(file.name, extname(file.name));
    const extension = `.${settings.format}`;
    
    let filename = originalName;
    
    if (settings.filenamePrefix) {
      filename = settings.filenamePrefix + filename;
    }
    
    if (settings.filenameSuffix) {
      filename = filename + settings.filenameSuffix;
    }

    // Add size indicator if not original
    if (settings.size === 'web') {
      filename += '_web';
    } else if (settings.size === 'custom') {
      filename += `_${settings.customWidth}x${settings.customHeight}`;
    }

    return filename + extension;
  }

  getPresetSettings(): { [key: string]: Partial<ExportSettings> } {
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
}