import { VideoService, VideoMetadata } from './VideoService';
import { MediaFile } from '../../types/global';
import * as path from 'path';

export interface VideoMetadataExtended extends VideoMetadata {
  title?: string;
  description?: string;
  tags?: string[];
  creationDate?: Date;
  location?: {
    latitude?: number;
    longitude?: number;
  };
}

export interface IVideoMetadataService {
  extractVideoMetadata(filePath: string): Promise<VideoMetadataExtended>;
  extractBatchVideoMetadata(files: MediaFile[]): Promise<Map<string, VideoMetadataExtended>>;
  isVideoFile(filePath: string): boolean;
  getSupportedVideoFormats(): string[];
}

export class VideoMetadataService implements IVideoMetadataService {
  private videoService: VideoService;

  constructor() {
    this.videoService = new VideoService();
  }

  public async extractVideoMetadata(filePath: string): Promise<VideoMetadataExtended> {
    if (!this.isVideoFile(filePath)) {
      throw new Error(`File ${filePath} is not a supported video format`);
    }

    try {
      // Get basic video metadata from VideoService
      const basicMetadata = await this.videoService.extractVideoMetadata(filePath);
      
      // Extend with additional metadata extraction
      const extendedMetadata: VideoMetadataExtended = {
        ...basicMetadata,
        title: this.extractTitleFromFilename(filePath),
        creationDate: await this.getFileCreationDate(filePath),
      };

      // TODO: In the future, we could add more sophisticated metadata extraction
      // such as reading video file metadata tags, GPS data, etc.
      
      return extendedMetadata;
    } catch (error) {
      console.error(`Failed to extract video metadata for ${filePath}:`, error);
      throw error;
    }
  }

  public async extractBatchVideoMetadata(files: MediaFile[]): Promise<Map<string, VideoMetadataExtended>> {
    const results = new Map<string, VideoMetadataExtended>();
    const videoFiles = files.filter(file => this.isVideoFile(file.path));
    
    // Process in batches to avoid overwhelming the system
    const batchSize = 5;
    for (let i = 0; i < videoFiles.length; i += batchSize) {
      const batch = videoFiles.slice(i, i + batchSize);
      
      const promises = batch.map(async (file) => {
        try {
          const metadata = await this.extractVideoMetadata(file.path);
          results.set(file.path, metadata);
        } catch (error) {
          console.warn(`Failed to extract metadata for ${file.path}:`, error);
          // Don't add to results if extraction failed
        }
      });
      
      await Promise.allSettled(promises);
    }
    
    return results;
  }

  public isVideoFile(filePath: string): boolean {
    return this.videoService.isVideoFile(filePath);
  }

  public getSupportedVideoFormats(): string[] {
    return this.videoService.getSupportedVideoFormats();
  }

  private extractTitleFromFilename(filePath: string): string {
    const filename = path.basename(filePath, path.extname(filePath));
    
    // Clean up common filename patterns
    return filename
      .replace(/[-_]/g, ' ') // Replace dashes and underscores with spaces
      .replace(/\b\w/g, l => l.toUpperCase()) // Capitalize first letter of each word
      .trim();
  }

  private async getFileCreationDate(filePath: string): Promise<Date> {
    try {
      const fs = await import('fs/promises');
      const stats = await fs.stat(filePath);
      return stats.birthtime || stats.mtime; // Use creation time or modification time as fallback
    } catch (error) {
      console.warn(`Failed to get creation date for ${filePath}:`, error);
      return new Date(); // Return current date as fallback
    }
  }

  public async dispose(): Promise<void> {
    await this.videoService.dispose();
  }
}