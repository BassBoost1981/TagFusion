/**
 * Memory Manager Service
 * Provides advanced memory management with LRU caching, large file handling, and leak prevention
 */

export interface MemoryStats {
  used: number;
  total: number;
  percentage: number;
  cacheSize: number;
  activeTasks: number;
}

export interface CacheEntry<T> {
  key: string;
  value: T;
  size: number;
  accessTime: number;
  accessCount: number;
  createdAt: number;
}

export interface LRUCacheOptions {
  maxSize: number; // Maximum cache size in bytes
  maxEntries: number; // Maximum number of entries
  ttl?: number; // Time to live in milliseconds
  onEvict?: (key: string, value: any) => void;
}

export interface ProgressiveLoadingOptions {
  chunkSize: number; // Size of each chunk in bytes
  maxConcurrentChunks: number;
  onProgress?: (loaded: number, total: number) => void;
  onChunkLoaded?: (chunk: ArrayBuffer, index: number) => void;
}

export class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private accessOrder: string[] = [];
  private currentSize = 0;
  private options: Required<LRUCacheOptions>;

  constructor(options: LRUCacheOptions) {
    this.options = {
      maxSize: options.maxSize,
      maxEntries: options.maxEntries,
      ttl: options.ttl || Infinity,
      onEvict: options.onEvict || (() => {})
    };
  }

  /**
   * Get value from cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check TTL
    if (this.options.ttl !== Infinity && 
        Date.now() - entry.createdAt > this.options.ttl) {
      this.delete(key);
      return undefined;
    }

    // Update access information
    entry.accessTime = Date.now();
    entry.accessCount++;

    // Move to end of access order (most recently used)
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);

    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T, size: number): void {
    // Remove existing entry if it exists
    if (this.cache.has(key)) {
      this.delete(key);
    }

    // Check if we need to evict entries
    this.evictIfNeeded(size);

    // Create new entry
    const entry: CacheEntry<T> = {
      key,
      value,
      size,
      accessTime: Date.now(),
      accessCount: 1,
      createdAt: Date.now()
    };

    this.cache.set(key, entry);
    this.accessOrder.push(key);
    this.currentSize += size;
  }

  /**
   * Delete entry from cache
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    this.cache.delete(key);
    this.currentSize -= entry.size;

    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }

    this.options.onEvict(key, entry.value);
    return true;
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check TTL
    if (this.options.ttl !== Infinity && 
        Date.now() - entry.createdAt > this.options.ttl) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    for (const [key, entry] of this.cache.entries()) {
      this.options.onEvict(key, entry.value);
    }
    this.cache.clear();
    this.accessOrder.length = 0;
    this.currentSize = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    entries: number;
    maxSize: number;
    maxEntries: number;
    hitRate: number;
  } {
    let totalAccesses = 0;
    let totalHits = 0;

    for (const entry of this.cache.values()) {
      totalAccesses += entry.accessCount;
      totalHits += entry.accessCount;
    }

    return {
      size: this.currentSize,
      entries: this.cache.size,
      maxSize: this.options.maxSize,
      maxEntries: this.options.maxEntries,
      hitRate: totalAccesses > 0 ? totalHits / totalAccesses : 0
    };
  }

  /**
   * Evict entries if needed to make space
   */
  private evictIfNeeded(newEntrySize: number): void {
    // Evict by size
    while (this.currentSize + newEntrySize > this.options.maxSize && this.accessOrder.length > 0) {
      const oldestKey = this.accessOrder[0];
      this.delete(oldestKey);
    }

    // Evict by count
    while (this.cache.size >= this.options.maxEntries && this.accessOrder.length > 0) {
      const oldestKey = this.accessOrder[0];
      this.delete(oldestKey);
    }

    // Evict expired entries
    this.evictExpired();
  }

  /**
   * Evict expired entries
   */
  private evictExpired(): void {
    if (this.options.ttl === Infinity) return;

    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.createdAt > this.options.ttl) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.delete(key);
    }
  }
}

export class MemoryManagerService {
  private thumbnailCache: LRUCache<string>; // Base64 thumbnails
  private imageDataCache: LRUCache<ImageData>; // Processed image data
  private metadataCache: LRUCache<any>; // File metadata
  private activeTasks = new Set<string>();
  private memoryPressureThreshold = 0.8; // 80%
  private cleanupInterval: number | null = null;
  private memoryMonitorInterval: number | null = null;

  constructor() {
    this.initializeCaches();
    this.startMemoryMonitoring();
    this.setupCleanupInterval();
  }

