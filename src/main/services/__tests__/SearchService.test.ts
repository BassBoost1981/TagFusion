import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SearchService, SearchCriteria } from '../SearchService';
import { IMetadataRepository } from '../../repositories/MetadataRepository';
import { IFileSystemRepository } from '../../repositories/FileSystemRepository';
import { MediaFile, FolderItem, HierarchicalTag, MediaMetadata, EXIFData } from '../../../types/global';

// Mock implementations
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

class MockFileSystemRepository implements IFileSystemRepository {
  private mockContent: Map<string, { files: MediaFile[]; folders: FolderItem[] }> = new Map();

  setMockContent(path: string, files: MediaFile[], folders: FolderItem[]): void {
    this.mockContent.set(path, { files, folders });
  }

  async getDrives(): Promise<any[]> {
    return [
      { path: 'C:\\', available: true },
      { path: 'D:\\', available: true }
    ];
  }

  async getDirectoryContents(path: string): Promise<any> {
    const content = this.mockContent.get(path) || { files: [], folders: [] };
    return {
      mediaFiles: content.files,
      folders: content.folders,
      path
    };
  }

  async getDirectoryTree(path: string): Promise<any[]> {
    return [];
  }

  async copyFile(source: string, destination: string): Promise<void> {
    // Mock implementation
  }
}

