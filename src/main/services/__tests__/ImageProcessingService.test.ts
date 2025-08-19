import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ImageProcessingService } from '../ImageProcessingService';
import { ImageOperation } from '../../../types/global';

// Mock Sharp
const mockSharp = {
  metadata: vi.fn(),
  modulate: vi.fn(),
  linear: vi.fn(),
  rotate: vi.fn(),
  extract: vi.fn(),
  resize: vi.fn(),
  jpeg: vi.fn(),
  png: vi.fn(),
  webp: vi.fn(),
  toFile: vi.fn(),
};

// Mock the Sharp constructor
const mockSharpConstructor = vi.fn(() => mockSharp);

// Mock fs/promises
vi.mock('fs/promises', () => ({
  access: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

// Mock Sharp module
vi.mock('sharp', () => mockSharpConstructor);

describe('ImageProcessingService', () => {
  let service: ImageProcessingService;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock chain
    mockSharp.modulate.mockReturnValue(mockSharp);
    mockSharp.linear.mockReturnValue(mockSharp);
    mockSharp.rotate.mockReturnValue(mockSharp);
    mockSharp.extract.mockReturnValue(mockSharp);
    mockSharp.resize.mockReturnValue(mockSharp);
    mockSharp.jpeg.mockReturnValue(mockSharp);
    mockSharp.png.mockReturnValue(mockSharp);
    mockSharp.webp.mockReturnValue(mockSharp);
    mockSharp.toFile.mockResolvedValue(undefined);
    mockSharp.metadata.mockResolvedValue({ width: 1920, height: 1080, format: 'jpeg' });

    service = new ImageProcessingService();
  });

  describe('processAndSaveImage', () => {
    const inputPath = '/test/input.jpg';
    const outputPath = '/test/output.jpg';

    it('should process image with brightness operation', async () => {
      const operations: ImageOperation[] = [
        {
          type: 'brightness',
          value: 50,
          timestamp: new Date(),
        },
      ];

      const result = await service.processAndSaveImage(inputPath, outputPath, operations);

      expect(result.success).toBe(true);
      expect(mockSharpConstructor).toHaveBeenCalledWith(inputPath);
      expect(mockSharp.modulate).toHaveBeenCalledWith({ brightness: 1.5 });
      expect(mockSharp.jpeg).toHaveBeenCalledWith({ quality: 90 });
      expect(mockSharp.toFile).toHaveBeenCalledWith(outputPath);
    });

    it('should process image with contrast operation', async () => {
      const operations: ImageOperation[] = [
        {
          type: 'contrast',
          value: 25,
          timestamp: new Date(),
        },
      ];

      const result = await service.processAndSaveImage(inputPath, outputPath, operations);

      expect(result.success).toBe(true);
      expect(mockSharp.linear).toHaveBeenCalledWith(1.25, 0);
    });

    it('should process image with saturation operation', async () => {
      const operations: ImageOperation[] = [
        {
          type: 'saturation',
          value: 150,
          timestamp: new Date(),
        },
      ];

      const result = await service.processAndSaveImage(inputPath, outputPath, operations);

      expect(result.success).toBe(true);
      expect(mockSharp.modulate).toHaveBeenCalledWith({ saturation: 1.5 });
    });

    it('should process image with rotation operation', async () => {
      const operations: ImageOperation[] = [
        {
          type: 'rotate',
          value: { degrees: 90 },
          timestamp: new Date(),
        },
      ];

      const result = await service.processAndSaveImage(inputPath, outputPath, operations);

      expect(result.success).toBe(true);
      expect(mockSharp.rotate).toHaveBeenCalledWith(90);
    });

    it('should process image with crop operation', async () => {
      const operations: ImageOperation[] = [
        {
          type: 'crop',
          value: { x: 10, y: 20, width: 100, height: 200 },
          timestamp: new Date(),
        },
      ];

      const result = await service.processAndSaveImage(inputPath, outputPath, operations);

      expect(result.success).toBe(true);
      expect(mockSharp.extract).toHaveBeenCalledWith({
        left: 10,
        top: 20,
        width: 100,
        height: 200,
      });
    });

    it('should process image with resize operation', async () => {
      const operations: ImageOperation[] = [
        {
          type: 'resize',
          value: 0.5,
          timestamp: new Date(),
        },
      ];

      const result = await service.processAndSaveImage(inputPath, outputPath, operations);

      expect(result.success).toBe(true);
      expect(mockSharp.metadata).toHaveBeenCalled();
      expect(mockSharp.resize).toHaveBeenCalledWith(960, 540);
    });

    it('should process multiple operations in sequence', async () => {
      const operations: ImageOperation[] = [
        {
          type: 'brightness',
          value: 25,
          timestamp: new Date(),
        },
        {
          type: 'rotate',
          value: { degrees: 90 },
          timestamp: new Date(),
        },
      ];

      const result = await service.processAndSaveImage(inputPath, outputPath, operations);

      expect(result.success).toBe(true);
      expect(mockSharp.modulate).toHaveBeenCalledWith({ brightness: 1.25 });
      expect(mockSharp.rotate).toHaveBeenCalledWith(90);
    });

    it('should save as PNG when output path has .png extension', async () => {
      const pngOutputPath = '/test/output.png';
      const operations: ImageOperation[] = [];

      const result = await service.processAndSaveImage(inputPath, pngOutputPath, operations);

      expect(result.success).toBe(true);
      expect(mockSharp.png).toHaveBeenCalledWith({ quality: 9 });
      expect(mockSharp.toFile).toHaveBeenCalledWith(pngOutputPath);
    });

    it('should handle errors gracefully', async () => {
      mockSharp.toFile.mockRejectedValue(new Error('Save failed'));

      const operations: ImageOperation[] = [];
      const result = await service.processAndSaveImage(inputPath, outputPath, operations);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Save failed');
    });
  });

  describe('getImageMetadata', () => {
    it('should return image metadata', async () => {
      const filePath = '/test/image.jpg';
      mockSharp.metadata.mockResolvedValue({
        width: 1920,
        height: 1080,
        format: 'jpeg',
      });

      const metadata = await service.getImageMetadata(filePath);

      expect(metadata).toEqual({
        width: 1920,
        height: 1080,
        format: 'jpeg',
      });
      expect(mockSharpConstructor).toHaveBeenCalledWith(filePath);
    });

    it('should handle metadata errors', async () => {
      mockSharp.metadata.mockRejectedValue(new Error('Metadata failed'));

      const metadata = await service.getImageMetadata('/test/image.jpg');

      expect(metadata).toBeNull();
    });
  });

  describe('saveCanvasToFile', () => {
    it('should save canvas data URL to file', async () => {
      const canvasDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8A';
      const outputPath = '/test/output.jpg';

      const result = await service.saveCanvasToFile(canvasDataUrl, outputPath);

      expect(result.success).toBe(true);
      expect(mockSharpConstructor).toHaveBeenCalledWith(expect.any(Buffer));
      expect(mockSharp.jpeg).toHaveBeenCalledWith({ quality: 90 });
      expect(mockSharp.toFile).toHaveBeenCalledWith(outputPath);
    });

    it('should handle canvas save errors', async () => {
      mockSharp.toFile.mockRejectedValue(new Error('Canvas save failed'));

      const canvasDataUrl = 'data:image/jpeg;base64,invalid';
      const result = await service.saveCanvasToFile(canvasDataUrl, '/test/output.jpg');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Canvas save failed');
    });
  });

  describe('isAvailable', () => {
    it('should return true when Sharp is available', () => {
      expect(service.isAvailable()).toBe(true);
    });
  });
});