import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useExport } from '../useExport';
import { MediaFile } from '../../../../types/global';
import * as ExportAPI from '../../api/exportApi';

// Mock the ExportAPI
vi.mock('../../api/exportApi', () => ({
  ExportAPI: {
    exportMultipleFiles: vi.fn(),
    selectOutputDirectory: vi.fn(),
    cancelExport: vi.fn()
  }
}));

describe('useExport', () => {
  let mockFiles: MediaFile[];

  beforeEach(() => {
    mockFiles = [
      {
        path: '/test/image1.jpg',
        name: 'image1.jpg',
        extension: '.jpg',
        size: 1024000,
        dateModified: new Date(),
        type: 'image'
      },
      {
        path: '/test/image2.png',
        name: 'image2.png',
        extension: '.png',
        size: 2048000,
        dateModified: new Date(),
        type: 'image'
      }
    ];

    vi.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useExport());

    expect(result.current.isExporting).toBe(false);
    expect(result.current.progress).toBeNull();
    expect(result.current.showExportDialog).toBe(false);
    expect(result.current.showProgressDialog).toBe(false);
    expect(result.current.exportResult).toBeNull();
  });

  it('should open export dialog', () => {
    const { result } = renderHook(() => useExport());

    act(() => {
      result.current.openExportDialog(mockFiles);
    });

    expect(result.current.showExportDialog).toBe(true);
  });

  it('should not open export dialog for empty file list', () => {
    const { result } = renderHook(() => useExport());

    act(() => {
      result.current.openExportDialog([]);
    });

    expect(result.current.showExportDialog).toBe(false);
  });

  it('should close export dialog', () => {
    const { result } = renderHook(() => useExport());

    act(() => {
      result.current.openExportDialog(mockFiles);
    });

    expect(result.current.showExportDialog).toBe(true);

    act(() => {
      result.current.closeExportDialog();
    });

    expect(result.current.showExportDialog).toBe(false);
  });

  it('should start export successfully', async () => {
    const mockSettings = {
      size: 'web' as const,
      quality: 85,
      format: 'jpeg' as const,
      preserveMetadata: false,
      outputDirectory: '/test/output',
      filenamePrefix: '',
      filenameSuffix: ''
    };

    const mockResult = {
      success: true,
      results: [
        { success: true, outputPath: '/test/output/image1_web.jpeg' },
        { success: true, outputPath: '/test/output/image2_web.jpeg' }
      ],
      totalFiles: 2,
      successfulFiles: 2,
      failedFiles: 0,
      errors: []
    };

    vi.mocked(ExportAPI.ExportAPI.exportMultipleFiles).mockResolvedValue(mockResult);

    const { result } = renderHook(() => useExport());

    await act(async () => {
      await result.current.startExport(mockFiles, mockSettings);
    });

    expect(result.current.isExporting).toBe(false);
    expect(result.current.showExportDialog).toBe(false);
    expect(result.current.showProgressDialog).toBe(true);
    expect(result.current.exportResult).toEqual(mockResult);
    expect(result.current.progress?.completed).toBe(true);
    expect(result.current.progress?.current).toBe(2);
    expect(result.current.progress?.total).toBe(2);
  });

  it('should handle export failure', async () => {
    const mockSettings = {
      size: 'web' as const,
      quality: 85,
      format: 'jpeg' as const,
      preserveMetadata: false,
      outputDirectory: '/test/output',
      filenamePrefix: '',
      filenameSuffix: ''
    };

    const mockResult = {
      success: false,
      results: [],
      totalFiles: 2,
      successfulFiles: 0,
      failedFiles: 2,
      errors: ['Export failed']
    };

    vi.mocked(ExportAPI.ExportAPI.exportMultipleFiles).mockResolvedValue(mockResult);

    const { result } = renderHook(() => useExport());

    await act(async () => {
      await result.current.startExport(mockFiles, mockSettings);
    });

    expect(result.current.isExporting).toBe(false);
    expect(result.current.exportResult).toEqual(mockResult);
    expect(result.current.progress?.error).toBe('Export failed');
  });

  it('should handle export exception', async () => {
    const mockSettings = {
      size: 'web' as const,
      quality: 85,
      format: 'jpeg' as const,
      preserveMetadata: false,
      outputDirectory: '/test/output',
      filenamePrefix: '',
      filenameSuffix: ''
    };

    const error = new Error('Network error');
    vi.mocked(ExportAPI.ExportAPI.exportMultipleFiles).mockRejectedValue(error);

    const { result } = renderHook(() => useExport());

    await act(async () => {
      await result.current.startExport(mockFiles, mockSettings);
    });

    expect(result.current.isExporting).toBe(false);
    expect(result.current.progress?.error).toBe('Network error');
  });

  it('should handle progress updates during export', async () => {
    const mockSettings = {
      size: 'web' as const,
      quality: 85,
      format: 'jpeg' as const,
      preserveMetadata: false,
      outputDirectory: '/test/output',
      filenamePrefix: '',
      filenameSuffix: ''
    };

    const mockResult = {
      success: true,
      results: [
        { success: true, outputPath: '/test/output/image1_web.jpeg' },
        { success: true, outputPath: '/test/output/image2_web.jpeg' }
      ],
      totalFiles: 2,
      successfulFiles: 2,
      failedFiles: 0,
      errors: []
    };

    let progressCallback: ((progress: any) => void) | undefined;

    vi.mocked(ExportAPI.ExportAPI.exportMultipleFiles).mockImplementation(
      async (files, settings, onProgress) => {
        progressCallback = onProgress;
        
        // Simulate progress updates
        if (progressCallback) {
          progressCallback({
            current: 1,
            total: 2,
            currentFile: 'image1.jpg',
            completed: false
          });
          
          progressCallback({
            current: 2,
            total: 2,
            currentFile: 'image2.png',
            completed: false
          });
        }
        
        return mockResult;
      }
    );

    const { result } = renderHook(() => useExport());

    await act(async () => {
      await result.current.startExport(mockFiles, mockSettings);
    });

    expect(result.current.progress?.completed).toBe(true);
  });

  it('should cancel export', async () => {
    vi.mocked(ExportAPI.ExportAPI.cancelExport).mockResolvedValue(true);

    const { result } = renderHook(() => useExport());

    await act(async () => {
      await result.current.cancelExport();
    });

    expect(result.current.isExporting).toBe(false);
    expect(result.current.progress?.error).toBe('Export cancelled by user');
    expect(ExportAPI.ExportAPI.cancelExport).toHaveBeenCalled();
  });

  it('should handle cancel export failure', async () => {
    vi.mocked(ExportAPI.ExportAPI.cancelExport).mockResolvedValue(false);

    const { result } = renderHook(() => useExport());

    await act(async () => {
      await result.current.cancelExport();
    });

    // Should not change state if cancel failed
    expect(result.current.progress).toBeNull();
  });

  it('should close progress dialog', () => {
    const { result } = renderHook(() => useExport());

    // Set some state first
    act(() => {
      result.current.openExportDialog(mockFiles);
    });

    act(() => {
      result.current.closeProgressDialog();
    });

    expect(result.current.showProgressDialog).toBe(false);
    expect(result.current.progress).toBeNull();
    expect(result.current.exportResult).toBeNull();
  });

  it('should select output directory', async () => {
    const mockDirectory = '/selected/directory';
    vi.mocked(ExportAPI.ExportAPI.selectOutputDirectory).mockResolvedValue(mockDirectory);

    const { result } = renderHook(() => useExport());

    let selectedDirectory: string | null = null;
    await act(async () => {
      selectedDirectory = await result.current.selectOutputDirectory();
    });

    expect(selectedDirectory).toBe(mockDirectory);
    expect(ExportAPI.ExportAPI.selectOutputDirectory).toHaveBeenCalled();
  });

  it('should handle directory selection failure', async () => {
    vi.mocked(ExportAPI.ExportAPI.selectOutputDirectory).mockRejectedValue(new Error('Dialog error'));

    const { result } = renderHook(() => useExport());

    let selectedDirectory: string | null = 'initial';
    await act(async () => {
      selectedDirectory = await result.current.selectOutputDirectory();
    });

    expect(selectedDirectory).toBeNull();
  });
});