import { parentPort } from 'worker_threads';
import { VideoService } from '../services/VideoService';
import { VideoThumbnailOptions } from '../../types/global';

interface WorkerMessage {
  type: 'video';
  filePath: string;
  options: VideoThumbnailOptions;
}

interface WorkerResponse {
  thumbnail?: string;
  error?: string;
}

class VideoThumbnailWorker {
  private videoService: VideoService;

  constructor() {
    this.videoService = new VideoService();
    this.setupMessageHandler();
  }

  private setupMessageHandler(): void {
    if (!parentPort) {
      throw new Error('This script must be run as a worker thread');
    }

    parentPort.on('message', async (message: WorkerMessage) => {
      try {
        await this.processMessage(message);
      } catch (error) {
        this.sendError(error instanceof Error ? error.message : 'Unknown error');
      }
    });
  }

  private async processMessage(message: WorkerMessage): Promise<void> {
    if (message.type !== 'video') {
      throw new Error(`Unsupported message type: ${message.type}`);
    }

    try {
      const thumbnail = await this.videoService.generateVideoThumbnail(
        message.filePath,
        message.options
      );

      this.sendSuccess(thumbnail);
    } catch (error) {
      this.sendError(error instanceof Error ? error.message : 'Video thumbnail generation failed');
    }
  }

  private sendSuccess(thumbnail: string): void {
    if (parentPort) {
      const response: WorkerResponse = { thumbnail };
      parentPort.postMessage(response);
    }
  }

  private sendError(error: string): void {
    if (parentPort) {
      const response: WorkerResponse = { error };
      parentPort.postMessage(response);
    }
  }

  public async dispose(): Promise<void> {
    await this.videoService.dispose();
  }
}

// Initialize the worker
const worker = new VideoThumbnailWorker();

// Handle worker termination
process.on('SIGTERM', async () => {
  await worker.dispose();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await worker.dispose();
  process.exit(0);
});