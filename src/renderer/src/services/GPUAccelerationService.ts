/**
 * GPU Acceleration Service
 * Provides WebGL-based image processing with CPU fallback
 */

export interface GPUCapabilities {
  webglSupported: boolean;
  webgl2Supported: boolean;
  maxTextureSize: number;
  maxRenderBufferSize: number;
  floatTextureSupported: boolean;
  offscreenCanvasSupported: boolean;
}

export interface ImageProcessingOptions {
  brightness?: number; // -1 to 1
  contrast?: number; // -1 to 1
  saturation?: number; // -1 to 1
  hue?: number; // -180 to 180
  gamma?: number; // 0.1 to 3.0
}

export interface FilterShader {
  vertexShader: string;
  fragmentShader: string;
  uniforms: Record<string, any>;
}

export class GPUAccelerationService {
  private gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  private canvas: HTMLCanvasElement | OffscreenCanvas | null = null;
  private capabilities: GPUCapabilities | null = null;
  private shaderPrograms: Map<string, WebGLProgram> = new Map();
  private textureCache: Map<string, WebGLTexture> = new Map();
  private frameBuffer: WebGLFramebuffer | null = null;

  constructor() {
    this.initializeGPU();
  }

  /**
   * Initialize GPU context and detect capabilities
   */
  private initializeGPU(): void {
    try {
      // Try OffscreenCanvas first for better performance
      if (typeof OffscreenCanvas !== 'undefined') {
        this.canvas = new OffscreenCanvas(1, 1);
      } else {
        this.canvas = document.createElement('canvas');
      }

      // Try WebGL2 first, fallback to WebGL1
      this.gl = this.canvas.getContext('webgl2') as WebGL2RenderingContext;
      if (!this.gl) {
        this.gl = this.canvas.getContext('webgl') as WebGLRenderingContext;
      }

      if (this.gl) {
        this.capabilities = this.detectCapabilities();
        this.initializeShaders();
        this.setupFrameBuffer();
      }
    } catch (error) {
      console.warn('GPU acceleration initialization failed:', error);
      this.gl = null;
      this.capabilities = null;
    }
  }

