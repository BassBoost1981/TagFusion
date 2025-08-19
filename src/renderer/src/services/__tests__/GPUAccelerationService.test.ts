import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GPUAccelerationService, ImageProcessingOptions } from '../GPUAccelerationService';

// Mock WebGL context
const mockWebGLContext = {
  getParameter: vi.fn(),
  getExtension: vi.fn(),
  createShader: vi.fn(),
  shaderSource: vi.fn(),
  compileShader: vi.fn(),
  getShaderParameter: vi.fn(),
  getShaderInfoLog: vi.fn(),
  deleteShader: vi.fn(),
  createProgram: vi.fn(),
  attachShader: vi.fn(),
  linkProgram: vi.fn(),
  getProgramParameter: vi.fn(),
  getProgramInfoLog: vi.fn(),
  useProgram: vi.fn(),
  getAttribLocation: vi.fn(),
  getUniformLocation: vi.fn(),
  enableVertexAttribArray: vi.fn(),
  vertexAttribPointer: vi.fn(),
  uniform1f: vi.fn(),
  uniform1i: vi.fn(),
  createBuffer: vi.fn(),
  bindBuffer: vi.fn(),
  bufferData: vi.fn(),
  createTexture: vi.fn(),
  bindTexture: vi.fn(),
  texImage2D: vi.fn(),
  texParameteri: vi.fn(),
  activeTexture: vi.fn(),
  viewport: vi.fn(),
  drawArrays: vi.fn(),
  readPixels: vi.fn(),
  deleteTexture: vi.fn(),
  createFramebuffer: vi.fn(),
  deleteFramebuffer: vi.fn(),
  deleteProgram: vi.fn(),
  VERTEX_SHADER: 35633,
  FRAGMENT_SHADER: 35632,
  COMPILE_STATUS: 35713,
  LINK_STATUS: 35714,
  MAX_TEXTURE_SIZE: 3379,
  MAX_RENDERBUFFER_SIZE: 34024,
  TEXTURE_2D: 3553,
  RGBA: 6408,
  UNSIGNED_BYTE: 5121,
  TEXTURE_WRAP_S: 10242,
  TEXTURE_WRAP_T: 10243,
  TEXTURE_MIN_FILTER: 10241,
  TEXTURE_MAG_FILTER: 10240,
  CLAMP_TO_EDGE: 33071,
  LINEAR: 9729,
  ARRAY_BUFFER: 34962,
  STATIC_DRAW: 35044,
  TRIANGLES: 4,
  TEXTURE0: 33984,
  FLOAT: 5126
};

// Mock canvas
const mockCanvas = {
  getContext: vi.fn(),
  width: 0,
  height: 0
};

// Mock OffscreenCanvas
const mockOffscreenCanvas = vi.fn().mockImplementation(() => mockCanvas);

