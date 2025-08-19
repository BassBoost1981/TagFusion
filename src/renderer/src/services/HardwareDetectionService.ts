/**
 * Hardware Detection Service
 * Detects hardware capabilities and provides fallback strategies
 */

export interface HardwareCapabilities {
  // CPU Information
  cpu: {
    cores: number;
    threads: number;
    architecture: string;
  };

  // GPU Information
  gpu: {
    vendor: string;
    renderer: string;
    webglVersion: string;
    maxTextureSize: number;
    maxRenderBufferSize: number;
    extensions: string[];
    floatTextureSupported: boolean;
    depthTextureSupported: boolean;
  };

  // Memory Information
  memory: {
    deviceMemory?: number; // GB
    jsHeapSizeLimit?: number; // bytes
    totalJSHeapSize?: number; // bytes
    usedJSHeapSize?: number; // bytes
  };

  // Canvas and Rendering
  canvas: {
    offscreenCanvasSupported: boolean;
    imageBitmapSupported: boolean;
    webWorkersSupported: boolean;
    transferableObjectsSupported: boolean;
  };

  // Performance Hints
  performance: {
    recommendedWorkers: number;
    recommendedBatchSize: number;
    gpuAccelerationRecommended: boolean;
    memoryConstraints: 'low' | 'medium' | 'high';
  };
}

export interface PerformanceProfile {
  name: string;
  description: string;
  settings: {
    useGPUAcceleration: boolean;
    maxWorkers: number;
    batchSize: number;
    thumbnailQuality: 'low' | 'medium' | 'high';
    cacheSize: number; // MB
    enableOffscreenCanvas: boolean;
  };
}

export class HardwareDetectionService {
  private capabilities: HardwareCapabilities | null = null;
  private performanceProfiles: PerformanceProfile[] = [];

  constructor() {
    this.detectHardware();
    this.generatePerformanceProfiles();
  }

  /**
   * Detect hardware capabilities
   */
  private detectHardware(): void {
    try {
      this.capabilities = {
        cpu: this.detectCPU(),
        gpu: this.detectGPU(),
        memory: this.detectMemory(),
        canvas: this.detectCanvasCapabilities(),
        performance: this.generatePerformanceHints()
      };
    } catch (error) {
      console.error('Hardware detection failed:', error);
      this.capabilities = this.getDefaultCapabilities();
    }
  }

  /**
   * Detect CPU capabilities
   */
  private detectCPU(): HardwareCapabilities['cpu'] {
    const cores = navigator.hardwareConcurrency || 4;
    
    return {
      cores,
      threads: cores, // Assume hyperthreading
      architecture: this.detectArchitecture()
    };
  }

  /**
   * Detect system architecture
   */
  private detectArchitecture(): string {
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (userAgent.includes('arm64') || userAgent.includes('aarch64')) {
      return 'arm64';
    } else if (userAgent.includes('arm')) {
      return 'arm';
    } else if (userAgent.includes('x86_64') || userAgent.includes('win64')) {
      return 'x64';
    } else {
      return 'x86';
    }
  }

  /**
   * Detect GPU capabilities
   */
  private detectGPU(): HardwareCapabilities['gpu'] {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');

    if (!gl) {
      return {
        vendor: 'unknown',
        renderer: 'software',
        webglVersion: 'none',
        maxTextureSize: 0,
        maxRenderBufferSize: 0,
        extensions: [],
        floatTextureSupported: false,
        depthTextureSupported: false
      };
    }

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const extensions = gl.getSupportedExtensions() || [];

    return {
      vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'unknown',
      renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown',
      webglVersion: gl instanceof WebGL2RenderingContext ? 'webgl2' : 'webgl1',
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxRenderBufferSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
      extensions,
      floatTextureSupported: extensions.includes('OES_texture_float'),
      depthTextureSupported: extensions.includes('WEBGL_depth_texture')
    };
  }

  /**
   * Detect memory capabilities
   */
  private detectMemory(): HardwareCapabilities['memory'] {
    const memory: HardwareCapabilities['memory'] = {};

    // Device memory (if supported)
    if ('deviceMemory' in navigator) {
      memory.deviceMemory = (navigator as any).deviceMemory;
    }

    // JavaScript heap information
    if ('memory' in performance) {
      const perfMemory = (performance as any).memory;
      memory.jsHeapSizeLimit = perfMemory.jsHeapSizeLimit;
      memory.totalJSHeapSize = perfMemory.totalJSHeapSize;
      memory.usedJSHeapSize = perfMemory.usedJSHeapSize;
    }

    return memory;
  }

