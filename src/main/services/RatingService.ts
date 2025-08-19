import { MediaFile } from '../../types/global';
import { IMetadataRepository } from '../repositories/MetadataRepository';

export interface IRatingService {
  getRating(filePath: string): Promise<number>;
  setRating(filePath: string, rating: number): Promise<void>;
  setBatchRating(filePaths: string[], rating: number): Promise<BatchRatingResult>;
  getAverageRating(filePaths: string[]): Promise<number>;
  getRatingDistribution(filePaths: string[]): Promise<RatingDistribution>;
}

export interface BatchRatingResult {
  successful: string[];
  failed: { filePath: string; error: string }[];
  totalProcessed: number;
}

export interface RatingDistribution {
  [rating: number]: number; // rating -> count
}

export class RatingService implements IRatingService {
  constructor(private metadataRepository: IMetadataRepository) {}

  /**
   * Get the rating for a single file
   */
  async getRating(filePath: string): Promise<number> {
    try {
      const metadata = await this.metadataRepository.readMetadata(filePath);
      return metadata.rating || 0;
    } catch (error) {
      console.error(`Error getting rating for ${filePath}:`, error);
      return 0;
    }
  }

  /**
   * Set the rating for a single file
   */
  async setRating(filePath: string, rating: number): Promise<void> {
    try {
      // Validate rating
      if (rating < 0 || rating > 5) {
        throw new Error('Rating must be between 0 and 5');
      }

      await this.metadataRepository.writeRating(filePath, rating);
    } catch (error) {
      console.error(`Error setting rating for ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Set the same rating for multiple files (batch operation)
   */
  async setBatchRating(filePaths: string[], rating: number): Promise<BatchRatingResult> {
    // Validate rating
    if (rating < 0 || rating > 5) {
      throw new Error('Rating must be between 0 and 5');
    }

    const result: BatchRatingResult = {
      successful: [],
      failed: [],
      totalProcessed: filePaths.length,
    };

    // Process files in parallel with limited concurrency to avoid overwhelming the system
    const concurrencyLimit = 5;
    const chunks = this.chunkArray(filePaths, concurrencyLimit);

    for (const chunk of chunks) {
      const promises = chunk.map(async (filePath) => {
        try {
          await this.setRating(filePath, rating);
          result.successful.push(filePath);
        } catch (error) {
          result.failed.push({
            filePath,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      });

      await Promise.all(promises);
    }

    return result;
  }

  /**
   * Calculate the average rating for a set of files
   */
  async getAverageRating(filePaths: string[]): Promise<number> {
    if (filePaths.length === 0) {
      return 0;
    }

    try {
      const ratings: number[] = [];

      // Get ratings for all files
      for (const filePath of filePaths) {
        try {
          const rating = await this.getRating(filePath);
          if (rating > 0) { // Only include rated files in average
            ratings.push(rating);
          }
        } catch (error) {
          console.warn(`Could not get rating for ${filePath}:`, error);
        }
      }

      if (ratings.length === 0) {
        return 0;
      }

      const sum = ratings.reduce((acc, rating) => acc + rating, 0);
      return Math.round((sum / ratings.length) * 10) / 10; // Round to 1 decimal place
    } catch (error) {
      console.error('Error calculating average rating:', error);
      return 0;
    }
  }

  /**
   * Get the distribution of ratings for a set of files
   */
  async getRatingDistribution(filePaths: string[]): Promise<RatingDistribution> {
    const distribution: RatingDistribution = {
      0: 0, // Unrated
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    try {
      for (const filePath of filePaths) {
        try {
          const rating = await this.getRating(filePath);
          distribution[rating]++;
        } catch (error) {
          console.warn(`Could not get rating for ${filePath}:`, error);
          distribution[0]++; // Count as unrated
        }
      }
    } catch (error) {
      console.error('Error calculating rating distribution:', error);
    }

    return distribution;
  }

  /**
   * Utility method to chunk an array into smaller arrays
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}