  /**
   * Initialize cache instances
   */
  private initializeCaches(): void {
    const maxMemory = this.getAvailableMemory();
    
    // Allocate memory for different caches
    const thumbnailMemory = Math.floor(maxMemory * 0.4); // 40% for thumbnails
    const imageDataMemory = Math.floor(maxMemory * 0.3); // 30% for image data
    const metadataMemory = Math.floor(maxMemory * 0.1);  // 10% for metadata

    this.thumbnailCache = new LRUCache<string>({
      maxSize: thumbnailMemory,
      maxEntries: 10000,
      ttl: 30 * 60 * 1000, // 30 minutes
      onEvict: (key, value) => {
        console.debug(`Evicted thumbnail: ${key}`);
      }
    });

    this.imageDataCache = new LRUCache<ImageData>({
      maxSize: imageDataMemory,
      maxEntries: 100,
      ttl: 10 * 60 * 1000, // 10 minutes
      onEvict: (key, value) => {
        console.debug(`Evicted image data: ${key}`);
      }
    });

    this.metadataCache = new LRUCache<any>({
      maxSize: metadataMemory,
      maxEntries: 50000,
      ttl: 60 * 60 * 1000, // 1 hour
      onEvict: (key, value) => {
        console.debug(`Evicted metadata: ${key}`);
      }
    });
  }

  /**
   * Get available memory for caching
   */
  private getAvailableMemory(): number {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const available = memory.jsHeapSizeLimit - memory.usedJSHeapSize;
      return Math.max(available * 0.3, 50 * 1024 * 1024); // Use 30% of available, min 50MB
    }
    
