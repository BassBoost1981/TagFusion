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

describe('FullscreenViewerService', () => {
  let service: FullscreenViewerService;
  let mockWindow: any;
  let mockFileList: MediaFile[];

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

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

    // Create test data
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
        path: '/test/video1.mp4',
        name: 'video1.mp4',
        extension: '.mp4',
        size: 4096,
        dateModified: new Date(),
        type: 'video',
      },
    ];

    service = new FullscreenViewerService();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('openViewer', () => {
    it('should open viewer with correct file and file list', async () => {
      const file = mockFileList[0];
      const result = await service.openViewer(file, mockFileList);

      expect(result).toBe(true);
      expect(BrowserWindow).toHaveBeenCalledWith({
        fullscreen: true,
        frame: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          enableRemoteModule: false,
          preload: expect.stringContaining('preload.js'),
        },
        show: false,
        backgroundColor: '#000000',
      });
    });

    it('should initialize state correctly', async () => {
      const file = mockFileList[1];
      await service.openViewer(file, mockFileList);

      const state = service.getCurrentState();
      expect(state).toEqual({
        currentFile: file,
        fileList: mockFileList,
        currentIndex: 1,
        zoomLevel: 1,
        panOffset: { x: 0, y: 0 },
        slideshowActive: false,
        slideshowInterval: 3,
        showInfo: false,
      });
    });

    it('should return false if file not found in list', async () => {
      const unknownFile: MediaFile = {
        path: '/unknown/file.jpg',
        name: 'file.jpg',
        extension: '.jpg',
        size: 1024,
        dateModified: new Date(),
        type: 'image',
      };

      const result = await service.openViewer(unknownFile, mockFileList);
      expect(result).toBe(false);
    });

    it('should close existing viewer before opening new one', async () => {
      // Open first viewer
      await service.openViewer(mockFileList[0], mockFileList);
      const firstWindow = mockWindow;

      // Mock new window
      const secondWindow = { ...mockWindow, close: vi.fn() };
      (BrowserWindow as any).mockImplementation(() => secondWindow);

      // Open second viewer
      await service.openViewer(mockFileList[1], mockFileList);

      expect(firstWindow.close).toHaveBeenCalled();
    });
  });

  describe('navigation', () => {
    beforeEach(async () => {
      await service.openViewer(mockFileList[1], mockFileList);
    });

    it('should navigate to next image', () => {
      const result = service.nextImage();
      expect(result).toBe(true);

      const state = service.getCurrentState();
      expect(state?.currentIndex).toBe(2);
      expect(state?.currentFile).toBe(mockFileList[2]);
    });

    it('should wrap to first image when at end', () => {
      // Go to last image
      service.goToIndex(2);
      
      // Go to next (should wrap to first)
      const result = service.nextImage();
      expect(result).toBe(true);

      const state = service.getCurrentState();
      expect(state?.currentIndex).toBe(0);
      expect(state?.currentFile).toBe(mockFileList[0]);
    });

    it('should navigate to previous image', () => {
      const result = service.previousImage();
      expect(result).toBe(true);

      const state = service.getCurrentState();
      expect(state?.currentIndex).toBe(0);
      expect(state?.currentFile).toBe(mockFileList[0]);
    });

    it('should wrap to last image when at beginning', () => {
      // Go to first image
      service.goToIndex(0);
      
      // Go to previous (should wrap to last)
      const result = service.previousImage();
      expect(result).toBe(true);

      const state = service.getCurrentState();
      expect(state?.currentIndex).toBe(2);
      expect(state?.currentFile).toBe(mockFileList[2]);
    });

    it('should go to specific index', () => {
      const result = service.goToIndex(0);
      expect(result).toBe(true);

      const state = service.getCurrentState();
      expect(state?.currentIndex).toBe(0);
      expect(state?.currentFile).toBe(mockFileList[0]);
    });

    it('should return false for invalid index', () => {
      expect(service.goToIndex(-1)).toBe(false);
      expect(service.goToIndex(10)).toBe(false);
    });

    it('should reset zoom and pan when changing images', () => {
      // Set zoom and pan
      service.setZoom(2);
      service.setPan({ x: 100, y: 50 });

      // Change image
      service.nextImage();

      const state = service.getCurrentState();
      expect(state?.zoomLevel).toBe(1);
      expect(state?.panOffset).toEqual({ x: 0, y: 0 });
    });
  });

  describe('zoom and pan', () => {
    beforeEach(async () => {
      await service.openViewer(mockFileList[0], mockFileList);
    });

    it('should set zoom level', () => {
      const result = service.setZoom(2.5);
      expect(result).toBe(true);

      const state = service.getCurrentState();
      expect(state?.zoomLevel).toBe(2.5);
    });

    it('should clamp zoom level between 0.1 and 10', () => {
      service.setZoom(0.05);
      expect(service.getCurrentState()?.zoomLevel).toBe(0.1);

      service.setZoom(15);
      expect(service.getCurrentState()?.zoomLevel).toBe(10);
    });

    it('should set pan offset', () => {
      const panOffset = { x: 100, y: -50 };
      const result = service.setPan(panOffset);
      expect(result).toBe(true);

      const state = service.getCurrentState();
      expect(state?.panOffset).toEqual(panOffset);
    });

    it('should reset view', () => {
      // Set zoom and pan
      service.setZoom(3);
      service.setPan({ x: 200, y: 100 });

      // Reset
      const result = service.resetView();
      expect(result).toBe(true);

      const state = service.getCurrentState();
      expect(state?.zoomLevel).toBe(1);
      expect(state?.panOffset).toEqual({ x: 0, y: 0 });
    });
  });

  describe('slideshow', () => {
    beforeEach(async () => {
      await service.openViewer(mockFileList[0], mockFileList);
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should start slideshow with default interval', () => {
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

    it('should advance images during slideshow', () => {
      service.startSlideshow(1);

      // Fast-forward 1 second
      vi.advanceTimersByTime(1000);

      const state = service.getCurrentState();
      expect(state?.currentIndex).toBe(1);
    });

    it('should stop slideshow', () => {
      service.startSlideshow();
      const result = service.stopSlideshow();
      expect(result).toBe(true);

      const state = service.getCurrentState();
      expect(state?.slideshowActive).toBe(false);
    });

    it('should set slideshow interval', () => {
      const result = service.setSlideshowInterval(10);
      expect(result).toBe(true);

      const state = service.getCurrentState();
      expect(state?.slideshowInterval).toBe(10);
    });

    it('should restart slideshow with new interval if active', () => {
      service.startSlideshow(2);
      service.setSlideshowInterval(1);

      // Should use new interval
      vi.advanceTimersByTime(1000);
      const state = service.getCurrentState();
      expect(state?.currentIndex).toBe(1);
    });

    it('should enforce minimum interval of 1 second', () => {
      service.setSlideshowInterval(0.5);
      const state = service.getCurrentState();
      expect(state?.slideshowInterval).toBe(1);
    });
  });

  describe('info overlay', () => {
    beforeEach(async () => {
      await service.openViewer(mockFileList[0], mockFileList);
    });

    it('should toggle info visibility', () => {
      const result = service.toggleInfo();
      expect(result).toBe(true);

      let state = service.getCurrentState();
      expect(state?.showInfo).toBe(true);

      service.toggleInfo();
      state = service.getCurrentState();
      expect(state?.showInfo).toBe(false);
    });

    it('should set info visibility', () => {
      const result = service.setShowInfo(true);
      expect(result).toBe(true);

      const state = service.getCurrentState();
      expect(state?.showInfo).toBe(true);
    });
  });

  describe('state management', () => {
    it('should return null state when not open', () => {
      expect(service.getCurrentState()).toBeNull();
      expect(service.isOpen()).toBe(false);
    });

    it('should return current state when open', async () => {
      await service.openViewer(mockFileList[0], mockFileList);
      
      const state = service.getCurrentState();
      expect(state).not.toBeNull();
      expect(service.isOpen()).toBe(true);
    });

    it('should notify renderer of state changes', async () => {
      await service.openViewer(mockFileList[0], mockFileList);
      
      service.setZoom(2);
      
      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'viewer:stateChanged',
        expect.objectContaining({
          zoomLevel: 2,
        })
      );
    });
  });

  describe('cleanup', () => {
    it('should cleanup when window is closed', async () => {
      await service.openViewer(mockFileList[0], mockFileList);
      service.startSlideshow();

      // Simulate window closed event
      const closedHandler = mockWindow.on.mock.calls.find(
        call => call[0] === 'closed'
      )?.[1];
      
      if (closedHandler) {
        closedHandler();
      }

      expect(service.getCurrentState()).toBeNull();
      expect(service.isOpen()).toBe(false);
    });

    it('should close viewer', async () => {
      await service.openViewer(mockFileList[0], mockFileList);
      
      const result = service.closeViewer();
      expect(result).toBe(true);
      expect(mockWindow.close).toHaveBeenCalled();
    });

    it('should return false when closing non-existent viewer', () => {
      const result = service.closeViewer();
      expect(result).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle window creation errors', async () => {
      (BrowserWindow as any).mockImplementation(() => {
        throw new Error('Window creation failed');
      });

      const result = await service.openViewer(mockFileList[0], mockFileList);
      expect(result).toBe(false);
    });

    it('should return false for operations when not open', () => {
      expect(service.nextImage()).toBe(false);
      expect(service.previousImage()).toBe(false);
      expect(service.setZoom(2)).toBe(false);
      expect(service.setPan({ x: 0, y: 0 })).toBe(false);
      expect(service.resetView()).toBe(false);
      expect(service.startSlideshow()).toBe(false);
      expect(service.stopSlideshow()).toBe(false);
      expect(service.toggleInfo()).toBe(false);
      expect(service.setShowInfo(true)).toBe(false);
    });
  });
});