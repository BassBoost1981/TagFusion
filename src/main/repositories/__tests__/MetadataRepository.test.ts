import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as ExifReader from 'exifreader';
import * as piexif from 'piexifjs';
import { MetadataRepository } from '../MetadataRepository';
import { MediaMetadata, HierarchicalTag, EXIFData } from '../../../types/global';

// Mock the dependencies
vi.mock('fs/promises');
vi.mock('exifreader');
vi.mock('piexifjs', () => ({
  load: vi.fn(),
  dump: vi.fn(),
  insert: vi.fn(),
  ImageIFD: {
    ImageDescription: 270,
    Software: 305
  }
}));

const mockFs = vi.mocked(fs);
const mockExifReader = vi.mocked(ExifReader);
const mockPiexif = {
  load: vi.fn(),
  dump: vi.fn(),
  insert: vi.fn(),
  ImageIFD: {
    ImageDescription: 270,
    Software: 305
  }
};

describe('MetadataRepository', () => {
  let repository: MetadataRepository;
  const testFilePath = '/test/image.jpg';
  const testFileBuffer = Buffer.from('fake image data');

  beforeEach(() => {
    repository = new MetadataRepository();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('readMetadata', () => {
    it('should read metadata from supported image formats', async () => {
      // Arrange
      const mockExifData = {
        Make: { description: 'Canon' },
        Model: { description: 'EOS 5D Mark IV' },
        DateTimeOriginal: { description: '2024:01:15 10:30:00' },
        'dc:subject': ['Nature/Landscape/Mountains', 'Photography'],
        Rating: { value: 4 }
      };

      mockFs.readFile.mockResolvedValue(testFileBuffer);
      mockExifReader.load.mockReturnValue(mockExifData);

      // Act
      const result = await repository.readMetadata(testFilePath);

      // Assert
      expect(mockFs.readFile).toHaveBeenCalledWith(testFilePath);
      expect(mockExifReader.load).toHaveBeenCalledWith(testFileBuffer);
      expect(result.tags).toHaveLength(2);
      expect(result.tags[0]).toEqual({
        category: 'Nature',
        subcategory: 'Landscape',
        tag: 'Mountains',
        fullPath: 'Nature/Landscape/Mountains'
      });
      expect(result.rating).toBe(4);
      expect(result.cameraInfo?.make).toBe('Canon');
      expect(result.cameraInfo?.model).toBe('EOS 5D Mark IV');
    });

    it('should return default metadata for unsupported formats', async () => {
      // Act
      const result = await repository.readMetadata('/test/video.mp4');

      // Assert
      expect(result.tags).toEqual([]);
      expect(result.rating).toBe(0);
      expect(result.cameraInfo).toBeUndefined();
      expect(mockFs.readFile).not.toHaveBeenCalled();
    });

    it('should handle file read errors gracefully', async () => {
      // Arrange
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      // Act
      const result = await repository.readMetadata(testFilePath);

      // Assert
      expect(result.tags).toEqual([]);
      expect(result.rating).toBe(0);
      expect(result.cameraInfo).toBeUndefined();
    });

    it('should handle EXIF parsing errors gracefully', async () => {
      // Arrange
      mockFs.readFile.mockResolvedValue(testFileBuffer);
      mockExifReader.load.mockImplementation(() => {
        throw new Error('Invalid EXIF data');
      });

      // Act
      const result = await repository.readMetadata(testFilePath);

      // Assert
      expect(result.tags).toEqual([]);
      expect(result.rating).toBe(0);
    });
  });

  describe('writeMetadata', () => {
    it('should write metadata to supported image formats', async () => {
      // Arrange
      const metadata: MediaMetadata = {
        tags: [
          {
            category: 'Nature',
            subcategory: 'Landscape',
            tag: 'Mountains',
            fullPath: 'Nature/Landscape/Mountains'
          }
        ],
        rating: 5,
        dateCreated: new Date('2024-01-15'),
        cameraInfo: {
          make: 'Canon',
          model: 'EOS 5D Mark IV'
        }
      };

      const mockExifDict = {
        '0th': {},
        'Exif': {},
        'GPS': {},
        '1st': {},
        'thumbnail': null
      };

      mockFs.readFile.mockResolvedValue(testFileBuffer);
      mockPiexif.load.mockReturnValue(mockExifDict);
      mockPiexif.dump.mockReturnValue('exif bytes');
      mockPiexif.insert.mockReturnValue('new image data');
      mockFs.writeFile.mockResolvedValue();

      // Act
      await repository.writeMetadata(testFilePath, metadata);

      // Assert
      expect(mockFs.readFile).toHaveBeenCalledWith(testFilePath);
      expect(mockPiexif.load).toHaveBeenCalled();
      expect(mockPiexif.dump).toHaveBeenCalledWith(mockExifDict);
      expect(mockPiexif.insert).toHaveBeenCalledWith('exif bytes', 'fake image data');
      expect(mockFs.writeFile).toHaveBeenCalledWith(testFilePath, expect.any(Buffer));
    });

    it('should throw error for unsupported formats', async () => {
      // Arrange
      const metadata: MediaMetadata = {
        tags: [],
        rating: 0,
        dateCreated: new Date(),
        cameraInfo: undefined
      };

      // Act & Assert
      await expect(repository.writeMetadata('/test/video.mp4', metadata))
        .rejects.toThrow('Metadata writing not supported for .mp4 files');
    });

    it('should handle missing EXIF data by creating new structure', async () => {
      // Arrange
      const metadata: MediaMetadata = {
        tags: [],
        rating: 3,
        dateCreated: new Date(),
        cameraInfo: undefined
      };

      mockFs.readFile.mockResolvedValue(testFileBuffer);
      mockPiexif.load.mockImplementation(() => {
        throw new Error('No EXIF data');
      });
      mockPiexif.dump.mockReturnValue('exif bytes');
      mockPiexif.insert.mockReturnValue('new image data');
      mockFs.writeFile.mockResolvedValue();

      // Act
      await repository.writeMetadata(testFilePath, metadata);

      // Assert
      expect(mockPiexif.dump).toHaveBeenCalledWith(expect.objectContaining({
        '0th': expect.any(Object),
        'Exif': expect.any(Object),
        'GPS': expect.any(Object),
        '1st': expect.any(Object),
        'thumbnail': null
      }));
    });
  });

  describe('extractTags', () => {
    it('should extract only tags from metadata', async () => {
      // Arrange
      const mockExifData = {
        'dc:subject': ['Nature/Landscape/Mountains', 'Photography/Portrait']
      };

      mockFs.readFile.mockResolvedValue(testFileBuffer);
      mockExifReader.load.mockReturnValue(mockExifData);

      // Act
      const result = await repository.extractTags(testFilePath);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].fullPath).toBe('Nature/Landscape/Mountains');
      expect(result[1].fullPath).toBe('Photography/Portrait');
    });

    it('should return empty array on error', async () => {
      // Arrange
      mockFs.readFile.mockRejectedValue(new Error('File error'));

      // Act
      const result = await repository.extractTags(testFilePath);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('writeTags', () => {
    it('should write only tags while preserving other metadata', async () => {
      // Arrange
      const tags: HierarchicalTag[] = [
        {
          category: 'Nature',
          subcategory: 'Wildlife',
          tag: 'Birds',
          fullPath: 'Nature/Wildlife/Birds'
        }
      ];

      const existingMetadata: MediaMetadata = {
        tags: [],
        rating: 4,
        dateCreated: new Date('2024-01-15'),
        cameraInfo: { make: 'Canon' }
      };

      // Mock readMetadata to return existing metadata
      const mockExifData = {
        Rating: { value: 4 },
        Make: { description: 'Canon' },
        DateTimeOriginal: { description: '2024:01:15 10:30:00' }
      };

      mockFs.readFile.mockResolvedValue(testFileBuffer);
      mockExifReader.load.mockReturnValue(mockExifData);

      // Mock writeMetadata
      const mockExifDict = { '0th': {}, 'Exif': {}, 'GPS': {}, '1st': {}, 'thumbnail': null };
      mockPiexif.load.mockReturnValue(mockExifDict);
      mockPiexif.dump.mockReturnValue('exif bytes');
      mockPiexif.insert.mockReturnValue('new image data');
      mockFs.writeFile.mockResolvedValue();

      // Act
      await repository.writeTags(testFilePath, tags);

      // Assert
      expect(mockFs.writeFile).toHaveBeenCalled();
    });
  });

  describe('readEXIFData', () => {
    it('should read detailed EXIF data', async () => {
      // Arrange
      const mockExifData = {
        Make: { description: 'Canon' },
        Model: { description: 'EOS 5D Mark IV' },
        LensModel: { description: 'EF 24-70mm f/2.8L' },
        FNumber: { description: 'f/2.8' },
        ExposureTime: { description: '1/125' },
        ISOSpeedRatings: { value: 400 },
        FocalLength: { description: '50mm' },
        Flash: { value: 0 },
        DateTime: { description: '2024:01:15 10:30:00' },
        ColorSpace: { description: 'sRGB' },
        WhiteBalance: { description: 'Auto' },
        MeteringMode: { description: 'Matrix' },
        GPSLatitude: { value: [40, 45, 30] },
        GPSLatitudeRef: { value: 'N' },
        GPSLongitude: { value: [74, 0, 0] },
        GPSLongitudeRef: { value: 'W' },
        GPSAltitude: { value: '100' }
      };

      mockFs.readFile.mockResolvedValue(testFileBuffer);
      mockExifReader.load.mockReturnValue(mockExifData);

      // Act
      const result = await repository.readEXIFData(testFilePath);

      // Assert
      expect(result.camera.make).toBe('Canon');
      expect(result.camera.model).toBe('EOS 5D Mark IV');
      expect(result.camera.lens).toBe('EF 24-70mm f/2.8L');
      expect(result.settings.aperture).toBe('f/2.8');
      expect(result.settings.shutterSpeed).toBe('1/125');
      expect(result.settings.iso).toBe(400);
      expect(result.settings.focalLength).toBe('50mm');
      expect(result.settings.flash).toBe(false);
      expect(result.technical.colorSpace).toBe('sRGB');
      expect(result.technical.whiteBalance).toBe('Auto');
      expect(result.technical.meteringMode).toBe('Matrix');
      expect(result.location.gps?.latitude).toBeCloseTo(40.758333);
      expect(result.location.gps?.longitude).toBeCloseTo(-74);
      expect(result.location.gps?.altitude).toBe(100);
    });

    it('should return empty EXIF data for unsupported formats', async () => {
      // Act
      const result = await repository.readEXIFData('/test/video.mp4');

      // Assert
      expect(result.camera.make).toBeUndefined();
      expect(result.settings.aperture).toBeUndefined();
      expect(result.location.gps).toBeUndefined();
    });
  });

  describe('writeRating', () => {
    it('should write only rating while preserving other metadata', async () => {
      // Arrange
      const rating = 5;

      const mockExifData = {
        Make: { description: 'Canon' },
        'dc:subject': ['Nature/Landscape/Mountains']
      };

      mockFs.readFile.mockResolvedValue(testFileBuffer);
      mockExifReader.load.mockReturnValue(mockExifData);

      const mockExifDict = { '0th': {}, 'Exif': {}, 'GPS': {}, '1st': {}, 'thumbnail': null };
      mockPiexif.load.mockReturnValue(mockExifDict);
      mockPiexif.dump.mockReturnValue('exif bytes');
      mockPiexif.insert.mockReturnValue('new image data');
      mockFs.writeFile.mockResolvedValue();

      // Act
      await repository.writeRating(testFilePath, rating);

      // Assert
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should validate rating range', async () => {
      // Act & Assert
      await expect(repository.writeRating(testFilePath, -1))
        .rejects.toThrow('Rating must be between 0 and 5');
      
      await expect(repository.writeRating(testFilePath, 6))
        .rejects.toThrow('Rating must be between 0 and 5');
    });
  });

  describe('parseHierarchicalTag', () => {
    it('should parse single tag', () => {
      // This tests the private method indirectly through readMetadata
      const mockExifData = {
        'dc:subject': ['Photography']
      };

      mockFs.readFile.mockResolvedValue(testFileBuffer);
      mockExifReader.load.mockReturnValue(mockExifData);

      return repository.readMetadata(testFilePath).then(result => {
        expect(result.tags[0]).toEqual({
          category: 'Photography',
          subcategory: undefined,
          tag: 'Photography',
          fullPath: 'Photography'
        });
      });
    });

    it('should parse two-level hierarchy', () => {
      const mockExifData = {
        'dc:subject': ['Nature/Landscape']
      };

      mockFs.readFile.mockResolvedValue(testFileBuffer);
      mockExifReader.load.mockReturnValue(mockExifData);

      return repository.readMetadata(testFilePath).then(result => {
        expect(result.tags[0]).toEqual({
          category: 'Nature',
          subcategory: undefined,
          tag: 'Landscape',
          fullPath: 'Nature/Landscape'
        });
      });
    });

    it('should parse three-level hierarchy', () => {
      const mockExifData = {
        'dc:subject': ['Nature/Landscape/Mountains']
      };

      mockFs.readFile.mockResolvedValue(testFileBuffer);
      mockExifReader.load.mockReturnValue(mockExifData);

      return repository.readMetadata(testFilePath).then(result => {
        expect(result.tags[0]).toEqual({
          category: 'Nature',
          subcategory: 'Landscape',
          tag: 'Mountains',
          fullPath: 'Nature/Landscape/Mountains'
        });
      });
    });

    it('should handle pipe separator', () => {
      const mockExifData = {
        'lr:hierarchicalSubject': ['Nature|Landscape|Mountains']
      };

      mockFs.readFile.mockResolvedValue(testFileBuffer);
      mockExifReader.load.mockReturnValue(mockExifData);

      return repository.readMetadata(testFilePath).then(result => {
        expect(result.tags[0]).toEqual({
          category: 'Nature',
          subcategory: 'Landscape',
          tag: 'Mountains',
          fullPath: 'Nature/Landscape/Mountains'
        });
      });
    });
  });

  describe('GPS coordinate conversion', () => {
    it('should convert GPS coordinates correctly', async () => {
      const mockExifData = {
        GPSLatitude: { value: [40, 45, 30] }, // 40°45'30"N
        GPSLatitudeRef: { value: 'N' },
        GPSLongitude: { value: [74, 0, 0] }, // 74°0'0"W
        GPSLongitudeRef: { value: 'W' }
      };

      mockFs.readFile.mockResolvedValue(testFileBuffer);
      mockExifReader.load.mockReturnValue(mockExifData);

      const result = await repository.readEXIFData(testFilePath);

      expect(result.location.gps?.latitude).toBeCloseTo(40.758333, 5);
      expect(result.location.gps?.longitude).toBeCloseTo(-74, 5);
    });

    it('should handle southern and western coordinates', async () => {
      const mockExifData = {
        GPSLatitude: { value: [33, 52, 0] }, // 33°52'0"S
        GPSLatitudeRef: { value: 'S' },
        GPSLongitude: { value: [151, 12, 0] }, // 151°12'0"E
        GPSLongitudeRef: { value: 'E' }
      };

      mockFs.readFile.mockResolvedValue(testFileBuffer);
      mockExifReader.load.mockReturnValue(mockExifData);

      const result = await repository.readEXIFData(testFilePath);

      expect(result.location.gps?.latitude).toBeCloseTo(-33.866667, 5);
      expect(result.location.gps?.longitude).toBeCloseTo(151.2, 5);
    });
  });
});