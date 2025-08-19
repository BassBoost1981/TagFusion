import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

export interface ThumbnailWorkerData {
  filePath: string;
  size: number;
  quality?: number;
  type: 'image' | 'video';
}

export interface ThumbnailWorkerResult {
  success: boolean;
  thumbnail?: string; // Base64 data URL
  error?: string;
}

// Worker thread code
if (!isMainThread) {
  const data: ThumbnailWorkerData = workerData;
  
  async function generateThumbnail(): Promise<ThumbnailWorkerResult> {
    try {
      if (!fs.existsSync(data.filePath)) {
        throw new Error(`File not found: ${data.filePath}`);
      }

      if (data.type === 'image') {
        // Generate image thumbnail using Sharp
        const thumbnailBuffer = await sharp(data.filePath)
          .resize(data.size, data.size, {
            fit: 'cover',
            position: 'center'
          })
          .jpeg({ 
            quality: data.quality || 80,
            progressive: true
          })
          .toBuffer();

        const base64 = thumbnailBuffer.toString('base64');
        return {
          success: true,
          thumbnail: `data:image/jpeg;base64,${base64}`
        };
      } else {
        // For video files, return placeholder for now
        // FFmpeg processing would be too heavy for worker threads
        const fileName = path.basename(data.filePath, path.extname(data.filePath));
        const displayName = fileName.length > 10 ? fileName.substring(0, 8) + '...' : fileName;
        
        const svg = `
          <svg width="${data.size}" height="${data.size}" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#fce4ec"/>
            <text x="50%" y="35%" text-anchor="middle" font-family="Arial" font-size="16" fill="#c2185b">
              🎬
            </text>
            <text x="50%" y="65%" text-anchor="middle" font-family="Arial" font-size="8" fill="#c2185b">
              ${displayName}
            </text>
          </svg>
        `;

        return {
          success: true,
          thumbnail: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  // Execute thumbnail generation and send result back
  generateThumbnail()
    .then(result => {
      parentPort?.postMessage(result);
    })
    .catch(error => {
      parentPort?.postMessage({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    });
}

// Main thread helper class
export class ThumbnailWorkerManager {
  private static readonly MAX_WORKERS = 4;
  private workers: Worker[] = [];
  private workerQueue: Array<{
    data: ThumbnailWorkerData;
    resolve: (result: ThumbnailWorkerResult) => void;
    reject: (error: Error) => void;
  }> = [];

  async generateThumbnailInWorker(data: ThumbnailWorkerData): Promise<ThumbnailWorkerResult> {
    return new Promise((resolve, reject) => {
      this.workerQueue.push({ data, resolve, reject });
      this.processQueue();
    });
  }

  private processQueue(): void {
    if (this.workerQueue.length === 0) return;
    if (this.workers.length >= ThumbnailWorkerManager.MAX_WORKERS) return;

    const { data, resolve, reject } = this.workerQueue.shift()!;
    
    const worker = new Worker(__filename, {
      workerData: data
    });

    this.workers.push(worker);

    worker.on('message', (result: ThumbnailWorkerResult) => {
      resolve(result);
      this.cleanupWorker(worker);
    });

    worker.on('error', (error) => {
      reject(error);
      this.cleanupWorker(worker);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
      this.cleanupWorker(worker);
    });
  }

  private cleanupWorker(worker: Worker): void {
    const index = this.workers.indexOf(worker);
    if (index > -1) {
      this.workers.splice(index, 1);
    }
    worker.terminate();
    
    // Process next item in queue
    this.processQueue();
  }

  async shutdown(): Promise<void> {
    await Promise.all(this.workers.map(worker => worker.terminate()));
    this.workers = [];
    this.workerQueue = [];
  }
}