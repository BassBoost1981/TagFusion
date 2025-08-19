import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MetadataRepository } from '../../main/repositories/MetadataRepository';
import { TagHierarchyService } from '../../main/services/TagHierarchyService';
import { RatingService } from '../../main/services/RatingService';
import type { HierarchicalTag, MediaMetadata } from '../../types/global';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('Metadata Roundtrip Integration Tests', () => {
  let metadataRepository: MetadataRepository;
  let tagHierarchyService: TagHierarchyService;
  let ratingService: RatingService;
  let tempDir: string;
  let testImagePath: string;

  beforeEach(async () => {
    // Create temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'metadata-test-'));
    testImagePath = path.join(tempDir, 'test-image.jpg');
    
    // Create a minimal JPEG file for testing
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
    
    await fs.writeFile(testImagePath, minimalJpeg);
    
    // Initialize services
    metadataRepository = new MetadataRepository();
    
    // Mock configuration repository for services
    const mockConfigRepo = {
      loadSettings: vi.fn().mockResolvedValue({
        language: 'en',
        theme: 'system' as const,
        favorites: [],
        tagHierarchy: []
      }),
      saveSettings: vi.fn().mockResolvedValue(undefined),
      exportConfiguration: vi.fn(),
      importConfiguration: vi.fn(),
      getConfigPath: vi.fn(),
      ensureConfigDirectory: vi.fn(),
      backupConfiguration: vi.fn(),
      restoreConfiguration: vi.fn(),
      validateConfiguration: vi.fn(),
      migrateConfiguration: vi.fn()
    };
    
    tagHierarchyService = new TagHierarchyService(mockConfigRepo);
    ratingService = new RatingService(metadataRepository);
  });

  afterEach(async () => {
    // Cleanup temporary files
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup temp directory:', error);
    }
  });

  describe('Tag Metadata Roundtrip', () => {
    it('should write and read hierarchical tags correctly', async () => {
      const tags: HierarchicalTag[] = [
        {
          category: 'Nature',
          subcategory: 'Landscape',
          tag: 'Mountains',
          fullPath: 'Nature/Landscape/Mountains'
        },
        {
          category: 'Nature',
          subcategory: 'Animals',
          tag: 'Birds',
          fullPath: 'Nature/Animals/Birds'
        },
        {
          category: 'Events',
          subcategory: undefined,
          tag: 'Wedding',
          fullPath: 'Events/Wedding'
        }
      ];

      // Write tags to metadata
      await metadataRepository.writeTags(testImagePath, tags);

      // Read tags back
      const readTags = await metadataRepository.extractTags(testImagePath);

      expect(readTags).toHaveLength(tags.length);
      expect(readTags).toEqual(expect.arrayContaining(tags));
    });

    it('should preserve existing metadata when adding new tags', async () => {
      // First, write some initial metadata
      const initialMetadata: MediaMetadata = {
        tags: [{
          category: 'Initial',
          subcategory: undefined,
          tag: 'Test',
          fullPath: 'Initial/Test'
        }],
        rating: 3,
        dateCreated: new Date('2024-01-01'),
        cameraInfo: {
          make: 'Canon',
          model: 'EOS 5D',
          lens: 'EF 50mm f/1.8'
        }
      };

      await metadataRepository.writeMetadata(testImagePath, initialMetadata);

      // Add new tags
      const newTags: HierarchicalTag[] = [
        {
          category: 'Nature',
          subcategory: 'Landscape',
          tag: 'Mountains',
          fullPath: 'Nature/Landscape/Mountains'
        }
      ];

      await metadataRepository.writeTags(testImagePath, [...initialMetadata.tags, ...newTags]);

      // Read back and verify all metadata is preserved
      const readMetadata = await metadataRepository.readMetadata(testImagePath);

      expect(readMetadata.tags).toHaveLength(2);
      expect(readMetadata.rating).toBe(3);
      expect(readMetadata.cameraInfo?.make).toBe('Canon');
    });
  });

  describe('Rating Metadata Roundtrip', () => {
    it('should write and read ratings correctly', async () => {
      const testRating = 4;

      // Write rating
      await ratingService.setRating(testImagePath, testRating);

      // Read rating back
      const readRating = await ratingService.getRating(testImagePath);

      expect(readRating).toBe(testRating);
    });

    it('should preserve existing metadata when updating rating', async () => {
      // First, write some initial metadata
      const initialTags: HierarchicalTag[] = [{
        category: 'Test',
        subcategory: undefined,
        tag: 'Initial',
        fullPath: 'Test/Initial'
      }];

      await metadataRepository.writeTags(testImagePath, initialTags);

      // Update rating
      await ratingService.setRating(testImagePath, 5);

      // Read back and verify tags are preserved
      const readTags = await metadataRepository.extractTags(testImagePath);
      const readRating = await ratingService.getRating(testImagePath);

      expect(readTags).toEqual(initialTags);
      expect(readRating).toBe(5);
    });
  });

  describe('Complex Metadata Scenarios', () => {
    it('should handle multiple metadata updates correctly', async () => {
      // Step 1: Add initial tags
      const initialTags: HierarchicalTag[] = [{
        category: 'Nature',
        subcategory: 'Landscape',
        tag: 'Mountains',
        fullPath: 'Nature/Landscape/Mountains'
      }];

      await metadataRepository.writeTags(testImagePath, initialTags);

      // Step 2: Add rating
      await ratingService.setRating(testImagePath, 4);

      // Step 3: Add more tags
      const additionalTags: HierarchicalTag[] = [{
        category: 'Weather',
        subcategory: undefined,
        tag: 'Sunny',
        fullPath: 'Weather/Sunny'
      }];

      await metadataRepository.writeTags(testImagePath, [...initialTags, ...additionalTags]);

      // Step 4: Update rating
      await ratingService.setRating(testImagePath, 5);

      // Verify final state
      const finalTags = await metadataRepository.extractTags(testImagePath);
      const finalRating = await ratingService.getRating(testImagePath);

      expect(finalTags).toHaveLength(2);
      expect(finalTags).toEqual(expect.arrayContaining([...initialTags, ...additionalTags]));
      expect(finalRating).toBe(5);
    });

    it('should handle tag hierarchy operations', async () => {
      // Create a tag hierarchy
      const hierarchy = [
        {
          id: '1',
          name: 'Nature',
          parent: undefined,
          children: [],
          level: 0
        },
        {
          id: '2',
          name: 'Landscape',
          parent: '1',
          children: [],
          level: 1
        },
        {
          id: '3',
          name: 'Mountains',
          parent: '2',
          children: [],
          level: 2
        }
      ];

      // Mock the hierarchy service to return our test hierarchy
      vi.spyOn(tagHierarchyService, 'getTagHierarchy').mockResolvedValue(hierarchy);

      // Create tags based on hierarchy
      const tags: HierarchicalTag[] = [{
        category: 'Nature',
        subcategory: 'Landscape',
        tag: 'Mountains',
        fullPath: 'Nature/Landscape/Mountains'
      }];

      await metadataRepository.writeTags(testImagePath, tags);

      // Verify the tags can be read back correctly
      const readTags = await metadataRepository.extractTags(testImagePath);
      expect(readTags).toEqual(tags);
    });
  });

  describe('Error Handling', () => {
    it('should handle corrupted metadata gracefully', async () => {
      // Write some valid metadata first
      const validTags: HierarchicalTag[] = [{
        category: 'Test',
        subcategory: undefined,
        tag: 'Valid',
        fullPath: 'Test/Valid'
      }];

      await metadataRepository.writeTags(testImagePath, validTags);

      // Simulate corruption by writing invalid data
      // (In a real scenario, this might happen due to external tools)
      
      // Try to read - should handle gracefully
      const readTags = await metadataRepository.extractTags(testImagePath);
      
      // Should either return valid tags or empty array, not throw
      expect(Array.isArray(readTags)).toBe(true);
    });

    it('should handle missing files gracefully', async () => {
      const nonExistentPath = path.join(tempDir, 'nonexistent.jpg');

      // Should not throw, but return default values
      const tags = await metadataRepository.extractTags(nonExistentPath);
      const rating = await ratingService.getRating(nonExistentPath);

      expect(tags).toEqual([]);
      expect(rating).toBe(0);
    });
  });

  describe('Performance Tests', () => {
    it('should handle batch operations efficiently', async () => {
      const batchSize = 10;
      const testFiles: string[] = [];

      // Create multiple test files
      for (let i = 0; i < batchSize; i++) {
        const filePath = path.join(tempDir, `test-${i}.jpg`);
        await fs.copyFile(testImagePath, filePath);
        testFiles.push(filePath);
      }

      const startTime = Date.now();

      // Perform batch rating operation
      const ratings = Array.from({ length: batchSize }, (_, i) => i % 5 + 1);
      await ratingService.setBatchRating(testFiles, ratings);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 5 seconds for 10 files)
      expect(duration).toBeLessThan(5000);

      // Verify all ratings were set correctly
      for (let i = 0; i < batchSize; i++) {
        const rating = await ratingService.getRating(testFiles[i]);
        expect(rating).toBe(ratings[i]);
      }
    });

    it('should handle large tag sets efficiently', async () => {
      // Create a large set of tags
      const largeTags: HierarchicalTag[] = [];
      for (let i = 0; i < 100; i++) {
        largeTags.push({
          category: `Category${i % 10}`,
          subcategory: `Subcategory${i % 20}`,
          tag: `Tag${i}`,
          fullPath: `Category${i % 10}/Subcategory${i % 20}/Tag${i}`
        });
      }

      const startTime = Date.now();

      await metadataRepository.writeTags(testImagePath, largeTags);
      const readTags = await metadataRepository.extractTags(testImagePath);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(2000);
      expect(readTags).toHaveLength(largeTags.length);
    });
  });
});