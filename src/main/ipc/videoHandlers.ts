import { ipcMain } from 'electron';
import { VideoService } from '../services/VideoService';
import { VideoMetadataService } from '../services/VideoMetadataService';
import { VideoThumbnailOptions, MediaFile } from '../../types/global';

export class VideoHandlers {
  private videoService: VideoService;
  private videoMetadataService: VideoMetadataService;

  constructor() {
    this.videoService = new VideoService();
    this.videoMetadataService = new VideoMetadataService();
    this.registerHandlers();
  }

  private registerHandlers(): void {
    // Generate video thumbnail
    ipcMain.handle('video:generateThumbnail', async (event, filePath: string, options: VideoThumbnailOptions) => {
      try {
        const thumbnail = await this.videoService.generateVideoThumbnail(filePath, options);
        
        // Also get basic metadata for the thumbnail result
        let metadata;
        try {
          metadata = await this.videoService.extractVideoMetadata(filePath);
        } catch (error) {
          console.warn('Failed to extract metadata while generating thumbnail:', error);
        }

        return {
          thumbnail,
          metadata
        };
      } catch (error) {
        console.error('Failed to generate video thumbnail:', error);
        throw error;
      }
    });

    // Extract video metadata
    ipcMain.handle('video:extractMetadata', async (event, filePath: string) => {
      try {
        return await this.videoMetadataService.extractVideoMetadata(filePath);
      } catch (error) {
        console.error('Failed to extract video metadata:', error);
        throw error;
      }
    });

    // Check if file is a video
    ipcMain.handle('video:isVideoFile', async (event, filePath: string) => {
      try {
        return this.videoService.isVideoFile(filePath);
      } catch (error) {
        console.error('Failed to check if file is video:', error);
        return false;
      }
    });

    // Get supported video formats
    ipcMain.handle('video:getSupportedFormats', async (event) => {
      try {
        return this.videoService.getSupportedVideoFormats();
      } catch (error) {
        console.error('Failed to get supported video formats:', error);
        return [];
      }
    });

    // Generate batch video thumbnails
    ipcMain.handle('video:generateBatchThumbnails', async (
      event, 
      filePaths: string[], 
      options: VideoThumbnailOptions
    ) => {
      try {
        const results = new Map();
        
        // Process in batches to avoid overwhelming the system
        const batchSize = 3;
        for (let i = 0; i < filePaths.length; i += batchSize) {
          const batch = filePaths.slice(i, i + batchSize);
          
          const promises = batch.map(async (filePath) => {
            try {
              const thumbnail = await this.videoService.generateVideoThumbnail(filePath, options);
              
              // Also get basic metadata
              let metadata;
              try {
                metadata = await this.videoService.extractVideoMetadata(filePath);
              } catch (error) {
                console.warn(`Failed to extract metadata for ${filePath}:`, error);
              }

              results.set(filePath, { thumbnail, metadata });
            } catch (error) {
              console.warn(`Failed to generate thumbnail for ${filePath}:`, error);
              // Don't add to results if failed
            }
          });
          
          await Promise.allSettled(promises);
        }
        
        return results;
      } catch (error) {
        console.error('Failed to generate batch video thumbnails:', error);
        throw error;
      }
    });

    // Extract batch video metadata
    ipcMain.handle('video:extractBatchMetadata', async (event, filePaths: string[]) => {
      try {
        const videoFiles: MediaFile[] = filePaths.map(path => ({
          path,
          name: require('path').basename(path),
          extension: require('path').extname(path),
          size: 0,
          dateModified: new Date(),
          type: 'video' as const
        }));

        return await this.videoMetadataService.extractBatchVideoMetadata(videoFiles);
      } catch (error) {
        console.error('Failed to extract batch video metadata:', error);
        throw error;
      }
    });
  }

  public async dispose(): Promise<void> {
    await this.videoService.dispose();
    await this.videoMetadataService.dispose();
  }
}