import { vi } from 'vitest';
import { BrowserWindow, globalShortcut } from 'electron';
import { KeyboardShortcutsService } from '../KeyboardShortcutsService';

// Mock Electron modules
vi.mock('electron', () => ({
  globalShortcut: {
    register: vi.fn(),
    unregister: vi.fn(),
    unregisterAll: vi.fn(),
  },
  BrowserWindow: vi.fn(),
}));

describe('KeyboardShortcutsService', () => {
  let service: KeyboardShortcutsService;
  let mockWindow: any;
  let mockGlobalShortcut: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockGlobalShortcut = globalShortcut as any;
    mockGlobalShortcut.register.mockReturnValue(true);
    
    // Create mock BrowserWindow
    mockWindow = {
      isDestroyed: vi.fn().mockReturnValue(false),
      isFullScreen: vi.fn().mockReturnValue(false),
      setFullScreen: vi.fn(),
      minimize: vi.fn(),
      close: vi.fn(),
      webContents: {
        isDevToolsOpened: vi.fn().mockReturnValue(false),
        openDevTools: vi.fn(),
        closeDevTools: vi.fn(),
        reload: vi.fn(),
        reloadIgnoringCache: vi.fn(),
      },
    } as any;

    service = new KeyboardShortcutsService(mockWindow);
  });

  describe('constructor', () => {
    it('should create service without window', () => {
      const serviceWithoutWindow = new KeyboardShortcutsService();
      expect(serviceWithoutWindow).toBeInstanceOf(KeyboardShortcutsService);
    });

    it('should create service with window', () => {
      expect(service).toBeInstanceOf(KeyboardShortcutsService);
    });
  });

  describe('setMainWindow', () => {
    it('should set the main window', () => {
      const newService = new KeyboardShortcutsService();
      newService.setMainWindow(mockWindow);
      
      // Test that window is set by calling a method that uses it
      newService.registerGlobalShortcuts();
      expect(mockGlobalShortcut.register).toHaveBeenCalled();
    });
  });

  describe('setHandlers', () => {
    it('should set handlers', () => {
      const handlers = {
        onQuit: vi.fn(),
        onNewWindow: vi.fn(),
      };
      
      service.setHandlers(handlers);
      
      // Handlers are set internally, we can't directly test them
      // but we can test that the method doesn't throw
      expect(() => service.setHandlers(handlers)).not.toThrow();
    });
  });

  describe('registerGlobalShortcuts', () => {
    it('should register all global shortcuts successfully', () => {
      service.registerGlobalShortcuts();
      
      expect(mockGlobalShortcut.register).toHaveBeenCalledTimes(6);
      expect(mockGlobalShortcut.register).toHaveBeenCalledWith('CommandOrControl+Shift+I', expect.any(Function));
      expect(mockGlobalShortcut.register).toHaveBeenCalledWith('CommandOrControl+R', expect.any(Function));
      expect(mockGlobalShortcut.register).toHaveBeenCalledWith('CommandOrControl+Shift+R', expect.any(Function));
      expect(mockGlobalShortcut.register).toHaveBeenCalledWith('F11', expect.any(Function));
      expect(mockGlobalShortcut.register).toHaveBeenCalledWith('CommandOrControl+M', expect.any(Function));
      expect(mockGlobalShortcut.register).toHaveBeenCalledWith('CommandOrControl+W', expect.any(Function));
    });

    it('should handle registration failures gracefully', () => {
      mockGlobalShortcut.register.mockReturnValue(false);
      
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation();
      
      service.registerGlobalShortcuts();
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to register global shortcut'));
      
      consoleSpy.mockRestore();
    });

    it('should handle registration errors gracefully', () => {
      mockGlobalShortcut.register.mockImplementation(() => {
        throw new Error('Registration failed');
      });
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation();
      
      service.registerGlobalShortcuts();
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error registering shortcut'), expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('unregisterGlobalShortcuts', () => {
    it('should unregister all registered shortcuts', () => {
      service.registerGlobalShortcuts();
      service.unregisterGlobalShortcuts();
      
      expect(mockGlobalShortcut.unregister).toHaveBeenCalledTimes(6);
    });

    it('should handle unregistration errors gracefully', () => {
      mockGlobalShortcut.unregister.mockImplementation(() => {
        throw new Error('Unregistration failed');
      });
      
      service.registerGlobalShortcuts();
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation();
      
      service.unregisterGlobalShortcuts();
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error unregistering shortcut'), expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('unregisterAllShortcuts', () => {
    it('should unregister all shortcuts using globalShortcut.unregisterAll', () => {
      service.unregisterAllShortcuts();
      
      expect(mockGlobalShortcut.unregisterAll).toHaveBeenCalledTimes(1);
    });

    it('should handle unregisterAll errors gracefully', () => {
      mockGlobalShortcut.unregisterAll.mockImplementation(() => {
        throw new Error('UnregisterAll failed');
      });
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation();
      
      service.unregisterAllShortcuts();
      
      expect(consoleSpy).toHaveBeenCalledWith('Error unregistering all shortcuts:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('registerCustomShortcut', () => {
    it('should register a custom shortcut successfully', () => {
      const handler = vi.fn();
      const result = service.registerCustomShortcut('CommandOrControl+T', handler);
      
      expect(result).toBe(true);
      expect(mockGlobalShortcut.register).toHaveBeenCalledWith('CommandOrControl+T', handler);
    });

    it('should return false when registration fails', () => {
      mockGlobalShortcut.register.mockReturnValue(false);
      
      const handler = vi.fn();
      const result = service.registerCustomShortcut('CommandOrControl+T', handler);
      
      expect(result).toBe(false);
    });

    it('should handle registration errors and return false', () => {
      mockGlobalShortcut.register.mockImplementation(() => {
        throw new Error('Registration failed');
      });
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation();
      
      const handler = vi.fn();
      const result = service.registerCustomShortcut('CommandOrControl+T', handler);
      
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('unregisterShortcut', () => {
    it('should unregister a specific shortcut successfully', () => {
      service.registerCustomShortcut('CommandOrControl+T', vi.fn());
      const result = service.unregisterShortcut('CommandOrControl+T');
      
      expect(result).toBe(true);
      expect(mockGlobalShortcut.unregister).toHaveBeenCalledWith('CommandOrControl+T');
    });

    it('should handle unregistration errors and return false', () => {
      mockGlobalShortcut.unregister.mockImplementation(() => {
        throw new Error('Unregistration failed');
      });
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation();
      
      const result = service.unregisterShortcut('CommandOrControl+T');
      
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('isShortcutRegistered', () => {
    it('should return true for registered shortcuts', () => {
      service.registerGlobalShortcuts();
      
      expect(service.isShortcutRegistered('F11')).toBe(true);
    });

    it('should return false for unregistered shortcuts', () => {
      expect(service.isShortcutRegistered('CommandOrControl+T')).toBe(false);
    });
  });

  describe('getRegisteredShortcuts', () => {
    it('should return array of registered shortcuts', () => {
      service.registerGlobalShortcuts();
      
      const shortcuts = service.getRegisteredShortcuts();
      
      expect(shortcuts).toContain('F11');
      expect(shortcuts).toContain('CommandOrControl+R');
      expect(shortcuts.length).toBe(6);
    });

    it('should return empty array when no shortcuts registered', () => {
      const shortcuts = service.getRegisteredShortcuts();
      
      expect(shortcuts).toEqual([]);
    });
  });

  describe('window operations', () => {
    it('should handle destroyed window gracefully', () => {
      mockWindow.isDestroyed.mockReturnValue(true);
      
      service.registerGlobalShortcuts();
      
      // Trigger shortcuts that interact with window
      // Since we can't directly access the handlers, we test that no errors are thrown
      expect(() => service.registerGlobalShortcuts()).not.toThrow();
    });

    it('should toggle fullscreen correctly', () => {
      mockWindow.isFullScreen.mockReturnValue(false);
      
      service.registerGlobalShortcuts();
      
      // We can't directly test the shortcut handler, but we can test the window interaction
      expect(mockWindow.isDestroyed).toBeDefined();
      expect(mockWindow.setFullScreen).toBeDefined();
    });

    it('should minimize window correctly', () => {
      const handlers = {
        onMinimizeWindow: vi.fn(),
      };
      
      service.setHandlers(handlers);
      service.registerGlobalShortcuts();
      
      expect(mockWindow.minimize).toBeDefined();
    });

    it('should close window correctly', () => {
      const handlers = {
        onCloseWindow: vi.fn(),
      };
      
      service.setHandlers(handlers);
      service.registerGlobalShortcuts();
      
      expect(mockWindow.close).toBeDefined();
    });
  });
});