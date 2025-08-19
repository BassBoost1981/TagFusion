import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { ThumbnailWorkerManager, ThumbnailWorkerData } from '../workers/thumbnailWorker';
import { VideoThumbnailService } from './VideoThumbnailService';

export interface ThumbnailOptions {
  size: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

export interface VideoThumbnailOptions extends ThumbnailOptions {
  timeOffset?: number; // seconds
}

export class ThumbnailService {
  private readonly supportedImageFormats = new Set([
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'
  ]);

  private readonly supportedVideoFormats = new Set([
    '.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm'
  ]);

  private workerManager: ThumbnailWorkerManager;
  private videoThumbnailService: VideoThumbnailService;

  constructor() {
    this.workerManager = new ThumbnailWorkerManager();
    this.videoThumbnailService = new VideoThumbnailService();
  }

  async generateImageThumbnail(filePath: string, options: ThumbnailOptions): Promise<string> {
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Check if it's a supported image format
      const extension = path.extname(filePath).toLowerCase();
      if (!this.supportedImageFormats.has(extension)) {
        throw new Error(`Unsupported image format: ${extension}`);
      }

      // Use worker thread for better performance
      const workerData: ThumbnailWorkerData = {
        filePath,
        size: options.size,
        quality: options.quality,
        type: 'image'
      };

      const result = await this.workerManager.generateThumbnailInWorker(workerData);
      
      if (result.success && result.thumbnail) {
        return result.thumbnail;
      } else {
        throw new Error(result.error || 'Unknown worker error');
      }

    } catch (error) {
      console.error(`Failed to generate thumbnail for ${filePath}:`, error);
      
      // Return fallback placeholder
      return this.generatePlaceholderThumbnail(filePath, options.size, 'image');
    }
  }

  async generateVideoThumbnail(filePath: string, options: VideoThumbnailOptions): Promise<string> {
    try {
      // Use the dedicated video thumbnail service
      return await this.videoThumbnailService.generateVideoThumbnail(filePath, {
        size: options.size,
        timeOffset: options.timeOffset,
        quality: options.quality
      });
    } catch (error) {
      console.error(`Failed to generate video thumbnail for ${filePath}:`, error);
      return this.generatePlaceholderThumbnail(filePath, options.size, 'video');
    }
  }

  private async initializeFFmpeg(): Promise<void> {
    // FFmpeg initialization will be implemented when needed
    // For now, we use placeholder thumbnails for videos
    console.log('FFmpeg initialization skipped - using placeholders for videos');
  }

  async generateThumbnail(filePath: string, size: number): Promise<string> {
    const extension = path.extname(filePath).toLowerCase();
    
    if (this.supportedImageFormats.has(extension)) {
      return this.generateImageThumbnail(filePath, { size });
    } else if (this.supportedVideoFormats.has(extension)) {
      return this.generateVideoThumbnail(filePath, { size });
    } else {
      return this.generatePlaceholderThumbnail(filePath, size, 'file');
    }
  }

  public generatePlaceholderThumbnail(filePath: string, size: number, type: 'image' | 'video' | 'file'): string {
    const fileName = path.basename(filePath, path.extname(filePath));
    const displayName = fileName.length > 10 ? fileName.substring(0, 8) + '...' : fileName;
    
    let icon = '📄';
    let bgColor = '#f5f5f5';
    let textColor = '#666';
    
    switch (type) {
      case 'image':
        icon = '🖼️';
        bgColor = '#e3f2fd';
        textColor = '#1976d2';
        break;
      case 'video':
        icon = '🎬';
        bgColor = '#fce4ec';
        textColor = '#c2185b';
        break;
      case 'file':
        icon = '📄';
        bgColor = '#f5f5f5';
        textColor = '#666';
        break;
    }

    const svg = `
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${bgColor}"/>
        <text x="50%" y="35%" text-anchor="middle" font-family="Arial" font-size="16" fill="${textColor}">
          ${icon}
        </text>
        <text x="50%" y="65%" text-anchor="middle" font-family="Arial" font-size="8" fill="${textColor}">
          ${displayName}
        </text>
      </svg>
    `;

    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  }

  isImageFile(filePath: string): boolean {
    const extension = path.extname(filePath).toLowerCase();
    return this.supportedImageFormats.has(extension);
  }

  isVideoFile(filePath: string): boolean {
    const extension = path.extname(filePath).toLowerCase();
    return this.supportedVideoFormats.has(extension);
  }

  isSupportedFile(filePath: string): boolean {
    return this.isImageFile(filePath) || this.isVideoFile(filePath);
  }

  async shutdown(): Promise<void> {
    await this.workerManager.shutdown();
    await this.videoThumbnailService.cleanup();
  }
}