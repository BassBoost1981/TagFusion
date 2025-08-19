import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryManagerService, LRUCache } from '../MemoryManagerService';

// Mock performance.memory
const mockMemory = {
  jsHeapSizeLimit: 2147483648,
  totalJSHeapSize: 100000000,
  usedJSHeapSize: 50000000
};

describe('LRUCache', () => {
  let cache: LRUCache<string>;

  beforeEach(() => {
    cache = new LRUCache<string>({
      maxSize: 1000,
      maxEntries: 10,
      ttl: 5000
    });
  });

  describe('basic operations', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1', 100);
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should check if key exists', () => {
      cache.set('key1', 'value1', 100);
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should delete entries', () => {
      cache.set('key1', 'value1', 100);
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.delete('nonexistent')).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1', 100);
      cache.set('key2', 'value2', 100);
      cache.clear();
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used entries when size limit exceeded', () => {
      // Fill cache to capacity
      for (let i = 0; i < 10; i++) {
        cache.set(`key${i}`, `value${i}`, 50);
      }

      // Add one more entry that should trigger eviction
      cache.set('key10', 'value10', 500); // Large entry

      // First entries should be evicted
      expect(cache.get('key0')).toBeUndefined();
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key10')).toBe('value10');
    });

    it('should evict entries when max entries exceeded', () => {
      // Fill cache to max entries
      for (let i = 0; i < 10; i++) {
        cache.set(`key${i}`, `value${i}`, 10);
      }

      // Add one more entry
      cache.set('key10', 'value10', 10);

      // First entry should be evicted
      expect(cache.get('key0')).toBeUndefined();
      expect(cache.get('key10')).toBe('value10');
    });

    it('should update access order when getting values', () => {
      cache.set('key1', 'value1', 50);
      cache.set('key2', 'value2', 50);
      cache.set('key3', 'value3', 50);

      // Access key1 to make it most recently used
      cache.get('key1');

      // Fill cache to trigger eviction
      for (let i = 4; i < 15; i++) {
        cache.set(`key${i}`, `value${i}`, 50);
      }

      // key1 should still exist (was accessed recently)
      expect(cache.get('key1')).toBe('value1');
      // key2 should be evicted (least recently used)
      expect(cache.get('key2')).toBeUndefined();
    });
  });

  describe('TTL expiration', () => {
    it('should expire entries after TTL', async () => {
      const shortTTLCache = new LRUCache<string>({
        maxSize: 1000,
        maxEntries: 10,
        ttl: 100 // 100ms
      });

      shortTTLCache.set('key1', 'value1', 50);
      expect(shortTTLCache.get('key1')).toBe('value1');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(shortTTLCache.get('key1')).toBeUndefined();
      expect(shortTTLCache.has('key1')).toBe(false);
    });
  });

  describe('statistics', () => {
    it('should provide accurate statistics', () => {
      cache.set('key1', 'value1', 100);
      cache.set('key2', 'value2', 200);
      
      const stats = cache.getStats();
      expect(stats.size).toBe(300);
      expect(stats.entries).toBe(2);
      expect(stats.maxSize).toBe(1000);
      expect(stats.maxEntries).toBe(10);
    });
  });

  describe('eviction callback', () => {
    it('should call onEvict callback when entries are evicted', () => {
      const onEvict = vi.fn();
      const callbackCache = new LRUCache<string>({
        maxSize: 100,
        maxEntries: 2,
        onEvict
      });

      callbackCache.set('key1', 'value1', 50);
      callbackCache.set('key2', 'value2', 50);
      callbackCache.set('key3', 'value3', 50); // Should trigger eviction

      expect(onEvict).toHaveBeenCalledWith('key1', 'value1');
    });
  });
});

