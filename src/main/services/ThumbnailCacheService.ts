import * as fs from 'fs/promises';
import * as path from 'path';
import { ThumbnailCache } from '../../types/global';

export interface IThumbnailCacheService {
  get(filePath: string): Promise<string | null>;
  set(filePath: string, thumbnailData: string): Promise<void>;
  has(filePath: string): boolean;
  delete(filePath: string): boolean;
  clear(): void;
  invalidate(filePath: string): Promise<boolean>;
  getStats(): CacheStats;
  cleanup(): Promise<void>;
}

export interface CacheStats {
  size: number;
  maxSize: number;
  hitRate: number;
  memoryUsage: number; // in bytes
}

interface CacheNode {
  key: string;
  value: ThumbnailCache;
  prev: CacheNode | null;
  next: CacheNode | null;
}

export class ThumbnailCacheService implements IThumbnailCacheService {
  private cache = new Map<string, CacheNode>();
  private head: CacheNode | null = null;
  private tail: CacheNode | null = null;
  private readonly maxSize: number;
  private readonly maxMemoryMB: number;
  private currentMemoryUsage = 0;
  private hits = 0;
  private misses = 0;
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor(maxSize = 1000, maxMemoryMB = 100) {
    this.maxSize = maxSize;
    this.maxMemoryMB = maxMemoryMB;
    
    // Initialize doubly linked list
    this.head = { key: '', value: {} as ThumbnailCache, prev: null, next: null };
    this.tail = { key: '', value: {} as ThumbnailCache, prev: null, next: null };
    this.head.next = this.tail;
    this.tail.prev = this.head;
    
    // Start periodic cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  public async get(filePath: string): Promise<string | null> {
    const node = this.cache.get(filePath);
    
    if (!node) {
      this.misses++;
      return null;
    }
    
    // Check if file has been modified since cache
    try {
      const stats = await fs.stat(filePath);
      if (stats.mtime > node.value.dateModified) {
        // File has been modified, invalidate cache entry
        this.delete(filePath);
        this.misses++;
        return null;
      }
    } catch (error) {
      // File doesn't exist anymore, remove from cache
      this.delete(filePath);
      this.misses++;
      return null;
    }
    
    // Move to front (most recently used)
    this.moveToFront(node);
    this.hits++;
    
    return node.value.thumbnailData;
  }

  public async set(filePath: string, thumbnailData: string): Promise<void> {
    try {
      const stats = await fs.stat(filePath);
      const thumbnailSize = this.estimateDataSize(thumbnailData);
      
      // Check if adding this would exceed memory limit
      if (this.currentMemoryUsage + thumbnailSize > this.maxMemoryMB * 1024 * 1024) {
        await this.evictToFitMemory(thumbnailSize);
      }
      
      const existingNode = this.cache.get(filePath);
      
      if (existingNode) {
        // Update existing entry
        const oldSize = this.estimateDataSize(existingNode.value.thumbnailData);
        existingNode.value = {
          filePath,
          thumbnailData,
          fileSize: stats.size,
          dateModified: stats.mtime,
          cacheDate: new Date()
        };
        this.currentMemoryUsage = this.currentMemoryUsage - oldSize + thumbnailSize;
        this.moveToFront(existingNode);
      } else {
        // Create new entry
        const cacheEntry: ThumbnailCache = {
          filePath,
          thumbnailData,
          fileSize: stats.size,
          dateModified: stats.mtime,
          cacheDate: new Date()
        };
        
        const newNode: CacheNode = {
          key: filePath,
          value: cacheEntry,
          prev: null,
          next: null
        };
        
        this.cache.set(filePath, newNode);
        this.addToFront(newNode);
        this.currentMemoryUsage += thumbnailSize;
        
        // Check if we need to evict due to size limit
        if (this.cache.size > this.maxSize) {
          this.evictLRU();
        }
      }
    } catch (error) {
      console.error(`Failed to cache thumbnail for ${filePath}:`, error);
    }
  }

  public has(filePath: string): boolean {
    return this.cache.has(filePath);
  }

  public delete(filePath: string): boolean {
    const node = this.cache.get(filePath);
    if (!node) return false;
    
    this.removeNode(node);
    this.cache.delete(filePath);
    this.currentMemoryUsage -= this.estimateDataSize(node.value.thumbnailData);
    
    return true;
  }

  public clear(): void {
    this.cache.clear();
    this.currentMemoryUsage = 0;
    this.hits = 0;
    this.misses = 0;
    
    // Reset linked list
    if (this.head && this.tail) {
      this.head.next = this.tail;
      this.tail.prev = this.head;
    }
  }

  public async invalidate(filePath: string): Promise<boolean> {
    const node = this.cache.get(filePath);
    if (!node) return false;
    
    try {
      const stats = await fs.stat(filePath);
      if (stats.mtime > node.value.dateModified) {
        return this.delete(filePath);
      }
    } catch (error) {
      // File doesn't exist, remove from cache
      return this.delete(filePath);
    }
    
    return false;
  }

  public getStats(): CacheStats {
    const totalRequests = this.hits + this.misses;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: totalRequests > 0 ? this.hits / totalRequests : 0,
      memoryUsage: this.currentMemoryUsage
    };
  }

  public async cleanup(): Promise<void> {
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const filesToCheck: string[] = [];
    
    // Collect files to check (avoid modifying cache during iteration)
    for (const [filePath, node] of this.cache) {
      const age = now.getTime() - node.value.cacheDate.getTime();
      if (age > maxAge) {
        filesToCheck.push(filePath);
      }
    }
    
    // Check and invalidate old entries
    for (const filePath of filesToCheck) {
      await this.invalidate(filePath);
    }
    
    console.log(`Cache cleanup completed. Removed ${filesToCheck.length} old entries.`);
  }

  private moveToFront(node: CacheNode): void {
    this.removeNode(node);
    this.addToFront(node);
  }

  private addToFront(node: CacheNode): void {
    if (!this.head) return;
    
    node.prev = this.head;
    node.next = this.head.next;
    
    if (this.head.next) {
      this.head.next.prev = node;
    }
    this.head.next = node;
  }

  private removeNode(node: CacheNode): void {
    if (node.prev) {
      node.prev.next = node.next;
    }
    if (node.next) {
      node.next.prev = node.prev;
    }
  }

  private evictLRU(): void {
    if (!this.tail || !this.tail.prev || this.tail.prev === this.head) return;
    
    const lru = this.tail.prev;
    this.removeNode(lru);
    this.cache.delete(lru.key);
    this.currentMemoryUsage -= this.estimateDataSize(lru.value.thumbnailData);
  }

  private async evictToFitMemory(requiredSize: number): Promise<void> {
    const maxMemoryBytes = this.maxMemoryMB * 1024 * 1024;
    const targetMemory = maxMemoryBytes * 0.8; // Keep 20% buffer
    
    while (this.currentMemoryUsage + requiredSize > targetMemory && this.cache.size > 0) {
      this.evictLRU();
    }
  }

  private estimateDataSize(base64Data: string): number {
    // Base64 encoding adds ~33% overhead, so actual data is ~75% of string length
    return Math.ceil(base64Data.length * 0.75);
  }

  public dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}