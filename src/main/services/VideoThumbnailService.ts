import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import sharp from 'sharp';

export interface VideoThumbnailOptions {
  size: number;
  timeOffset?: number; // seconds
  quality?: number;
}

export class VideoThumbnailService {
  private readonly supportedVideoFormats = new Set([
    '.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm', '.m4v', '.3gp'
  ]);

  private readonly tempDir = path.join(os.tmpdir(), 'portable-image-manager-thumbs');

  constructor() {
    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async generateVideoThumbnail(filePath: string, options: VideoThumbnailOptions): Promise<string> {
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`Video file not found: ${filePath}`);
      }

      // Check if it's a supported video format
      const extension = path.extname(filePath).toLowerCase();
      if (!this.supportedVideoFormats.has(extension)) {
        throw new Error(`Unsupported video format: ${extension}`);
      }

      // Try to extract frame using ffmpeg (if available)
      const thumbnail = await this.extractFrameWithFFmpeg(filePath, options);
      if (thumbnail) {
        return thumbnail;
      }

      // Fallback: Try to use Windows Media Foundation (Windows only)
      if (process.platform === 'win32') {
        const wmfThumbnail = await this.extractFrameWithWMF(filePath, options);
        if (wmfThumbnail) {
          return wmfThumbnail;
        }
      }

      // Final fallback: Generate a nice placeholder
      return this.generateVideoPlaceholder(filePath, options.size);

    } catch (error) {
      console.error(`Failed to generate video thumbnail for ${filePath}:`, error);
      return this.generateVideoPlaceholder(filePath, options.size);
    }
  }

  private async extractFrameWithFFmpeg(filePath: string, options: VideoThumbnailOptions): Promise<string | null> {
    return new Promise((resolve) => {
      const timeOffset = options.timeOffset || 1;
      const outputPath = path.join(this.tempDir, `thumb_${Date.now()}.jpg`);

      // Try to use ffmpeg
      const ffmpeg = spawn('ffmpeg', [
        '-i', filePath,
        '-ss', timeOffset.toString(),
        '-vframes', '1',
        '-f', 'image2',
        '-vf', `scale=${options.size}:${options.size}:force_original_aspect_ratio=increase,crop=${options.size}:${options.size}`,
        '-y', // Overwrite output file
        outputPath
      ], {
        stdio: 'pipe'
      });

      let hasError = false;

      ffmpeg.on('error', () => {
        hasError = true;
        resolve(null);
      });

      ffmpeg.on('close', async (code) => {
        if (hasError || code !== 0) {
          resolve(null);
          return;
        }

        try {
          if (fs.existsSync(outputPath)) {
            // Read the generated thumbnail and convert to base64
            const thumbnailBuffer = await fs.promises.readFile(outputPath);
            const base64 = thumbnailBuffer.toString('base64');
            
            // Clean up temp file
            fs.unlinkSync(outputPath);
            
            resolve(`data:image/jpeg;base64,${base64}`);
          } else {
            resolve(null);
          }
        } catch (error) {
          resolve(null);
        }
      });

      // Set timeout to prevent hanging
      setTimeout(() => {
        if (!hasError) {
          ffmpeg.kill();
          hasError = true;
          resolve(null);
        }
      }, 10000); // 10 second timeout
    });
  }

  private async extractFrameWithWMF(filePath: string, options: VideoThumbnailOptions): Promise<string | null> {
    // This would use Windows Media Foundation APIs
    // For now, return null to use placeholder
    return null;
  }

  private generateVideoPlaceholder(filePath: string, size: number): string {
    const fileName = path.basename(filePath, path.extname(filePath));
    const displayName = fileName.length > 12 ? fileName.substring(0, 10) + '...' : fileName;
    const extension = path.extname(filePath).toUpperCase().substring(1);
    
    const svg = `
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="videoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#1976d2;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#0d47a1;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#videoGrad)"/>
        <circle cx="50%" cy="40%" r="12" fill="white" opacity="0.9"/>
        <polygon points="${size/2-4},${size*0.4-6} ${size/2-4},${size*0.4+6} ${size/2+6},${size*0.4}" fill="#1976d2"/>
        <text x="50%" y="65%" text-anchor="middle" font-family="Arial" font-size="9" fill="white" font-weight="bold">
          ${extension}
        </text>
        <text x="50%" y="80%" text-anchor="middle" font-family="Arial" font-size="7" fill="white" opacity="0.8">
          ${displayName}
        </text>
      </svg>
    `;

    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  }

  isVideoFile(filePath: string): boolean {
    const extension = path.extname(filePath).toLowerCase();
    return this.supportedVideoFormats.has(extension);
  }

  async cleanup(): Promise<void> {
    try {
      // Clean up temp directory
      if (fs.existsSync(this.tempDir)) {
        const files = await fs.promises.readdir(this.tempDir);
        for (const file of files) {
          const filePath = path.join(this.tempDir, file);
          await fs.promises.unlink(filePath);
        }
      }
    } catch (error) {
      console.error('Error cleaning up video thumbnails:', error);
    }
  }
}