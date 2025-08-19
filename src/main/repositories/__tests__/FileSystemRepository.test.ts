import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileSystemRepository } from '../FileSystemRepository';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('FileSystemRepository', () => {
  let repository: FileSystemRepository;
  let testDir: string;

  beforeEach(async () => {
    repository = new FileSystemRepository();
    testDir = join(tmpdir(), 'file-system-repo-test-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rmdir(testDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('getDrives', () => {
    it('should return available drives', async () => {
      const drives = await repository.getDrives();
      expect(drives).toBeDefined();
      expect(Array.isArray(drives)).toBe(true);
      
      if (drives.length > 0) {
        const drive = drives[0];
        expect(drive).toHaveProperty('letter');
        expect(drive).toHaveProperty('label');
        expect(drive).toHaveProperty('path');
        expect(drive).toHaveProperty('type');
        expect(drive).toHaveProperty('available');
      }
    });
  });

  describe('getDirectoryContents', () => {
    it('should return directory contents', async () => {
      // Create test files
      const imageFile = join(testDir, 'test.jpg');
      const videoFile = join(testDir, 'test.mp4');
      const textFile = join(testDir, 'test.txt');
      const subDir = join(testDir, 'subdir');

      await fs.writeFile(imageFile, 'fake image data');
      await fs.writeFile(videoFile, 'fake video data');
      await fs.writeFile(textFile, 'text data');
      await fs.mkdir(subDir);

      const contents = await repository.getDirectoryContents(testDir);

      expect(contents).toBeDefined();
      expect(contents.path).toBe(testDir);
      expect(contents.folders).toHaveLength(1);
      expect(contents.mediaFiles).toHaveLength(2); // Only image and video files
      
      const folder = contents.folders[0];
      expect(folder.name).toBe('subdir');
      expect(folder.path).toBe(subDir);

      const mediaFiles = contents.mediaFiles;
      expect(mediaFiles.some(f => f.name === 'test.jpg')).toBe(true);
      expect(mediaFiles.some(f => f.name === 'test.mp4')).toBe(true);
      expect(mediaFiles.some(f => f.name === 'test.txt')).toBe(false); // Text file should be filtered out
    });
  });

  describe('getSupportedExtensions', () => {
    it('should return supported image and video extensions', () => {
      const extensions = repository.getSupportedExtensions();
      
      expect(extensions).toHaveProperty('images');
      expect(extensions).toHaveProperty('videos');
      expect(Array.isArray(extensions.images)).toBe(true);
      expect(Array.isArray(extensions.videos)).toBe(true);
      
      expect(extensions.images).toContain('.jpg');
      expect(extensions.images).toContain('.png');
      expect(extensions.videos).toContain('.mp4');
      expect(extensions.videos).toContain('.avi');
    });
  });

  describe('isExtensionSupported', () => {
    it('should correctly identify supported extensions', () => {
      expect(repository.isExtensionSupported('.jpg')).toBe(true);
      expect(repository.isExtensionSupported('.JPG')).toBe(true); // Case insensitive
      expect(repository.isExtensionSupported('.png')).toBe(true);
      expect(repository.isExtensionSupported('.mp4')).toBe(true);
      expect(repository.isExtensionSupported('.txt')).toBe(false);
      expect(repository.isExtensionSupported('.doc')).toBe(false);
    });
  });

  describe('file operations', () => {
    it('should copy files correctly', async () => {
      const sourceFile = join(testDir, 'source.txt');
      const destFile = join(testDir, 'dest.txt');
      const testContent = 'test content';

      await fs.writeFile(sourceFile, testContent);
      await repository.copyFile(sourceFile, destFile);

      const copiedContent = await fs.readFile(destFile, 'utf-8');
      expect(copiedContent).toBe(testContent);
    });

    it('should move files correctly', async () => {
      const sourceFile = join(testDir, 'source.txt');
      const destFile = join(testDir, 'dest.txt');
      const testContent = 'test content';

      await fs.writeFile(sourceFile, testContent);
      await repository.moveFile(sourceFile, destFile);

      const movedContent = await fs.readFile(destFile, 'utf-8');
      expect(movedContent).toBe(testContent);
      
      // Source file should no longer exist
      await expect(fs.access(sourceFile)).rejects.toThrow();
    });

    it('should delete files correctly', async () => {
      const testFile = join(testDir, 'test.txt');
      await fs.writeFile(testFile, 'test content');

      await repository.deleteFile(testFile);

      // File should no longer exist
      await expect(fs.access(testFile)).rejects.toThrow();
    });
  });

  describe('utility methods', () => {
    it('should check if path exists', async () => {
      const existingFile = join(testDir, 'existing.txt');
      const nonExistingFile = join(testDir, 'nonexisting.txt');

      await fs.writeFile(existingFile, 'content');

      expect(await repository.exists(existingFile)).toBe(true);
      expect(await repository.exists(nonExistingFile)).toBe(false);
    });

    it('should check if path is directory', async () => {
      const subDir = join(testDir, 'subdir');
      const testFile = join(testDir, 'test.txt');

      await fs.mkdir(subDir);
      await fs.writeFile(testFile, 'content');

      expect(await repository.isDirectory(subDir)).toBe(true);
      expect(await repository.isDirectory(testFile)).toBe(false);
    });

    it('should check if path is file', async () => {
      const subDir = join(testDir, 'subdir');
      const testFile = join(testDir, 'test.txt');

      await fs.mkdir(subDir);
      await fs.writeFile(testFile, 'content');

      expect(await repository.isFile(testFile)).toBe(true);
      expect(await repository.isFile(subDir)).toBe(false);
    });
  });

  describe('cache management', () => {
    it('should manage cache correctly', async () => {
      // Clear cache first
      repository.clearCache();
      
      let stats = repository.getCacheStats();
      expect(stats.size).toBe(0);

      // Load directory contents to populate cache
      await repository.getDirectoryContents(testDir);
      
      stats = repository.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.entries).toContain(testDir);

      // Clear cache again
      repository.clearCache();
      stats = repository.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });
});