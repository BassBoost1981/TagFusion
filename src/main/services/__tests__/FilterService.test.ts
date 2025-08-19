import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FilterService, FilterCriteria } from '../FilterService';
import { IMetadataRepository } from '../../repositories/MetadataRepository';
import { MediaFile, FolderItem, HierarchicalTag, MediaMetadata, EXIFData } from '../../../types/global';

// Mock implementation
class MockMetadataRepository implements IMetadataRepository {
  private mockMetadata: Map<string, MediaMetadata> = new Map();
  private mockExifData: Map<string, EXIFData> = new Map();

  setMockMetadata(filePath: string, metadata: MediaMetadata): void {
    this.mockMetadata.set(filePath, metadata);
  }

  setMockExifData(filePath: string, exifData: EXIFData): void {
    this.mockExifData.set(filePath, exifData);
  }

  async readMetadata(filePath: string): Promise<MediaMetadata> {
    return this.mockMetadata.get(filePath) || {
      tags: [],
      rating: 0,
      dateCreated: new Date(),
      cameraInfo: undefined
    };
  }

  async writeMetadata(filePath: string, metadata: MediaMetadata): Promise<void> {
    this.mockMetadata.set(filePath, metadata);
  }

  async extractTags(filePath: string): Promise<HierarchicalTag[]> {
    const metadata = await this.readMetadata(filePath);
    return metadata.tags;
  }

  async writeTags(filePath: string, tags: HierarchicalTag[]): Promise<void> {
    const metadata = await this.readMetadata(filePath);
    metadata.tags = tags;
    await this.writeMetadata(filePath, metadata);
  }

  async readEXIFData(filePath: string): Promise<EXIFData> {
    return this.mockExifData.get(filePath) || {
      camera: { make: undefined, model: undefined, lens: undefined },
      settings: { aperture: undefined, shutterSpeed: undefined, iso: undefined, focalLength: undefined, flash: undefined },
      location: { dateTime: undefined, gps: undefined },
      technical: { colorSpace: undefined, whiteBalance: undefined, meteringMode: undefined }
    };
  }

  async writeRating(filePath: string, rating: number): Promise<void> {
    const metadata = await this.readMetadata(filePath);
    metadata.rating = rating;
    await this.writeMetadata(filePath, metadata);
  }
}

