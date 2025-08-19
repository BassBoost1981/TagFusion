import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BrowserWindow, ipcMain } from 'electron';
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

describe('FullscreenViewerService - Integration Tests', () => {
  let service: FullscreenViewerService;
  let mockWindow: any;
  let mockFileList: MediaFile[];
  let ipcHandlers: Map<string, Function>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Track IPC handlers
    ipcHandlers = new Map();
    (ipcMain.handle as any).mockImplementation((channel: string, handler: Function) => {
      ipcHandlers.set(channel, handler);
    });

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
        path: '/test/nature1.jpg',
        name: 'nature1.jpg',
        extension: '.jpg',
        size: 1024000,
        dateModified: new Date('2024-01-15T10:00:00Z'),
        type: 'image',
      },
      {
        path: '/test/nature2.jpg',
        name: 'nature2.jpg',
        extension: '.jpg',
        size: 2048000,
        dateModified: new Date('2024-01-16T11:00:00Z'),
        type: 'image',
      },
      {
        path: '/test/landscape.jpg',
        name: 'landscape.jpg',
        extension: '.jpg',
        size: 3072000,
        dateModified: new Date('2024-01-17T12:00:00Z'),
        type: 'image',
      },
    ];

    service = new FullscreenViewerService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Complete Viewer Workflow', () => {
    it('should handle complete viewer lifecycle', async () => {
      // 1. Open viewer
      const openResult = await service.openViewer(mockFileList[0], mockFileList);
      expect(openResult).toBe(true);
      expect(service.isOpen()).toBe(true);

      // 2. Verify initial state
      const initialState = service.getCurrentState();
      expect(initialState).toEqual({
        currentFile: mockFileList[0],
        fileList: mockFileList,
        currentIndex: 0,
        zoomLevel: 1,
        panOffset: { x: 0, y: 0 },
        slideshowActive: false,
        slideshowInterval: 3,
        showInfo: false,
      });

      // 3. Navigate through images
      service.nextImage();
      expect(service.getCurrentState()?.currentIndex).toBe(1);
      expect(service.getCurrentState()?.currentFile).toBe(mockFileList[1]);

      service.nextImage();
      expect(service.getCurrentState()?.currentIndex).toBe(2);

      // 4. Test zoom and pan
      service.setZoom(2.5);
      service.setPan({ x: 100, y: -50 });
      expect(service.getCurrentState()?.zoomLevel).toBe(2.5);
      expect(service.getCurrentState()?.panOffset).toEqual({ x: 100, y: -50 });

      // 5. Start slideshow
      service.startSlideshow(1);
      expect(service.getCurrentState()?.slideshowActive).toBe(true);

      // 6. Verify slideshow progression
      vi.advanceTimersByTime(1000);
      expect(service.getCurrentState()?.currentIndex).toBe(0); // Wrapped around

      // 7. Stop slideshow
      service.stopSlideshow();
      expect(service.getCurrentState()?.slideshowActive).toBe(false);

      // 8. Show info overlay
      service.toggleInfo();
      expect(service.getCurrentState()?.showInfo).toBe(true);

      // 9. Close viewer
      const closeResult = service.closeViewer();
      expect(closeResult).toBe(true);
    });

    it('should handle IPC communication correctly', async () => {
      // Open viewer to initialize IPC handlers
      await service.openViewer(mockFileList[0], mockFileList);

      // Test all IPC handlers are registered
      const expectedHandlers = [
        'viewer:open',
        'viewer:close',
        'viewer:next',
        'viewer:previous',
        'viewer:goToIndex',
        'viewer:setZoom',
        'viewer:setPan',
        'viewer:resetView',
        'viewer:startSlideshow',
        'viewer:stopSlideshow',
        'viewer:setSlideshowInterval',
        'viewer:toggleInfo',
        'viewer:setShowInfo',
        'viewer:getState',
      ];

      expectedHandlers.forEach(handler => {
        expect(ipcHandlers.has(handler)).toBe(true);
      });

      // Test IPC handler functionality
      const nextHandler = ipcHandlers.get('viewer:next');
      if (nextHandler) {
        const result = await nextHandler();
        expect(result).toBe(true);
        expect(service.getCurrentState()?.currentIndex).toBe(1);
      }

      const zoomHandler = ipcHandlers.get('viewer:setZoom');
      if (zoomHandler) {
        const result = await zoomHandler(null, 1.5);
        expect(result).toBe(true);
        expect(service.getCurrentState()?.zoomLevel).toBe(1.5);
      }

      const stateHandler = ipcHandlers.get('viewer:getState');
      if (stateHandler) {
        const state = await stateHandler();
        expect(state).toBe(service.getCurrentState());
      }
    });

    it('should handle multiple viewer sessions', async () => {
      // First session
      await service.openViewer(mockFileList[0], mockFileList);
      service.nextImage();
      service.setZoom(2);
      expect(service.getCurrentState()?.currentIndex).toBe(1);
      expect(service.getCurrentState()?.zoomLevel).toBe(2);

      // Close first session
      service.closeViewer();
      expect(service.getCurrentState()).toBeNull();

      // Second session with different file
      await service.openViewer(mockFileList[2], mockFileList);
      const newState = service.getCurrentState();
      expect(newState?.currentIndex).toBe(2);
      expect(newState?.zoomLevel).toBe(1); // Reset to default
      expect(newState?.currentFile).toBe(mockFileList[2]);
    });

    it('should handle slideshow with navigation interactions', async () => {
      await service.openViewer(mockFileList[0], mockFileList);

      // Start slideshow
      service.startSlideshow(2);
      expect(service.getCurrentState()?.slideshowActive).toBe(true);

      // Manual navigation should not stop slideshow
      service.nextImage();
      expect(service.getCurrentState()?.slideshowActive).toBe(true);
      expect(service.getCurrentState()?.currentIndex).toBe(1);

      // Slideshow should continue from new position
      vi.advanceTimersByTime(2000);
      expect(service.getCurrentState()?.currentIndex).toBe(2);

      // Manual zoom should not affect slideshow
      service.setZoom(1.5);
      expect(service.getCurrentState()?.slideshowActive).toBe(true);

      // But zoom should reset when slideshow advances
      vi.advanceTimersByTime(2000);
      expect(service.getCurrentState()?.currentIndex).toBe(0); // Wrapped
      expect(service.getCurrentState()?.zoomLevel).toBe(1); // Reset
    });

    it('should handle error scenarios gracefully', async () => {
      // Test opening with invalid file
      const invalidFile: MediaFile = {
        path: '/nonexistent/file.jpg',
        name: 'file.jpg',
        extension: '.jpg',
        size: 1024,
        dateModified: new Date(),
        type: 'image',
      };

      const result = await service.openViewer(invalidFile, mockFileList);
      expect(result).toBe(false);
      expect(service.getCurrentState()).toBeNull();

      // Test operations on closed viewer
      expect(service.nextImage()).toBe(false);
      expect(service.setZoom(2)).toBe(false);
      expect(service.startSlideshow()).toBe(false);
    });

    it('should handle window events correctly', async () => {
      await service.openViewer(mockFileList[0], mockFileList);
      service.startSlideshow(1);

      // Simulate window ready event
      const readyHandler = mockWindow.once.mock.calls.find(
        call => call[0] === 'ready-to-show'
      )?.[1];
      
      if (readyHandler) {
        readyHandler();
        expect(mockWindow.show).toHaveBeenCalled();
        expect(mockWindow.focus).toHaveBeenCalled();
      }

      // Simulate window closed event
      const closedHandler = mockWindow.on.mock.calls.find(
        call => call[0] === 'closed'
      )?.[1];
      
      if (closedHandler) {
        closedHandler();
        expect(service.getCurrentState()).toBeNull();
        expect(service.isOpen()).toBe(false);
      }
    });

    it('should notify renderer of all state changes', async () => {
      await service.openViewer(mockFileList[0], mockFileList);
      mockWindow.webContents.send.mockClear();

      // Navigation should notify
      service.nextImage();
      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'viewer:stateChanged',
        expect.objectContaining({ currentIndex: 1 })
      );

      // Zoom should notify
      service.setZoom(2);
      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'viewer:stateChanged',
        expect.objectContaining({ zoomLevel: 2 })
      );

      // Pan should notify
      service.setPan({ x: 50, y: 25 });
      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'viewer:stateChanged',
        expect.objectContaining({ panOffset: { x: 50, y: 25 } })
      );

      // Slideshow should notify
      service.startSlideshow();
      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'viewer:stateChanged',
        expect.objectContaining({ slideshowActive: true })
      );

      // Info toggle should notify
      service.toggleInfo();
      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'viewer:stateChanged',
        expect.objectContaining({ showInfo: true })
      );
    });
  });

  describe('Performance and Memory Management', () => {
    it('should clean up resources properly', async () => {
      // Open and close multiple times
      for (let i = 0; i < 5; i++) {
        await service.openViewer(mockFileList[0], mockFileList);
        service.startSlideshow(1);
        service.closeViewer();
        
        expect(service.getCurrentState()).toBeNull();
        expect(service.isOpen()).toBe(false);
      }

      // Should still work after multiple cycles
      await service.openViewer(mockFileList[1], mockFileList);
      expect(service.getCurrentState()?.currentFile).toBe(mockFileList[1]);
    });

    it('should handle rapid state changes', async () => {
      await service.openViewer(mockFileList[0], mockFileList);

      // Rapid navigation
      for (let i = 0; i < 10; i++) {
        service.nextImage();
      }
      expect(service.getCurrentState()?.currentIndex).toBe(1); // 10 % 3 = 1

      // Rapid zoom changes
      for (let i = 0; i < 5; i++) {
        service.setZoom(i + 1);
      }
      expect(service.getCurrentState()?.zoomLevel).toBe(5);

      // Rapid slideshow toggles
      for (let i = 0; i < 3; i++) {
        service.startSlideshow();
        service.stopSlideshow();
      }
      expect(service.getCurrentState()?.slideshowActive).toBe(false);
    });
  });
});