describe('GPUAccelerationService', () => {
  let service: GPUAccelerationService;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Mock global objects
    global.OffscreenCanvas = mockOffscreenCanvas;
    global.document = {
      createElement: vi.fn().mockReturnValue(mockCanvas)
    } as any;

    // Setup WebGL context mock
    mockCanvas.getContext.mockImplementation((type) => {
      if (type === 'webgl2' || type === 'webgl') {
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
        default:
          return 0;
      }
    });

    mockWebGLContext.getExtension.mockImplementation((name) => {
      if (name === 'OES_texture_float') {
        return {};
      }
      return null;
    });

    // Setup shader compilation success
    mockWebGLContext.createShader.mockReturnValue({});
    mockWebGLContext.getShaderParameter.mockReturnValue(true);
    mockWebGLContext.createProgram.mockReturnValue({});
    mockWebGLContext.getProgramParameter.mockReturnValue(true);
    mockWebGLContext.createBuffer.mockReturnValue({});
    mockWebGLContext.createTexture.mockReturnValue({});
    mockWebGLContext.createFramebuffer.mockReturnValue({});

    service = new GPUAccelerationService();
  });

  afterEach(() => {
    service.dispose();
  });

  describe('initialization', () => {
    it('should initialize with WebGL2 context when available', () => {
      expect(mockCanvas.getContext).toHaveBeenCalledWith('webgl2');
      expect(service.isGPUAvailable()).toBe(true);
    });

    it('should fallback to WebGL1 when WebGL2 is not available', () => {
      mockCanvas.getContext.mockImplementation((type) => {
        if (type === 'webgl2') return null;
        if (type === 'webgl') return mockWebGLContext;
        return null;
      });

      const fallbackService = new GPUAccelerationService();
      expect(fallbackService.isGPUAvailable()).toBe(true);
      fallbackService.dispose();
    });

    it('should handle WebGL initialization failure gracefully', () => {
      mockCanvas.getContext.mockReturnValue(null);
      
      const failedService = new GPUAccelerationService();
      expect(failedService.isGPUAvailable()).toBe(false);
      expect(failedService.getCapabilities()).toBeNull();
    });
  });

  describe('capabilities detection', () => {
    it('should detect GPU capabilities correctly', () => {
      const capabilities = service.getCapabilities();
      
      expect(capabilities).toBeDefined();
      expect(capabilities?.webglSupported).toBe(true);
      expect(capabilities?.maxTextureSize).toBe(4096);
      expect(capabilities?.maxRenderBufferSize).toBe(4096);
      expect(capabilities?.floatTextureSupported).toBe(true);
    });

    it('should detect OffscreenCanvas support', () => {
      const capabilities = service.getCapabilities();
      expect(capabilities?.offscreenCanvasSupported).toBe(true);
    });
  });

  describe('image processing', () => {
    let testImageData: ImageData;

    beforeEach(() => {
      // Create test image data
      const width = 100;
      const height = 100;
      const data = new Uint8ClampedArray(width * height * 4);
      
      // Fill with test pattern
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 128;     // R
        data[i + 1] = 128; // G
        data[i + 2] = 128; // B
        data[i + 3] = 255; // A
      }
      
      testImageData = new ImageData(data, width, height);
    });

    it('should process image with GPU when available', async () => {
      const options: ImageProcessingOptions = {
        brightness: 0.2,
        contrast: 0.1,
        saturation: 0.1
      };

      // Mock readPixels to return processed data
      const processedData = new Uint8ClampedArray(testImageData.data.length);
      processedData.fill(150); // Simulate brighter image
      mockWebGLContext.readPixels.mockImplementation((x, y, w, h, format, type, pixels) => {
        pixels.set(processedData);
      });

      const result = await service.processImageGPU(testImageData, options);
      
      expect(result).toBeDefined();
      expect(result?.width).toBe(testImageData.width);
      expect(result?.height).toBe(testImageData.height);
      expect(mockWebGLContext.useProgram).toHaveBeenCalled();
      expect(mockWebGLContext.drawArrays).toHaveBeenCalled();
    });

    it('should process image with CPU fallback', () => {
      const options: ImageProcessingOptions = {
        brightness: 0.2,
        contrast: 0.1,
        saturation: 0.1,
        gamma: 1.2
      };

      const result = service.processImageCPU(testImageData, options);
      
      expect(result).toBeDefined();
      expect(result.width).toBe(testImageData.width);
      expect(result.height).toBe(testImageData.height);
      expect(result.data.length).toBe(testImageData.data.length);
    });

    it('should automatically fallback to CPU when GPU fails', async () => {
      // Make GPU processing fail
      mockWebGLContext.readPixels.mockImplementation(() => {
        throw new Error('GPU processing failed');
      });

      const options: ImageProcessingOptions = {
        brightness: 0.1
      };

      const result = await service.processImage(testImageData, options);
      
      expect(result).toBeDefined();
      expect(result.width).toBe(testImageData.width);
      expect(result.height).toBe(testImageData.height);
    });

    it('should handle batch processing', async () => {
      const images = [testImageData, testImageData, testImageData];
      const options: ImageProcessingOptions = {
        brightness: 0.1
      };

      let progressCalls = 0;
      const onProgress = (processed: number, total: number) => {
        progressCalls++;
        expect(processed).toBeLessThanOrEqual(total);
        expect(total).toBe(images.length);
      };

      const results = await service.batchProcessImages(images, options, onProgress);
      
      expect(results).toHaveLength(images.length);
      expect(progressCalls).toBe(images.length);
    });
  });

  describe('canvas optimization', () => {
    it('should create optimized canvas with correct settings', () => {
      const canvas = service.createOptimizedCanvas(800, 600);
      
      expect(canvas.width).toBe(800);
      expect(canvas.height).toBe(600);
      expect(canvas.tagName).toBe('CANVAS');
    });
  });

  describe('resource management', () => {
    it('should dispose of GPU resources properly', () => {
      service.dispose();
      
      expect(mockWebGLContext.deleteProgram).toHaveBeenCalled();
      expect(mockWebGLContext.deleteFramebuffer).toHaveBeenCalled();
      expect(service.isGPUAvailable()).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle shader compilation errors', () => {
      mockWebGLContext.getShaderParameter.mockReturnValue(false);
      mockWebGLContext.getShaderInfoLog.mockReturnValue('Shader compilation error');
      
      const errorService = new GPUAccelerationService();
      expect(errorService.isGPUAvailable()).toBe(true); // Should still work with fallback
      errorService.dispose();
    });

    it('should handle program linking errors', () => {
      mockWebGLContext.getProgramParameter.mockReturnValue(false);
      mockWebGLContext.getProgramInfoLog.mockReturnValue('Program linking error');
      
      const errorService = new GPUAccelerationService();
      expect(errorService.isGPUAvailable()).toBe(true); // Should still work
      errorService.dispose();
    });

    it('should handle texture creation failures', async () => {
      mockWebGLContext.createTexture.mockReturnValue(null);
      
      const options: ImageProcessingOptions = { brightness: 0.1 };
      const result = await service.processImageGPU(testImageData, options);
      
      expect(result).toBeNull();
    });
  });

  describe('CPU processing accuracy', () => {
    it('should apply brightness correctly', () => {
      const options: ImageProcessingOptions = { brightness: 0.2 };
      const result = service.processImageCPU(testImageData, options);
      
      // Check that brightness was applied (values should be higher)
      expect(result.data[0]).toBeGreaterThan(testImageData.data[0]);
    });

    it('should apply contrast correctly', () => {
      const options: ImageProcessingOptions = { contrast: 0.5 };
      const result = service.processImageCPU(testImageData, options);
      
      // Contrast should change the values
      expect(result.data[0]).not.toBe(testImageData.data[0]);
    });

    it('should clamp values to valid range', () => {
      const options: ImageProcessingOptions = { 
        brightness: 2.0, // Extreme brightness
        contrast: 2.0    // Extreme contrast
      };
      const result = service.processImageCPU(testImageData, options);
      
      // All values should be clamped to 0-255 range
      for (let i = 0; i < result.data.length; i++) {
        expect(result.data[i]).toBeGreaterThanOrEqual(0);
        expect(result.data[i]).toBeLessThanOrEqual(255);
      }
    });
  });
});