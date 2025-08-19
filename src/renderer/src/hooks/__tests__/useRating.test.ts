import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRating } from '../useRating';
import { MediaFile } from '../../../../types/global';

// Mock window.electronAPI
const mockElectronAPI = {
  setRating: vi.fn(),
  getRating: vi.fn(),
  setBatchRating: vi.fn(),
  getAverageRating: vi.fn(),
};

// @ts-ignore
global.window = {
  electronAPI: mockElectronAPI,
};

describe('useRating', () => {
  const mockFile1: MediaFile = {
    path: '/path/to/image1.jpg',
    name: 'image1.jpg',
    extension: '.jpg',
    size: 1024000,
    dateModified: new Date(),
    type: 'image',
  };

  const mockFile2: MediaFile = {
    path: '/path/to/image2.jpg',
    name: 'image2.jpg',
    extension: '.jpg',
    size: 2048000,
    dateModified: new Date(),
    type: 'image',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('setRating', () => {
    it('should set rating for single file', async () => {
      mockElectronAPI.setRating.mockResolvedValue(undefined);

      const { result } = renderHook(() => useRating());

      await act(async () => {
        await result.current.setRating([mockFile1], 4);
      });

      expect(mockElectronAPI.setRating).toHaveBeenCalledWith('/path/to/image1.jpg', 4);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it('should set batch rating for multiple files', async () => {
      const mockBatchResult = {
        successful: ['/path/to/image1.jpg', '/path/to/image2.jpg'],
        failed: [],
        totalProcessed: 2,
      };

      mockElectronAPI.setBatchRating.mockResolvedValue(mockBatchResult);

      const { result } = renderHook(() => useRating());

      await act(async () => {
        await result.current.setRating([mockFile1, mockFile2], 5);
      });

      expect(mockElectronAPI.setBatchRating).toHaveBeenCalledWith(
        ['/path/to/image1.jpg', '/path/to/image2.jpg'],
        5
      );
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it('should handle partial batch failures', async () => {
      const mockBatchResult = {
        successful: ['/path/to/image1.jpg'],
        failed: [{ filePath: '/path/to/image2.jpg', error: 'Write failed' }],
        totalProcessed: 2,
      };

      mockElectronAPI.setBatchRating.mockResolvedValue(mockBatchResult);

      const { result } = renderHook(() => useRating());

      await act(async () => {
        await result.current.setRating([mockFile1, mockFile2], 3);
      });

      expect(result.current.error).toBe('Failed to rate 1 out of 2 files');
    });

    it('should handle errors', async () => {
      mockElectronAPI.setRating.mockRejectedValue(new Error('File not found'));

      const { result } = renderHook(() => useRating());

      await act(async () => {
        try {
          await result.current.setRating([mockFile1], 4);
        } catch (error) {
          // Expected to throw
        }
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe('File not found');
    });
  });

  describe('getRating', () => {
    it('should get rating for file', async () => {
      mockElectronAPI.getRating.mockResolvedValue(4);

      const { result } = renderHook(() => useRating());

      let rating: number;
      await act(async () => {
        rating = await result.current.getRating('/path/to/image1.jpg');
      });

      expect(rating!).toBe(4);
      expect(mockElectronAPI.getRating).toHaveBeenCalledWith('/path/to/image1.jpg');
      expect(result.current.error).toBe(null);
    });

    it('should handle errors and return 0', async () => {
      mockElectronAPI.getRating.mockRejectedValue(new Error('File not found'));

      const { result } = renderHook(() => useRating());

      let rating: number;
      await act(async () => {
        rating = await result.current.getRating('/path/to/nonexistent.jpg');
      });

      expect(rating!).toBe(0);
      expect(result.current.error).toBe('File not found');
    });
  });

  describe('setBatchRating', () => {
    it('should set batch rating successfully', async () => {
      const mockBatchResult = {
        successful: ['/path/to/image1.jpg', '/path/to/image2.jpg'],
        failed: [],
        totalProcessed: 2,
      };

      mockElectronAPI.setBatchRating.mockResolvedValue(mockBatchResult);

      const { result } = renderHook(() => useRating());

      let batchResult: any;
      await act(async () => {
        batchResult = await result.current.setBatchRating([mockFile1, mockFile2], 5);
      });

      expect(batchResult).toEqual(mockBatchResult);
      expect(mockElectronAPI.setBatchRating).toHaveBeenCalledWith(
        ['/path/to/image1.jpg', '/path/to/image2.jpg'],
        5
      );
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it('should handle batch failures', async () => {
      const mockBatchResult = {
        successful: ['/path/to/image1.jpg'],
        failed: [{ filePath: '/path/to/image2.jpg', error: 'Write failed' }],
        totalProcessed: 2,
      };

      mockElectronAPI.setBatchRating.mockResolvedValue(mockBatchResult);

      const { result } = renderHook(() => useRating());

      await act(async () => {
        await result.current.setBatchRating([mockFile1, mockFile2], 3);
      });

      expect(result.current.error).toBe('Failed to rate 1 out of 2 files');
    });
  });

  describe('getAverageRating', () => {
    it('should get average rating for files', async () => {
      mockElectronAPI.getAverageRating.mockResolvedValue(4.5);

      const { result } = renderHook(() => useRating());

      let averageRating: number;
      await act(async () => {
        averageRating = await result.current.getAverageRating([mockFile1, mockFile2]);
      });

      expect(averageRating!).toBe(4.5);
      expect(mockElectronAPI.getAverageRating).toHaveBeenCalledWith(
        ['/path/to/image1.jpg', '/path/to/image2.jpg']
      );
      expect(result.current.error).toBe(null);
    });

    it('should handle errors and return 0', async () => {
      mockElectronAPI.getAverageRating.mockRejectedValue(new Error('Failed to calculate'));

      const { result } = renderHook(() => useRating());

      let averageRating: number;
      await act(async () => {
        averageRating = await result.current.getAverageRating([mockFile1, mockFile2]);
      });

      expect(averageRating!).toBe(0);
      expect(result.current.error).toBe('Failed to calculate');
    });
  });
});