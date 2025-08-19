import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BrowserWindow } from 'electron';
import { FullscreenViewerService } from '../FullscreenViewerService';
import { MediaFile } from '../../../types/global';

// Mock Electron
vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  ipcMain: {
    handle: vi.fn(),
  },
}));

// Mock utils
vi.mock('../../utils/environment', () => ({
  isDev: false,
}));

describe('FullscreenViewerService - Slideshow Functionality', () => {
  let service: FullscreenViewerService;
  let mockWindow: any;
  let mockFileList: MediaFile[];

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Mock BrowserWindow
    mockWindow = {
      loadURL: vi.fn().mockResolvedValue(undefined),
      loadFile: vi.fn().mockResolvedValue(undefined),
      once: vi.fn(),
      on: vi.fn(),
      show: vi.fn(),
      focus: vi.fn(),
      close: vi.fn(),
      isDestroyed: vi.fn().mockReturnValue(false),
      webContents: {
        send: vi.fn(),
      },
    };

    (BrowserWindow as any).mockImplementation(() => mockWindow);

    // Create test data with multiple images
    mockFileList = [
      {
        path: '/test/image1.jpg',
        name: 'image1.jpg',
        extension: '.jpg',
        size: 1024,
        dateModified: new Date(),
        type: 'image',
      },
      {
        path: '/test/image2.jpg',
        name: 'image2.jpg',
        extension: '.jpg',
        size: 2048,
        dateModified: new Date(),
        type: 'image',
      },
      {
        path: '/test/image3.jpg',
        name: 'image3.jpg',
        extension: '.jpg',
        size: 3072,
        dateModified: new Date(),
        type: 'image',
      },
      {
        path: '/test/image4.jpg',
        name: 'image4.jpg',
        extension: '.jpg',
        size: 4096,
        dateModified: new Date(),
        type: 'image',
      },
    ];

    service = new FullscreenViewerService();
    await service.openViewer(mockFileList[0], mockFileList);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Slideshow Controls', () => {
    it('should start slideshow with default 3-second interval', () => {
      const result = service.startSlideshow();
      
      expect(result).toBe(true);
      const state = service.getCurrentState();
      expect(state?.slideshowActive).toBe(true);
      expect(state?.slideshowInterval).toBe(3);
    });

    it('should start slideshow with custom interval', () => {
      const result = service.startSlideshow(5);
      
      expect(result).toBe(true);
      const state = service.getCurrentState();
      expect(state?.slideshowActive).toBe(true);
      expect(state?.slideshowInterval).toBe(5);
    });

    it('should stop slideshow', () => {
      service.startSlideshow();
      const result = service.stopSlideshow();
      
      expect(result).toBe(true);
      const state = service.getCurrentState();
      expect(state?.slideshowActive).toBe(false);
    });

    it('should toggle slideshow state correctly', () => {
      // Start slideshow
      service.startSlideshow();
      expect(service.getCurrentState()?.slideshowActive).toBe(true);
      
      // Stop slideshow
      service.stopSlideshow();
      expect(service.getCurrentState()?.slideshowActive).toBe(false);
      
      // Start again
      service.startSlideshow();
      expect(service.getCurrentState()?.slideshowActive).toBe(true);
    });
  });

  describe('Automatic Image Progression', () => {
    it('should advance to next image after interval', () => {
      service.startSlideshow(2); // 2 second interval
      
      // Initially at image 0
      expect(service.getCurrentState()?.currentIndex).toBe(0);
      
      // After 2 seconds, should advance to image 1
      vi.advanceTimersByTime(2000);
      expect(service.getCurrentState()?.currentIndex).toBe(1);
      
      // After another 2 seconds, should advance to image 2
      vi.advanceTimersByTime(2000);
      expect(service.getCurrentState()?.currentIndex).toBe(2);
    });

    it('should wrap around to first image after reaching the end', () => {
      // Start at last image
      service.goToIndex(3);
      service.startSlideshow(1);
      
      expect(service.getCurrentState()?.currentIndex).toBe(3);
      
      // After 1 second, should wrap to first image
      vi.advanceTimersByTime(1000);
      expect(service.getCurrentState()?.currentIndex).toBe(0);
    });

    it('should continue progression through multiple cycles', () => {
      service.startSlideshow(1);
      
      // Complete one full cycle (4 images)
      vi.advanceTimersByTime(4000);
      expect(service.getCurrentState()?.currentIndex).toBe(0); // Wrapped around
      
      // Continue for another cycle
      vi.advanceTimersByTime(4000);
      expect(service.getCurrentState()?.currentIndex).toBe(0); // Wrapped around again
    });

    it('should stop progression when slideshow is stopped', () => {
      service.startSlideshow(1);
      
      // Advance one image
      vi.advanceTimersByTime(1000);
      expect(service.getCurrentState()?.currentIndex).toBe(1);
      
      // Stop slideshow
      service.stopSlideshow();
      
      // Wait more time - should not advance
      vi.advanceTimersByTime(2000);
      expect(service.getCurrentState()?.currentIndex).toBe(1);
    });
  });

  describe('Slideshow Speed Settings', () => {
    it('should change slideshow interval', () => {
      const result = service.setSlideshowInterval(7);
      
      expect(result).toBe(true);
      const state = service.getCurrentState();
      expect(state?.slideshowInterval).toBe(7);
    });

    it('should enforce minimum interval of 1 second', () => {
      service.setSlideshowInterval(0.5);
      expect(service.getCurrentState()?.slideshowInterval).toBe(1);
      
      service.setSlideshowInterval(0);
      expect(service.getCurrentState()?.slideshowInterval).toBe(1);
      
      service.setSlideshowInterval(-5);
      expect(service.getCurrentState()?.slideshowInterval).toBe(1);
    });

    it('should allow reasonable maximum intervals', () => {
      service.setSlideshowInterval(60);
      expect(service.getCurrentState()?.slideshowInterval).toBe(60);
      
      service.setSlideshowInterval(300);
      expect(service.getCurrentState()?.slideshowInterval).toBe(300);
    });

    it('should restart slideshow with new interval when active', () => {
      // Start with 3 second interval
      service.startSlideshow(3);
      
      // Change to 1 second interval
      service.setSlideshowInterval(1);
      
      // Should advance after 1 second (new interval)
      vi.advanceTimersByTime(1000);
      expect(service.getCurrentState()?.currentIndex).toBe(1);
      
      // Should advance again after another 1 second
      vi.advanceTimersByTime(1000);
      expect(service.getCurrentState()?.currentIndex).toBe(2);
    });

    it('should not restart slideshow when inactive', () => {
      // Set interval without starting slideshow
      service.setSlideshowInterval(1);
      
      // Should not advance automatically
      vi.advanceTimersByTime(2000);
      expect(service.getCurrentState()?.currentIndex).toBe(0);
      expect(service.getCurrentState()?.slideshowActive).toBe(false);
    });
  });

  describe('Slideshow State Notifications', () => {
    it('should notify renderer when slideshow starts', () => {
      service.startSlideshow();
      
      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'viewer:stateChanged',
        expect.objectContaining({
          slideshowActive: true,
        })
      );
    });

    it('should notify renderer when slideshow stops', () => {
      service.startSlideshow();
      mockWindow.webContents.send.mockClear();
      
      service.stopSlideshow();
      
      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'viewer:stateChanged',
        expect.objectContaining({
          slideshowActive: false,
        })
      );
    });

    it('should notify renderer when interval changes', () => {
      service.setSlideshowInterval(5);
      
      // Should not notify if slideshow is not active
      expect(mockWindow.webContents.send).not.toHaveBeenCalled();
      
      // Start slideshow and change interval
      service.startSlideshow();
      mockWindow.webContents.send.mockClear();
      
      service.setSlideshowInterval(2);
      
      // Should notify twice: once for stop, once for start
      expect(mockWindow.webContents.send).toHaveBeenCalledTimes(2);
    });
  });

  describe('Slideshow with Manual Navigation', () => {
    it('should continue slideshow after manual navigation', () => {
      service.startSlideshow(2);
      
      // Manually navigate to next image
      service.nextImage();
      expect(service.getCurrentState()?.currentIndex).toBe(1);
      
      // Slideshow should continue from new position
      vi.advanceTimersByTime(2000);
      expect(service.getCurrentState()?.currentIndex).toBe(2);
    });

    it('should continue slideshow after manual index change', () => {
      service.startSlideshow(1);
      
      // Manually jump to image 2
      service.goToIndex(2);
      expect(service.getCurrentState()?.currentIndex).toBe(2);
      
      // Slideshow should continue from new position
      vi.advanceTimersByTime(1000);
      expect(service.getCurrentState()?.currentIndex).toBe(3);
    });

    it('should maintain slideshow state during manual navigation', () => {
      service.startSlideshow(3);
      
      // Manual navigation should not stop slideshow
      service.nextImage();
      expect(service.getCurrentState()?.slideshowActive).toBe(true);
      
      service.previousImage();
      expect(service.getCurrentState()?.slideshowActive).toBe(true);
      
      service.goToIndex(2);
      expect(service.getCurrentState()?.slideshowActive).toBe(true);
    });
  });

  describe('Slideshow Cleanup', () => {
    it('should stop slideshow when viewer is closed', () => {
      service.startSlideshow(1);
      expect(service.getCurrentState()?.slideshowActive).toBe(true);
      
      // Simulate window closed event
      const closedHandler = mockWindow.on.mock.calls.find(
        call => call[0] === 'closed'
      )?.[1];
      
      if (closedHandler) {
        closedHandler();
      }
      
      // Slideshow should be stopped and state should be null
      expect(service.getCurrentState()).toBeNull();
      
      // Timer should not advance anything
      vi.advanceTimersByTime(5000);
      expect(service.getCurrentState()).toBeNull();
    });

    it('should handle multiple slideshow start/stop cycles', () => {
      // Start and stop multiple times
      for (let i = 0; i < 5; i++) {
        service.startSlideshow(1);
        expect(service.getCurrentState()?.slideshowActive).toBe(true);
        
        service.stopSlideshow();
        expect(service.getCurrentState()?.slideshowActive).toBe(false);
      }
      
      // Should still work correctly
      service.startSlideshow(1);
      vi.advanceTimersByTime(1000);
      expect(service.getCurrentState()?.currentIndex).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle slideshow with single image', async () => {
      // Create service with single image
      const singleImageList = [mockFileList[0]];
      await service.openViewer(singleImageList[0], singleImageList);
      
      service.startSlideshow(1);
      
      // Should stay on same image
      vi.advanceTimersByTime(2000);
      expect(service.getCurrentState()?.currentIndex).toBe(0);
      expect(service.getCurrentState()?.slideshowActive).toBe(true);
    });

    it('should handle slideshow with empty file list', async () => {
      // This should not happen in normal usage, but test defensive programming
      const emptyList: MediaFile[] = [];
      
      // This should fail to open
      const result = await service.openViewer(mockFileList[0], emptyList);
      expect(result).toBe(false);
    });

    it('should return false for slideshow operations when viewer is not open', () => {
      const closedService = new FullscreenViewerService();
      
      expect(closedService.startSlideshow()).toBe(false);
      expect(closedService.stopSlideshow()).toBe(false);
      expect(closedService.setSlideshowInterval(5)).toBe(false);
    });
  });
});