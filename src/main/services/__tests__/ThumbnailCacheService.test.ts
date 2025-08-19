import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThumbnailCacheService } from '../ThumbnailCacheService';
import * as fs from 'fs/promises';

// Mock fs module
vi.mock('fs/promises');
const mockFs = vi.mocked(fs);

describe('ThumbnailCacheService', () => {
  let cacheService: ThumbnailCacheService;
  const testFilePath = '/test/image.jpg';
  const testThumbnail = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8A';

  beforeEach(() => {
    cacheService = new ThumbnailCacheService(10, 1); // Small cache for testing
    
    // Mock file stats
    mockFs.stat.mockResolvedValue({
      mtime: new Date('2024-01-01'),
      size: 1024
    } as any);
  });

  afterEach(() => {
    cacheService.dispose();
    vi.clearAllMocks();
  });

  describe('Basic Cache Operations', () => {
    it('should store and retrieve thumbnails', async () => {
      await cacheService.set(testFilePath, testThumbnail);
      const result = await cacheService.get(testFilePath);
      
      expect(result).toBe(testThumbnail);
    });

    it('should return null for non-existent entries', async () => {
      const result = await cacheService.get('/non/existent/file.jpg');
      
      expect(result).toBeNull();
    });

    it('should check if cache has entry', async () => {
      await cacheService.set(testFilePath, testThumbnail);
      
      expect(cacheService.has(testFilePath)).toBe(true);
      expect(cacheService.has('/other/file.jpg')).toBe(false);
    });

    it('should delete entries', async () => {
      await cacheService.set(testFilePath, testThumbnail);
      const deleted = cacheService.delete(testFilePath);
      
      expect(deleted).toBe(true);
      expect(cacheService.has(testFilePath)).toBe(false);
    });

    it('should clear all entries', async () => {
      await cacheService.set(testFilePath, testThumbnail);
      await cacheService.set('/other/file.jpg', testThumbnail);
      
      cacheService.clear();
      
      expect(cacheService.has(testFilePath)).toBe(false);
      expect(cacheService.has('/other/file.jpg')).toBe(false);
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate cache when file is modified', async () => {
      await cacheService.set(testFilePath, testThumbnail);
      
      // Mock file with newer modification time
      mockFs.stat.mockResolvedValue({
        mtime: new Date('2024-01-02'),
        size: 1024
      } as any);
      
      const result = await cacheService.get(testFilePath);
      
      expect(result).toBeNull();
    });

    it('should invalidate cache when file does not exist', async () => {
      await cacheService.set(testFilePath, testThumbnail);
      
      // Mock file not found error
      mockFs.stat.mockRejectedValue(new Error('File not found'));
      
      const result = await cacheService.get(testFilePath);
      
      expect(result).toBeNull();
    });

    it('should manually invalidate entries', async () => {
      await cacheService.set(testFilePath, testThumbnail);
      
      // Mock file with newer modification time
      mockFs.stat.mockResolvedValue({
        mtime: new Date('2024-01-02'),
        size: 1024
      } as any);
      
      const invalidated = await cacheService.invalidate(testFilePath);
      
      expect(invalidated).toBe(true);
      expect(cacheService.has(testFilePath)).toBe(false);
    });
  });

  describe('LRU Eviction', () => {
    it('should evict least recently used entries when cache is full', async () => {
      const cache = new ThumbnailCacheService(3, 10); // Max 3 entries
      
      // Fill cache
      await cache.set('/file1.jpg', testThumbnail);
      await cache.set('/file2.jpg', testThumbnail);
      await cache.set('/file3.jpg', testThumbnail);
      
      // Access file1 to make it recently used
      await cache.get('/file1.jpg');
      
      // Add new entry, should evict file2 (least recently used)
      await cache.set('/file4.jpg', testThumbnail);
      
      expect(cache.has('/file1.jpg')).toBe(true);
      expect(cache.has('/file2.jpg')).toBe(false);
      expect(cache.has('/file3.jpg')).toBe(true);
      expect(cache.has('/file4.jpg')).toBe(true);
      
      cache.dispose();
    });
  });

  describe('Memory Management', () => {
    it('should track memory usage', async () => {
      await cacheService.set(testFilePath, testThumbnail);
      
      const stats = cacheService.getStats();
      
      expect(stats.memoryUsage).toBeGreaterThan(0);
      expect(stats.size).toBe(1);
    });

    it('should evict entries when memory limit is exceeded', async () => {
      const smallCache = new ThumbnailCacheService(100, 0.0001); // Very small memory limit (0.1KB)
      
      // Create a larger thumbnail to trigger memory-based eviction
      const largeThumbnail = 'data:image/jpeg;base64,' + 'A'.repeat(1000); // ~1KB thumbnail
      
      // This should trigger memory-based eviction
      await smallCache.set('/file1.jpg', largeThumbnail);
      await smallCache.set('/file2.jpg', largeThumbnail);
      
      const stats = smallCache.getStats();
      expect(stats.size).toBeLessThanOrEqual(1); // Should have evicted entries due to memory limit
      
      smallCache.dispose();
    });
  });

  describe('Cache Statistics', () => {
    it('should track hit rate correctly', async () => {
      await cacheService.set(testFilePath, testThumbnail);
      
      // Hit
      await cacheService.get(testFilePath);
      // Miss
      await cacheService.get('/non/existent.jpg');
      
      const stats = cacheService.getStats();
      
      expect(stats.hitRate).toBe(0.5); // 1 hit out of 2 requests
    });

    it('should provide accurate cache statistics', async () => {
      await cacheService.set(testFilePath, testThumbnail);
      
      const stats = cacheService.getStats();
      
      expect(stats.size).toBe(1);
      expect(stats.maxSize).toBe(10);
      expect(stats.memoryUsage).toBeGreaterThan(0);
      expect(typeof stats.hitRate).toBe('number');
    });
  });
});