describe('MemoryManagerService', () => {
  let service: MemoryManagerService;

  beforeEach(() => {
    // Mock performance.memory
    Object.defineProperty(global.performance, 'memory', {
      value: mockMemory,
      writable: true
    });

    // Mock window.setInterval
    vi.spyOn(window, 'setInterval').mockImplementation((fn, delay) => {
      return setTimeout(fn, delay) as any;
    });

    vi.spyOn(window, 'clearInterval').mockImplementation((id) => {
      clearTimeout(id as any);
    });

    service = new MemoryManagerService();
  });

  afterEach(() => {
    service.dispose();
    vi.restoreAllMocks();
  });

  describe('thumbnail caching', () => {
    it('should cache and retrieve thumbnails', () => {
      const filePath = '/path/to/image.jpg';
      const thumbnail = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD...';

      service.cacheThumbnail(filePath, thumbnail);
      expect(service.getCachedThumbnail(filePath)).toBe(thumbnail);
    });

    it('should return undefined for non-cached thumbnails', () => {
      expect(service.getCachedThumbnail('/nonexistent.jpg')).toBeUndefined();
    });
  });

  describe('image data caching', () => {
    it('should cache and retrieve image data', () => {
      const key = 'processed_image_123';
      const imageData = new ImageData(new Uint8ClampedArray([255, 0, 0, 255]), 1, 1);

      service.cacheImageData(key, imageData);
      const cached = service.getCachedImageData(key);

      expect(cached).toBeDefined();
      expect(cached?.width).toBe(1);
      expect(cached?.height).toBe(1);
    });
  });

  describe('metadata caching', () => {
    it('should cache and retrieve metadata', () => {
      const filePath = '/path/to/image.jpg';
      const metadata = {
        width: 1920,
        height: 1080,
        format: 'JPEG',
        tags: ['nature', 'landscape']
      };

      service.cacheMetadata(filePath, metadata);
      expect(service.getCachedMetadata(filePath)).toEqual(metadata);
    });
  });

  describe('progressive loading', () => {
    it('should load file progressively', async () => {
      const fileContent = new Uint8Array(1000);
      fileContent.fill(42);
      
      const mockFile = new File([fileContent], 'test.jpg', { type: 'image/jpeg' });
      
      const onProgress = vi.fn();
      const onChunkLoaded = vi.fn();

      const result = await service.loadFileProgressively(mockFile, {
        chunkSize: 250,
        maxConcurrentChunks: 2,
        onProgress,
        onChunkLoaded
      });

      expect(result.byteLength).toBe(1000);
      expect(onProgress).toHaveBeenCalled();
      expect(onChunkLoaded).toHaveBeenCalledTimes(4); // 1000 / 250 = 4 chunks
    });

    it('should handle empty files', async () => {
      const mockFile = new File([], 'empty.txt', { type: 'text/plain' });

      const result = await service.loadFileProgressively(mockFile, {
        chunkSize: 100,
        maxConcurrentChunks: 2
      });

      expect(result.byteLength).toBe(0);
    });
  });

  describe('batch processing with memory management', () => {
    it('should process items in batches', async () => {
      const items = Array.from({ length: 25 }, (_, i) => i);
      const processor = vi.fn().mockImplementation(async (item: number) => item * 2);
      const onProgress = vi.fn();

      const results = await service.batchProcessWithMemoryManagement(
        items,
        processor,
        {
          batchSize: 5,
          onProgress
        }
      );

      expect(results).toEqual(items.map(i => i * 2));
      expect(processor).toHaveBeenCalledTimes(25);
      expect(onProgress).toHaveBeenCalledTimes(5); // 25 items / 5 batch size = 5 batches
    });

    it('should handle memory pressure during batch processing', async () => {
      // Mock high memory usage
      Object.defineProperty(global.performance, 'memory', {
        value: {
          ...mockMemory,
          usedJSHeapSize: mockMemory.jsHeapSizeLimit * 0.8 // 80% usage
        },
        writable: true
      });

      const items = [1, 2, 3, 4, 5];
      const processor = vi.fn().mockImplementation(async (item: number) => item * 2);

      const results = await service.batchProcessWithMemoryManagement(
        items,
        processor,
        {
          batchSize: 2,
          memoryThreshold: 0.7 // 70% threshold
        }
      );

      expect(results).toEqual([2, 4, 6, 8, 10]);
    });
  });

  describe('memory statistics', () => {
    it('should provide memory statistics', () => {
      const stats = service.getMemoryStats();

      expect(stats.used).toBe(mockMemory.usedJSHeapSize);
      expect(stats.total).toBe(mockMemory.jsHeapSizeLimit);
      expect(stats.percentage).toBeCloseTo(23.3, 1); // 50MB / 2GB * 100
      expect(stats.cacheSize).toBeGreaterThanOrEqual(0);
      expect(stats.activeTasks).toBe(0);
    });

    it('should handle missing memory API', () => {
      delete (global.performance as any).memory;
      
      const noMemoryService = new MemoryManagerService();
      const stats = noMemoryService.getMemoryStats();

      expect(stats.used).toBe(0);
      expect(stats.total).toBe(0);
      expect(stats.percentage).toBe(0);
      
      noMemoryService.dispose();
    });
  });

  describe('cache statistics', () => {
    it('should provide cache statistics', () => {
      // Add some data to caches
      service.cacheThumbnail('/test1.jpg', 'thumbnail1');
      service.cacheImageData('key1', new ImageData(new Uint8ClampedArray(400), 10, 10));
      service.cacheMetadata('/test1.jpg', { width: 100, height: 100 });

      const stats = service.getCacheStats();

      expect(stats.thumbnail.entries).toBe(1);
      expect(stats.imageData.entries).toBe(1);
      expect(stats.metadata.entries).toBe(1);
      expect(stats.thumbnail.size).toBeGreaterThan(0);
      expect(stats.imageData.size).toBeGreaterThan(0);
      expect(stats.metadata.size).toBeGreaterThan(0);
    });
  });

  describe('cache clearing', () => {
    it('should clear all caches', () => {
      service.cacheThumbnail('/test1.jpg', 'thumbnail1');
      service.cacheImageData('key1', new ImageData(new Uint8ClampedArray(400), 10, 10));
      service.cacheMetadata('/test1.jpg', { width: 100, height: 100 });

      service.clearAllCaches();

      expect(service.getCachedThumbnail('/test1.jpg')).toBeUndefined();
      expect(service.getCachedImageData('key1')).toBeUndefined();
      expect(service.getCachedMetadata('/test1.jpg')).toBeUndefined();
    });
  });

  describe('disposal', () => {
    it('should clean up resources on disposal', () => {
      const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
      
      service.dispose();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle file reading errors in progressive loading', async () => {
      const mockFile = {
        size: 1000,
        slice: vi.fn().mockImplementation(() => {
          throw new Error('File read error');
        })
      } as any;

      await expect(
        service.loadFileProgressively(mockFile, {
          chunkSize: 100,
          maxConcurrentChunks: 2
        })
      ).rejects.toThrow('File read error');
    });

    it('should handle processor errors in batch processing', async () => {
      const items = [1, 2, 3];
      const processor = vi.fn().mockImplementation(async (item: number) => {
        if (item === 2) throw new Error('Processing error');
        return item * 2;
      });

      await expect(
        service.batchProcessWithMemoryManagement(items, processor)
      ).rejects.toThrow('Processing error');
    });
  });
});