import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { ExportService, ExportSettings } from '../ExportService';
import { MediaFile } from '../../../types/global';

// Mock dependencies
vi.mock('fs', () => ({
  promises: {
    stat: vi.fn(),
    mkdir: vi.fn(),
    access: vi.fn()
  }
}));

vi.mock('sharp', () => {
  const mockSharp = vi.fn(() => ({
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    withMetadata: vi.fn().mockReturnThis(),
    toFile: vi.fn().mockResolvedValue(undefined)
  }));
  return { default: mockSharp };
});

vi.mock('electron', () => ({
  dialog: {
    showOpenDialog: vi.fn()
  }
}));

describe('ExportService', () => {
  let exportService: ExportService;
  let mockFile: MediaFile;
  let mockSettings: ExportSettings;

  beforeEach(() => {
    exportService = new ExportService();
    
    mockFile = {
      path: '/test/image.jpg',
      name: 'image.jpg',
      extension: '.jpg',
      size: 1024000,
      dateModified: new Date(),
      type: 'image'
    };

    mockSettings = {
      size: 'web',
      quality: 85,
      format: 'jpeg',
      preserveMetadata: false,
      outputDirectory: '/test/output',
      filenamePrefix: '',
      filenameSuffix: ''
    };

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('exportSingleFile', () => {
    it('should export image file successfully', async () => {
      // Mock file system operations
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.stat)
        .mockResolvedValueOnce({ size: 1024000 } as any) // Original file
        .mockResolvedValueOnce({ size: 512000 } as any); // Exported file

      const result = await exportService.exportSingleFile(mockFile, mockSettings);

      expect(result.success).toBe(true);
      expect(result.outputPath).toContain('image_web.jpeg');
      expect(result.originalSize).toBe(1024000);
      expect(result.exportedSize).toBe(512000);
    });

    it('should reject video files', async () => {
      const videoFile: MediaFile = {
        ...mockFile,
        type: 'video',
        name: 'video.mp4',
        extension: '.mp4'
      };

      const result = await exportService.exportSingleFile(videoFile, mockSettings);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Only image files are supported for export');
    });

    it('should handle custom size settings', async () => {
      const customSettings: ExportSettings = {
        ...mockSettings,
        size: 'custom',
        customWidth: 800,
        customHeight: 600
      };

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.stat)
        .mockResolvedValueOnce({ size: 1024000 } as any)
        .mockResolvedValueOnce({ size: 400000 } as any);

      const result = await exportService.exportSingleFile(mockFile, customSettings);

      expect(result.success).toBe(true);
      expect(result.outputPath).toContain('image_800x600.jpeg');
    });

    it('should handle original size settings', async () => {
      const originalSettings: ExportSettings = {
        ...mockSettings,
        size: 'original'
      };

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.stat)
        .mockResolvedValueOnce({ size: 1024000 } as any)
        .mockResolvedValueOnce({ size: 900000 } as any);

      const result = await exportService.exportSingleFile(mockFile, originalSettings);

      expect(result.success).toBe(true);
      expect(result.outputPath).toContain('image.jpeg');
    });

    it('should handle different formats', async () => {
      const pngSettings: ExportSettings = {
        ...mockSettings,
        format: 'png'
      };

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.stat)
        .mockResolvedValueOnce({ size: 1024000 } as any)
        .mockResolvedValueOnce({ size: 800000 } as any);

      const result = await exportService.exportSingleFile(mockFile, pngSettings);

      expect(result.success).toBe(true);
      expect(result.outputPath).toContain('image_web.png');
    });

    it('should handle filename prefix and suffix', async () => {
      const prefixSuffixSettings: ExportSettings = {
        ...mockSettings,
        filenamePrefix: 'exported_',
        filenameSuffix: '_final'
      };

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.stat)
        .mockResolvedValueOnce({ size: 1024000 } as any)
        .mockResolvedValueOnce({ size: 512000 } as any);

      const result = await exportService.exportSingleFile(mockFile, prefixSuffixSettings);

      expect(result.success).toBe(true);
      expect(result.outputPath).toContain('exported_image_final_web.jpeg');
    });

    it('should create output directory if it does not exist', async () => {
      vi.mocked(fs.access).mockRejectedValueOnce(new Error('Directory not found'));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.stat)
        .mockResolvedValueOnce({ size: 1024000 } as any)
        .mockResolvedValueOnce({ size: 512000 } as any);

      const result = await exportService.exportSingleFile(mockFile, mockSettings);

      expect(fs.mkdir).toHaveBeenCalledWith('/test/output', { recursive: true });
      expect(result.success).toBe(true);
    });

    it('should handle export errors', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.stat).mockRejectedValue(new Error('File not found'));

      const result = await exportService.exportSingleFile(mockFile, mockSettings);

      expect(result.success).toBe(false);
      expect(result.error).toBe('File not found');
    });
  });

  describe('exportMultipleFiles', () => {
    it('should export multiple image files', async () => {
      const files: MediaFile[] = [
        mockFile,
        { ...mockFile, path: '/test/image2.jpg', name: 'image2.jpg' }
      ];

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.stat)
        .mockResolvedValue({ size: 1024000 } as any);

      let progressCallCount = 0;
      exportService.setProgressCallback((progress) => {
        progressCallCount++;
        expect(progress.total).toBe(2);
        expect(progress.current).toBeGreaterThan(0);
      });

      const result = await exportService.exportMultipleFiles(files, mockSettings);

      expect(result.success).toBe(true);
      expect(result.totalFiles).toBe(2);
      expect(result.successfulFiles).toBe(2);
      expect(result.failedFiles).toBe(0);
      expect(result.results).toHaveLength(2);
      expect(progressCallCount).toBeGreaterThan(0);
    });

    it('should filter out video files', async () => {
      const files: MediaFile[] = [
        mockFile,
        { ...mockFile, path: '/test/video.mp4', name: 'video.mp4', type: 'video' }
      ];

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.stat).mockResolvedValue({ size: 1024000 } as any);

      const result = await exportService.exportMultipleFiles(files, mockSettings);

      expect(result.success).toBe(true);
      expect(result.totalFiles).toBe(1); // Only image file counted
      expect(result.successfulFiles).toBe(1);
    });

    it('should handle empty file list', async () => {
      const result = await exportService.exportMultipleFiles([], mockSettings);

      expect(result.success).toBe(false);
      expect(result.totalFiles).toBe(0);
      expect(result.errors).toContain('No image files found to export');
    });

    it('should handle mixed success and failure', async () => {
      const files: MediaFile[] = [
        mockFile,
        { ...mockFile, path: '/test/image2.jpg', name: 'image2.jpg' }
      ];

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.stat)
        .mockResolvedValueOnce({ size: 1024000 } as any) // First file original
        .mockResolvedValueOnce({ size: 512000 } as any)  // First file exported
        .mockRejectedValueOnce(new Error('File not found')); // Second file error

      const result = await exportService.exportMultipleFiles(files, mockSettings);

      expect(result.success).toBe(true); // At least one succeeded
      expect(result.totalFiles).toBe(2);
      expect(result.successfulFiles).toBe(1);
      expect(result.failedFiles).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('File not found');
    });
  });

  describe('selectOutputDirectory', () => {
    it('should return selected directory path', async () => {
      const { dialog } = require('electron');
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({
        canceled: false,
        filePaths: ['/selected/directory']
      });

      const result = await exportService.selectOutputDirectory();

      expect(result).toBe('/selected/directory');
      expect(dialog.showOpenDialog).toHaveBeenCalledWith({
        properties: ['openDirectory', 'createDirectory'],
        title: 'Select Export Directory'
      });
    });

    it('should return null when dialog is cancelled', async () => {
      const { dialog } = require('electron');
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({
        canceled: true,
        filePaths: []
      });

      const result = await exportService.selectOutputDirectory();

      expect(result).toBeNull();
    });
  });

  describe('getPresetSettings', () => {
    it('should return preset configurations', () => {
      const presets = exportService.getPresetSettings();

      expect(presets).toHaveProperty('web-high');
      expect(presets).toHaveProperty('web-medium');
      expect(presets).toHaveProperty('web-low');
      expect(presets).toHaveProperty('original-compressed');
      expect(presets).toHaveProperty('thumbnail');

      expect(presets['web-high']).toEqual({
        size: 'web',
        quality: 85,
        format: 'jpeg',
        preserveMetadata: false
      });
    });
  });
});