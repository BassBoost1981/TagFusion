import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OffscreenRenderingService } from '../OffscreenRenderingService';

// Mock OffscreenCanvas
class MockOffscreenCanvas {
  width: number = 0;
  height: number = 0;
  
  getContext(contextType: string) {
    if (contextType === '2d') {
      return {
        drawImage: vi.fn(),
        getImageData: vi.fn(),
        putImageData: vi.fn(),
        createImageData: vi.fn(),
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        scale: vi.fn(),
        rotate: vi.fn(),
        translate: vi.fn(),
        filter: '',
        globalAlpha: 1,
        globalCompositeOperation: 'source-over'
      };
    }
    return null;
  }
  
  transferToImageBitmap() {
    return new ImageBitmap();
  }
  
  convertToBlob() {
    return Promise.resolve(new Blob());
  }
}

// Mock ImageBitmap
class MockImageBitmap {
  width: number = 100;
  height: number = 100;
  close() {}
}

global.OffscreenCanvas = MockOffscreenCanvas as any;
global.ImageBitmap = MockImageBitmap as any;

describe('OffscreenRenderingService', () => {
  let service: OffscreenRenderingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new OffscreenRenderingService();
  });

  describe('isSupported', () => {
    it('should return true when OffscreenCanvas is supported', () => {
      expect(service.isSupported()).toBe(true);
    });

    it('should return false when OffscreenCanvas is not supported', () => {
      const originalOffscreenCanvas = global.OffscreenCanvas;
      delete (global as any).OffscreenCanvas;
      
      const newService = new OffscreenRenderingService();
      expect(newService.isSupported()).toBe(false);
      
      global.OffscreenCanvas = originalOffscreenCanvas;
    });
  });

  describe('createCanvas', () => {
    it('should create offscreen canvas with specified dimensions', () => {
      const canvas = service.createCanvas(800, 600);
      
      expect(canvas).toBeInstanceOf(MockOffscreenCanvas);
      expect(canvas.width).toBe(800);
      expect(canvas.height).toBe(600);
    });

    it('should throw error when OffscreenCanvas is not supported', () => {
      const originalOffscreenCanvas = global.OffscreenCanvas;
      delete (global as any).OffscreenCanvas;
      
      const newService = new OffscreenRenderingService();
      
      expect(() => newService.createCanvas(800, 600))
        .toThrow('OffscreenCanvas is not supported');
      
      global.OffscreenCanvas = originalOffscreenCanvas;
    });
  });

  describe('getContext', () => {
    it('should return 2D context for offscreen canvas', () => {
      const canvas = service.createCanvas(800, 600);
      const context = service.getContext(canvas, '2d');
      
      expect(context).toBeDefined();
      expect(context.drawImage).toBeDefined();
      expect(context.getImageData).toBeDefined();
    });

    it('should return null for unsupported context type', () => {
      const canvas = service.createCanvas(800, 600);
      const context = service.getContext(canvas, 'webgl' as any);
      
      expect(context).toBeNull();
    });
  });

  describe('processImageOffscreen', () => {
    it('should process image with brightness filter', async () => {
      const mockImageData = {
        data: new Uint8ClampedArray([255, 128, 64, 255]),
        width: 1,
        height: 1
      };
      
      const canvas = service.createCanvas(1, 1);
      const context = service.getContext(canvas, '2d')!;
      
      vi.mocked(context.getImageData).mockReturnValue(mockImageData as ImageData);
      vi.mocked(context.createImageData).mockReturnValue(mockImageData as ImageData);
      
      const result = await service.processImageOffscreen(
        mockImageData as ImageData,
        { type: 'brightness', value: 0.5 }
      );
      
      expect(result).toBeDefined();
      expect(context.putImageData).toHaveBeenCalled();
    });

    it('should process image with contrast filter', async () => {
      const mockImageData = {
        data: new Uint8ClampedArray([255, 128, 64, 255]),
        width: 1,
        height: 1
      };
      
      const result = await service.processImageOffscreen(
        mockImageData as ImageData,
        { type: 'contrast', value: 1.5 }
      );
      
      expect(result).toBeDefined();
    });

    it('should process image with saturation filter', async () => {
      const mockImageData = {
        data: new Uint8ClampedArray([255, 128, 64, 255]),
        width: 1,
        height: 1
      };
      
      const result = await service.processImageOffscreen(
        mockImageData as ImageData,
        { type: 'saturation', value: 0.8 }
      );
      
      expect(result).toBeDefined();
    });

    it('should handle unsupported filter types', async () => {
      const mockImageData = {
        data: new Uint8ClampedArray([255, 128, 64, 255]),
        width: 1,
        height: 1
      };
      
      await expect(service.processImageOffscreen(
        mockImageData as ImageData,
        { type: 'unsupported' as any, value: 1.0 }
      )).rejects.toThrow('Unsupported filter type: unsupported');
    });

    it('should throw error when OffscreenCanvas is not supported', async () => {
      const originalOffscreenCanvas = global.OffscreenCanvas;
      delete (global as any).OffscreenCanvas;
      
      const newService = new OffscreenRenderingService();
      const mockImageData = {
        data: new Uint8ClampedArray([255, 128, 64, 255]),
        width: 1,
        height: 1
      };
      
      await expect(newService.processImageOffscreen(
        mockImageData as ImageData,
        { type: 'brightness', value: 0.5 }
      )).rejects.toThrow('OffscreenCanvas is not supported');
      
      global.OffscreenCanvas = originalOffscreenCanvas;
    });
  });

  describe('resizeImageOffscreen', () => {
    it('should resize image to specified dimensions', async () => {
      const mockImage = new Image();
      Object.defineProperty(mockImage, 'width', { value: 200 });
      Object.defineProperty(mockImage, 'height', { value: 200 });
      
      const canvas = service.createCanvas(100, 100);
      const context = service.getContext(canvas, '2d')!;
      
      const result = await service.resizeImageOffscreen(mockImage, 100, 100);
      
      expect(result).toBeInstanceOf(MockImageBitmap);
      expect(context.drawImage).toHaveBeenCalledWith(mockImage, 0, 0, 100, 100);
    });

    it('should maintain aspect ratio when only width is specified', async () => {
      const mockImage = new Image();
      Object.defineProperty(mockImage, 'width', { value: 200 });
      Object.defineProperty(mockImage, 'height', { value: 100 });
      
      const result = await service.resizeImageOffscreen(mockImage, 100);
      
      expect(result).toBeInstanceOf(MockImageBitmap);
    });

    it('should throw error when OffscreenCanvas is not supported', async () => {
      const originalOffscreenCanvas = global.OffscreenCanvas;
      delete (global as any).OffscreenCanvas;
      
      const newService = new OffscreenRenderingService();
      const mockImage = new Image();
      
      await expect(newService.resizeImageOffscreen(mockImage, 100, 100))
        .rejects.toThrow('OffscreenCanvas is not supported');
      
      global.OffscreenCanvas = originalOffscreenCanvas;
    });
  });

  describe('convertToBlob', () => {
    it('should convert canvas to blob', async () => {
      const canvas = service.createCanvas(100, 100);
      
      const result = await service.convertToBlob(canvas);
      
      expect(result).toBeInstanceOf(Blob);
    });

    it('should convert canvas to blob with specified type and quality', async () => {
      const canvas = service.createCanvas(100, 100);
      
      const result = await service.convertToBlob(canvas, 'image/jpeg', 0.8);
      
      expect(result).toBeInstanceOf(Blob);
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', () => {
      // Should not throw
      expect(() => service.cleanup()).not.toThrow();
    });
  });

  describe('performance optimization', () => {
    it('should handle large images efficiently', async () => {
      const mockImageData = {
        data: new Uint8ClampedArray(4000000), // 1000x1000 image
        width: 1000,
        height: 1000
      };
      
      const startTime = Date.now();
      
      const result = await service.processImageOffscreen(
        mockImageData as ImageData,
        { type: 'brightness', value: 0.5 }
      );
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      expect(result).toBeDefined();
      // Should complete within reasonable time (less than 1 second for test)
      expect(processingTime).toBeLessThan(1000);
    });
  });

  describe('error handling', () => {
    it('should handle invalid image data gracefully', async () => {
      const invalidImageData = {
        data: new Uint8ClampedArray([]), // Empty data
        width: 0,
        height: 0
      };
      
      await expect(service.processImageOffscreen(
        invalidImageData as ImageData,
        { type: 'brightness', value: 0.5 }
      )).rejects.toThrow();
    });

    it('should handle negative dimensions', () => {
      expect(() => service.createCanvas(-100, 100))
        .toThrow();
    });

    it('should handle zero dimensions', () => {
      expect(() => service.createCanvas(0, 0))
        .toThrow();
    });
  });
});