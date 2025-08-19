/**
 * Memory Leak Prevention Service
 * Monitors and prevents common memory leaks in the application
 */

export interface LeakDetectionResult {
  type: 'event-listener' | 'timer' | 'dom-reference' | 'closure' | 'canvas' | 'worker';
  description: string;
  severity: 'low' | 'medium' | 'high';
  count: number;
  recommendation: string;
}

export interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  eventListeners: number;
  timers: number;
  canvases: number;
  workers: number;
}

export class MemoryLeakPreventionService {
  private eventListenerRegistry = new Map<string, Set<EventListenerInfo>>();
  private timerRegistry = new Set<number>();
  private canvasRegistry = new WeakSet<HTMLCanvasElement | OffscreenCanvas>();
  private workerRegistry = new Set<Worker>();
  private domObserver: MutationObserver | null = null;
  private memorySnapshots: MemorySnapshot[] = [];
  private maxSnapshots = 100;
  private monitoringInterval: number | null = null;
  private leakDetectionThreshold = 1.5; // 50% increase in memory usage

  constructor() {
    this.setupDOMObserver();
    this.startMemoryMonitoring();
    this.interceptTimerMethods();
    this.interceptEventListenerMethods();
    this.interceptWorkerCreation();
  }

  /**
   * Setup DOM mutation observer to track element lifecycle
   */
  private setupDOMObserver(): void {
    if (typeof MutationObserver === 'undefined') return;

    this.domObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          // Track removed nodes for potential memory leaks
          for (const removedNode of mutation.removedNodes) {
            if (removedNode.nodeType === Node.ELEMENT_NODE) {
              this.checkRemovedElementForLeaks(removedNode as Element);
            }
          }
        }
      }
    });

    this.domObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    this.monitoringInterval = window.setInterval(() => {
      this.takeMemorySnapshot();
      this.analyzeMemoryTrends();
    }, 30000); // Every 30 seconds
  }

  /**
   * Intercept timer methods to track active timers
   */
  private interceptTimerMethods(): void {
    const originalSetTimeout = window.setTimeout;
    const originalSetInterval = window.setInterval;
    const originalClearTimeout = window.clearTimeout;
    const originalClearInterval = window.clearInterval;

    window.setTimeout = (callback: Function, delay?: number, ...args: any[]) => {
      const id = originalSetTimeout.call(window, (...callbackArgs: any[]) => {
        this.timerRegistry.delete(id);
        callback(...callbackArgs);
      }, delay, ...args);
      this.timerRegistry.add(id);
      return id;
    };

    window.setInterval = (callback: Function, delay?: number, ...args: any[]) => {
      const id = originalSetInterval.call(window, callback, delay, ...args);
      this.timerRegistry.add(id);
      return id;
    };

    window.clearTimeout = (id?: number) => {
      if (id !== undefined) {
        this.timerRegistry.delete(id);
        originalClearTimeout.call(window, id);
      }
    };

    window.clearInterval = (id?: number) => {
      if (id !== undefined) {
        this.timerRegistry.delete(id);
        originalClearInterval.call(window, id);
      }
    };
  }

  /**
   * Intercept event listener methods to track active listeners
   */
  private interceptEventListenerMethods(): void {
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    const originalRemoveEventListener = EventTarget.prototype.removeEventListener;

    EventTarget.prototype.addEventListener = function(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions
    ) {
      const target = this;
      const targetId = this.constructor.name + '_' + Math.random().toString(36).substr(2, 9);
      
      if (!memoryLeakPreventionService.eventListenerRegistry.has(targetId)) {
        memoryLeakPreventionService.eventListenerRegistry.set(targetId, new Set());
      }

      const listenerInfo: EventListenerInfo = {
        type,
        listener,
        options,
        target: new WeakRef(target),
        addedAt: Date.now(),
        stackTrace: new Error().stack || ''
      };

      memoryLeakPreventionService.eventListenerRegistry.get(targetId)!.add(listenerInfo);

      return originalAddEventListener.call(this, type, listener, options);
    };

    EventTarget.prototype.removeEventListener = function(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions
    ) {
      const targetId = this.constructor.name + '_' + Math.random().toString(36).substr(2, 9);
      const listeners = memoryLeakPreventionService.eventListenerRegistry.get(targetId);
      
      if (listeners) {
        for (const listenerInfo of listeners) {
          if (listenerInfo.type === type && listenerInfo.listener === listener) {
            listeners.delete(listenerInfo);
            break;
          }
        }
      }

      return originalRemoveEventListener.call(this, type, listener, options);
    };
  }

  /**
   * Intercept Worker creation to track active workers
   */
  private interceptWorkerCreation(): void {
    const originalWorker = window.Worker;

    window.Worker = class extends originalWorker {
      constructor(scriptURL: string | URL, options?: WorkerOptions) {
        super(scriptURL, options);
        memoryLeakPreventionService.workerRegistry.add(this);

        // Auto-cleanup on termination
        const originalTerminate = this.terminate;
        this.terminate = () => {
          memoryLeakPreventionService.workerRegistry.delete(this);
          return originalTerminate.call(this);
        };
      }
    };
  }

  /**
   * Check removed element for potential memory leaks
   */
  private checkRemovedElementForLeaks(element: Element): void {
    // Check for canvas elements that might not be properly cleaned up
    if (element.tagName === 'CANVAS') {
      const canvas = element as HTMLCanvasElement;
      if (this.canvasRegistry.has(canvas)) {
        console.warn('Canvas element removed from DOM but still tracked', canvas);
      }
    }

    // Check for elements with event listeners
    const listeners = this.getEventListenersForElement(element);
    if (listeners.length > 0) {
      console.warn(`Element removed with ${listeners.length} active event listeners`, element);
    }
  }

  /**
   * Get event listeners for a specific element
   */
  private getEventListenersForElement(element: Element): EventListenerInfo[] {
    const result: EventListenerInfo[] = [];
    
    for (const [targetId, listeners] of this.eventListenerRegistry.entries()) {
      for (const listener of listeners) {
        const target = listener.target.deref();
        if (target === element) {
          result.push(listener);
        }
      }
    }

    return result;
  }

  /**
   * Take memory snapshot
   */
  private takeMemorySnapshot(): void {
    if (!('memory' in performance)) return;

    const memory = (performance as any).memory;
    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      heapUsed: memory.usedJSHeapSize,
      heapTotal: memory.totalJSHeapSize,
      external: memory.usedJSHeapSize, // Approximation
      arrayBuffers: 0, // Would need more sophisticated tracking
      eventListeners: this.getTotalEventListenerCount(),
      timers: this.timerRegistry.size,
      canvases: 0, // WeakSet doesn't have size
      workers: this.workerRegistry.size
    };

    this.memorySnapshots.push(snapshot);

    // Keep only recent snapshots
    if (this.memorySnapshots.length > this.maxSnapshots) {
      this.memorySnapshots.shift();
    }
  }

  /**
   * Analyze memory trends for potential leaks
   */
  private analyzeMemoryTrends(): void {
    if (this.memorySnapshots.length < 10) return;

    const recent = this.memorySnapshots.slice(-10);
    const oldest = recent[0];
    const newest = recent[recent.length - 1];

    const memoryIncrease = (newest.heapUsed - oldest.heapUsed) / oldest.heapUsed;
    const timeSpan = newest.timestamp - oldest.timestamp;

    if (memoryIncrease > this.leakDetectionThreshold && timeSpan > 300000) { // 5 minutes
      console.warn(`Potential memory leak detected: ${(memoryIncrease * 100).toFixed(1)}% increase over ${Math.round(timeSpan / 60000)} minutes`);
      this.performLeakDetection();
    }
  }

  /**
   * Get total event listener count
   */
  private getTotalEventListenerCount(): number {
    let total = 0;
    for (const listeners of this.eventListenerRegistry.values()) {
      total += listeners.size;
    }
    return total;
  }

  /**
   * Perform comprehensive leak detection
   */
  public performLeakDetection(): LeakDetectionResult[] {
    const results: LeakDetectionResult[] = [];

    // Check for excessive event listeners
    const totalListeners = this.getTotalEventListenerCount();
    if (totalListeners > 1000) {
      results.push({
        type: 'event-listener',
        description: `High number of event listeners detected: ${totalListeners}`,
        severity: totalListeners > 5000 ? 'high' : 'medium',
        count: totalListeners,
        recommendation: 'Review event listener cleanup in component lifecycle methods'
      });
    }

    // Check for excessive timers
    if (this.timerRegistry.size > 100) {
      results.push({
        type: 'timer',
        description: `High number of active timers: ${this.timerRegistry.size}`,
        severity: this.timerRegistry.size > 500 ? 'high' : 'medium',
        count: this.timerRegistry.size,
        recommendation: 'Ensure timers are properly cleared when components unmount'
      });
    }

    // Check for excessive workers
    if (this.workerRegistry.size > 10) {
      results.push({
        type: 'worker',
        description: `High number of active workers: ${this.workerRegistry.size}`,
        severity: this.workerRegistry.size > 50 ? 'high' : 'medium',
        count: this.workerRegistry.size,
        recommendation: 'Ensure workers are properly terminated when no longer needed'
      });
    }

    // Check for orphaned event listeners
    const orphanedListeners = this.findOrphanedEventListeners();
    if (orphanedListeners > 0) {
      results.push({
        type: 'event-listener',
        description: `Orphaned event listeners detected: ${orphanedListeners}`,
        severity: orphanedListeners > 100 ? 'high' : 'medium',
        count: orphanedListeners,
        recommendation: 'Remove event listeners when their target elements are destroyed'
      });
    }

    return results;
  }

  /**
   * Find orphaned event listeners (listeners on destroyed elements)
   */
  private findOrphanedEventListeners(): number {
    let orphanedCount = 0;

    for (const [targetId, listeners] of this.eventListenerRegistry.entries()) {
      const listenersToRemove: EventListenerInfo[] = [];
      
      for (const listener of listeners) {
        const target = listener.target.deref();
        if (!target) {
          // Target has been garbage collected
          orphanedCount++;
          listenersToRemove.push(listener);
        } else if (target instanceof Element && !document.contains(target)) {
          // Element is no longer in the DOM
          orphanedCount++;
          listenersToRemove.push(listener);
        }
      }

      // Clean up orphaned listeners
      for (const listener of listenersToRemove) {
        listeners.delete(listener);
      }
    }

    return orphanedCount;
  }

  /**
   * Register canvas for tracking
   */
  public registerCanvas(canvas: HTMLCanvasElement | OffscreenCanvas): void {
    this.canvasRegistry.add(canvas);
  }

  /**
   * Clean up all tracked resources
   */
  public performCleanup(): void {
    // Clear all timers
    for (const timerId of this.timerRegistry) {
      clearTimeout(timerId);
      clearInterval(timerId);
    }
    this.timerRegistry.clear();

    // Terminate all workers
    for (const worker of this.workerRegistry) {
      worker.terminate();
    }
    this.workerRegistry.clear();

    // Clear event listener registry
    this.eventListenerRegistry.clear();

    console.log('Memory leak prevention cleanup completed');
  }

  /**
   * Get memory usage report
   */
  public getMemoryReport(): {
    current: MemorySnapshot | null;
    trend: 'increasing' | 'stable' | 'decreasing';
    leaks: LeakDetectionResult[];
    recommendations: string[];
  } {
    const current = this.memorySnapshots[this.memorySnapshots.length - 1] || null;
    const leaks = this.performLeakDetection();
    
    let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
    if (this.memorySnapshots.length >= 5) {
      const recent = this.memorySnapshots.slice(-5);
      const first = recent[0];
      const last = recent[recent.length - 1];
      const change = (last.heapUsed - first.heapUsed) / first.heapUsed;
      
      if (change > 0.1) trend = 'increasing';
      else if (change < -0.1) trend = 'decreasing';
    }

    const recommendations: string[] = [];
    if (trend === 'increasing') {
      recommendations.push('Memory usage is increasing - check for memory leaks');
    }
    if (leaks.length > 0) {
      recommendations.push('Active memory leaks detected - review leak detection results');
    }
    if (current && current.eventListeners > 500) {
      recommendations.push('High number of event listeners - consider using event delegation');
    }
    if (current && current.timers > 50) {
      recommendations.push('High number of active timers - ensure proper cleanup');
    }

    return {
      current,
      trend,
      leaks,
      recommendations
    };
  }

  /**
   * Dispose of the service
   */
  public dispose(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.domObserver) {
      this.domObserver.disconnect();
      this.domObserver = null;
    }

    this.performCleanup();
    this.memorySnapshots.length = 0;
  }
}

interface EventListenerInfo {
  type: string;
  listener: EventListenerOrEventListenerObject;
  options?: boolean | AddEventListenerOptions;
  target: WeakRef<EventTarget>;
  addedAt: number;
  stackTrace: string;
}

// Singleton instance
export const memoryLeakPreventionService = new MemoryLeakPreventionService();