  /**
   * Detect GPU capabilities
   */
  private detectCapabilities(): GPUCapabilities {
    if (!this.gl) {
      return {
        webglSupported: false,
        webgl2Supported: false,
        maxTextureSize: 0,
        maxRenderBufferSize: 0,
        floatTextureSupported: false,
        offscreenCanvasSupported: false
      };
    }

    const isWebGL2 = this.gl instanceof WebGL2RenderingContext;
    const floatExtension = this.gl.getExtension('OES_texture_float');
    
    return {
      webglSupported: true,
      webgl2Supported: isWebGL2,
      maxTextureSize: this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE),
      maxRenderBufferSize: this.gl.getParameter(this.gl.MAX_RENDERBUFFER_SIZE),
      floatTextureSupported: !!floatExtension,
      offscreenCanvasSupported: this.canvas instanceof OffscreenCanvas
    };
  }

  /**
   * Initialize shader programs
   */
  private initializeShaders(): void {
    if (!this.gl) return;

    // Basic vertex shader for all image processing
    const vertexShaderSource = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `;

    // Color adjustment fragment shader
    const colorAdjustmentFragmentShader = `
      precision mediump float;
      uniform sampler2D u_texture;
      uniform float u_brightness;
      uniform float u_contrast;
      uniform float u_saturation;
      uniform float u_hue;
      uniform float u_gamma;
      varying vec2 v_texCoord;
      
      vec3 rgb2hsv(vec3 c) {
        vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
        vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
        vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
        float d = q.x - min(q.w, q.y);
        float e = 1.0e-10;
        return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
      }
      
      vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
      }
      
      void main() {
        vec4 color = texture2D(u_texture, v_texCoord);
        
        // Apply brightness
        color.rgb += u_brightness;
        
        // Apply contrast
        color.rgb = (color.rgb - 0.5) * (1.0 + u_contrast) + 0.5;
        
        // Apply saturation and hue
        vec3 hsv = rgb2hsv(color.rgb);
        hsv.y *= (1.0 + u_saturation);
        hsv.x += u_hue / 360.0;
        color.rgb = hsv2rgb(hsv);
        
        // Apply gamma correction
        color.rgb = pow(color.rgb, vec3(1.0 / u_gamma));
        
        // Clamp values
        color.rgb = clamp(color.rgb, 0.0, 1.0);
        
        gl_FragColor = color;
      }
    `;

    this.createShaderProgram('colorAdjustment', vertexShaderSource, colorAdjustmentFragmentShader);
  }

  /**
   * Create and compile shader program
   */
  private createShaderProgram(name: string, vertexSource: string, fragmentSource: string): void {
    if (!this.gl) return;

    const vertexShader = this.compileShader(this.gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.compileShader(this.gl.FRAGMENT_SHADER, fragmentSource);

    if (!vertexShader || !fragmentShader) return;

    const program = this.gl.createProgram();
    if (!program) return;

    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error('Shader program linking failed:', this.gl.getProgramInfoLog(program));
      return;
    }

    this.shaderPrograms.set(name, program);
  }

  /**
   * Compile individual shader
   */
  private compileShader(type: number, source: string): WebGLShader | null {
    if (!this.gl) return null;

    const shader = this.gl.createShader(type);
    if (!shader) return null;

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('Shader compilation failed:', this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  /**
   * Setup framebuffer for offscreen rendering
   */
  private setupFrameBuffer(): void {
    if (!this.gl) return;

    this.frameBuffer = this.gl.createFramebuffer();
  }

  /**
   * Get GPU capabilities
   */
  public getCapabilities(): GPUCapabilities | null {
    return this.capabilities;
  }

  /**
   * Check if GPU acceleration is available
   */
  public isGPUAvailable(): boolean {
    return this.gl !== null && this.capabilities?.webglSupported === true;
  }

  /**
   * Process image with GPU acceleration
   */
  public async processImageGPU(
    imageData: ImageData,
    options: ImageProcessingOptions
  ): Promise<ImageData | null> {
    if (!this.isGPUAvailable() || !this.gl || !this.canvas) {
      return null;
    }

    try {
      const { width, height } = imageData;
      
      // Resize canvas to match image
      this.canvas.width = width;
      this.canvas.height = height;
      this.gl.viewport(0, 0, width, height);

      // Create texture from image data
      const texture = this.createTextureFromImageData(imageData);
      if (!texture) return null;

      // Get shader program
      const program = this.shaderPrograms.get('colorAdjustment');
      if (!program) return null;

      // Use shader program
      this.gl.useProgram(program);

      // Set up geometry (full screen quad)
      this.setupGeometry(program);

      // Set uniforms
      this.setUniforms(program, options);

      // Bind texture
      this.gl.activeTexture(this.gl.TEXTURE0);
      this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
      this.gl.uniform1i(this.gl.getUniformLocation(program, 'u_texture'), 0);

      // Render
      this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

      // Read pixels back
      const pixels = new Uint8ClampedArray(width * height * 4);
      this.gl.readPixels(0, 0, width, height, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels);

      // Clean up texture
      this.gl.deleteTexture(texture);

      return new ImageData(pixels, width, height);
    } catch (error) {
      console.error('GPU image processing failed:', error);
      return null;
    }
  }

  /**
   * Create texture from ImageData
   */
  private createTextureFromImageData(imageData: ImageData): WebGLTexture | null {
    if (!this.gl) return null;

    const texture = this.gl.createTexture();
    if (!texture) return null;

    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      imageData.width,
      imageData.height,
      0,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      imageData.data
    );

    // Set texture parameters
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);

    return texture;
  }

  /**
   * Setup geometry for full screen quad
   */
  private setupGeometry(program: WebGLProgram): void {
    if (!this.gl) return;

    // Full screen quad vertices
    const vertices = new Float32Array([
      -1, -1, 0, 0,  // bottom left
       1, -1, 1, 0,  // bottom right
      -1,  1, 0, 1,  // top left
      -1,  1, 0, 1,  // top left
       1, -1, 1, 0,  // bottom right
       1,  1, 1, 1   // top right
    ]);

    const buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);

    // Position attribute
    const positionLocation = this.gl.getAttribLocation(program, 'a_position');
    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 16, 0);

    // Texture coordinate attribute
    const texCoordLocation = this.gl.getAttribLocation(program, 'a_texCoord');
    this.gl.enableVertexAttribArray(texCoordLocation);
    this.gl.vertexAttribPointer(texCoordLocation, 2, this.gl.FLOAT, false, 16, 8);
  }

  /**
   * Set shader uniforms
   */
  private setUniforms(program: WebGLProgram, options: ImageProcessingOptions): void {
    if (!this.gl) return;

    const brightness = options.brightness ?? 0;
    const contrast = options.contrast ?? 0;
    const saturation = options.saturation ?? 0;
    const hue = options.hue ?? 0;
    const gamma = options.gamma ?? 1;

    this.gl.uniform1f(this.gl.getUniformLocation(program, 'u_brightness'), brightness);
    this.gl.uniform1f(this.gl.getUniformLocation(program, 'u_contrast'), contrast);
    this.gl.uniform1f(this.gl.getUniformLocation(program, 'u_saturation'), saturation);
    this.gl.uniform1f(this.gl.getUniformLocation(program, 'u_hue'), hue);
    this.gl.uniform1f(this.gl.getUniformLocation(program, 'u_gamma'), gamma);
  }

  /**
   * Process image with CPU fallback
   */
  public processImageCPU(
    imageData: ImageData,
    options: ImageProcessingOptions
  ): ImageData {
    const { width, height, data } = imageData;
    const newData = new Uint8ClampedArray(data);

    const brightness = (options.brightness ?? 0) * 255;
    const contrast = (options.contrast ?? 0) + 1;
    const saturation = (options.saturation ?? 0) + 1;
    const hue = (options.hue ?? 0) * Math.PI / 180;
    const gamma = options.gamma ?? 1;

    for (let i = 0; i < newData.length; i += 4) {
      let r = newData[i];
      let g = newData[i + 1];
      let b = newData[i + 2];

      // Apply brightness
      r += brightness;
      g += brightness;
      b += brightness;

      // Apply contrast
      r = (r - 128) * contrast + 128;
      g = (g - 128) * contrast + 128;
      b = (b - 128) * contrast + 128;

      // Apply saturation (simplified)
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gray + saturation * (r - gray);
      g = gray + saturation * (g - gray);
      b = gray + saturation * (b - gray);

      // Apply gamma correction
      r = Math.pow(r / 255, 1 / gamma) * 255;
      g = Math.pow(g / 255, 1 / gamma) * 255;
      b = Math.pow(b / 255, 1 / gamma) * 255;

      // Clamp values
      newData[i] = Math.max(0, Math.min(255, r));
      newData[i + 1] = Math.max(0, Math.min(255, g));
      newData[i + 2] = Math.max(0, Math.min(255, b));
    }

    return new ImageData(newData, width, height);
  }

  /**
   * Process image with automatic GPU/CPU fallback
   */
  public async processImage(
    imageData: ImageData,
    options: ImageProcessingOptions
  ): Promise<ImageData> {
    // Try GPU first
    if (this.isGPUAvailable()) {
      const gpuResult = await this.processImageGPU(imageData, options);
      if (gpuResult) {
        return gpuResult;
      }
    }

    // Fallback to CPU
    return this.processImageCPU(imageData, options);
  }

  /**
   * Batch process multiple images
   */
  public async batchProcessImages(
    images: ImageData[],
    options: ImageProcessingOptions,
    onProgress?: (processed: number, total: number) => void
  ): Promise<ImageData[]> {
    const results: ImageData[] = [];
    
    for (let i = 0; i < images.length; i++) {
      const result = await this.processImage(images[i], options);
      results.push(result);
      
      if (onProgress) {
        onProgress(i + 1, images.length);
      }
    }

    return results;
  }

  /**
   * Create optimized canvas for rendering
   */
  public createOptimizedCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    // Enable hardware acceleration hints
    const ctx = canvas.getContext('2d', {
      alpha: false,
      desynchronized: true,
      willReadFrequently: false
    });

    if (ctx) {
      // Enable image smoothing for better quality
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    }

    return canvas;
  }

  /**
   * Dispose of GPU resources
   */
  public dispose(): void {
    if (this.gl) {
      // Clean up shader programs
      this.shaderPrograms.forEach(program => {
        this.gl!.deleteProgram(program);
      });
      this.shaderPrograms.clear();

      // Clean up textures
      this.textureCache.forEach(texture => {
        this.gl!.deleteTexture(texture);
      });
      this.textureCache.clear();

      // Clean up framebuffer
      if (this.frameBuffer) {
        this.gl.deleteFramebuffer(this.frameBuffer);
        this.frameBuffer = null;
      }
    }

    this.gl = null;
    this.canvas = null;
    this.capabilities = null;
  }
}

// Singleton instance
export const gpuAccelerationService = new GPUAccelerationService();