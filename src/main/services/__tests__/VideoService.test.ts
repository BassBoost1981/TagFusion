import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { VideoService } from '../VideoService';
import { VideoThumbnailOptions } from '../../../types/global';
import * as fs from 'fs/promises';

// Mock FFmpeg
vi.mock('@ffmpeg/ffmpeg', () => ({
  FFmpeg: vi.fn().mockImplementation(() => ({
    load: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
    deleteFile: vi.fn(),
    exec: vi.fn(),
    on: vi.fn(),
    terminate: vi.fn()
  }))
}));

vi.mock('@ffmpeg/util', () => ({
  fetchFile: vi.fn(),
  toBlobURL: vi.fn().mockResolvedValue('blob:mock-url')
}));

// Mock fs
vi.mock('fs/promises');

describe('VideoService', () => {
  let videoService: VideoService;
  let mockFFmpeg: any;

  beforeEach(() => {
    videoService = new VideoService();
    mockFFmpeg = (videoService as any).ffmpeg;
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await videoService.dispose();
  });

  describe('isVideoFile', () => {
    it('should return true for supported video extensions', () => {
      expect(videoService.isVideoFile('test.mp4')).toBe(true);
      expect(videoService.isVideoFile('test.avi')).toBe(true);
      expect(videoService.isVideoFile('test.mov')).toBe(true);
      expect(videoService.isVideoFile('test.mkv')).toBe(true);
      expect(videoService.isVideoFile('test.webm')).toBe(true);
    });

    it('should return false for unsupported extensions', () => {
      expect(videoService.isVideoFile('test.jpg')).toBe(false);
      expect(videoService.isVideoFile('test.png')).toBe(false);
      expect(videoService.isVideoFile('test.txt')).toBe(false);
      expect(videoService.isVideoFile('test.pdf')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(videoService.isVideoFile('test.MP4')).toBe(true);
      expect(videoService.isVideoFile('test.AVI')).toBe(true);
      expect(videoService.isVideoFile('test.MoV')).toBe(true);
    });
  });

  describe('getSupportedVideoFormats', () => {
    it('should return array of supported video formats', () => {
      const formats = videoService.getSupportedVideoFormats();
      expect(Array.isArray(formats)).toBe(true);
      expect(formats).toContain('.mp4');
      expect(formats).toContain('.avi');
      expect(formats).toContain('.mov');
      expect(formats).toContain('.mkv');
      expect(formats).toContain('.webm');
    });
  });

  describe('initializeFFmpeg', () => {
    it('should initialize FFmpeg successfully', async () => {
      mockFFmpeg.load.mockResolvedValue(undefined);
      
      await videoService.initializeFFmpeg();
      
      expect(mockFFmpeg.load).toHaveBeenCalledWith({
        coreURL: 'blob:mock-url',
        wasmURL: 'blob:mock-url'
      });
    });

    it('should handle initialization failure', async () => {
      mockFFmpeg.load.mockRejectedValue(new Error('Failed to load FFmpeg'));
      
      await expect(videoService.initializeFFmpeg()).rejects.toThrow('Failed to initialize video processing engine');
    });

    it('should not initialize twice', async () => {
      mockFFmpeg.load.mockResolvedValue(undefined);
      
      await videoService.initializeFFmpeg();
      await videoService.initializeFFmpeg();
      
      expect(mockFFmpeg.load).toHaveBeenCalledTimes(1);
    });
  });

  describe('generateVideoThumbnail', () => {
    const mockOptions: VideoThumbnailOptions = {
      width: 200,
      height: 150,
      timeOffset: 1,
      quality: 80
    };

    beforeEach(() => {
      mockFFmpeg.load.mockResolvedValue(undefined);
      mockFFmpeg.exec.mockResolvedValue(undefined);
      mockFFmpeg.writeFile.mockResolvedValue(undefined);
      mockFFmpeg.readFile.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));
      mockFFmpeg.deleteFile.mockResolvedValue(undefined);
      (fs.access as Mock).mockResolvedValue(undefined);
      (fs.readFile as Mock).mockResolvedValue(Buffer.from('mock video data'));
    });

    it('should generate thumbnail for valid video file', async () => {
      const result = await videoService.generateVideoThumbnail('test.mp4', mockOptions);
      
      expect(result).toMatch(/^data:image\/jpeg;base64,/);
      expect(mockFFmpeg.exec).toHaveBeenCalledWith([
        '-i', 'input.mp4',
        '-ss', '1',
        '-vframes', '1',
        '-vf', 'scale=200:150',
        '-q:v', '2',
        '-y',
        'thumbnail.jpg'
      ]);
    });

    it('should reject non-video files', async () => {
      await expect(videoService.generateVideoThumbnail('test.jpg', mockOptions))
        .rejects.toThrow('File test.jpg is not a supported video format');
    });

    it('should handle file access errors', async () => {
      (fs.access as Mock).mockRejectedValue(new Error('File not found'));
      
      await expect(videoService.generateVideoThumbnail('test.mp4', mockOptions))
        .rejects.toThrow('Video thumbnail generation failed');
    });

    it('should handle FFmpeg execution errors', async () => {
      mockFFmpeg.exec.mockRejectedValue(new Error('FFmpeg error'));
      
      await expect(videoService.generateVideoThumbnail('test.mp4', mockOptions))
        .rejects.toThrow('Video thumbnail generation failed');
    });

    it('should use default time offset if not provided', async () => {
      const optionsWithoutOffset = { ...mockOptions };
      delete optionsWithoutOffset.timeOffset;
      
      await videoService.generateVideoThumbnail('test.mp4', optionsWithoutOffset);
      
      expect(mockFFmpeg.exec).toHaveBeenCalledWith(
        expect.arrayContaining(['-ss', '1'])
      );
    });

    it('should clean up temporary files', async () => {
      await videoService.generateVideoThumbnail('test.mp4', mockOptions);
      
      expect(mockFFmpeg.deleteFile).toHaveBeenCalledWith('input.mp4');
      expect(mockFFmpeg.deleteFile).toHaveBeenCalledWith('thumbnail.jpg');
    });
  });

  describe('extractVideoMetadata', () => {
    beforeEach(() => {
      mockFFmpeg.load.mockResolvedValue(undefined);
      mockFFmpeg.exec.mockRejectedValue(new Error('Expected failure for metadata extraction'));
      mockFFmpeg.writeFile.mockResolvedValue(undefined);
      mockFFmpeg.deleteFile.mockResolvedValue(undefined);
      let logCallback: Function | null = null;
      mockFFmpeg.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'log') {
          logCallback = callback;
        }
      });
      
      // Mock the exec method to call the log callback
      mockFFmpeg.exec.mockImplementation(async () => {
        if (logCallback) {
          logCallback({
            message: 'Duration: 00:01:30.50, start: 0.000000, bitrate: 1500 kb/s'
          });
          logCallback({
            message: 'Stream #0:0: Video: h264, 1920x1080, 30.00 fps'
          });
        }
        throw new Error('Expected failure for metadata extraction');
      });
      (fs.access as Mock).mockResolvedValue(undefined);
      (fs.readFile as Mock).mockResolvedValue(Buffer.from('mock video data'));
    });

    it('should extract metadata from valid video file', async () => {
      const result = await videoService.extractVideoMetadata('test.mp4');
      
      expect(result).toEqual({
        duration: 90.5,
        width: 1920,
        height: 1080,
        fps: 30,
        bitrate: 1500000,
        codec: 'h264',
        format: 'mp4'
      });
    });

    it('should reject non-video files', async () => {
      await expect(videoService.extractVideoMetadata('test.jpg'))
        .rejects.toThrow('File test.jpg is not a supported video format');
    });

    it('should handle file access errors', async () => {
      (fs.access as Mock).mockRejectedValue(new Error('File not found'));
      
      await expect(videoService.extractVideoMetadata('test.mp4'))
        .rejects.toThrow('Video metadata extraction failed');
    });

    it('should return default metadata when parsing fails', async () => {
      mockFFmpeg.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'log') {
          setTimeout(() => {
            callback({ message: 'Invalid log output' });
          }, 0);
        }
      });
      
      const result = await videoService.extractVideoMetadata('test.mp4');
      
      expect(result).toEqual({
        duration: 0,
        width: 0,
        height: 0,
        fps: 0,
        bitrate: 0,
        codec: 'unknown',
        format: 'mp4'
      });
    });
  });

  describe('dispose', () => {
    it('should terminate FFmpeg when initialized', async () => {
      mockFFmpeg.load.mockResolvedValue(undefined);
      await videoService.initializeFFmpeg();
      
      await videoService.dispose();
      
      expect(mockFFmpeg.terminate).toHaveBeenCalled();
    });

    it('should handle disposal when not initialized', async () => {
      await expect(videoService.dispose()).resolves.not.toThrow();
    });

    it('should handle termination errors', async () => {
      mockFFmpeg.load.mockResolvedValue(undefined);
      mockFFmpeg.terminate.mockRejectedValue(new Error('Termination error'));
      await videoService.initializeFFmpeg();
      
      await expect(videoService.dispose()).resolves.not.toThrow();
    });
  });
});