describe('FilterService', () => {
  let filterService: FilterService;
  let mockMetadataRepo: MockMetadataRepository;

  // Test data
  const testFiles: MediaFile[] = [
    {
      path: 'C:\\Photos\\vacation.jpg',
      name: 'vacation.jpg',
      extension: '.jpg',
      size: 1024000, // 1MB
      dateModified: new Date('2024-01-15'),
      type: 'image'
    },
    {
      path: 'C:\\Photos\\mountain_sunset.png',
      name: 'mountain_sunset.png',
      extension: '.png',
      size: 2048000, // 2MB
      dateModified: new Date('2024-01-20'),
      type: 'image'
    },
    {
      path: 'C:\\Videos\\family_trip.mp4',
      name: 'family_trip.mp4',
      extension: '.mp4',
      size: 50000000, // 50MB
      dateModified: new Date('2024-01-25'),
      type: 'video'
    },
    {
      path: 'C:\\Photos\\small_image.jpg',
      name: 'small_image.jpg',
      extension: '.jpg',
      size: 512000, // 0.5MB
      dateModified: new Date('2024-02-01'),
      type: 'image'
    }
  ];

  const testFolders: FolderItem[] = [
    {
      name: 'Vacation Photos',
      path: 'C:\\Photos\\Vacation Photos',
      hasSubfolders: true,
      mediaCount: 25
    },
    {
      name: 'Nature',
      path: 'C:\\Photos\\Nature',
      hasSubfolders: false,
      mediaCount: 10
    }
  ];

  beforeEach(() => {
    mockMetadataRepo = new MockMetadataRepository();
    filterService = new FilterService(mockMetadataRepo);

    // Setup metadata for test files
    mockMetadataRepo.setMockMetadata('C:\\Photos\\vacation.jpg', {
      tags: [
        {
          category: 'Travel',
          subcategory: 'Vacation',
          tag: 'Beach',
          fullPath: 'Travel/Vacation/Beach'
        }
      ],
      rating: 4,
      dateCreated: new Date('2024-01-15'),
      cameraInfo: {
        make: 'Canon',
        model: 'EOS 5D Mark IV'
      }
    });

    mockMetadataRepo.setMockMetadata('C:\\Photos\\mountain_sunset.png', {
      tags: [
        {
          category: 'Nature',
          subcategory: 'Landscape',
          tag: 'Mountains',
          fullPath: 'Nature/Landscape/Mountains'
        },
        {
          category: 'Nature',
          subcategory: 'Landscape',
          tag: 'Sunset',
          fullPath: 'Nature/Landscape/Sunset'
        }
      ],
      rating: 5,
      dateCreated: new Date('2024-01-20'),
      cameraInfo: {
        make: 'Nikon',
        model: 'D850'
      }
    });

    mockMetadataRepo.setMockMetadata('C:\\Videos\\family_trip.mp4', {
      tags: [
        {
          category: 'Family',
          subcategory: 'Events',
          tag: 'Trip',
          fullPath: 'Family/Events/Trip'
        }
      ],
      rating: 3,
      dateCreated: new Date('2024-01-25'),
      cameraInfo: undefined
    });

    mockMetadataRepo.setMockMetadata('C:\\Photos\\small_image.jpg', {
      tags: [],
      rating: 2,
      dateCreated: new Date('2024-02-01'),
      cameraInfo: {
        make: 'Sony',
        model: 'A7R IV'
      }
    });

    // Setup EXIF data
    mockMetadataRepo.setMockExifData('C:\\Photos\\vacation.jpg', {
      camera: { make: 'Canon', model: 'EOS 5D Mark IV', lens: 'EF 24-70mm f/2.8L' },
      settings: { aperture: 'f/2.8', shutterSpeed: '1/125s', iso: 400, focalLength: '50mm', flash: false },
      location: { dateTime: new Date('2024-01-15'), gps: undefined },
      technical: { colorSpace: 'sRGB', whiteBalance: 'Auto', meteringMode: 'Matrix' }
    });

    mockMetadataRepo.setMockExifData('C:\\Photos\\mountain_sunset.png', {
      camera: { make: 'Nikon', model: 'D850', lens: 'AF-S NIKKOR 24-70mm f/2.8E ED VR' },
      settings: { aperture: 'f/8', shutterSpeed: '1/60s', iso: 100, focalLength: '35mm', flash: false },
      location: { dateTime: new Date('2024-01-20'), gps: undefined },
      technical: { colorSpace: 'sRGB', whiteBalance: 'Daylight', meteringMode: 'Matrix' }
    });

    mockMetadataRepo.setMockExifData('C:\\Photos\\small_image.jpg', {
      camera: { make: 'Sony', model: 'A7R IV', lens: 'FE 85mm F1.4 GM' },
      settings: { aperture: 'f/1.4', shutterSpeed: '1/200s', iso: 200, focalLength: '85mm', flash: false },
      location: { dateTime: new Date('2024-02-01'), gps: undefined },
      technical: { colorSpace: 'sRGB', whiteBalance: 'Auto', meteringMode: 'Center-weighted' }
    });
  });

  describe('filterByFileType', () => {
    it('should filter files by image type', () => {
      const result = filterService.filterByFileType(testFiles, ['image']);
      
      expect(result).toHaveLength(3);
      expect(result.every(file => file.type === 'image')).toBe(true);
    });

    it('should filter files by video type', () => {
      const result = filterService.filterByFileType(testFiles, ['video']);
      
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('video');
    });

    it('should filter files by multiple types', () => {
      const result = filterService.filterByFileType(testFiles, ['image', 'video']);
      
      expect(result).toHaveLength(4);
    });

    it('should return empty array for non-matching types', () => {
      const result = filterService.filterByFileType(testFiles, []);
      
      expect(result).toHaveLength(0);
    });
  });

  describe('filterBySize', () => {
    it('should filter files by minimum size', () => {
      const result = filterService.filterBySize(testFiles, { min: 1000000, max: Number.MAX_SAFE_INTEGER });
      
      expect(result).toHaveLength(3); // All except small_image.jpg
      expect(result.every(file => file.size >= 1000000)).toBe(true);
    });

    it('should filter files by maximum size', () => {
      const result = filterService.filterBySize(testFiles, { min: 0, max: 2000000 });
      
      expect(result).toHaveLength(2); // vacation.jpg and small_image.jpg
      expect(result.every(file => file.size <= 2000000)).toBe(true);
    });

    it('should filter files by size range', () => {
      const result = filterService.filterBySize(testFiles, { min: 1000000, max: 10000000 });
      
      expect(result).toHaveLength(2); // vacation.jpg and mountain_sunset.png
      expect(result.every(file => file.size >= 1000000 && file.size <= 10000000)).toBe(true);
    });
  });

  describe('filterByTags', () => {
    it('should filter files by exact tag match', async () => {
      const tags: HierarchicalTag[] = [{
        category: 'Travel',
        subcategory: 'Vacation',
        tag: 'Beach',
        fullPath: 'Travel/Vacation/Beach'
      }];

      const result = await filterService.filterByTags(testFiles, tags);
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('vacation.jpg');
    });

    it('should filter files by category match', async () => {
      const tags: HierarchicalTag[] = [{
        category: 'Nature',
        subcategory: undefined,
        tag: 'Nature',
        fullPath: 'Nature'
      }];

      const result = await filterService.filterByTags(testFiles, tags);
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('mountain_sunset.png');
    });

    it('should filter files by subcategory match', async () => {
      const tags: HierarchicalTag[] = [{
        category: 'Nature',
        subcategory: 'Landscape',
        tag: 'Landscape',
        fullPath: 'Nature/Landscape'
      }];

      const result = await filterService.filterByTags(testFiles, tags);
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('mountain_sunset.png');
    });

    it('should filter files by multiple tags (OR logic)', async () => {
      const tags: HierarchicalTag[] = [
        {
          category: 'Travel',
          subcategory: 'Vacation',
          tag: 'Beach',
          fullPath: 'Travel/Vacation/Beach'
        },
        {
          category: 'Family',
          subcategory: 'Events',
          tag: 'Trip',
          fullPath: 'Family/Events/Trip'
        }
      ];

      const result = await filterService.filterByTags(testFiles, tags);
      
      expect(result).toHaveLength(2);
      expect(result.map(f => f.name)).toContain('vacation.jpg');
      expect(result.map(f => f.name)).toContain('family_trip.mp4');
    });

    it('should return empty array for non-matching tags', async () => {
      const tags: HierarchicalTag[] = [{
        category: 'NonExistent',
        subcategory: undefined,
        tag: 'NonExistent',
        fullPath: 'NonExistent'
      }];

      const result = await filterService.filterByTags(testFiles, tags);
      
      expect(result).toHaveLength(0);
    });
  });

  describe('filterByDateRange', () => {
    it('should filter files by date range', async () => {
      const dateRange = {
        from: new Date('2024-01-14'),
        to: new Date('2024-01-21')
      };

      const result = await filterService.filterByDateRange(testFiles, dateRange);
      
      expect(result).toHaveLength(2); // vacation.jpg and mountain_sunset.png
      expect(result.map(f => f.name)).toContain('vacation.jpg');
      expect(result.map(f => f.name)).toContain('mountain_sunset.png');
    });

    it('should filter files by exact date', async () => {
      const dateRange = {
        from: new Date('2024-01-15'),
        to: new Date('2024-01-15')
      };

      const result = await filterService.filterByDateRange(testFiles, dateRange);
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('vacation.jpg');
    });

    it('should return empty array for non-matching date range', async () => {
      const dateRange = {
        from: new Date('2024-03-01'),
        to: new Date('2024-03-31')
      };

      const result = await filterService.filterByDateRange(testFiles, dateRange);
      
      expect(result).toHaveLength(0);
    });
  });

  describe('filterByRating', () => {
    it('should filter files by minimum rating', async () => {
      const result = await filterService.filterByRating(testFiles, 4);
      
      expect(result).toHaveLength(2); // vacation.jpg (4) and mountain_sunset.png (5)
      expect(result.map(f => f.name)).toContain('vacation.jpg');
      expect(result.map(f => f.name)).toContain('mountain_sunset.png');
    });

    it('should filter files by exact rating', async () => {
      const result = await filterService.filterByRating(testFiles, 5);
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('mountain_sunset.png');
    });

    it('should return empty array for high rating requirement', async () => {
      const result = await filterService.filterByRating(testFiles, 6);
      
      expect(result).toHaveLength(0);
    });
  });

  describe('filterByCameraInfo', () => {
    it('should filter files by camera make', async () => {
      const result = await filterService.filterByCameraInfo(testFiles, { make: 'Canon' });
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('vacation.jpg');
    });

    it('should filter files by camera model', async () => {
      const result = await filterService.filterByCameraInfo(testFiles, { model: 'D850' });
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('mountain_sunset.png');
    });

    it('should filter files by both make and model', async () => {
      const result = await filterService.filterByCameraInfo(testFiles, { 
        make: 'Sony', 
        model: 'A7R IV' 
      });
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('small_image.jpg');
    });

    it('should handle partial matches', async () => {
      const result = await filterService.filterByCameraInfo(testFiles, { make: 'can' });
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('vacation.jpg');
    });

    it('should return empty array for non-matching camera info', async () => {
      const result = await filterService.filterByCameraInfo(testFiles, { make: 'Fujifilm' });
      
      expect(result).toHaveLength(0);
    });
  });

  describe('applyFilters (comprehensive filtering)', () => {
    it('should apply multiple filters together', async () => {
      const criteria: FilterCriteria = {
        fileTypes: ['image'],
        rating: 4,
        cameraInfo: { make: 'Canon' }
      };

      const result = await filterService.applyFilters(testFiles, testFolders, criteria);
      
      expect(result.files).toHaveLength(1);
      expect(result.files[0].name).toBe('vacation.jpg');
      expect(result.folders).toHaveLength(2); // Folders are not filtered by metadata
      expect(result.totalCount).toBe(3);
      expect(result.filterTime).toBeGreaterThanOrEqual(0);
      expect(result.appliedFilters).toEqual(criteria);
    });

    it('should apply size and type filters', async () => {
      const criteria: FilterCriteria = {
        fileTypes: ['image'],
        sizeRange: { min: 1000000, max: 3000000 }
      };

      const result = await filterService.applyFilters(testFiles, testFolders, criteria);
      
      expect(result.files).toHaveLength(2); // vacation.jpg and mountain_sunset.png
      expect(result.files.every(file => file.type === 'image')).toBe(true);
      expect(result.files.every(file => file.size >= 1000000 && file.size <= 3000000)).toBe(true);
    });

    it('should handle empty criteria', async () => {
      const criteria: FilterCriteria = {};

      const result = await filterService.applyFilters(testFiles, testFolders, criteria);
      
      expect(result.files).toHaveLength(4);
      expect(result.folders).toHaveLength(2);
      expect(result.totalCount).toBe(6);
    });

    it('should handle no matches', async () => {
      const criteria: FilterCriteria = {
        fileTypes: ['video'],
        rating: 5
      };

      const result = await filterService.applyFilters(testFiles, testFolders, criteria);
      
      expect(result.files).toHaveLength(0);
      expect(result.totalCount).toBe(2); // Only folders remain
    });
  });

  describe('getAvailableTags', () => {
    it('should extract all unique tags from files', async () => {
      const result = await filterService.getAvailableTags(testFiles);
      
      expect(result.length).toBeGreaterThan(0);
      expect(result.some(tag => tag.fullPath === 'Travel/Vacation/Beach')).toBe(true);
      expect(result.some(tag => tag.fullPath === 'Nature/Landscape/Mountains')).toBe(true);
      expect(result.some(tag => tag.fullPath === 'Family/Events/Trip')).toBe(true);
    });

    it('should return sorted tags', async () => {
      const result = await filterService.getAvailableTags(testFiles);
      
      const sortedPaths = result.map(tag => tag.fullPath).sort();
      const actualPaths = result.map(tag => tag.fullPath);
      
      expect(actualPaths).toEqual(sortedPaths);
    });

    it('should handle files with no tags', async () => {
      const filesWithNoTags = [testFiles[3]]; // small_image.jpg has no tags
      
      const result = await filterService.getAvailableTags(filesWithNoTags);
      
      expect(result).toHaveLength(0);
    });
  });

  describe('getTagHierarchy', () => {
    it('should build hierarchical tree from tags', async () => {
      const tags = await filterService.getAvailableTags(testFiles);
      const hierarchy = filterService.getTagHierarchy(tags);
      
      expect(hierarchy['Travel']).toBeDefined();
      expect(hierarchy['Travel']['Vacation']).toBeDefined();
      expect(hierarchy['Travel']['Vacation']).toContain('Beach');
      
      expect(hierarchy['Nature']).toBeDefined();
      expect(hierarchy['Nature']['Landscape']).toBeDefined();
      expect(hierarchy['Nature']['Landscape']).toContain('Mountains');
      expect(hierarchy['Nature']['Landscape']).toContain('Sunset');
    });

    it('should handle empty tags array', () => {
      const hierarchy = filterService.getTagHierarchy([]);
      
      expect(Object.keys(hierarchy)).toHaveLength(0);
    });

    it('should sort tags within categories', async () => {
      const tags = await filterService.getAvailableTags(testFiles);
      const hierarchy = filterService.getTagHierarchy(tags);
      
      if (hierarchy['Nature'] && hierarchy['Nature']['Landscape']) {
        const landscapeTags = hierarchy['Nature']['Landscape'];
        const sortedTags = [...landscapeTags].sort();
        expect(landscapeTags).toEqual(sortedTags);
      }
    });
  });

  describe('error handling', () => {
    it('should handle metadata read errors gracefully', async () => {
      vi.spyOn(mockMetadataRepo, 'readMetadata').mockRejectedValueOnce(new Error('Read error'));

      const result = await filterService.filterByRating(testFiles, 4);
      
      // Should not throw and should continue with other files
      expect(result.length).toBeLessThan(testFiles.length);
    });

    it('should handle EXIF read errors gracefully', async () => {
      vi.spyOn(mockMetadataRepo, 'readEXIFData').mockRejectedValueOnce(new Error('EXIF error'));

      const result = await filterService.filterByCameraInfo(testFiles, { make: 'Canon' });
      
      // Should not throw and should continue with other files
      expect(result.length).toBeLessThan(testFiles.length);
    });

    it('should handle comprehensive filter errors gracefully', async () => {
      vi.spyOn(mockMetadataRepo, 'extractTags').mockRejectedValue(new Error('Tags error'));

      const criteria: FilterCriteria = {
        tags: [{
          category: 'Travel',
          subcategory: 'Vacation',
          tag: 'Beach',
          fullPath: 'Travel/Vacation/Beach'
        }]
      };

      const result = await filterService.applyFilters(testFiles, testFolders, criteria);
      
      expect(result.files).toHaveLength(0);
      expect(result.folders).toHaveLength(2);
      expect(result.filterTime).toBeGreaterThanOrEqual(0);
    });
  });
});