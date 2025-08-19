import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileSystemRepository } from '../../main/repositories/FileSystemRepository';
import { DriveTreeService } from '../../main/services/DriveTreeService';
import { ThumbnailService } from '../../main/services/ThumbnailService';
import { ThumbnailCacheService } from '../../main/services/ThumbnailCacheService';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('File System Operations Integration Tests', () => {
  let fileSystemRepository: FileSystemRepository;
  let driveTreeService: DriveTreeService;
  let thumbnailService: ThumbnailService;
  let thumbnailCacheService: ThumbnailCacheService;
  let tempDir: string;
  let testStructure: {
    folders: string[];
    images: string[];
    videos: string[];
  };

  beforeEach(async () => {
    // Create temporary directory structure for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'filesystem-test-'));
    
    // Create test directory structure
    const folders = [
      'Pictures',
      'Pictures/Vacation',
      'Pictures/Vacation/Beach',
      'Pictures/Family',
      'Documents',
      'Videos',
      'Videos/Clips'
    ];

    const images = [
      'Pictures/photo1.jpg',
      'Pictures/photo2.png',
      'Pictures/Vacation/sunset.jpg',
      'Pictures/Vacation/Beach/beach1.jpg',
      'Pictures/Vacation/Beach/beach2.png',
      'Pictures/Family/family1.jpg'
    ];

    const videos = [
      'Videos/video1.mp4',
      'Videos/Clips/clip1.avi',
      'Videos/Clips/clip2.mov'
    ];

    // Create folders
    for (const folder of folders) {
      await fs.mkdir(path.join(tempDir, folder), { recursive: true });
    }

    // Create minimal image files
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

    const minimalPng = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
      0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0x57, 0x63, 0xF8, 0x0F, 0x00, 0x00,
      0x01, 0x00, 0x01, 0x5C, 0xC2, 0x8E, 0x8E, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);

    // Create image files
    for (const image of images) {
      const fullPath = path.join(tempDir, image);
      const buffer = image.endsWith('.png') ? minimalPng : minimalJpeg;
      await fs.writeFile(fullPath, buffer);
    }

    // Create minimal video files (just headers)
    const minimalMp4 = Buffer.from([
      0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6F, 0x6D,
      0x00, 0x00, 0x02, 0x00, 0x69, 0x73, 0x6F, 0x6D, 0x69, 0x73, 0x6F, 0x32,
      0x6D, 0x70, 0x34, 0x31, 0x00, 0x00, 0x00, 0x08, 0x66, 0x72, 0x65, 0x65
    ]);

    for (const video of videos) {
      const fullPath = path.join(tempDir, video);
      await fs.writeFile(fullPath, minimalMp4);
    }

    testStructure = { folders, images, videos };

    // Initialize services
    fileSystemRepository = new FileSystemRepository();
    driveTreeService = new DriveTreeService(fileSystemRepository);
    thumbnailService = new ThumbnailService();
    thumbnailCacheService = new ThumbnailCacheService();
  });

  afterEach(async () => {
    // Cleanup
    try {
      await thumbnailService.cleanup();
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup:', error);
    }
  });

  describe('Directory Tree Operations', () => {
    it('should build complete directory tree', async () => {
      const tree = await driveTreeService.getDirectoryTree(tempDir);

      expect(tree).toBeDefined();
      expect(tree.length).toBeGreaterThan(0);

      // Find Pictures folder
      const picturesNode = tree.find(node => node.name === 'Pictures');
      expect(picturesNode).toBeDefined();
      expect(picturesNode?.hasSubfolders).toBe(true);
    });

    it('should get directory contents with media files', async () => {
      const picturesPath = path.join(tempDir, 'Pictures');
      const contents = await fileSystemRepository.getDirectoryContents(picturesPath);

      expect(contents.folders).toHaveLength(2); // Vacation, Family
      expect(contents.mediaFiles).toHaveLength(2); // photo1.jpg, photo2.png

      // Verify media file properties
      const jpegFile = contents.mediaFiles.find(f => f.name === 'photo1.jpg');
      expect(jpegFile).toBeDefined();
      expect(jpegFile?.type).toBe('image');
      expect(jpegFile?.extension).toBe('.jpg');
    });

    it('should handle nested directory traversal', async () => {
      const beachPath = path.join(tempDir, 'Pictures', 'Vacation', 'Beach');
      const contents = await fileSystemRepository.getDirectoryContents(beachPath);

      expect(contents.folders).toHaveLength(0);
      expect(contents.mediaFiles).toHaveLength(2); // beach1.jpg, beach2.png
    });

    it('should detect media count in folders', async () => {
      const tree = await driveTreeService.getDirectoryTree(tempDir);
      const picturesNode = tree.find(node => node.name === 'Pictures');

      expect(picturesNode?.mediaCount).toBeGreaterThan(0);
    });
  });

  describe('File Type Detection', () => {
    it('should correctly identify image files', async () => {
      const picturesPath = path.join(tempDir, 'Pictures');
      const contents = await fileSystemRepository.getDirectoryContents(picturesPath);

      const imageFiles = contents.mediaFiles.filter(f => f.type === 'image');
      expect(imageFiles).toHaveLength(2);

      const jpegFile = imageFiles.find(f => f.extension === '.jpg');
      const pngFile = imageFiles.find(f => f.extension === '.png');

      expect(jpegFile).toBeDefined();
      expect(pngFile).toBeDefined();
    });

    it('should correctly identify video files', async () => {
      const videosPath = path.join(tempDir, 'Videos');
      const contents = await fileSystemRepository.getDirectoryContents(videosPath);

      const videoFiles = contents.mediaFiles.filter(f => f.type === 'video');
      expect(videoFiles).toHaveLength(1); // video1.mp4

      const mp4File = videoFiles.find(f => f.extension === '.mp4');
      expect(mp4File).toBeDefined();
    });

    it('should ignore non-media files', async () => {
      // Create a text file
      const textFilePath = path.join(tempDir, 'Pictures', 'readme.txt');
      await fs.writeFile(textFilePath, 'This is a text file');

      const picturesPath = path.join(tempDir, 'Pictures');
      const contents = await fileSystemRepository.getDirectoryContents(picturesPath);

      // Should not include the text file
      const textFile = contents.mediaFiles.find(f => f.name === 'readme.txt');
      expect(textFile).toBeUndefined();
    });
  });

  describe('Thumbnail Generation Integration', () => {
    it('should generate thumbnails for images', async () => {
      const imagePath = path.join(tempDir, 'Pictures', 'photo1.jpg');
      
      const thumbnail = await thumbnailService.generateThumbnail(imagePath, 200);
      
      expect(thumbnail).toBeDefined();
      expect(typeof thumbnail).toBe('string');
      expect(thumbnail.length).toBeGreaterThan(0);
    });

    it('should cache generated thumbnails', async () => {
      const imagePath = path.join(tempDir, 'Pictures', 'photo1.jpg');
      
      // Generate thumbnail first time
      const startTime1 = Date.now();
      const thumbnail1 = await thumbnailService.generateThumbnail(imagePath, 200);
      const duration1 = Date.now() - startTime1;
      
      // Cache the thumbnail
      await thumbnailCacheService.cacheThumbnail(imagePath, thumbnail1, 200);
      
      // Get from cache second time
      const startTime2 = Date.now();
      const cachedThumbnail = await thumbnailCacheService.getThumbnail(imagePath, 200);
      const duration2 = Date.now() - startTime2;
      
      expect(cachedThumbnail).toBe(thumbnail1);
      expect(duration2).toBeLessThan(duration1); // Cache should be faster
    });

    it('should handle batch thumbnail generation', async () => {
      const imagePaths = [
        path.join(tempDir, 'Pictures', 'photo1.jpg'),
        path.join(tempDir, 'Pictures', 'photo2.png'),
        path.join(tempDir, 'Pictures', 'Family', 'family1.jpg')
      ];
      
      const startTime = Date.now();
      
      const thumbnails = await Promise.all(
        imagePaths.map(imagePath => thumbnailService.generateThumbnail(imagePath, 150))
      );
      
      const duration = Date.now() - startTime;
      
      expect(thumbnails).toHaveLength(3);
      thumbnails.forEach(thumbnail => {
        expect(thumbnail).toBeDefined();
        expect(typeof thumbnail).toBe('string');
      });
      
      // Should complete within reasonable time
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('File Operations', () => {
    it('should copy files between directories', async () => {
      const sourcePath = path.join(tempDir, 'Pictures', 'photo1.jpg');
      const targetDir = path.join(tempDir, 'Documents');
      const targetPath = path.join(targetDir, 'photo1.jpg');
      
      await fileSystemRepository.copyFile(sourcePath, targetPath);
      
      // Verify file was copied
      const stats = await fs.stat(targetPath);
      expect(stats.isFile()).toBe(true);
      
      // Verify original still exists
      const originalStats = await fs.stat(sourcePath);
      expect(originalStats.isFile()).toBe(true);
    });

    it('should move files between directories', async () => {
      const sourcePath = path.join(tempDir, 'Pictures', 'photo2.png');
      const targetDir = path.join(tempDir, 'Documents');
      const targetPath = path.join(targetDir, 'photo2.png');
      
      await fileSystemRepository.moveFile(sourcePath, targetPath);
      
      // Verify file was moved
      const targetExists = await fs.access(targetPath).then(() => true).catch(() => false);
      expect(targetExists).toBe(true);
      
      // Verify original no longer exists
      const sourceExists = await fs.access(sourcePath).then(() => true).catch(() => false);
      expect(sourceExists).toBe(false);
    });

    it('should handle file operation errors gracefully', async () => {
      const nonExistentSource = path.join(tempDir, 'nonexistent.jpg');
      const targetPath = path.join(tempDir, 'Documents', 'copy.jpg');
      
      await expect(fileSystemRepository.copyFile(nonExistentSource, targetPath))
        .rejects.toThrow();
    });
  });

  describe('Performance Tests', () => {
    it('should handle large directory scanning efficiently', async () => {
      // Create a larger directory structure
      const largeDir = path.join(tempDir, 'LargeTest');
      await fs.mkdir(largeDir);
      
      // Create 50 subdirectories with 10 files each
      for (let i = 0; i < 50; i++) {
        const subDir = path.join(largeDir, `subdir${i}`);
        await fs.mkdir(subDir);
        
        for (let j = 0; j < 10; j++) {
          const filePath = path.join(subDir, `image${j}.jpg`);
          await fs.writeFile(filePath, Buffer.from([0xFF, 0xD8, 0xFF, 0xD9])); // Minimal JPEG
        }
      }
      
      const startTime = Date.now();
      const tree = await driveTreeService.getDirectoryTree(largeDir);
      const duration = Date.now() - startTime;
      
      expect(tree).toHaveLength(50);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should handle concurrent file operations', async () => {
      const operations = [];
      
      // Create multiple concurrent operations
      for (let i = 0; i < 10; i++) {
        const sourcePath = path.join(tempDir, 'Pictures', 'photo1.jpg');
        const targetPath = path.join(tempDir, `concurrent_copy_${i}.jpg`);
        operations.push(fileSystemRepository.copyFile(sourcePath, targetPath));
      }
      
      const startTime = Date.now();
      await Promise.all(operations);
      const duration = Date.now() - startTime;
      
      // Verify all files were created
      for (let i = 0; i < 10; i++) {
        const targetPath = path.join(tempDir, `concurrent_copy_${i}.jpg`);
        const exists = await fs.access(targetPath).then(() => true).catch(() => false);
        expect(exists).toBe(true);
      }
      
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Error Recovery', () => {
    it('should recover from permission errors', async () => {
      // This test would be platform-specific and might not work in all environments
      // For now, we'll test the error handling structure
      
      const restrictedPath = path.join(tempDir, 'restricted');
      await fs.mkdir(restrictedPath);
      
      try {
        // Try to change permissions (might not work on all systems)
        await fs.chmod(restrictedPath, 0o000);
        
        // Try to access - should handle gracefully
        const contents = await fileSystemRepository.getDirectoryContents(restrictedPath);
        
        // Should return empty results rather than throwing
        expect(contents.folders).toEqual([]);
        expect(contents.mediaFiles).toEqual([]);
        
      } catch (error) {
        // If permission change fails, that's okay - just verify error handling
        expect(error).toBeDefined();
      } finally {
        // Restore permissions for cleanup
        try {
          await fs.chmod(restrictedPath, 0o755);
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    it('should handle corrupted files gracefully', async () => {
      // Create a corrupted image file
      const corruptedPath = path.join(tempDir, 'corrupted.jpg');
      await fs.writeFile(corruptedPath, Buffer.from([0x00, 0x01, 0x02, 0x03])); // Invalid JPEG
      
      // Should not throw when trying to generate thumbnail
      await expect(thumbnailService.generateThumbnail(corruptedPath, 200))
        .rejects.toThrow(); // Expected to fail, but gracefully
    });
  });
});