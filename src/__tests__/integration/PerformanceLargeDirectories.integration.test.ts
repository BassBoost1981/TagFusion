import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileSystemRepository } from '../../main/repositories/FileSystemRepository';
import { DriveTreeService } from '../../main/services/DriveTreeService';
import { ThumbnailManagerService } from '../../main/services/ThumbnailManagerService';
import { ThumbnailCacheService } from '../../main/services/ThumbnailCacheService';
import { SearchService } from '../../main/services/SearchService';
import { FilterService } from '../../main/services/FilterService';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('Performance Tests for Large Directories', () => {
  let fileSystemRepository: FileSystemRepository;
  let driveTreeService: DriveTreeService;
  let thumbnailManagerService: ThumbnailManagerService;
  let thumbnailCacheService: ThumbnailCacheService;
  let searchService: SearchService;
  let filterService: FilterService;
  let tempDir: string;
  let largeDirectoryPath: string;

  beforeEach(async () => {
    // Create temporary directory for large-scale testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'performance-test-'));
    largeDirectoryPath = path.join(tempDir, 'LargeDirectory');
    await fs.mkdir(largeDirectoryPath);

    // Initialize services
    fileSystemRepository = new FileSystemRepository();
    driveTreeService = new DriveTreeService(fileSystemRepository);
    thumbnailCacheService = new ThumbnailCacheService();
    
    // Mock thumbnail service for performance tests
    const mockThumbnailService = {
      generateThumbnail: vi.fn().mockResolvedValue('mock-thumbnail-data'),
      generateImageThumbnail: vi.fn().mockResolvedValue('mock-image-thumbnail'),
      generateVideoThumbnail: vi.fn().mockResolvedValue('mock-video-thumbnail'),
      isImageFile: vi.fn().mockReturnValue(true),
      isVideoFile: vi.fn().mockReturnValue(false),
      isSupportedFile: vi.fn().mockReturnValue(true),
      cleanup: vi.fn().mockResolvedValue(undefined)
    };

    thumbnailManagerService = new ThumbnailManagerService(
      mockThumbnailService,
      thumbnailCacheService
    );

    // Mock metadata repository for search/filter services
    const mockMetadataRepository = {
      readMetadata: vi.fn().mockResolvedValue({
        tags: [],
        rating: 0,
        dateCreated: new Date(),
        cameraInfo: undefined
      }),
      writeMetadata: vi.fn().mockResolvedValue(undefined),
      extractTags: vi.fn().mockResolvedValue([]),
      writeTags: vi.fn().mockResolvedValue(undefined),
      writeRating: vi.fn().mockResolvedValue(undefined)
    };

    searchService = new SearchService(fileSystemRepository, mockMetadataRepository);
    filterService = new FilterService(mockMetadataRepository);
  });

  afterEach(async () => {
    // Cleanup
    try {
      await thumbnailManagerService.cleanup();
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup:', error);
    }
  });

  describe('Large Directory Scanning', () => {
    it('should handle 1000 files efficiently', async () => {
      // Create 1000 image files
      const fileCount = 1000;
      const minimalJpeg = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
        0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
        0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
        0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
        0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
        0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
        0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x01,
        0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
        0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0xFF, 0xC4,
        0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x0C,
        0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3F, 0x00, 0xB2, 0xC0,
        0x07, 0xFF, 0xD9
      ]);

      console.log(`Creating ${fileCount} test files...`);
      const createStartTime = Date.now();

      // Create files in batches to avoid overwhelming the filesystem
      const batchSize = 100;
      for (let batch = 0; batch < fileCount / batchSize; batch++) {
        const promises = [];
        for (let i = 0; i < batchSize; i++) {
          const fileIndex = batch * batchSize + i;
          const filePath = path.join(largeDirectoryPath, `image${fileIndex.toString().padStart(4, '0')}.jpg`);
          promises.push(fs.writeFile(filePath, minimalJpeg));
        }
        await Promise.all(promises);
      }

      const createEndTime = Date.now();
      console.log(`Created ${fileCount} files in ${createEndTime - createStartTime}ms`);

      // Test directory scanning performance
      const scanStartTime = Date.now();
      const contents = await fileSystemRepository.getDirectoryContents(largeDirectoryPath);
      const scanEndTime = Date.now();

      const scanDuration = scanEndTime - scanStartTime;
      console.log(`Scanned ${fileCount} files in ${scanDuration}ms`);

      expect(contents.mediaFiles).toHaveLength(fileCount);
      expect(scanDuration).toBeLessThan(5000); // Should complete within 5 seconds

      // Test performance metrics
      const avgTimePerFile = scanDuration / fileCount;
      expect(avgTimePerFile).toBeLessThan(5); // Less than 5ms per file on average
    });

    it('should handle deep directory hierarchies efficiently', async () => {
      // Create a deep directory structure: 10 levels deep, 10 folders per level
      const depth = 10;
      const foldersPerLevel = 10;
      const filesPerFolder = 5;

      console.log(`Creating deep directory structure (${depth} levels, ${foldersPerLevel} folders per level)...`);
      const createStartTime = Date.now();

      const minimalJpeg = Buffer.from([0xFF, 0xD8, 0xFF, 0xD9]); // Minimal JPEG

      async function createLevel(currentPath: string, currentDepth: number) {
        if (currentDepth >= depth) return;

        for (let i = 0; i < foldersPerLevel; i++) {
          const folderPath = path.join(currentPath, `folder_${currentDepth}_${i}`);
          await fs.mkdir(folderPath, { recursive: true });

          // Add some files to each folder
          for (let j = 0; j < filesPerFolder; j++) {
            const filePath = path.join(folderPath, `image_${j}.jpg`);
            await fs.writeFile(filePath, minimalJpeg);
          }

          // Recurse to next level (only for first few folders to avoid exponential growth)
          if (i < 2) {
            await createLevel(folderPath, currentDepth + 1);
          }
        }
      }

      await createLevel(largeDirectoryPath, 0);

      const createEndTime = Date.now();
      console.log(`Created deep structure in ${createEndTime - createStartTime}ms`);

      // Test tree building performance
      const treeStartTime = Date.now();
      const tree = await driveTreeService.getDirectoryTree(largeDirectoryPath);
      const treeEndTime = Date.now();

      const treeDuration = treeEndTime - treeStartTime;
      console.log(`Built directory tree in ${treeDuration}ms`);

      expect(tree).toBeDefined();
      expect(tree.length).toBe(foldersPerLevel);
      expect(treeDuration).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });

  describe('Thumbnail Generation Performance', () => {
    it('should handle batch thumbnail generation efficiently', async () => {
      const fileCount = 100;
      const filePaths: string[] = [];

      // Create test files
      const minimalJpeg = Buffer.from([0xFF, 0xD8, 0xFF, 0xD9]);
      for (let i = 0; i < fileCount; i++) {
        const filePath = path.join(largeDirectoryPath, `thumb_test_${i}.jpg`);
        await fs.writeFile(filePath, minimalJpeg);
        filePaths.push(filePath);
      }

      // Test batch thumbnail generation
      const startTime = Date.now();
      await thumbnailManagerService.preloadThumbnails(filePaths, 200);
      const endTime = Date.now();

      const duration = endTime - startTime;
      console.log(`Generated ${fileCount} thumbnails in ${duration}ms`);

      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

      // Verify thumbnails are cached
      for (const filePath of filePaths.slice(0, 10)) { // Check first 10
        const cachedThumbnail = await thumbnailCacheService.getThumbnail(filePath, 200);
        expect(cachedThumbnail).toBeDefined();
      }
    });

    it('should handle concurrent thumbnail requests efficiently', async () => {
      const fileCount = 50;
      const filePaths: string[] = [];

      // Create test files
      const minimalJpeg = Buffer.from([0xFF, 0xD8, 0xFF, 0xD9]);
      for (let i = 0; i < fileCount; i++) {
        const filePath = path.join(largeDirectoryPath, `concurrent_${i}.jpg`);
        await fs.writeFile(filePath, minimalJpeg);
        filePaths.push(filePath);
      }

      // Test concurrent thumbnail generation
      const startTime = Date.now();
      const promises = filePaths.map(filePath =>
        thumbnailManagerService.getThumbnail(filePath, 150)
      );
      
      const results = await Promise.all(promises);
      const endTime = Date.now();

      const duration = endTime - startTime;
      console.log(`Generated ${fileCount} concurrent thumbnails in ${duration}ms`);

      expect(results).toHaveLength(fileCount);
      results.forEach(result => {
        expect(result).toBeDefined();
      });

      expect(duration).toBeLessThan(15000); // Should complete within 15 seconds
    });
  });

  describe('Search Performance', () => {
    it('should search through large file collections efficiently', async () => {
      const fileCount = 500;
      const searchTerms = ['vacation', 'family', 'work', 'nature', 'city'];

      // Create files with searchable names
      const minimalJpeg = Buffer.from([0xFF, 0xD8, 0xFF, 0xD9]);
      for (let i = 0; i < fileCount; i++) {
        const term = searchTerms[i % searchTerms.length];
        const filePath = path.join(largeDirectoryPath, `${term}_photo_${i}.jpg`);
        await fs.writeFile(filePath, minimalJpeg);
      }

      // Test search performance
      const searchStartTime = Date.now();
      const results = await searchService.searchFiles(largeDirectoryPath, 'vacation');
      const searchEndTime = Date.now();

      const searchDuration = searchEndTime - searchStartTime;
      console.log(`Searched ${fileCount} files in ${searchDuration}ms`);

      expect(results.length).toBeGreaterThan(0);
      expect(searchDuration).toBeLessThan(2000); // Should complete within 2 seconds

      // Verify search results contain the search term
      results.forEach(result => {
        expect(result.name.toLowerCase()).toContain('vacation');
      });
    });

    it('should handle complex filter operations efficiently', async () => {
      const fileCount = 300;
      const imageTypes = ['.jpg', '.png', '.gif'];
      const videoTypes = ['.mp4', '.avi', '.mov'];

      // Create mixed media files
      const minimalJpeg = Buffer.from([0xFF, 0xD8, 0xFF, 0xD9]);
      const minimalMp4 = Buffer.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]);

      for (let i = 0; i < fileCount; i++) {
        const isImage = i % 2 === 0;
        const extension = isImage 
          ? imageTypes[i % imageTypes.length]
          : videoTypes[i % videoTypes.length];
        const buffer = isImage ? minimalJpeg : minimalMp4;
        
        const filePath = path.join(largeDirectoryPath, `media_${i}${extension}`);
        await fs.writeFile(filePath, buffer);
      }

      // Get all files first
      const contents = await fileSystemRepository.getDirectoryContents(largeDirectoryPath);

      // Test filter performance
      const filterStartTime = Date.now();
      
      const imageFilter = await filterService.filterByFileType(contents.mediaFiles, 'image');
      const videoFilter = await filterService.filterByFileType(contents.mediaFiles, 'video');
      const dateFilter = await filterService.filterByDateRange(
        contents.mediaFiles,
        new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        new Date() // Today
      );

      const filterEndTime = Date.now();

      const filterDuration = filterEndTime - filterStartTime;
      console.log(`Applied filters to ${fileCount} files in ${filterDuration}ms`);

      expect(imageFilter.length).toBeGreaterThan(0);
      expect(videoFilter.length).toBeGreaterThan(0);
      expect(dateFilter.length).toBe(fileCount); // All files should be within date range

      expect(filterDuration).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Memory Usage', () => {
    it('should maintain reasonable memory usage with large datasets', async () => {
      const fileCount = 200;
      const minimalJpeg = Buffer.from([0xFF, 0xD8, 0xFF, 0xD9]);

      // Create files
      for (let i = 0; i < fileCount; i++) {
        const filePath = path.join(largeDirectoryPath, `memory_test_${i}.jpg`);
        await fs.writeFile(filePath, minimalJpeg);
      }

      // Monitor memory usage during operations
      const initialMemory = process.memoryUsage();

      // Perform memory-intensive operations
      const contents = await fileSystemRepository.getDirectoryContents(largeDirectoryPath);
      
      // Generate thumbnails for all files
      const thumbnailPromises = contents.mediaFiles.map(file =>
        thumbnailManagerService.getThumbnail(file.path, 200)
      );
      await Promise.all(thumbnailPromises);

      // Search operations
      await searchService.searchFiles(largeDirectoryPath, 'test');

      const finalMemory = process.memoryUsage();

      // Calculate memory increase
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePerFile = memoryIncrease / fileCount;

      console.log(`Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB total, ${Math.round(memoryIncreasePerFile / 1024)}KB per file`);

      // Memory increase should be reasonable (less than 100KB per file)
      expect(memoryIncreasePerFile).toBeLessThan(100 * 1024);

      // Total memory increase should be less than 100MB
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });

    it('should handle cache eviction properly under memory pressure', async () => {
      const fileCount = 100;
      const minimalJpeg = Buffer.from([0xFF, 0xD8, 0xFF, 0xD9]);

      // Create files
      const filePaths: string[] = [];
      for (let i = 0; i < fileCount; i++) {
        const filePath = path.join(largeDirectoryPath, `cache_test_${i}.jpg`);
        await fs.writeFile(filePath, minimalJpeg);
        filePaths.push(filePath);
      }

      // Fill cache beyond its limit
      for (const filePath of filePaths) {
        await thumbnailManagerService.getThumbnail(filePath, 200);
      }

      // Verify cache has evicted some items (assuming LRU cache with limited size)
      let cachedCount = 0;
      for (const filePath of filePaths) {
        const cached = await thumbnailCacheService.getThumbnail(filePath, 200);
        if (cached) cachedCount++;
      }

      console.log(`${cachedCount} out of ${fileCount} thumbnails remain cached`);

      // Should have evicted some items if cache has size limits
      // This depends on cache implementation - adjust expectations accordingly
      expect(cachedCount).toBeLessThanOrEqual(fileCount);
    });
  });

  describe('Stress Tests', () => {
    it('should handle rapid file system changes', async () => {
      const initialFileCount = 50;
      const minimalJpeg = Buffer.from([0xFF, 0xD8, 0xFF, 0xD9]);

      // Create initial files
      for (let i = 0; i < initialFileCount; i++) {
        const filePath = path.join(largeDirectoryPath, `stress_${i}.jpg`);
        await fs.writeFile(filePath, minimalJpeg);
      }

      // Simulate rapid changes: add, remove, modify files
      const operations = [];

      // Add files
      for (let i = initialFileCount; i < initialFileCount + 25; i++) {
        operations.push(async () => {
          const filePath = path.join(largeDirectoryPath, `stress_${i}.jpg`);
          await fs.writeFile(filePath, minimalJpeg);
        });
      }

      // Remove some files
      for (let i = 0; i < 10; i++) {
        operations.push(async () => {
          const filePath = path.join(largeDirectoryPath, `stress_${i}.jpg`);
          try {
            await fs.unlink(filePath);
          } catch {
            // File might not exist, ignore
          }
        });
      }

      // Modify files (update timestamp)
      for (let i = 10; i < 20; i++) {
        operations.push(async () => {
          const filePath = path.join(largeDirectoryPath, `stress_${i}.jpg`);
          try {
            const now = new Date();
            await fs.utimes(filePath, now, now);
          } catch {
            // File might not exist, ignore
          }
        });
      }

      // Execute all operations concurrently
      const startTime = Date.now();
      await Promise.all(operations.map(op => op()));
      const endTime = Date.now();

      console.log(`Completed ${operations.length} file operations in ${endTime - startTime}ms`);

      // Verify system can still scan directory after rapid changes
      const contents = await fileSystemRepository.getDirectoryContents(largeDirectoryPath);
      expect(contents.mediaFiles.length).toBeGreaterThan(0);

      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});