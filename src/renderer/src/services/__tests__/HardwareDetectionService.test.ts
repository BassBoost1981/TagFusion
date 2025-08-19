import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HardwareDetectionService } from '../HardwareDetectionService';

// Mock WebGL context
const mockWebGLContext = {
  getParameter: vi.fn(),
  getExtension: vi.fn(),
  getSupportedExtensions: vi.fn(),
  createBuffer: vi.fn(),
  bindBuffer: vi.fn(),
  bufferData: vi.fn(),
  createTexture: vi.fn(),
  bindTexture: vi.fn(),
  texImage2D: vi.fn(),
  texParameteri: vi.fn(),
  clear: vi.fn(),
  drawArrays: vi.fn(),
  finish: vi.fn(),
  COLOR_BUFFER_BIT: 16384,
  ARRAY_BUFFER: 34962,
  STATIC_DRAW: 35044,
  TRIANGLE_STRIP: 5,
  TEXTURE_2D: 3553,
  RGBA: 6408,
  UNSIGNED_BYTE: 5121,
  LINEAR: 9729,
  TEXTURE_MIN_FILTER: 10241,
  TEXTURE_MAG_FILTER: 10240,
  MAX_TEXTURE_SIZE: 3379,
  MAX_RENDERBUFFER_SIZE: 34024
};

// Mock canvas
const mockCanvas = {
  getContext: vi.fn(),
  width: 0,
  height: 0
};