describe('SearchService', () => {
  let searchService: SearchService;
  let mockMetadataRepo: MockMetadataRepository;
  let mockFileSystemRepo: MockFileSystemRepository;

  // Test data
  const testFiles: MediaFile[] = [
    {
      path: 'C:\\Photos\\vacation.jpg',
      name: 'vacation.jpg',
      extension: '.jpg',
      size: 1024000,
      dateModified: new Date('2024-01-15'),
      type: 'image'
    },
    {
      path: 'C:\\Photos\\mountain_sunset.png',
      name: 'mountain_sunset.png',
      extension: '.png',
      size: 2048000,
      dateModified: new Date('2024-01-20'),
      type: 'image'
    },
    {
      path: 'C:\\Videos\\family_trip.mp4',
      name: 'family_trip.mp4',
      extension: '.mp4',
      size: 50000000,
      dateModified: new Date('2024-01-25'),
      type: 'video'
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
    mockFileSystemRepo = new MockFileSystemRepository();
    searchService = new SearchService(mockMetadataRepo, mockFileSystemRepo);

    // Setup mock data
    mockFileSystemRepo.setMockContent('C:\\Photos', testFiles, testFolders);

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
        }
      ],
      rating: 5,
      dateCreated: new Date('2024-01-20'),
      cameraInfo: {
        make: 'Nikon',
        model: 'D850'
      }
    });

    mockMetadataRepo.setMockExifData('C:\\Photos\\vacation.jpg', {
      camera: { make: 'Canon', model: 'EOS 5D Mark IV', lens: 'EF 24-70mm f/2.8L' },
      settings: { aperture: 'f/2.8', shutterSpeed: '1/125s', iso: 400, focalLength: '50mm', flash: false },
      location: { dateTime: new Date('2024-01-15'), gps: undefined },
      technical: { colorSpace: 'sRGB', whiteBalance: 'Auto', meteringMode: 'Matrix' }
    });
  });

  describe('fuzzyMatch', () => {
    it('should return 1.0 for exact matches', () => {
      const score = searchService.fuzzyMatch('vacation', 'vacation');
      expect(score).toBe(1.0);
    });

    it('should return high score for contains matches', () => {
      const score = searchService.fuzzyMatch('cat', 'vacation');
      expect(score).toBeGreaterThan(0.5);
    });

    it('should return good score for starts with matches', () => {
      const score = searchService.fuzzyMatch('vac', 'vacation');
      expect(score).toBeCloseTo(0.7, 1);
    });

    it('should return 0 for very different strings', () => {
      const score = searchService.fuzzyMatch('xyz', 'vacation');
      expect(score).toBe(0);
    });

    it('should handle empty strings', () => {
      expect(searchService.fuzzyMatch('', 'vacation')).toBe(0);
      expect(searchService.fuzzyMatch('vacation', '')).toBe(0);
    });
  });

  describe('searchByFilename', () => {
    it('should find files with exact filename matches', async () => {
      const results = await searchService.searchByFilename('vacation.jpg', 'C:\\Photos');
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('vacation.jpg');
    });

    it('should find files with partial filename matches', async () => {
      const results = await searchService.searchByFilename('mountain', 'C:\\Photos');
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('mountain_sunset.png');
    });

    it('should return files sorted by relevance score', async () => {
      const results = await searchService.searchByFilename('a', 'C:\\Photos');
      
      // Should find files containing 'a' sorted by relevance
      expect(results.length).toBeGreaterThan(0);
      // vacation.jpg should score higher than family_trip.mp4 for 'a'
    });

    it('should return empty array for no matches', async () => {
      const results = await searchService.searchByFilename('nonexistent', 'C:\\Photos');
      expect(results).toHaveLength(0);
    });

    it('should handle empty query', async () => {
      const results = await searchService.searchByFilename('', 'C:\\Photos');
      expect(results).toHaveLength(testFiles.length);
    });
  });

  describe('searchByTags', () => {
    it('should find files with exact tag matches', async () => {
      const searchTags: HierarchicalTag[] = [{
        category: 'Travel',
        subcategory: 'Vacation',
        tag: 'Beach',
        fullPath: 'Travel/Vacation/Beach'
      }];

      const results = await searchService.searchByTags(searchTags, 'C:\\Photos');
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('vacation.jpg');
    });

    it('should find files with hierarchical tag matches', async () => {
      const searchTags: HierarchicalTag[] = [{
        category: 'Nature',
        subcategory: undefined,
        tag: 'Nature',
        fullPath: 'Nature'
      }];

      const results = await searchService.searchByTags(searchTags, 'C:\\Photos');
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('mountain_sunset.png');
    });

    it('should return empty array for no tag matches', async () => {
      const searchTags: HierarchicalTag[] = [{
        category: 'NonExistent',
        subcategory: undefined,
        tag: 'NonExistent',
        fullPath: 'NonExistent'
      }];

      const results = await searchService.searchByTags(searchTags, 'C:\\Photos');
      expect(results).toHaveLength(0);
    });
  });

  describe('searchByMetadata', () => {
    it('should find files by rating', async () => {
      const criteria: Partial<SearchCriteria> = {
        rating: 4
      };

      const results = await searchService.searchByMetadata(criteria, 'C:\\Photos');
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('vacation.jpg');
    });

    it('should find files by camera make', async () => {
      const criteria: Partial<SearchCriteria> = {
        cameraInfo: {
          make: 'Canon'
        }
      };

      const results = await searchService.searchByMetadata(criteria, 'C:\\Photos');
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('vacation.jpg');
    });

    it('should find files by date range', async () => {
      const criteria: Partial<SearchCriteria> = {
        dateRange: {
          from: new Date('2024-01-14'),
          to: new Date('2024-01-16')
        }
      };

      const results = await searchService.searchByMetadata(criteria, 'C:\\Photos');
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('vacation.jpg');
    });

    it('should return empty array for no metadata matches', async () => {
      const criteria: Partial<SearchCriteria> = {
        rating: 1
      };

      const results = await searchService.searchByMetadata(criteria, 'C:\\Photos');
      expect(results).toHaveLength(0);
    });
  });

  describe('searchFiles (comprehensive search)', () => {
    it('should combine filename and tag search', async () => {
      const criteria: SearchCriteria = {
        query: 'vacation',
        tags: [{
          category: 'Travel',
          subcategory: 'Vacation',
          tag: 'Beach',
          fullPath: 'Travel/Vacation/Beach'
        }]
      };

      const results = await searchService.searchFiles(criteria, 'C:\\Photos');
      
      expect(results.files).toHaveLength(1);
      expect(results.files[0].name).toBe('vacation.jpg');
      expect(results.totalCount).toBe(2); // 1 file + 1 folder (Vacation Photos)
      expect(results.searchTime).toBeGreaterThan(0);
    });

    it('should filter by file type', async () => {
      const criteria: SearchCriteria = {
        fileTypes: ['video']
      };

      const results = await searchService.searchFiles(criteria, 'C:\\Photos');
      
      expect(results.files).toHaveLength(1);
      expect(results.files[0].type).toBe('video');
    });

    it('should filter by size range', async () => {
      const criteria: SearchCriteria = {
        sizeRange: {
          min: 1000000,
          max: 10000000
        }
      };

      const results = await searchService.searchFiles(criteria, 'C:\\Photos');
      
      expect(results.files).toHaveLength(2); // vacation.jpg and mountain_sunset.png
      expect(results.files.every(file => file.size >= 1000000 && file.size <= 10000000)).toBe(true);
    });

    it('should search folder names', async () => {
      const criteria: SearchCriteria = {
        query: 'vacation'
      };

      const results = await searchService.searchFiles(criteria, 'C:\\Photos');
      
      expect(results.folders.length).toBeGreaterThan(0);
      expect(results.folders.some(folder => folder.name.toLowerCase().includes('vacation'))).toBe(true);
    });

    it('should return empty results for no matches', async () => {
      const criteria: SearchCriteria = {
        query: 'nonexistent',
        fileTypes: ['image'],
        rating: 1
      };

      const results = await searchService.searchFiles(criteria, 'C:\\Photos');
      
      expect(results.files).toHaveLength(0);
      expect(results.folders).toHaveLength(0);
      expect(results.totalCount).toBe(0);
    });

    it('should handle multiple criteria', async () => {
      const criteria: SearchCriteria = {
        fileTypes: ['image'],
        sizeRange: { min: 2000000, max: 3000000 }
      };

      const results = await searchService.searchFiles(criteria, 'C:\\Photos');
      
      expect(results.files).toHaveLength(1);
      expect(results.files[0].name).toBe('mountain_sunset.png');
    });
  });

  describe('error handling', () => {
    it('should handle metadata read errors gracefully', async () => {
      // Mock an error in metadata reading
      vi.spyOn(mockMetadataRepo, 'readMetadata').mockRejectedValueOnce(new Error('Read error'));

      const criteria: SearchCriteria = {
        rating: 4
      };

      const results = await searchService.searchByMetadata(criteria, 'C:\\Photos');
      
      // Should not throw and should return empty results
      expect(results).toHaveLength(0);
    });

    it('should handle file system errors gracefully', async () => {
      // Mock an error in file system access
      vi.spyOn(mockFileSystemRepo, 'getDirectoryContents').mockRejectedValueOnce(new Error('Access denied'));

      const results = await searchService.searchByFilename('vacation', 'C:\\Photos');
      
      // Should not throw and should return empty results
      expect(results).toHaveLength(0);
    });

    it('should handle search errors gracefully', async () => {
      // Mock an error in the main search method
      vi.spyOn(mockFileSystemRepo, 'getDirectoryContents').mockRejectedValueOnce(new Error('System error'));

      const criteria: SearchCriteria = {
        query: 'vacation'
      };

      const results = await searchService.searchFiles(criteria, 'C:\\Photos');
      
      expect(results.files).toHaveLength(0);
      expect(results.folders).toHaveLength(0);
      expect(results.totalCount).toBe(0);
      expect(results.searchTime).toBeGreaterThan(0);
    });
  });
});