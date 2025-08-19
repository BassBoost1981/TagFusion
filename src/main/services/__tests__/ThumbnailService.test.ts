import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThumbnailService } from '../ThumbnailService';
import sharp from 'sharp';

// Mock sharp
vi.mock('sharp');

// Mock worker_threads
vi.mock('worker_threads', () => ({
  Worker: vi.fn().mockImplementation(() => ({
    postMessage: vi.fn(),
    terminate: vi.fn(),
    on: vi.fn()
  })),
  isMainThread: true
}));

// Mock fs
vi.mock('fs', () => ({
  promises: {
    access: vi.fn(),
    readFile: vi.fn()
  },
  constants: {
    F_OK: 0
  }
}));

// Mock path
vi.mock('path', () => ({
  extname: vi.fn(),
  join: vi.fn(),
  dirname: vi.fn(),
  basename: vi.fn()
}));

describe('ThumbnailService', () => {
  let thumbnailService: ThumbnailService;
  let mockSharp: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup sharp mock
    mockSharp = {
      resize: vi.fn().mockReturnThis(),
      jpeg: vi.fn().mockReturnThis(),
      png: vi.fn().mockReturnThis(),
      toBuffer: vi.fn()
    };
    
    vi.mocked(sharp).mockReturnValue(mockSharp);
    
    thumbnailService = new ThumbnailService();
  });

  describe('generateImageThumbnail', () => {
    it('should generate thumbnail for JPEG image', async () => {
      const mockBuffer = Buffer.from('thumbnail-data');
      mockSharp.toBuffer.mockResolvedValue(mockBuffer);
      
      const result = await thumbnailService.generateImageThumbnail('/path/to/image.jpg', 200);
      
      expect(sharp).toHaveBeenCalledWith('/path/to/image.jpg');
      expect(mockSharp.resize).toHaveBeenCalledWith(200, 200, {
        fit: 'cover',
        position: 'center'
      });
      expect(mockSharp.jpeg).toHaveBeenCalledWith({ quality: 80 });
      expect(result).toBe(mockBuffer.toString('base64'));
    });

    it('should generate thumbnail for PNG image', async () => {
      const mockBuffer = Buffer.from('thumbnail-data');
      mockSharp.toBuffer.mockResolvedValue(mockBuffer);
      
      const result = await thumbnailService.generateImageThumbnail('/path/to/image.png', 150);
      
      expect(sharp).toHaveBeenCalledWith('/path/to/image.png');
      expect(mockSharp.resize).toHaveBeenCalledWith(150, 150, {
        fit: 'cover',
        position: 'center'
      });
      expect(mockSharp.png).toHaveBeenCalledWith({ quality: 80 });
      expect(result).toBe(mockBuffer.toString('base64'));
    });

    it('should handle sharp processing errors', async () => {
      mockSharp.toBuffer.mockRejectedValue(new Error('Sharp error'));
      
      await expect(thumbnailService.generateImageThumbnail('/path/to/image.jpg', 200))
        .rejects.toThrow('Sharp error');
    });

    it('should use default size when not specified', async () => {
      const mockBuffer = Buffer.from('thumbnail-data');
      mockSharp.toBuffer.mockResolvedValue(mockBuffer);
      
      await thumbnailService.generateImageThumbnail('/path/to/image.jpg');
      
      expect(mockSharp.resize).toHaveBeenCalledWith(256, 256, {
        fit: 'cover',
        position: 'center'
      });
    });
  });

  describe('generateVideoThumbnail', () => {
    it('should generate thumbnail for video using worker', async () => {
      const mockWorker = {
        postMessage: vi.fn(),
        terminate: vi.fn(),
        on: vi.fn()
      };
      
      const { Worker } = await import('worker_threads');
      vi.mocked(Worker).mockReturnValue(mockWorker as any);
      
      // Mock worker response
      mockWorker.on.mockImplementation((event, callback) => {
        if (event === 'message') {
          setTimeout(() => {
            callback({ success: true, thumbnail: 'base64-thumbnail-data' });
          }, 10);
        }
        if (event === 'error') {
          // No error for this test
        }
      });
      
      const result = await thumbnailService.generateVideoThumbnail('/path/to/video.mp4', 200);
      
      expect(Worker).toHaveBeenCalled();
      expect(mockWorker.postMessage).toHaveBeenCalledWith({
        filePath: '/path/to/video.mp4',
        size: 200
      });
      expect(result).toBe('base64-thumbnail-data');
      expect(mockWorker.terminate).toHaveBeenCalled();
    });

    it('should handle worker errors', async () => {
      const mockWorker = {
        postMessage: vi.fn(),
        terminate: vi.fn(),
        on: vi.fn()
      };
      
      const { Worker } = await import('worker_threads');
      vi.mocked(Worker).mockReturnValue(mockWorker as any);
      
      // Mock worker error
      mockWorker.on.mockImplementation((event, callback) => {
        if (event === 'error') {
          setTimeout(() => {
            callback(new Error('Worker error'));
          }, 10);
        }
      });
      
      await expect(thumbnailService.generateVideoThumbnail('/path/to/video.mp4', 200))
        .rejects.toThrow('Worker error');
      
      expect(mockWorker.terminate).toHaveBeenCalled();
    });

    it('should handle worker message errors', async () => {
      const mockWorker = {
        postMessage: vi.fn(),
        terminate: vi.fn(),
        on: vi.fn()
      };
      
      const { Worker } = await import('worker_threads');
      vi.mocked(Worker).mockReturnValue(mockWorker as any);
      
      // Mock worker response with error
      mockWorker.on.mockImplementation((event, callback) => {
        if (event === 'message') {
          setTimeout(() => {
            callback({ success: false, error: 'Processing failed' });
          }, 10);
        }
      });
      
      await expect(thumbnailService.generateVideoThumbnail('/path/to/video.mp4', 200))
        .rejects.toThrow('Processing failed');
      
      expect(mockWorker.terminate).toHaveBeenCalled();
    });

    it('should use default size when not specified', async () => {
      const mockWorker = {
        postMessage: vi.fn(),
        terminate: vi.fn(),
        on: vi.fn()
      };
      
      const { Worker } = await import('worker_threads');
      vi.mocked(Worker).mockReturnValue(mockWorker as any);
      
      // Mock worker response
      mockWorker.on.mockImplementation((event, callback) => {
        if (event === 'message') {
          setTimeout(() => {
            callback({ success: true, thumbnail: 'base64-thumbnail-data' });
          }, 10);
        }
      });
      
      await thumbnailService.generateVideoThumbnail('/path/to/video.mp4');
      
      expect(mockWorker.postMessage).toHaveBeenCalledWith({
        filePath: '/path/to/video.mp4',
        size: 256
      });
    });
  });

  describe('generateThumbnail', () => {
    it('should generate image thumbnail for image files', async () => {
      const mockBuffer = Buffer.from('thumbnail-data');
      mockSharp.toBuffer.mockResolvedValue(mockBuffer);
      
      const result = await thumbnailService.generateThumbnail('/path/to/image.jpg', 200);
      
      expect(result).toBe(mockBuffer.toString('base64'));
    });

    it('should generate video thumbnail for video files', async () => {
      const mockWorker = {
        postMessage: vi.fn(),
        terminate: vi.fn(),
        on: vi.fn()
      };
      
      const { Worker } = await import('worker_threads');
      vi.mocked(Worker).mockReturnValue(mockWorker as any);
      
      // Mock worker response
      mockWorker.on.mockImplementation((event, callback) => {
        if (event === 'message') {
          setTimeout(() => {
            callback({ success: true, thumbnail: 'base64-thumbnail-data' });
          }, 10);
        }
      });
      
      const result = await thumbnailService.generateThumbnail('/path/to/video.mp4', 200);
      
      expect(result).toBe('base64-thumbnail-data');
    });

    it('should throw error for unsupported file types', async () => {
      await expect(thumbnailService.generateThumbnail('/path/to/document.pdf', 200))
        .rejects.toThrow('Unsupported file type: .pdf');
    });
  });

  describe('isImageFile', () => {
    it('should return true for supported image extensions', () => {
      expect(thumbnailService.isImageFile('/path/to/image.jpg')).toBe(true);
      expect(thumbnailService.isImageFile('/path/to/image.jpeg')).toBe(true);
      expect(thumbnailService.isImageFile('/path/to/image.png')).toBe(true);
      expect(thumbnailService.isImageFile('/path/to/image.gif')).toBe(true);
      expect(thumbnailService.isImageFile('/path/to/image.bmp')).toBe(true);
      expect(thumbnailService.isImageFile('/path/to/image.tiff')).toBe(true);
      expect(thumbnailService.isImageFile('/path/to/image.webp')).toBe(true);
    });

    it('should return false for non-image files', () => {
      expect(thumbnailService.isImageFile('/path/to/video.mp4')).toBe(false);
      expect(thumbnailService.isImageFile('/path/to/document.pdf')).toBe(false);
      expect(thumbnailService.isImageFile('/path/to/file.txt')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(thumbnailService.isImageFile('/path/to/image.JPG')).toBe(true);
      expect(thumbnailService.isImageFile('/path/to/image.PNG')).toBe(true);
    });
  });

  describe('isVideoFile', () => {
    it('should return true for supported video extensions', () => {
      expect(thumbnailService.isVideoFile('/path/to/video.mp4')).toBe(true);
      expect(thumbnailService.isVideoFile('/path/to/video.avi')).toBe(true);
      expect(thumbnailService.isVideoFile('/path/to/video.mov')).toBe(true);
      expect(thumbnailService.isVideoFile('/path/to/video.mkv')).toBe(true);
      expect(thumbnailService.isVideoFile('/path/to/video.wmv')).toBe(true);
      expect(thumbnailService.isVideoFile('/path/to/video.flv')).toBe(true);
      expect(thumbnailService.isVideoFile('/path/to/video.webm')).toBe(true);
    });

    it('should return false for non-video files', () => {
      expect(thumbnailService.isVideoFile('/path/to/image.jpg')).toBe(false);
      expect(thumbnailService.isVideoFile('/path/to/document.pdf')).toBe(false);
      expect(thumbnailService.isVideoFile('/path/to/file.txt')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(thumbnailService.isVideoFile('/path/to/video.MP4')).toBe(true);
      expect(thumbnailService.isVideoFile('/path/to/video.AVI')).toBe(true);
    });
  });

  describe('isSupportedFile', () => {
    it('should return true for supported image and video files', () => {
      expect(thumbnailService.isSupportedFile('/path/to/image.jpg')).toBe(true);
      expect(thumbnailService.isSupportedFile('/path/to/video.mp4')).toBe(true);
    });

    it('should return false for unsupported files', () => {
      expect(thumbnailService.isSupportedFile('/path/to/document.pdf')).toBe(false);
      expect(thumbnailService.isSupportedFile('/path/to/file.txt')).toBe(false);
    });
  });

  describe('getFileExtension', () => {
    it('should return lowercase file extension', () => {
      expect(thumbnailService.getFileExtension('/path/to/image.JPG')).toBe('.jpg');
      expect(thumbnailService.getFileExtension('/path/to/video.MP4')).toBe('.mp4');
      expect(thumbnailService.getFileExtension('/path/to/file.txt')).toBe('.txt');
    });

    it('should handle files without extension', () => {
      expect(thumbnailService.getFileExtension('/path/to/file')).toBe('');
    });
  });

  describe('cleanup', () => {
    it('should terminate all active workers', async () => {
      // Create some workers
      const mockWorker1 = {
        postMessage: vi.fn(),
        terminate: vi.fn(),
        on: vi.fn()
      };
      
      const mockWorker2 = {
        postMessage: vi.fn(),
        terminate: vi.fn(),
        on: vi.fn()
      };
      
      const { Worker } = await import('worker_threads');
      vi.mocked(Worker)
        .mockReturnValueOnce(mockWorker1 as any)
        .mockReturnValueOnce(mockWorker2 as any);
      
      // Mock worker responses
      mockWorker1.on.mockImplementation((event, callback) => {
        if (event === 'message') {
          setTimeout(() => {
            callback({ success: true, thumbnail: 'data1' });
          }, 100);
        }
      });
      
      mockWorker2.on.mockImplementation((event, callback) => {
        if (event === 'message') {
          setTimeout(() => {
            callback({ success: true, thumbnail: 'data2' });
          }, 100);
        }
      });
      
      // Start some video thumbnail generations (don't await)
      thumbnailService.generateVideoThumbnail('/path/to/video1.mp4');
      thumbnailService.generateVideoThumbnail('/path/to/video2.mp4');
      
      // Give workers time to start
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Cleanup
      await thumbnailService.cleanup();
      
      expect(mockWorker1.terminate).toHaveBeenCalled();
      expect(mockWorker2.terminate).toHaveBeenCalled();
    });

    it('should handle cleanup when no workers are active', async () => {
      // Should not throw
      await expect(thumbnailService.cleanup()).resolves.not.toThrow();
    });
  });
});