describe('HardwareDetectionService', () => {
  let service: HardwareDetectionService;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Mock navigator
    Object.defineProperty(global.navigator, 'hardwareConcurrency', {
      value: 8,
      writable: true
    });
    
    Object.defineProperty(global.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      writable: true
    });

    // Mock performance.memory
    Object.defineProperty(global.performance, 'memory', {
      value: {
        jsHeapSizeLimit: 2147483648,
        totalJSHeapSize: 50000000,
        usedJSHeapSize: 30000000
      },
      writable: true
    });

    // Mock document
    global.document = {
      createElement: vi.fn().mockReturnValue(mockCanvas)
    } as any;

    // Mock OffscreenCanvas
    global.OffscreenCanvas = vi.fn();
    global.createImageBitmap = vi.fn();
    global.Worker = vi.fn();

    // Setup WebGL context mock
    mockCanvas.getContext.mockImplementation((type) => {
      if (type === 'webgl2') {
        return { ...mockWebGLContext, constructor: { name: 'WebGL2RenderingContext' } };
      } else if (type === 'webgl') {
        return mockWebGLContext;
      }
      return null;
    });

    // Setup WebGL parameter returns
    mockWebGLContext.getParameter.mockImplementation((param) => {
      switch (param) {
        case mockWebGLContext.MAX_TEXTURE_SIZE:
          return 4096;
        case mockWebGLContext.MAX_RENDERBUFFER_SIZE:
          return 4096;
        case 37445: // UNMASKED_VENDOR_WEBGL
          return 'NVIDIA Corporation';
        case 37446: // UNMASKED_RENDERER_WEBGL
          return 'NVIDIA GeForce GTX 1080';
        default:
          return 0;
      }
    });

    mockWebGLContext.getExtension.mockImplementation((name) => {
      if (name === 'WEBGL_debug_renderer_info') {
        return {
          UNMASKED_VENDOR_WEBGL: 37445,
          UNMASKED_RENDERER_WEBGL: 37446
        };
      } else if (name === 'OES_texture_float') {
        return {};
      } else if (name === 'WEBGL_depth_texture') {
        return {};
      }
      return null;
    });

    mockWebGLContext.getSupportedExtensions.mockReturnValue([
      'OES_texture_float',
      'WEBGL_depth_texture',
      'EXT_texture_filter_anisotropic'
    ]);

    service = new HardwareDetectionService();
  });

  describe('CPU detection', () => {
    it('should detect CPU cores correctly', () => {
      const capabilities = service.getCapabilities();
      
      expect(capabilities.cpu.cores).toBe(8);
      expect(capabilities.cpu.threads).toBe(8);
      expect(capabilities.cpu.architecture).toBe('x64');
    });

    it('should handle missing hardwareConcurrency', () => {
      Object.defineProperty(global.navigator, 'hardwareConcurrency', {
        value: undefined,
        writable: true
      });

      const fallbackService = new HardwareDetectionService();
      const capabilities = fallbackService.getCapabilities();
      
      expect(capabilities.cpu.cores).toBe(4); // Default fallback
    });

    it('should detect ARM architecture', () => {
      Object.defineProperty(global.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 (arm64)',
        writable: true
      });

      const armService = new HardwareDetectionService();
      const capabilities = armService.getCapabilities();
      
      expect(capabilities.cpu.architecture).toBe('arm64');
    });
  });

  describe('GPU detection', () => {
    it('should detect GPU capabilities correctly', () => {
      const capabilities = service.getCapabilities();
      
      expect(capabilities.gpu.vendor).toBe('NVIDIA Corporation');
      expect(capabilities.gpu.renderer).toBe('NVIDIA GeForce GTX 1080');
      expect(capabilities.gpu.webglVersion).toBe('webgl2');
      expect(capabilities.gpu.maxTextureSize).toBe(4096);
      expect(capabilities.gpu.maxRenderBufferSize).toBe(4096);
      expect(capabilities.gpu.extensions).toContain('OES_texture_float');
      expect(capabilities.gpu.floatTextureSupported).toBe(true);
      expect(capabilities.gpu.depthTextureSupported).toBe(true);
    });

    it('should handle WebGL unavailability', () => {
      mockCanvas.getContext.mockReturnValue(null);
      
      const noWebGLService = new HardwareDetectionService();
      const capabilities = noWebGLService.getCapabilities();
      
      expect(capabilities.gpu.vendor).toBe('unknown');
      expect(capabilities.gpu.renderer).toBe('software');
      expect(capabilities.gpu.webglVersion).toBe('none');
      expect(capabilities.gpu.maxTextureSize).toBe(0);
    });

    it('should fallback to WebGL1 when WebGL2 is unavailable', () => {
      mockCanvas.getContext.mockImplementation((type) => {
        if (type === 'webgl2') return null;
        if (type === 'webgl') return mockWebGLContext;
        return null;
      });

      const webgl1Service = new HardwareDetectionService();
      const capabilities = webgl1Service.getCapabilities();
      
      expect(capabilities.gpu.webglVersion).toBe('webgl1');
    });
  });

  describe('memory detection', () => {
    it('should detect memory information', () => {
      // Mock deviceMemory
      Object.defineProperty(global.navigator, 'deviceMemory', {
        value: 8,
        writable: true
      });

      const memoryService = new HardwareDetectionService();
      const capabilities = memoryService.getCapabilities();
      
      expect(capabilities.memory.deviceMemory).toBe(8);
      expect(capabilities.memory.jsHeapSizeLimit).toBe(2147483648);
      expect(capabilities.memory.totalJSHeapSize).toBe(50000000);
      expect(capabilities.memory.usedJSHeapSize).toBe(30000000);
    });

    it('should handle missing memory information', () => {
      delete (global.performance as any).memory;
      delete (global.navigator as any).deviceMemory;

      const noMemoryService = new HardwareDetectionService();
      const capabilities = noMemoryService.getCapabilities();
      
      expect(capabilities.memory.deviceMemory).toBeUndefined();
      expect(capabilities.memory.jsHeapSizeLimit).toBeUndefined();
    });
  });

  describe('canvas capabilities detection', () => {
    it('should detect canvas capabilities correctly', () => {
      const capabilities = service.getCapabilities();
      
      expect(capabilities.canvas.offscreenCanvasSupported).toBe(true);
      expect(capabilities.canvas.imageBitmapSupported).toBe(true);
      expect(capabilities.canvas.webWorkersSupported).toBe(true);
      expect(capabilities.canvas.transferableObjectsSupported).toBe(true);
    });

    it('should handle missing canvas features', () => {
      delete (global as any).OffscreenCanvas;
      delete (global as any).createImageBitmap;
      delete (global as any).Worker;

      const limitedService = new HardwareDetectionService();
      const capabilities = limitedService.getCapabilities();
      
      expect(capabilities.canvas.offscreenCanvasSupported).toBe(false);
      expect(capabilities.canvas.imageBitmapSupported).toBe(false);
      expect(capabilities.canvas.webWorkersSupported).toBe(false);
    });
  });

  describe('performance hints', () => {
    it('should generate appropriate performance hints for high-end hardware', () => {
      Object.defineProperty(global.navigator, 'deviceMemory', {
        value: 16,
        writable: true
      });

      const highEndService = new HardwareDetectionService();
      const capabilities = highEndService.getCapabilities();
      
      expect(capabilities.performance.recommendedWorkers).toBeGreaterThan(2);
      expect(capabilities.performance.recommendedBatchSize).toBeGreaterThan(10);
      expect(capabilities.performance.gpuAccelerationRecommended).toBe(true);
      expect(capabilities.performance.memoryConstraints).toBe('high');
    });

    it('should generate conservative hints for low-end hardware', () => {
      Object.defineProperty(global.navigator, 'hardwareConcurrency', {
        value: 2,
        writable: true
      });
      
      Object.defineProperty(global.navigator, 'deviceMemory', {
        value: 2,
        writable: true
      });

      mockCanvas.getContext.mockReturnValue(null); // No WebGL

      const lowEndService = new HardwareDetectionService();
      const capabilities = lowEndService.getCapabilities();
      
      expect(capabilities.performance.recommendedWorkers).toBeLessThanOrEqual(4);
      expect(capabilities.performance.gpuAccelerationRecommended).toBe(false);
      expect(capabilities.performance.memoryConstraints).toBe('low');
    });
  });

  describe('performance profiles', () => {
    it('should generate appropriate performance profiles', () => {
      const profiles = service.getPerformanceProfiles();
      
      expect(profiles).toHaveLength(3);
      expect(profiles.map(p => p.name)).toEqual(['high', 'balanced', 'low']);
      
      const highProfile = profiles.find(p => p.name === 'high')!;
      expect(highProfile.settings.useGPUAcceleration).toBe(true);
      expect(highProfile.settings.thumbnailQuality).toBe('high');
      
      const lowProfile = profiles.find(p => p.name === 'low')!;
      expect(lowProfile.settings.useGPUAcceleration).toBe(false);
      expect(lowProfile.settings.thumbnailQuality).toBe('low');
    });

    it('should recommend appropriate profile based on hardware', () => {
      const recommended = service.getRecommendedProfile();
      expect(recommended.name).toBe('high'); // High-end mock hardware
    });

    it('should recommend low profile for limited hardware', () => {
      mockCanvas.getContext.mockReturnValue(null); // No WebGL
      Object.defineProperty(global.navigator, 'deviceMemory', {
        value: 2,
        writable: true
      });

      const limitedService = new HardwareDetectionService();
      const recommended = limitedService.getRecommendedProfile();
      
      expect(recommended.name).toBe('low');
    });
  });

  describe('GPU performance testing', () => {
    it('should test GPU performance successfully', async () => {
      mockWebGLContext.createBuffer.mockReturnValue({});
      mockWebGLContext.createTexture.mockReturnValue({});
      
      const result = await service.testGPUPerformance();
      
      expect(result.supported).toBe(true);
      expect(result.renderTime).toBeGreaterThan(0);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(mockWebGLContext.drawArrays).toHaveBeenCalled();
      expect(mockWebGLContext.finish).toHaveBeenCalled();
    });

    it('should handle GPU performance test failure', async () => {
      mockCanvas.getContext.mockReturnValue(null);
      
      const result = await service.testGPUPerformance();
      
      expect(result.supported).toBe(false);
      expect(result.renderTime).toBe(0);
      expect(result.score).toBe(0);
    });

    it('should handle GPU test errors gracefully', async () => {
      mockWebGLContext.createBuffer.mockImplementation(() => {
        throw new Error('GPU error');
      });
      
      const result = await service.testGPUPerformance();
      
      expect(result.supported).toBe(false);
    });
  });

  describe('memory monitoring', () => {
    it('should monitor memory usage', () => {
      const usage = service.getMemoryUsage();
      
      expect(usage.used).toBe(30000000);
      expect(usage.total).toBe(2147483648);
      expect(usage.percentage).toBeCloseTo(1.4, 1);
    });

    it('should detect memory pressure', () => {
      // Mock high memory usage
      Object.defineProperty(global.performance, 'memory', {
        value: {
          jsHeapSizeLimit: 100000000,
          totalJSHeapSize: 90000000,
          usedJSHeapSize: 85000000
        },
        writable: true
      });

      const highMemoryService = new HardwareDetectionService();
      expect(highMemoryService.isMemoryPressureHigh()).toBe(true);
    });

    it('should handle missing memory API', () => {
      delete (global.performance as any).memory;
      
      const noMemoryService = new HardwareDetectionService();
      const usage = noMemoryService.getMemoryUsage();
      
      expect(usage.used).toBe(0);
      expect(usage.total).toBe(0);
      expect(usage.percentage).toBe(0);
    });
  });

  describe('system summary', () => {
    it('should generate comprehensive system summary', () => {
      Object.defineProperty(global.navigator, 'deviceMemory', {
        value: 8,
        writable: true
      });

      const summary = service.getSystemSummary();
      
      expect(summary).toContain('CPU: 8 cores (x64)');
      expect(summary).toContain('GPU: NVIDIA Corporation NVIDIA GeForce GTX 1080');
      expect(summary).toContain('Memory: 8 GB');
      expect(summary).toContain('GPU Acceleration: Yes');
      expect(summary).toContain('OffscreenCanvas: Yes');
    });

    it('should handle unknown memory in summary', () => {
      const summary = service.getSystemSummary();
      expect(summary).toContain('Memory: unknown GB');
    });
  });

  describe('error handling', () => {
    it('should handle hardware detection errors gracefully', () => {
      // Mock error during detection
      vi.spyOn(console, 'error').mockImplementation(() => {});
      
      global.document.createElement = vi.fn().mockImplementation(() => {
        throw new Error('Canvas creation failed');
      });

      const errorService = new HardwareDetectionService();
      const capabilities = errorService.getCapabilities();
      
      // Should return default capabilities
      expect(capabilities.cpu.cores).toBe(4);
      expect(capabilities.gpu.webglVersion).toBe('none');
      expect(capabilities.performance.gpuAccelerationRecommended).toBe(false);
    });
  });
});