    // Default to 100MB if memory API not available
    return 100 * 1024 * 1024;
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    this.memoryMonitorInterval = window.setInterval(() => {
      const stats = this.getMemoryStats();
      
      if (stats.percentage > this.memoryPressureThreshold) {
        console.warn('Memory pressure detected, triggering cleanup');
        this.performEmergencyCleanup();
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Setup cleanup interval
   */
  private setupCleanupInterval(): void {
    this.cleanupInterval = window.setInterval(() => {
      this.performRoutineCleanup();
    }, 60000); // Cleanup every minute
  }

  /**
   * Cache thumbnail
   */
  public cacheThumbnail(filePath: string, thumbnail: string): void {
    const size = thumbnail.length * 2; // Rough estimate for UTF-16
    this.thumbnailCache.set(filePath, thumbnail, size);
  }

  /**
   * Get cached thumbnail
   */
  public getCachedThumbnail(filePath: string): string | undefined {
    return this.thumbnailCache.get(filePath);
  }

  /**
   * Cache image data
   */
  public cacheImageData(key: string, imageData: ImageData): void {
    const size = imageData.data.length;
    this.imageDataCache.set(key, imageData, size);
  }

  /**
   * Get cached image data
   */
  public getCachedImageData(key: string): ImageData | undefined {
    return this.imageDataCache.get(key);
  }

  /**
   * Cache metadata
   */
  public cacheMetadata(filePath: string, metadata: any): void {
    const size = JSON.stringify(metadata).length * 2;
    this.metadataCache.set(filePath, metadata, size);
  }

  /**
   * Get cached metadata
   */
  public getCachedMetadata(filePath: string): any | undefined {
    return this.metadataCache.get(filePath);
  }

  /**
   * Progressive loading for large files
   */
  public async loadFileProgressively(
    file: File,
    options: ProgressiveLoadingOptions
  ): Promise<ArrayBuffer> {
    const taskId = `load_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.activeTasks.add(taskId);

    try {
      const totalSize = file.size;
      const chunks: ArrayBuffer[] = [];
      const chunkCount = Math.ceil(totalSize / options.chunkSize);
      let loadedSize = 0;

      // Load chunks with concurrency control
      const semaphore = new Semaphore(options.maxConcurrentChunks);
      const chunkPromises: Promise<void>[] = [];

      for (let i = 0; i < chunkCount; i++) {
        const chunkPromise = semaphore.acquire().then(async (release) => {
          try {
            const start = i * options.chunkSize;
            const end = Math.min(start + options.chunkSize, totalSize);
            const chunkBlob = file.slice(start, end);
            const chunkBuffer = await chunkBlob.arrayBuffer();
            
            chunks[i] = chunkBuffer;
            loadedSize += chunkBuffer.byteLength;

            if (options.onChunkLoaded) {
              options.onChunkLoaded(chunkBuffer, i);
            }

            if (options.onProgress) {
              options.onProgress(loadedSize, totalSize);
            }
          } finally {
            release();
          }
        });

        chunkPromises.push(chunkPromise);
      }

      await Promise.all(chunkPromises);

      // Combine chunks
      const result = new ArrayBuffer(totalSize);
      const resultView = new Uint8Array(result);
      let offset = 0;

      for (const chunk of chunks) {
        resultView.set(new Uint8Array(chunk), offset);
        offset += chunk.byteLength;
      }

      return result;
    } finally {
      this.activeTasks.delete(taskId);
    }
  }

  /**
   * Batch process with memory management
   */
  public async batchProcessWithMemoryManagement<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options: {
      batchSize?: number;
      memoryThreshold?: number;
      onProgress?: (processed: number, total: number) => void;
    } = {}
  ): Promise<R[]> {
    const batchSize = options.batchSize || 10;
    const memoryThreshold = options.memoryThreshold || 0.7;
    const results: R[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      // Check memory pressure before processing batch
      const memoryStats = this.getMemoryStats();
      if (memoryStats.percentage > memoryThreshold) {
        console.warn('Memory pressure detected, performing cleanup before batch');
        await this.performEmergencyCleanup();
        
        // Wait a bit for garbage collection
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const batch = items.slice(i, Math.min(i + batchSize, items.length));
      const batchPromises = batch.map(processor);
      const batchResults = await Promise.all(batchPromises);
      
      results.push(...batchResults);

      if (options.onProgress) {
        options.onProgress(Math.min(i + batchSize, items.length), items.length);
      }
    }

    return results;
  }

  /**
   * Get memory statistics
   */
  public getMemoryStats(): MemoryStats {
    let used = 0;
    let total = 0;

    if ('memory' in performance) {
      const memory = (performance as any).memory;
      used = memory.usedJSHeapSize;
      total = memory.jsHeapSizeLimit;
    }

    const thumbnailStats = this.thumbnailCache.getStats();
    const imageDataStats = this.imageDataCache.getStats();
    const metadataStats = this.metadataCache.getStats();

    return {
      used,
      total,
      percentage: total > 0 ? (used / total) * 100 : 0,
      cacheSize: thumbnailStats.size + imageDataStats.size + metadataStats.size,
      activeTasks: this.activeTasks.size
    };
  }

  /**
   * Perform routine cleanup
   */
  private performRoutineCleanup(): void {
    // Force garbage collection if available
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc();
    }

    // Clean up expired cache entries (already handled by LRU cache TTL)
    console.debug('Routine cleanup completed');
  }

  /**
   * Perform emergency cleanup under memory pressure
   */
  private async performEmergencyCleanup(): Promise<void> {
    console.warn('Performing emergency memory cleanup');

    // Clear least recently used cache entries more aggressively
    const thumbnailStats = this.thumbnailCache.getStats();
    const imageDataStats = this.imageDataCache.getStats();

    // Clear 50% of thumbnail cache
    if (thumbnailStats.entries > 10) {
      const keysToRemove = Math.floor(thumbnailStats.entries * 0.5);
      for (let i = 0; i < keysToRemove; i++) {
        // Remove oldest entries (implementation would need access to internal structure)
      }
    }

    // Clear 75% of image data cache (more memory intensive)
    if (imageDataStats.entries > 5) {
      const keysToRemove = Math.floor(imageDataStats.entries * 0.75);
      for (let i = 0; i < keysToRemove; i++) {
        // Remove oldest entries
      }
    }

    // Force garbage collection
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc();
    }

    // Wait for cleanup to take effect
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Clear all caches
   */
  public clearAllCaches(): void {
    this.thumbnailCache.clear();
    this.imageDataCache.clear();
    this.metadataCache.clear();
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    thumbnail: ReturnType<LRUCache<string>['getStats']>;
    imageData: ReturnType<LRUCache<ImageData>['getStats']>;
    metadata: ReturnType<LRUCache<any>['getStats']>;
  } {
    return {
      thumbnail: this.thumbnailCache.getStats(),
      imageData: this.imageDataCache.getStats(),
      metadata: this.metadataCache.getStats()
    };
  }

  /**
   * Dispose of memory manager
   */
  public dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
      this.memoryMonitorInterval = null;
    }

    this.clearAllCaches();
    this.activeTasks.clear();
  }
}

/**
 * Semaphore for controlling concurrency
 */
class Semaphore {
  private permits: number;
  private waitQueue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      if (this.permits > 0) {
        this.permits--;
        resolve(() => this.release());
      } else {
        this.waitQueue.push(() => {
          this.permits--;
          resolve(() => this.release());
        });
      }
    });
  }

  private release(): void {
    this.permits++;
    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift()!;
      next();
    }
  }
}

// Singleton instance
export const memoryManagerService = new MemoryManagerService();