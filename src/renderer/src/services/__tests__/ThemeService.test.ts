import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThemeService } from '../ThemeService';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

// Mock matchMedia
const matchMediaMock = vi.fn();

// Mock document
const documentMock = {
  documentElement: {
    setAttribute: vi.fn(),
    classList: {
      remove: vi.fn(),
      add: vi.fn(),
    },
  },
};

describe('ThemeService', () => {
  let themeService: ThemeService;
  let mediaQueryMock: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Reset singleton instance
    ThemeService.resetInstance();
    
    // Setup localStorage mock
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });

    // Setup document mock
    Object.defineProperty(global, 'document', {
      value: documentMock,
      writable: true,
    });

    // Setup matchMedia mock
    mediaQueryMock = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    
    matchMediaMock.mockReturnValue(mediaQueryMock);
    Object.defineProperty(window, 'matchMedia', {
      value: matchMediaMock,
      writable: true,
    });

    // Create new instance for each test
    themeService = new ThemeService();
  });

  afterEach(() => {
    // Clean up
    if (themeService) {
      themeService.destroy();
    }
    ThemeService.resetInstance();
  });

  describe('initialization', () => {
    it('should initialize with system theme detection', () => {
      expect(matchMediaMock).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
      expect(mediaQueryMock.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should detect light system theme by default', () => {
      const settings = themeService.getThemeSettings();
      expect(settings.systemTheme).toBe('light');
    });

    it('should detect dark system theme when media query matches', () => {
      mediaQueryMock.matches = true;
      const newService = new ThemeService();
      const settings = newService.getThemeSettings();
      expect(settings.systemTheme).toBe('dark');
      newService.destroy();
    });

    it('should load saved theme from localStorage', () => {
      localStorageMock.getItem.mockReturnValue('dark');
      const newService = new ThemeService();
      expect(newService.getTheme()).toBe('dark');
      newService.destroy();
    });

    it('should default to system theme when no saved preference', () => {
      localStorageMock.getItem.mockReturnValue(null);
      const newService = new ThemeService();
      expect(newService.getTheme()).toBe('system');
      newService.destroy();
    });
  });

  describe('theme management', () => {
    it('should set theme and save to localStorage', () => {
      themeService.setTheme('dark');
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'dark');
      expect(themeService.getTheme()).toBe('dark');
    });

    it('should apply theme to document', () => {
      themeService.setTheme('dark');
      
      expect(documentMock.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
      expect(documentMock.documentElement.classList.remove).toHaveBeenCalledWith('theme-light', 'theme-dark');
      expect(documentMock.documentElement.classList.add).toHaveBeenCalledWith('theme-dark');
    });

    it('should not update if theme is the same', () => {
      themeService.setTheme('system');
      vi.clearAllMocks();
      
      themeService.setTheme('system');
      
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
      expect(documentMock.documentElement.setAttribute).not.toHaveBeenCalled();
    });

    it('should toggle between light and dark themes', () => {
      // Start with light theme
      themeService.setTheme('light');
      
      themeService.toggleTheme();
      expect(themeService.getTheme()).toBe('dark');
      
      themeService.toggleTheme();
      expect(themeService.getTheme()).toBe('light');
    });

    it('should toggle from system theme based on effective theme', () => {
      // System is light, so toggle should go to dark
      mediaQueryMock.matches = false;
      themeService.setTheme('system');
      
      themeService.toggleTheme();
      expect(themeService.getTheme()).toBe('dark');
    });
  });

  describe('effective theme calculation', () => {
    it('should return light for light theme', () => {
      themeService.setTheme('light');
      expect(themeService.getEffectiveThemeMode()).toBe('light');
    });

    it('should return dark for dark theme', () => {
      themeService.setTheme('dark');
      expect(themeService.getEffectiveThemeMode()).toBe('dark');
    });

    it('should return system theme for system mode', () => {
      mediaQueryMock.matches = true; // Dark system theme
      themeService.setTheme('system');
      expect(themeService.getEffectiveThemeMode()).toBe('dark');
      
      mediaQueryMock.matches = false; // Light system theme
      expect(themeService.getEffectiveThemeMode()).toBe('light');
    });
  });

  describe('listeners', () => {
    it('should notify listeners when theme changes', () => {
      const listener = vi.fn();
      const unsubscribe = themeService.addListener(listener);
      
      themeService.setTheme('dark');
      
      expect(listener).toHaveBeenCalledWith({
        mode: 'dark',
        systemTheme: 'light'
      });
      
      unsubscribe();
    });

    it('should notify listeners when system theme changes', () => {
      const listener = vi.fn();
      themeService.addListener(listener);
      themeService.setTheme('system');
      vi.clearAllMocks();
      
      // Simulate system theme change
      const changeHandler = mediaQueryMock.addEventListener.mock.calls[0][1];
      changeHandler({ matches: true });
      
      expect(listener).toHaveBeenCalledWith({
        mode: 'system',
        systemTheme: 'dark'
      });
    });

    it('should handle listener errors gracefully', () => {
      const errorListener = vi.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      themeService.addListener(errorListener);
      themeService.setTheme('dark');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error in theme listener:', expect.any(Error));
      
      consoleErrorSpy.mockRestore();
    });

    it('should remove listeners when unsubscribed', () => {
      const listener = vi.fn();
      const unsubscribe = themeService.addListener(listener);
      
      unsubscribe();
      themeService.setTheme('dark');
      
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle localStorage errors gracefully', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      themeService.setTheme('dark');
      
      expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to save theme to storage:', expect.any(Error));
      
      consoleWarnSpy.mockRestore();
    });

    it('should handle invalid saved theme gracefully', () => {
      localStorageMock.getItem.mockReturnValue('invalid-theme');
      const newService = new ThemeService();
      
      expect(newService.getTheme()).toBe('system');
      newService.destroy();
    });
  });

  describe('cleanup', () => {
    it('should remove event listeners on destroy', () => {
      themeService.destroy();
      
      expect(mediaQueryMock.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should clear all listeners on destroy', () => {
      const listener = vi.fn();
      themeService.addListener(listener);
      
      themeService.destroy();
      themeService.setTheme('dark');
      
      expect(listener).not.toHaveBeenCalled();
    });
  });
});