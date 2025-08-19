import { IThumbnailService, ThumbnailService } from './ThumbnailService';
import { IThumbnailCacheService, ThumbnailCacheService, CacheStats } from './ThumbnailCacheService';
import { MediaFile, ThumbnailOptions, VideoThumbnailOptions } from '../../types/global';

export interface IThumbnailManagerService {
  getThumbnail(filePath: string, options?: ThumbnailOptions): Promise<string>;
  getThumbnailBatch(files: MediaFile[], options?: ThumbnailOptions): Promise<Map<string, string>>;
  preloadThumbnails(files: MediaFile[], options?: ThumbnailOptions): Promise<void>;
  invalidateCache(filePath: string): Promise<boolean>;
  clearCache(): void;
  getCacheStats(): CacheStats;
  dispose(): Promise<void>;
}

export class ThumbnailManagerService implements IThumbnailManagerService {
  private thumbnailService: IThumbnailService;
  private cacheService: IThumbnailCacheService;
  private readonly defaultOptions: ThumbnailOptions = {
    width: 200,
    height: 200,
    quality: 80,
    format: 'jpeg'
  };

  constructor(
    thumbnailService?: IThumbnailService,
    cacheService?: IThumbnailCacheService
  ) {
    this.thumbnailService = thumbnailService || new ThumbnailService();
    this.cacheService = cacheService || new ThumbnailCacheService();
  }

  public async getThumbnail(filePath: string, options?: ThumbnailOptions): Promise<string> {
    const finalOptions = { ...this.defaultOptions, ...options };
    const cacheKey = this.generateCacheKey(filePath, finalOptions);
    
    // Try to get from cache first
    const cachedThumbnail = await this.cacheService.get(cacheKey);
    if (cachedThumbnail) {
      return cachedThumbnail;
    }
    
    // Generate new thumbnail
    const thumbnail = await this.thumbnailService.generateThumbnail(filePath, finalOptions);
    
    // Cache the result
    await this.cacheService.set(cacheKey, thumbnail);
    
    return thumbnail;
  }

  public async getThumbnailBatch(files: MediaFile[], options?: ThumbnailOptions): Promise<Map<string, string>> {
    const finalOptions = { ...this.defaultOptions, ...options };
    const results = new Map<string, string>();
    const filesToGenerate: MediaFile[] = [];
    
    // Check cache for existing thumbnails
    for (const file of files) {
      const cacheKey = this.generateCacheKey(file.path, finalOptions);
      const cachedThumbnail = await this.cacheService.get(cacheKey);
      
      if (cachedThumbnail) {
        results.set(file.path, cachedThumbnail);
      } else {
        filesToGenerate.push(file);
      }
    }
    
    // Generate thumbnails for files not in cache
    if (filesToGenerate.length > 0) {
      const generatedThumbnails = await this.thumbnailService.generateThumbnailBatch(
        filesToGenerate,
        finalOptions
      );
      
      // Cache the generated thumbnails and add to results
      for (const [filePath, thumbnail] of generatedThumbnails) {
        const cacheKey = this.generateCacheKey(filePath, finalOptions);
        await this.cacheService.set(cacheKey, thumbnail);
        results.set(filePath, thumbnail);
      }
    }
    
    return results;
  }

  public async preloadThumbnails(files: MediaFile[], options?: ThumbnailOptions): Promise<void> {
    const finalOptions = { ...this.defaultOptions, ...options };
    const filesToPreload: MediaFile[] = [];
    
    // Filter out files that are already cached
    for (const file of files) {
      const cacheKey = this.generateCacheKey(file.path, finalOptions);
      if (!this.cacheService.has(cacheKey)) {
        filesToPreload.push(file);
      }
    }
    
    if (filesToPreload.length === 0) {
      return; // All thumbnails already cached
    }
    
    // Generate thumbnails in background
    try {
      const thumbnails = await this.thumbnailService.generateThumbnailBatch(
        filesToPreload,
        finalOptions
      );
      
      // Cache all generated thumbnails
      const cachePromises = Array.from(thumbnails.entries()).map(([filePath, thumbnail]) => {
        const cacheKey = this.generateCacheKey(filePath, finalOptions);
        return this.cacheService.set(cacheKey, thumbnail);
      });
      
      await Promise.all(cachePromises);
      
      console.log(`Preloaded ${thumbnails.size} thumbnails`);
    } catch (error) {
      console.error('Failed to preload thumbnails:', error);
    }
  }

  public async invalidateCache(filePath: string): Promise<boolean> {
    // Invalidate all cached versions of this file (different sizes/options)
    let invalidated = false;
    const cacheStats = this.cacheService.getStats();
    
    // Since we can't iterate over cache keys directly, we'll use the file path pattern
    // This is a simplified approach - in a real implementation, you might want to
    // maintain a reverse index of file paths to cache keys
    const commonOptions = [
      { width: 200, height: 200 },
      { width: 150, height: 150 },
      { width: 100, height: 100 },
      { width: 300, height: 300 }
    ];
    
    for (const options of commonOptions) {
      const cacheKey = this.generateCacheKey(filePath, { ...this.defaultOptions, ...options });
      if (this.cacheService.delete(cacheKey)) {
        invalidated = true;
      }
    }
    
    return invalidated;
  }

  public clearCache(): void {
    this.cacheService.clear();
  }

  public getCacheStats(): CacheStats {
    return this.cacheService.getStats();
  }

  public async dispose(): Promise<void> {
    await this.thumbnailService.dispose();
    this.cacheService.dispose();
  }

  private generateCacheKey(filePath: string, options: ThumbnailOptions): string {
    // Create a unique cache key based on file path and options
    const optionsString = `${options.width}x${options.height}_q${options.quality}_${options.format}`;
    return `${filePath}|${optionsString}`;
  }

  // Utility methods for checking file types
  public isImageFile(filePath: string): boolean {
    return this.thumbnailService.isImageFile(filePath);
  }

  public isVideoFile(filePath: string): boolean {
    return this.thumbnailService.isVideoFile(filePath);
  }

  public isSupportedFile(filePath: string): boolean {
    return this.isImageFile(filePath) || this.isVideoFile(filePath);
  }
}