  /**
   * Detect canvas capabilities
   */
  private detectCanvasCapabilities(): HardwareCapabilities['canvas'] {
    return {
      offscreenCanvasSupported: typeof OffscreenCanvas !== 'undefined',
      imageBitmapSupported: typeof createImageBitmap !== 'undefined',
      webWorkersSupported: typeof Worker !== 'undefined',
      transferableObjectsSupported: this.testTransferableObjects()
    };
  }

  /**
   * Test transferable objects support
   */
  private testTransferableObjects(): boolean {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;

      const imageData = ctx.getImageData(0, 0, 1, 1);
      const buffer = imageData.data.buffer.slice();
      
      // Test if we can transfer the buffer
      return buffer.byteLength > 0;
    } catch {
      return false;
    }
  }

  /**
   * Generate performance hints
   */
  private generatePerformanceHints(): HardwareCapabilities['performance'] {
    const cpu = this.detectCPU();
    const gpu = this.detectGPU();
    const memory = this.detectMemory();

    // Determine recommended workers
    const recommendedWorkers = Math.max(2, Math.min(cpu.cores, 8));

    // Determine batch size based on memory
    let recommendedBatchSize = 10;
    if (memory.deviceMemory) {
      if (memory.deviceMemory >= 8) {
        recommendedBatchSize = 50;
      } else if (memory.deviceMemory >= 4) {
        recommendedBatchSize = 25;
      }
    }

    // GPU acceleration recommendation
    const gpuAccelerationRecommended = 
      gpu.webglVersion !== 'none' && 
      gpu.maxTextureSize >= 2048 &&
      !gpu.renderer.toLowerCase().includes('software');

    // Memory constraints
    let memoryConstraints: 'low' | 'medium' | 'high' = 'medium';
    if (memory.deviceMemory) {
      if (memory.deviceMemory <= 2) {
        memoryConstraints = 'low';
      } else if (memory.deviceMemory >= 8) {
        memoryConstraints = 'high';
      }
    }

    return {
      recommendedWorkers,
      recommendedBatchSize,
      gpuAccelerationRecommended,
      memoryConstraints
    };
  }

  /**
   * Generate performance profiles
   */
  private generatePerformanceProfiles(): void {
    if (!this.capabilities) return;

    const { performance: perf, memory, gpu } = this.capabilities;

    // High Performance Profile
    this.performanceProfiles.push({
      name: 'high',
      description: 'Maximum performance with GPU acceleration',
      settings: {
        useGPUAcceleration: perf.gpuAccelerationRecommended,
        maxWorkers: perf.recommendedWorkers,
        batchSize: Math.max(perf.recommendedBatchSize, 25),
        thumbnailQuality: 'high',
        cacheSize: perf.memoryConstraints === 'high' ? 512 : 256,
        enableOffscreenCanvas: this.capabilities.canvas.offscreenCanvasSupported
      }
    });

    // Balanced Profile
    this.performanceProfiles.push({
      name: 'balanced',
      description: 'Good performance with moderate resource usage',
      settings: {
        useGPUAcceleration: perf.gpuAccelerationRecommended,
        maxWorkers: Math.max(2, Math.floor(perf.recommendedWorkers * 0.75)),
        batchSize: perf.recommendedBatchSize,
        thumbnailQuality: 'medium',
        cacheSize: 128,
        enableOffscreenCanvas: this.capabilities.canvas.offscreenCanvasSupported
      }
    });

    // Low Resource Profile
    this.performanceProfiles.push({
      name: 'low',
      description: 'Optimized for low-end hardware',
      settings: {
        useGPUAcceleration: false,
        maxWorkers: Math.max(1, Math.floor(perf.recommendedWorkers * 0.5)),
        batchSize: Math.min(perf.recommendedBatchSize, 5),
        thumbnailQuality: 'low',
        cacheSize: 64,
        enableOffscreenCanvas: false
      }
    });
  }

  /**
   * Get default capabilities for fallback
   */
  private getDefaultCapabilities(): HardwareCapabilities {
    return {
      cpu: {
        cores: 4,
        threads: 4,
        architecture: 'x64'
      },
      gpu: {
        vendor: 'unknown',
        renderer: 'software',
        webglVersion: 'none',
        maxTextureSize: 0,
        maxRenderBufferSize: 0,
        extensions: [],
        floatTextureSupported: false,
        depthTextureSupported: false
      },
      memory: {},
      canvas: {
        offscreenCanvasSupported: false,
        imageBitmapSupported: false,
        webWorkersSupported: true,
        transferableObjectsSupported: false
      },
      performance: {
        recommendedWorkers: 2,
        recommendedBatchSize: 5,
        gpuAccelerationRecommended: false,
        memoryConstraints: 'low'
      }
    };
  }

  /**
   * Get hardware capabilities
   */
  public getCapabilities(): HardwareCapabilities {
    return this.capabilities || this.getDefaultCapabilities();
  }

  /**
   * Get performance profiles
   */
  public getPerformanceProfiles(): PerformanceProfile[] {
    return this.performanceProfiles;
  }

  /**
   * Get recommended performance profile
   */
  public getRecommendedProfile(): PerformanceProfile {
    const capabilities = this.getCapabilities();
    
    if (capabilities.performance.memoryConstraints === 'low' || 
        !capabilities.performance.gpuAccelerationRecommended) {
      return this.performanceProfiles.find(p => p.name === 'low') || this.performanceProfiles[2];
    } else if (capabilities.performance.memoryConstraints === 'high' && 
               capabilities.performance.gpuAccelerationRecommended) {
      return this.performanceProfiles.find(p => p.name === 'high') || this.performanceProfiles[0];
    } else {
      return this.performanceProfiles.find(p => p.name === 'balanced') || this.performanceProfiles[1];
    }
  }

  /**
   * Test GPU performance
   */
  public async testGPUPerformance(): Promise<{
    supported: boolean;
    renderTime: number;
    score: number;
  }> {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');

    if (!gl) {
      return { supported: false, renderTime: 0, score: 0 };
    }

    const startTime = performance.now();

    try {
      // Simple performance test - render a textured quad
      const vertices = new Float32Array([
        -1, -1, 0, 0,
         1, -1, 1, 0,
        -1,  1, 0, 1,
         1,  1, 1, 1
      ]);

      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

      // Create a simple texture
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      
      const pixels = new Uint8Array(256 * 256 * 4);
      for (let i = 0; i < pixels.length; i += 4) {
        pixels[i] = Math.random() * 255;     // R
        pixels[i + 1] = Math.random() * 255; // G
        pixels[i + 2] = Math.random() * 255; // B
        pixels[i + 3] = 255;                 // A
      }
      
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 256, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      // Render multiple frames
      for (let i = 0; i < 100; i++) {
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }

      // Force completion
      gl.finish();

      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      // Calculate score (lower time = higher score)
      const score = Math.max(0, 100 - (renderTime / 10));

      return {
        supported: true,
        renderTime,
        score
      };
    } catch (error) {
      console.error('GPU performance test failed:', error);
      return { supported: false, renderTime: 0, score: 0 };
    }
  }

  /**
   * Monitor memory usage
   */
  public getMemoryUsage(): {
    used: number;
    total: number;
    percentage: number;
  } {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const used = memory.usedJSHeapSize;
      const total = memory.jsHeapSizeLimit;
      const percentage = (used / total) * 100;

      return { used, total, percentage };
    }

    return { used: 0, total: 0, percentage: 0 };
  }

  /**
   * Check if system is under memory pressure
   */
  public isMemoryPressureHigh(): boolean {
    const usage = this.getMemoryUsage();
    return usage.percentage > 80;
  }

  /**
   * Get system information summary
   */
  public getSystemSummary(): string {
    const caps = this.getCapabilities();
    const profile = this.getRecommendedProfile();

    return `
System Summary:
- CPU: ${caps.cpu.cores} cores (${caps.cpu.architecture})
- GPU: ${caps.gpu.vendor} ${caps.gpu.renderer} (${caps.gpu.webglVersion})
- Memory: ${caps.memory.deviceMemory || 'unknown'} GB
- Recommended Profile: ${profile.name}
- GPU Acceleration: ${caps.performance.gpuAccelerationRecommended ? 'Yes' : 'No'}
- OffscreenCanvas: ${caps.canvas.offscreenCanvasSupported ? 'Yes' : 'No'}
    `.trim();
  }
}

// Singleton instance
export const hardwareDetectionService = new HardwareDetectionService();