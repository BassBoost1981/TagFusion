import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RatingService } from '../RatingService';
import { IMetadataRepository } from '../../repositories/MetadataRepository';
import { MediaMetadata } from '../../../types/global';

// Mock MetadataRepository
const mockMetadataRepository: IMetadataRepository = {
  readMetadata: vi.fn(),
  writeMetadata: vi.fn(),
  extractTags: vi.fn(),
  writeTags: vi.fn(),
  readEXIFData: vi.fn(),
  writeRating: vi.fn(),
};

describe('RatingService', () => {
  let ratingService: RatingService;

  beforeEach(() => {
    vi.clearAllMocks();
    ratingService = new RatingService(mockMetadataRepository);
  });

  describe('getRating', () => {
    it('should return rating from metadata', async () => {
      const mockMetadata: MediaMetadata = {
        tags: [],
        rating: 4,
        dateCreated: new Date(),
      };

      vi.mocked(mockMetadataRepository.readMetadata).mockResolvedValue(mockMetadata);

      const rating = await ratingService.getRating('/path/to/image.jpg');

      expect(rating).toBe(4);
      expect(mockMetadataRepository.readMetadata).toHaveBeenCalledWith('/path/to/image.jpg');
    });

    it('should return 0 if no rating in metadata', async () => {
      const mockMetadata: MediaMetadata = {
        tags: [],
        rating: 0,
        dateCreated: new Date(),
      };

      vi.mocked(mockMetadataRepository.readMetadata).mockResolvedValue(mockMetadata);

      const rating = await ratingService.getRating('/path/to/image.jpg');

      expect(rating).toBe(0);
    });

    it('should return 0 on error', async () => {
      vi.mocked(mockMetadataRepository.readMetadata).mockRejectedValue(new Error('File not found'));

      const rating = await ratingService.getRating('/path/to/nonexistent.jpg');

      expect(rating).toBe(0);
    });
  });

  describe('setRating', () => {
    it('should set rating successfully', async () => {
      vi.mocked(mockMetadataRepository.writeRating).mockResolvedValue();

      await ratingService.setRating('/path/to/image.jpg', 5);

      expect(mockMetadataRepository.writeRating).toHaveBeenCalledWith('/path/to/image.jpg', 5);
    });

    it('should validate rating range', async () => {
      await expect(ratingService.setRating('/path/to/image.jpg', 6)).rejects.toThrow('Rating must be between 0 and 5');
      await expect(ratingService.setRating('/path/to/image.jpg', -1)).rejects.toThrow('Rating must be between 0 and 5');
    });

    it('should propagate metadata repository errors', async () => {
      vi.mocked(mockMetadataRepository.writeRating).mockRejectedValue(new Error('Write failed'));

      await expect(ratingService.setRating('/path/to/image.jpg', 3)).rejects.toThrow('Write failed');
    });
  });

  describe('setBatchRating', () => {
    it('should set rating for multiple files successfully', async () => {
      const filePaths = ['/path/to/image1.jpg', '/path/to/image2.jpg', '/path/to/image3.jpg'];
      vi.mocked(mockMetadataRepository.writeRating).mockResolvedValue();

      const result = await ratingService.setBatchRating(filePaths, 4);

      expect(result.successful).toEqual(filePaths);
      expect(result.failed).toEqual([]);
      expect(result.totalProcessed).toBe(3);
      expect(mockMetadataRepository.writeRating).toHaveBeenCalledTimes(3);
    });

    it('should handle partial failures', async () => {
      const filePaths = ['/path/to/image1.jpg', '/path/to/image2.jpg', '/path/to/image3.jpg'];
      
      vi.mocked(mockMetadataRepository.writeRating)
        .mockResolvedValueOnce() // First file succeeds
        .mockRejectedValueOnce(new Error('Write failed')) // Second file fails
        .mockResolvedValueOnce(); // Third file succeeds

      const result = await ratingService.setBatchRating(filePaths, 3);

      expect(result.successful).toEqual(['/path/to/image1.jpg', '/path/to/image3.jpg']);
      expect(result.failed).toEqual([{
        filePath: '/path/to/image2.jpg',
        error: 'Write failed'
      }]);
      expect(result.totalProcessed).toBe(3);
    });

    it('should validate rating range for batch operations', async () => {
      const filePaths = ['/path/to/image1.jpg'];

      await expect(ratingService.setBatchRating(filePaths, 6)).rejects.toThrow('Rating must be between 0 and 5');
      await expect(ratingService.setBatchRating(filePaths, -1)).rejects.toThrow('Rating must be between 0 and 5');
    });
  });

  describe('getAverageRating', () => {
    it('should calculate average rating correctly', async () => {
      const filePaths = ['/path/to/image1.jpg', '/path/to/image2.jpg', '/path/to/image3.jpg'];
      
      const mockMetadata1: MediaMetadata = { tags: [], rating: 3, dateCreated: new Date() };
      const mockMetadata2: MediaMetadata = { tags: [], rating: 4, dateCreated: new Date() };
      const mockMetadata3: MediaMetadata = { tags: [], rating: 5, dateCreated: new Date() };

      vi.mocked(mockMetadataRepository.readMetadata)
        .mockResolvedValueOnce(mockMetadata1)
        .mockResolvedValueOnce(mockMetadata2)
        .mockResolvedValueOnce(mockMetadata3);

      const average = await ratingService.getAverageRating(filePaths);

      expect(average).toBe(4); // (3 + 4 + 5) / 3 = 4
    });

    it('should exclude unrated files from average', async () => {
      const filePaths = ['/path/to/image1.jpg', '/path/to/image2.jpg', '/path/to/image3.jpg'];
      
      const mockMetadata1: MediaMetadata = { tags: [], rating: 0, dateCreated: new Date() }; // Unrated
      const mockMetadata2: MediaMetadata = { tags: [], rating: 4, dateCreated: new Date() };
      const mockMetadata3: MediaMetadata = { tags: [], rating: 5, dateCreated: new Date() };

      vi.mocked(mockMetadataRepository.readMetadata)
        .mockResolvedValueOnce(mockMetadata1)
        .mockResolvedValueOnce(mockMetadata2)
        .mockResolvedValueOnce(mockMetadata3);

      const average = await ratingService.getAverageRating(filePaths);

      expect(average).toBe(4.5); // (4 + 5) / 2 = 4.5
    });

    it('should return 0 for empty file list', async () => {
      const average = await ratingService.getAverageRating([]);
      expect(average).toBe(0);
    });

    it('should return 0 if all files are unrated', async () => {
      const filePaths = ['/path/to/image1.jpg', '/path/to/image2.jpg'];
      
      const mockMetadata: MediaMetadata = { tags: [], rating: 0, dateCreated: new Date() };

      vi.mocked(mockMetadataRepository.readMetadata)
        .mockResolvedValue(mockMetadata);

      const average = await ratingService.getAverageRating(filePaths);

      expect(average).toBe(0);
    });
  });

  describe('getRatingDistribution', () => {
    it('should calculate rating distribution correctly', async () => {
      const filePaths = [
        '/path/to/image1.jpg',
        '/path/to/image2.jpg',
        '/path/to/image3.jpg',
        '/path/to/image4.jpg',
        '/path/to/image5.jpg'
      ];
      
      const mockMetadataList: MediaMetadata[] = [
        { tags: [], rating: 0, dateCreated: new Date() }, // Unrated
        { tags: [], rating: 3, dateCreated: new Date() },
        { tags: [], rating: 4, dateCreated: new Date() },
        { tags: [], rating: 4, dateCreated: new Date() },
        { tags: [], rating: 5, dateCreated: new Date() }
      ];

      vi.mocked(mockMetadataRepository.readMetadata)
        .mockImplementation(async (filePath) => {
          const index = filePaths.indexOf(filePath);
          return mockMetadataList[index];
        });

      const distribution = await ratingService.getRatingDistribution(filePaths);

      expect(distribution).toEqual({
        0: 1, // 1 unrated
        1: 0,
        2: 0,
        3: 1, // 1 with 3 stars
        4: 2, // 2 with 4 stars
        5: 1  // 1 with 5 stars
      });
    });

    it('should handle errors by counting as unrated', async () => {
      const filePaths = ['/path/to/image1.jpg', '/path/to/image2.jpg'];
      
      const mockMetadata: MediaMetadata = { tags: [], rating: 5, dateCreated: new Date() };

      vi.mocked(mockMetadataRepository.readMetadata)
        .mockResolvedValueOnce(mockMetadata)
        .mockRejectedValueOnce(new Error('File not found'));

      const distribution = await ratingService.getRatingDistribution(filePaths);

      expect(distribution).toEqual({
        0: 1, // 1 error counted as unrated
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 1  // 1 with 5 stars
      });
    });
  });
});