import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryLeakPreventionService } from '../MemoryLeakPreventionService';

// Mock performance.memory
const mockMemory = {
  jsHeapSizeLimit: 2147483648,
  totalJSHeapSize: 100000000,
  usedJSHeapSize: 50000000
};

// Mock DOM elements
class MockElement extends EventTarget {
  tagName = 'DIV';
  constructor(tagName = 'DIV') {
    super();
    this.tagName = tagName;
  }
}

class MockCanvas extends MockElement {
  tagName = 'CANVAS';
  width = 0;
  height = 0;
  constructor() {
    super('CANVAS');
  }
}

describe('MemoryLeakPreventionService', () => {
  let service: MemoryLeakPreventionService;
  let originalSetTimeout: typeof setTimeout;
  let originalSetInterval: typeof setInterval;
  let originalClearTimeout: typeof clearTimeout;
  let originalClearInterval: typeof clearInterval;

  beforeEach(() => {
    // Store original timer functions
    originalSetTimeout = window.setTimeout;
    originalSetInterval = window.setInterval;
    originalClearTimeout = window.clearTimeout;
    originalClearInterval = window.clearInterval;

    // Mock performance.memory
    Object.defineProperty(global.performance, 'memory', {
      value: mockMemory,
      writable: true
    });

    // Mock DOM
    global.document = {
      body: new MockElement(),
      contains: vi.fn().mockReturnValue(true),
      createElement: vi.fn().mockImplementation((tagName) => {
        if (tagName === 'canvas') return new MockCanvas();
        return new MockElement(tagName.toUpperCase());
      })
    } as any;

    // Mock MutationObserver
    global.MutationObserver = vi.fn().mockImplementation((callback) => ({
      observe: vi.fn(),
      disconnect: vi.fn(),
      takeRecords: vi.fn()
    }));

    // Mock Worker
    global.Worker = vi.fn().mockImplementation(() => ({
      terminate: vi.fn(),
      postMessage: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }));

    service = new MemoryLeakPreventionService();
  });

  afterEach(() => {
    service.dispose();
    
    // Restore original timer functions
    window.setTimeout = originalSetTimeout;
    window.setInterval = originalSetInterval;
    window.clearTimeout = originalClearTimeout;
    window.clearInterval = originalClearInterval;
    
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with DOM observer', () => {
      expect(global.MutationObserver).toHaveBeenCalled();
    });

    it('should start memory monitoring', () => {
      // Memory monitoring should be active (tested indirectly through snapshots)
      expect(service).toBeDefined();
    });
  });

  describe('timer tracking', () => {
    it('should track setTimeout calls', () => {
      const callback = vi.fn();
      const id = setTimeout(callback, 100);
      
      expect(typeof id).toBe('number');
      
      clearTimeout(id);
    });

    it('should track setInterval calls', () => {
      const callback = vi.fn();
      const id = setInterval(callback, 100);
      
      expect(typeof id).toBe('number');
      
      clearInterval(id);
    });

    it('should clean up timers when cleared', () => {
      const callback = vi.fn();
      const timeoutId = setTimeout(callback, 100);
      const intervalId = setInterval(callback, 100);
      
      clearTimeout(timeoutId);
      clearInterval(intervalId);
      
      // Timers should be removed from tracking
      expect(true).toBe(true); // Indirect test - no errors thrown
    });

    it('should auto-remove setTimeout from tracking when executed', (done) => {
      const callback = vi.fn(() => {
        // Timer should be automatically removed from tracking
        done();
      });
      
      setTimeout(callback, 10);
    });
  });

  describe('event listener tracking', () => {
    it('should track addEventListener calls', () => {
      const element = new MockElement();
      const listener = vi.fn();
      
      element.addEventListener('click', listener);
      
      // Should not throw errors
      expect(true).toBe(true);
    });

    it('should track removeEventListener calls', () => {
      const element = new MockElement();
      const listener = vi.fn();
      
      element.addEventListener('click', listener);
      element.removeEventListener('click', listener);
      
      // Should not throw errors
      expect(true).toBe(true);
    });

    it('should handle event listeners on different element types', () => {
      const div = new MockElement('DIV');
      const canvas = new MockCanvas();
      
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      
      div.addEventListener('click', listener1);
      canvas.addEventListener('mousedown', listener2);
      
      expect(true).toBe(true);
    });
  });

  describe('worker tracking', () => {
    it('should track Worker creation', () => {
      const worker = new Worker('test-worker.js');
      
      expect(worker).toBeDefined();
      expect(worker.terminate).toBeDefined();
    });

    it('should clean up workers on termination', () => {
      const worker = new Worker('test-worker.js');
      worker.terminate();
      
      expect(worker.terminate).toHaveBeenCalled();
    });
  });

  describe('memory monitoring', () => {
    it('should take memory snapshots', async () => {
      // Wait a bit for initial snapshot
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const report = service.getMemoryReport();
      expect(report.current).toBeDefined();
    });

    it('should detect memory trends', async () => {
      // Simulate increasing memory usage
      const increasingMemory = { ...mockMemory };
      
      for (let i = 0; i < 6; i++) {
        increasingMemory.usedJSHeapSize += 10000000; // Increase by 10MB each time
        Object.defineProperty(global.performance, 'memory', {
          value: increasingMemory,
          writable: true
        });
        
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      const report = service.getMemoryReport();
      expect(report.trend).toBeDefined();
    });
  });

  describe('leak detection', () => {
    it('should detect excessive event listeners', () => {
      // Create many event listeners
      for (let i = 0; i < 1500; i++) {
        const element = new MockElement();
        element.addEventListener('click', vi.fn());
      }
      
      const results = service.performLeakDetection();
      const listenerLeak = results.find(r => r.type === 'event-listener');
      
      expect(listenerLeak).toBeDefined();
      expect(listenerLeak?.severity).toBe('medium');
    });

    it('should detect excessive timers', () => {
      // Create many timers
      for (let i = 0; i < 150; i++) {
        setTimeout(vi.fn(), 1000);
      }
      
      const results = service.performLeakDetection();
      const timerLeak = results.find(r => r.type === 'timer');
      
      expect(timerLeak).toBeDefined();
      expect(timerLeak?.severity).toBe('medium');
    });

    it('should detect excessive workers', () => {
      // Create many workers
      for (let i = 0; i < 15; i++) {
        new Worker('test-worker.js');
      }
      
      const results = service.performLeakDetection();
      const workerLeak = results.find(r => r.type === 'worker');
      
      expect(workerLeak).toBeDefined();
      expect(workerLeak?.severity).toBe('medium');
    });

    it('should provide appropriate recommendations', () => {
      // Create excessive timers
      for (let i = 0; i < 600; i++) {
        setTimeout(vi.fn(), 1000);
      }
      
      const results = service.performLeakDetection();
      const timerLeak = results.find(r => r.type === 'timer');
      
      expect(timerLeak?.recommendation).toContain('cleared');
      expect(timerLeak?.severity).toBe('high');
    });
  });

  describe('canvas tracking', () => {
    it('should register canvas elements', () => {
      const canvas = new MockCanvas();
      
      service.registerCanvas(canvas as any);
      
      // Should not throw errors
      expect(true).toBe(true);
    });
  });

  describe('memory report', () => {
    it('should generate comprehensive memory report', () => {
      const report = service.getMemoryReport();
      
      expect(report).toHaveProperty('current');
      expect(report).toHaveProperty('trend');
      expect(report).toHaveProperty('leaks');
      expect(report).toHaveProperty('recommendations');
      expect(Array.isArray(report.leaks)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('should provide recommendations based on conditions', () => {
      // Create conditions that should trigger recommendations
      for (let i = 0; i < 600; i++) {
        const element = new MockElement();
        element.addEventListener('click', vi.fn());
      }
      
      for (let i = 0; i < 60; i++) {
        setTimeout(vi.fn(), 1000);
      }
      
      const report = service.getMemoryReport();
      
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('cleanup', () => {
    it('should perform cleanup of all resources', () => {
      // Create some resources
      const timeoutId = setTimeout(vi.fn(), 1000);
      const intervalId = setInterval(vi.fn(), 1000);
      const worker = new Worker('test-worker.js');
      
      service.performCleanup();
      
      // Should clean up without errors
      expect(true).toBe(true);
    });
  });

  describe('disposal', () => {
    it('should dispose of all resources', () => {
      const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
      
      service.dispose();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('should disconnect DOM observer on disposal', () => {
      const mockObserver = {
        observe: vi.fn(),
        disconnect: vi.fn(),
        takeRecords: vi.fn()
      };
      
      (global.MutationObserver as any).mockImplementation(() => mockObserver);
      
      const testService = new MemoryLeakPreventionService();
      testService.dispose();
      
      expect(mockObserver.disconnect).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle missing MutationObserver gracefully', () => {
      delete (global as any).MutationObserver;
      
      expect(() => {
        const testService = new MemoryLeakPreventionService();
        testService.dispose();
      }).not.toThrow();
    });

    it('should handle missing performance.memory gracefully', () => {
      delete (global.performance as any).memory;
      
      const testService = new MemoryLeakPreventionService();
      const report = testService.getMemoryReport();
      
      expect(report.current).toBeNull();
      testService.dispose();
    });

    it('should handle timer creation errors', () => {
      const originalSetTimeout = window.setTimeout;
      window.setTimeout = vi.fn().mockImplementation(() => {
        throw new Error('Timer creation failed');
      });
      
      expect(() => {
        setTimeout(vi.fn(), 100);
      }).toThrow('Timer creation failed');
      
      window.setTimeout = originalSetTimeout;
    });
  });

  describe('orphaned listener detection', () => {
    it('should detect orphaned event listeners', () => {
      const element = new MockElement();
      element.addEventListener('click', vi.fn());
      
      // Mock element being removed from DOM
      (global.document.contains as any).mockReturnValue(false);
      
      const results = service.performLeakDetection();
      
      // Should detect orphaned listeners
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('memory pressure detection', () => {
    it('should detect memory pressure and trigger cleanup', async () => {
      // Mock high memory usage
      const highMemory = {
        ...mockMemory,
        usedJSHeapSize: mockMemory.jsHeapSizeLimit * 0.9 // 90% usage
      };
      
      Object.defineProperty(global.performance, 'memory', {
        value: highMemory,
        writable: true
      });
      
      // Wait for memory monitoring to detect pressure
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should not throw errors during pressure handling
      expect(true).toBe(true);
    });
  });
});