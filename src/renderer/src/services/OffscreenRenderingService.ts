/**
 * Offscreen Rendering Service
 * Provides high-performance offscreen canvas rendering for image processing
 */

export interface RenderingOptions {
  width: number;
  height: number;
  alpha?: boolean;
  desynchronized?: boolean;
  willReadFrequently?: boolean;
}

export interface RenderTask {
  id: string;
  canvas: OffscreenCanvas | HTMLCanvasElement;
  context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  width: number;
  height: number;
  createdAt: number;
}

export class OffscreenRenderingService {
  private renderTasks: Map<string, RenderTask> = new Map();
  private workerPool: Worker[] = [];
  private maxWorkers = Math.max(2, Math.min(navigator.hardwareConcurrency || 4, 8));
  private taskQueue: Array<() => Promise<void>> = [];
  private activeWorkers = 0;

  constructor() {
    this.initializeWorkerPool();
  }

  /**
   * Initialize worker pool for background rendering
   */
  private initializeWorkerPool(): void {
    // Note: In a real implementation, you would create web workers
    // For now, we'll simulate with async processing
    console.log(`Initialized rendering service with ${this.maxWorkers} max workers`);
  }

  /**
   * Create optimized offscreen canvas
   */
  public createOffscreenCanvas(options: RenderingOptions): RenderTask {
    const id = `render_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    let canvas: OffscreenCanvas | HTMLCanvasElement;
    let context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

    // Try OffscreenCanvas first for better performance
    if (typeof OffscreenCanvas !== 'undefined') {
      canvas = new OffscreenCanvas(options.width, options.height);
      context = canvas.getContext('2d', {
        alpha: options.alpha ?? true,
        desynchronized: options.desynchronized ?? true,
        willReadFrequently: options.willReadFrequently ?? false
      }) as OffscreenCanvasRenderingContext2D;
    } else {
      // Fallback to regular canvas
      canvas = document.createElement('canvas');
      canvas.width = options.width;
      canvas.height = options.height;
      context = canvas.getContext('2d', {
        alpha: options.alpha ?? true,
        desynchronized: options.desynchronized ?? true,
        willReadFrequently: options.willReadFrequently ?? false
      }) as CanvasRenderingContext2D;
    }

    if (!context) {
      throw new Error('Failed to create rendering context');
    }

    // Optimize context settings
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    const task: RenderTask = {
      id,
      canvas,
      context,
      width: options.width,
      height: options.height,
      createdAt: Date.now()
    };

    this.renderTasks.set(id, task);
    return task;
  }

  /**
   * Render image with transformations
   */
  public async renderImage(
    task: RenderTask,
    image: HTMLImageElement | ImageBitmap | HTMLCanvasElement,
    transformations?: {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      rotation?: number;
      scaleX?: number;
      scaleY?: number;
      alpha?: number;
    }
  ): Promise<void> {
    return new Promise((resolve) => {
      const renderFn = async () => {
        const { context, width, height } = task;
        const t = transformations || {};

        // Clear canvas
        context.clearRect(0, 0, width, height);

        // Save context state
        context.save();

        // Apply transformations
        if (t.alpha !== undefined) {
          context.globalAlpha = t.alpha;
        }

        const centerX = width / 2;
        const centerY = height / 2;

        // Translate to center for rotation
        context.translate(centerX, centerY);

        if (t.rotation) {
          context.rotate(t.rotation * Math.PI / 180);
        }

        if (t.scaleX !== undefined || t.scaleY !== undefined) {
          context.scale(t.scaleX ?? 1, t.scaleY ?? 1);
        }

        // Draw image
        const drawX = (t.x ?? 0) - centerX;
        const drawY = (t.y ?? 0) - centerY;
        const drawWidth = t.width ?? width;
        const drawHeight = t.height ?? height;

        context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

        // Restore context state
        context.restore();

        resolve();
      };

      this.queueTask(renderFn);
    });
  }

  /**
   * Apply filter to canvas
   */
  public async applyFilter(
    task: RenderTask,
    filter: string
  ): Promise<void> {
    return new Promise((resolve) => {
      const renderFn = async () => {
        const { context } = task;
        
        // Apply CSS filter
        context.filter = filter;
        
        // Re-draw the canvas content with filter
        const imageData = context.getImageData(0, 0, task.width, task.height);
        context.clearRect(0, 0, task.width, task.height);
        context.putImageData(imageData, 0, 0);
        
        // Reset filter
        context.filter = 'none';
        
        resolve();
      };

      this.queueTask(renderFn);
    });
  }

  /**
   * Get ImageData from render task
   */
  public getImageData(task: RenderTask): ImageData {
    return task.context.getImageData(0, 0, task.width, task.height);
  }

  /**
   * Get ImageBitmap from render task (if supported)
   */
  public async getImageBitmap(task: RenderTask): Promise<ImageBitmap | null> {
    if (typeof createImageBitmap === 'undefined') {
      return null;
    }

    if (task.canvas instanceof OffscreenCanvas) {
      return createImageBitmap(task.canvas);
    } else {
      return createImageBitmap(task.canvas);
    }
  }

  /**
   * Convert canvas to blob
   */
  public async getBlob(
    task: RenderTask,
    type: string = 'image/png',
    quality?: number
  ): Promise<Blob | null> {
    if (task.canvas instanceof OffscreenCanvas) {
      return task.canvas.convertToBlob({ type, quality });
    } else {
      return new Promise((resolve) => {
        task.canvas.toBlob(resolve, type, quality);
      });
    }
  }

  /**
   * Resize render task canvas
   */
  public resizeCanvas(task: RenderTask, width: number, height: number): void {
    // Save current content
    const imageData = task.context.getImageData(0, 0, task.width, task.height);
    
    // Resize canvas
    task.canvas.width = width;
    task.canvas.height = height;
    task.width = width;
    task.height = height;

    // Restore content (scaled)
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(imageData, 0, 0);

    task.context.drawImage(tempCanvas, 0, 0, width, height);
  }

  /**
   * Queue rendering task
   */
  private async queueTask(taskFn: () => Promise<void>): Promise<void> {
    return new Promise((resolve) => {
      const wrappedTask = async () => {
        this.activeWorkers++;
        try {
          await taskFn();
        } finally {
          this.activeWorkers--;
          this.processQueue();
        }
        resolve();
      };

      if (this.activeWorkers < this.maxWorkers) {
        wrappedTask();
      } else {
        this.taskQueue.push(wrappedTask);
      }
    });
  }

  /**
   * Process queued tasks
   */
  private processQueue(): void {
    if (this.taskQueue.length > 0 && this.activeWorkers < this.maxWorkers) {
      const task = this.taskQueue.shift();
      if (task) {
        task();
      }
    }
  }

  /**
   * Batch process multiple images
   */
  public async batchProcess(
    images: (HTMLImageElement | ImageBitmap | HTMLCanvasElement)[],
    options: RenderingOptions,
    processor: (task: RenderTask, image: any, index: number) => Promise<void>,
    onProgress?: (completed: number, total: number) => void
  ): Promise<RenderTask[]> {
    const tasks: RenderTask[] = [];
    const results: Promise<void>[] = [];

    for (let i = 0; i < images.length; i++) {
      const task = this.createOffscreenCanvas(options);
      tasks.push(task);

      const processPromise = processor(task, images[i], i).then(() => {
        if (onProgress) {
          onProgress(i + 1, images.length);
        }
      });

      results.push(processPromise);
    }

    await Promise.all(results);
    return tasks;
  }

  /**
   * Clean up render task
   */
  public disposeTask(taskId: string): void {
    const task = this.renderTasks.get(taskId);
    if (task) {
      // Clear canvas
      task.context.clearRect(0, 0, task.width, task.height);
      this.renderTasks.delete(taskId);
    }
  }

  /**
   * Clean up old tasks (older than 5 minutes)
   */
  public cleanupOldTasks(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    for (const [id, task] of this.renderTasks.entries()) {
      if (now - task.createdAt > maxAge) {
        this.disposeTask(id);
      }
    }
  }

  /**
   * Get rendering statistics
   */
  public getStats(): {
    activeTasks: number;
    queuedTasks: number;
    activeWorkers: number;
    maxWorkers: number;
  } {
    return {
      activeTasks: this.renderTasks.size,
      queuedTasks: this.taskQueue.length,
      activeWorkers: this.activeWorkers,
      maxWorkers: this.maxWorkers
    };
  }

  /**
   * Dispose of all resources
   */
  public dispose(): void {
    // Clear all tasks
    for (const taskId of this.renderTasks.keys()) {
      this.disposeTask(taskId);
    }

    // Clear queue
    this.taskQueue.length = 0;
    this.activeWorkers = 0;
  }
}

// Singleton instance
export const offscreenRenderingService = new OffscreenRenderingService();