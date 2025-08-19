import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BrowserWindow } from 'electron';
import { ImageEditorService } from '../ImageEditorService';
import { MediaFile, ImageOperation } from '../../../types/global';

// Mock Electron modules
vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  ipcMain: {
    handle: vi.fn(),
  },
  app: {
    isPackaged: true,
  },
}));

vi.mock('../utils/environment', () => ({
  isDev: false,
}));

describe('ImageEditorService', () => {
  let service: ImageEditorService;
  let mockWindow: any;

  const mockFile: MediaFile = {
    path: '/test/image.jpg',
    name: 'image.jpg',
    extension: 'jpg',
    size: 1024000,
    dateModified: new Date(),
    type: 'image',
  };

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock BrowserWindow
    mockWindow = {
      id: 1,
      loadURL: vi.fn().mockResolvedValue(undefined),
      loadFile: vi.fn().mockResolvedValue(undefined),
      show: vi.fn(),
      focus: vi.fn(),
      close: vi.fn(),
      isDestroyed: vi.fn().mockReturnValue(false),
      once: vi.fn((event, callback) => {
        if (event === 'ready-to-show') {
          setTimeout(callback, 0);
        }
      }),
      on: vi.fn(),
      webContents: {
        openDevTools: vi.fn(),
      },
    };

    (BrowserWindow as any).mockImplementation(() => mockWindow);
    (BrowserWindow as any).getFocusedWindow = vi.fn().mockReturnValue(null);

    service = new ImageEditorService();
  });

  afterEach(() => {
    service.closeAllEditors();
  });

  describe('openEditor', () => {
    it('should open a new editor window for a file', async () => {
      const result = await service.openEditor(mockFile);

      expect(result.success).toBe(true);
      expect(result.windowId).toBe(1);
      expect(BrowserWindow).toHaveBeenCalledWith({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        title: 'Image Editor - image.jpg',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          enableRemoteModule: false,
          preload: expect.stringContaining('preload.js'),
        },
        show: false,
        titleBarStyle: 'default',
        parent: undefined,
        modal: false,
      });
    });

    it('should focus existing window if editor is already open for the file', async () => {
      // Open editor first time
      await service.openEditor(mockFile);

      // Try to open again
      const result = await service.openEditor(mockFile);

      expect(result.success).toBe(true);
      expect(result.windowId).toBe(1);
      expect(mockWindow.focus).toHaveBeenCalled();
      expect(BrowserWindow).toHaveBeenCalledTimes(1); // Should not create new window
    });

    it('should create new window if previous window was destroyed', async () => {
      // Open editor first time
      await service.openEditor(mockFile);

      // Mock window as destroyed
      mockWindow.isDestroyed.mockReturnValue(true);

      // Create new mock window for second call
      const mockWindow2 = { ...mockWindow, id: 2 };
      (BrowserWindow as any).mockImplementation(() => mockWindow2);

      // Try to open again
      const result = await service.openEditor(mockFile);

      expect(result.success).toBe(true);
      expect(result.windowId).toBe(2);
      expect(BrowserWindow).toHaveBeenCalledTimes(2);
    });

    it('should handle errors when opening editor', async () => {
      // Mock BrowserWindow constructor to throw error
      (BrowserWindow as any).mockImplementation(() => {
        throw new Error('Failed to create window');
      });

      const result = await service.openEditor(mockFile);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to create window');
    });
  });

  describe('closeEditor', () => {
    it('should close editor window for a file', async () => {
      // Open editor first
      await service.openEditor(mockFile);

      const result = service.closeEditor(mockFile.path);

      expect(result.success).toBe(true);
      expect(mockWindow.close).toHaveBeenCalled();
    });

    it('should handle closing non-existent editor', () => {
      const result = service.closeEditor('/non/existent/file.jpg');

      expect(result.success).toBe(true);
    });

    it('should handle errors when closing editor', async () => {
      // Open editor first
      await service.openEditor(mockFile);

      // Mock close to throw error
      mockWindow.close.mockImplementation(() => {
        throw new Error('Failed to close window');
      });

      const result = service.closeEditor(mockFile.path);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to close window');
    });
  });

  describe('saveEditedImage', () => {
    it('should generate correct output path for edited image', async () => {
      const operations: ImageOperation[] = [
        {
          type: 'brightness',
          value: 50,
          timestamp: new Date(),
        },
      ];

      const result = await service.saveEditedImage(mockFile.path, operations);

      expect(result.success).toBe(true);
      expect(result.outputPath).toBe('/test/image_edited.jpg');
    });

    it('should handle files without extension', async () => {
      const fileWithoutExt = { ...mockFile, path: '/test/image' };
      const operations: ImageOperation[] = [];

      const result = await service.saveEditedImage(fileWithoutExt.path, operations);

      expect(result.success).toBe(true);
      expect(result.outputPath).toBe('/test/image_edited');
    });
  });

  describe('getOpenEditors', () => {
    it('should return list of open editor file paths', async () => {
      const file1 = { ...mockFile, path: '/test/image1.jpg' };
      const file2 = { ...mockFile, path: '/test/image2.jpg' };

      await service.openEditor(file1);
      await service.openEditor(file2);

      const openEditors = service.getOpenEditors();

      expect(openEditors).toHaveLength(2);
      expect(openEditors).toContain('/test/image1.jpg');
      expect(openEditors).toContain('/test/image2.jpg');
    });

    it('should filter out destroyed windows', async () => {
      await service.openEditor(mockFile);

      // Mock window as destroyed
      mockWindow.isDestroyed.mockReturnValue(true);

      const openEditors = service.getOpenEditors();

      expect(openEditors).toHaveLength(0);
    });
  });

  describe('closeAllEditors', () => {
    it('should close all open editor windows', async () => {
      const file1 = { ...mockFile, path: '/test/image1.jpg' };
      const file2 = { ...mockFile, path: '/test/image2.jpg' };

      await service.openEditor(file1);
      await service.openEditor(file2);

      service.closeAllEditors();

      expect(mockWindow.close).toHaveBeenCalledTimes(2);
      expect(service.getOpenEditors()).toHaveLength(0);
    });
  });
});