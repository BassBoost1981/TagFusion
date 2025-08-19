import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThumbnailManagerService } from '../ThumbnailManagerService';
import { IThumbnailService } from '../ThumbnailService';
import { IThumbnailCacheService } from '../ThumbnailCacheService';
import { MediaFile, ThumbnailOptions } from '../../../types/global';

// Mock dependencies
const mockThumbnailService: ReturnType<typeof vi.mocked<IThumbnailService>> = {
  generateThumbnail: vi.fn(),
  generateVideoThumbnail: vi.fn(),
  generateThumbnailBatch: vi.fn(),
  isImageFile: vi.fn(),
  isVideoFile: vi.fn(),
  dispose: vi.fn()
};

const mockCacheService: ReturnType<typeof vi.mocked<IThumbnailCacheService>> = {
  get: vi.fn(),
  set: vi.fn(),
  has: vi.fn(),
  delete: vi.fn(),
  clear: vi.fn(),
  invalidate: vi.fn(),
  getStats: vi.fn(),
  cleanup: vi.fn(),
  dispose: vi.fn()
};

describe('ThumbnailManagerService', () => {
  let managerService: ThumbnailManagerService;
  const testFilePath = '/test/image.jpg';
  const testThumbnail = 'data:image/jpeg;base64,test';
  const testOptions: ThumbnailOptions = { width: 200, height: 200, quality: 80 };

  beforeEach(() => {
    managerService = new ThumbnailManagerService(mockThumbnailService, mockCacheService);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await managerService.dispose();
  });

  describe('getThumbnail', () => {
    it('should return cached thumbnail if available', async () => {
      mockCacheService.get.mockResolvedValue(testThumbnail);
      
      const result = await managerService.getThumbnail(testFilePath, testOptions);
      
      expect(result).toBe(testThumbnail);
      expect(mockCacheService.get).toHaveBeenCalled();
      expect(mockThumbnailService.generateThumbnail).not.toHaveBeenCalled();
    });

    it('should generate and cache thumbnail if not in cache', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockThumbnailService.generateThumbnail.mockResolvedValue(testThumbnail);
      
      const result = await managerService.getThumbnail(testFilePath, testOptions);
      
      expect(result).toBe(testThumbnail);
      expect(mockThumbnailService.generateThumbnail).toHaveBeenCalledWith(testFilePath, expect.objectContaining(testOptions));
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it('should use default options when none provided', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockThumbnailService.generateThumbnail.mockResolvedValue(testThumbnail);
      
      await managerService.getThumbnail(testFilePath);
      
      expect(mockThumbnailService.generateThumbnail).toHaveBeenCalledWith(
        testFilePath,
        expect.objectContaining({
          width: 200,
          height: 200,
          quality: 80,
          format: 'jpeg'
        })
      );
    });
  });

  describe('getThumbnailBatch', () => {
    const testFiles: MediaFile[] = [
      {
        path: '/test/image1.jpg',
        name: 'image1.jpg',
        extension: '.jpg',
        size: 1024,
        dateModified: new Date(),
        type: 'image'
      },
      {
        path: '/test/image2.jpg',
        name: 'image2.jpg',
        extension: '.jpg',
        size: 2048,
        dateModified: new Date(),
        type: 'image'
      }
    ];

    it('should return cached thumbnails and generate missing ones', async () => {
      // First file is cached, second is not
      mockCacheService.get
        .mockResolvedValueOnce(testThumbnail)
        .mockResolvedValueOnce(null);
      
      mockThumbnailService.generateThumbnailBatch.mockResolvedValue(
        new Map([['/test/image2.jpg', testThumbnail]])
      );
      
      const result = await managerService.getThumbnailBatch(testFiles, testOptions);
      
      expect(result.size).toBe(2);
      expect(result.get('/test/image1.jpg')).toBe(testThumbnail);
      expect(result.get('/test/image2.jpg')).toBe(testThumbnail);
      expect(mockThumbnailService.generateThumbnailBatch).toHaveBeenCalledWith(
        [testFiles[1]], // Only second file should be generated
        expect.objectContaining(testOptions)
      );
    });

    it('should return only cached thumbnails if all are cached', async () => {
      mockCacheService.get.mockResolvedValue(testThumbnail);
      
      const result = await managerService.getThumbnailBatch(testFiles, testOptions);
      
      expect(result.size).toBe(2);
      expect(mockThumbnailService.generateThumbnailBatch).not.toHaveBeenCalled();
    });
  });

  describe('preloadThumbnails', () => {
    const testFiles: MediaFile[] = [
      {
        path: '/test/image1.jpg',
        name: 'image1.jpg',
        extension: '.jpg',
        size: 1024,
        dateModified: new Date(),
        type: 'image'
      }
    ];

    it('should preload thumbnails for uncached files', async () => {
      mockCacheService.has.mockReturnValue(false);
      mockThumbnailService.generateThumbnailBatch.mockResolvedValue(
        new Map([['/test/image1.jpg', testThumbnail]])
      );
      
      await managerService.preloadThumbnails(testFiles, testOptions);
      
      expect(mockThumbnailService.generateThumbnailBatch).toHaveBeenCalledWith(
        testFiles,
        expect.objectContaining(testOptions)
      );
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it('should skip preloading if all files are cached', async () => {
      mockCacheService.has.mockReturnValue(true);
      
      await managerService.preloadThumbnails(testFiles, testOptions);
      
      expect(mockThumbnailService.generateThumbnailBatch).not.toHaveBeenCalled();
    });

    it('should handle preloading errors gracefully', async () => {
      mockCacheService.has.mockReturnValue(false);
      mockThumbnailService.generateThumbnailBatch.mockRejectedValue(new Error('Generation failed'));
      
      // Should not throw
      await expect(managerService.preloadThumbnails(testFiles, testOptions)).resolves.toBeUndefined();
    });
  });

  describe('Cache Management', () => {
    it('should invalidate cache for a file', async () => {
      mockCacheService.delete.mockReturnValue(true);
      
      const result = await managerService.invalidateCache(testFilePath);
      
      expect(result).toBe(true);
      expect(mockCacheService.delete).toHaveBeenCalled();
    });

    it('should clear entire cache', () => {
      managerService.clearCache();
      
      expect(mockCacheService.clear).toHaveBeenCalled();
    });

    it('should return cache statistics', () => {
      const mockStats = {
        size: 10,
        maxSize: 100,
        hitRate: 0.8,
        memoryUsage: 1024
      };
      mockCacheService.getStats.mockReturnValue(mockStats);
      
      const stats = managerService.getCacheStats();
      
      expect(stats).toBe(mockStats);
    });
  });

  describe('File Type Detection', () => {
    it('should detect image files', () => {
      mockThumbnailService.isImageFile.mockReturnValue(true);
      
      const result = managerService.isImageFile('/test/image.jpg');
      
      expect(result).toBe(true);
      expect(mockThumbnailService.isImageFile).toHaveBeenCalledWith('/test/image.jpg');
    });

    it('should detect video files', () => {
      mockThumbnailService.isVideoFile.mockReturnValue(true);
      
      const result = managerService.isVideoFile('/test/video.mp4');
      
      expect(result).toBe(true);
      expect(mockThumbnailService.isVideoFile).toHaveBeenCalledWith('/test/video.mp4');
    });

    it('should detect supported files', () => {
      mockThumbnailService.isImageFile.mockReturnValue(false);
      mockThumbnailService.isVideoFile.mockReturnValue(true);
      
      const result = managerService.isSupportedFile('/test/video.mp4');
      
      expect(result).toBe(true);
    });
  });

  describe('Disposal', () => {
    it('should dispose of all services', async () => {
      await managerService.dispose();
      
      expect(mockThumbnailService.dispose).toHaveBeenCalled();
      expect(mockCacheService.dispose).toHaveBeenCalled();
    });
  });
});