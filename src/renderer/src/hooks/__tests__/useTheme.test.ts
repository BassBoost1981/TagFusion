import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '../useTheme';
import { themeService } from '../../services/ThemeService';

// Mock the ThemeService
vi.mock('../../services/ThemeService', () => ({
  themeService: {
    getThemeSettings: vi.fn(),
    addListener: vi.fn(),
    setTheme: vi.fn(),
    toggleTheme: vi.fn(),
    getEffectiveThemeMode: vi.fn(),
  },
}));

const mockThemeService = themeService as any;

describe('useTheme', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    mockThemeService.getThemeSettings.mockReturnValue({
      mode: 'system',
      systemTheme: 'light',
    });
    mockThemeService.getEffectiveThemeMode.mockReturnValue('light');
    mockThemeService.addListener.mockReturnValue(() => {}); // unsubscribe function
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return initial theme settings', () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('system');
    expect(result.current.effectiveTheme).toBe('light');
    expect(result.current.systemTheme).toBe('light');
    expect(result.current.isSystemTheme).toBe(true);
  });

  it('should subscribe to theme changes on mount', () => {
    renderHook(() => useTheme());

    expect(mockThemeService.addListener).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should unsubscribe from theme changes on unmount', () => {
    const unsubscribeMock = vi.fn();
    mockThemeService.addListener.mockReturnValue(unsubscribeMock);

    const { unmount } = renderHook(() => useTheme());
    unmount();

    expect(unsubscribeMock).toHaveBeenCalled();
  });

  it('should update state when theme service notifies changes', () => {
    let themeListener: (settings: any) => void;
    mockThemeService.addListener.mockImplementation((listener) => {
      themeListener = listener;
      return () => {};
    });

    const { result } = renderHook(() => useTheme());

    // Initial state
    expect(result.current.theme).toBe('system');

    // Simulate theme change
    act(() => {
      themeListener({
        mode: 'dark',
        systemTheme: 'dark',
      });
    });

    expect(result.current.theme).toBe('dark');
    expect(result.current.systemTheme).toBe('dark');
  });

  it('should call themeService.setTheme when setTheme is called', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('dark');
    });

    expect(mockThemeService.setTheme).toHaveBeenCalledWith('dark');
  });

  it('should call themeService.toggleTheme when toggleTheme is called', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.toggleTheme();
    });

    expect(mockThemeService.toggleTheme).toHaveBeenCalled();
  });

  it('should correctly identify system theme mode', () => {
    mockThemeService.getThemeSettings.mockReturnValue({
      mode: 'system',
      systemTheme: 'dark',
    });

    const { result } = renderHook(() => useTheme());

    expect(result.current.isSystemTheme).toBe(true);
  });

  it('should correctly identify manual theme mode', () => {
    mockThemeService.getThemeSettings.mockReturnValue({
      mode: 'dark',
      systemTheme: 'light',
    });

    const { result } = renderHook(() => useTheme());

    expect(result.current.isSystemTheme).toBe(false);
  });

  it('should handle missing systemTheme gracefully', () => {
    mockThemeService.getThemeSettings.mockReturnValue({
      mode: 'light',
      // systemTheme is undefined
    });

    const { result } = renderHook(() => useTheme());

    expect(result.current.systemTheme).toBe('light'); // fallback to 'light'
  });

  it('should update effectiveTheme when service returns different value', () => {
    mockThemeService.getEffectiveThemeMode.mockReturnValue('dark');

    const { result } = renderHook(() => useTheme());

    expect(result.current.effectiveTheme).toBe('dark');
  });

  it('should maintain stable function references', () => {
    const { result, rerender } = renderHook(() => useTheme());

    const initialSetTheme = result.current.setTheme;
    const initialToggleTheme = result.current.toggleTheme;

    rerender();

    expect(result.current.setTheme).toBe(initialSetTheme);
    expect(result.current.toggleTheme).toBe(initialToggleTheme);
  });

  describe('theme transitions', () => {
    it('should handle light to dark transition', () => {
      let themeListener: (settings: any) => void;
      mockThemeService.addListener.mockImplementation((listener) => {
        themeListener = listener;
        return () => {};
      });

      mockThemeService.getThemeSettings.mockReturnValue({
        mode: 'light',
        systemTheme: 'light',
      });
      mockThemeService.getEffectiveThemeMode.mockReturnValue('light');

      const { result } = renderHook(() => useTheme());

      expect(result.current.theme).toBe('light');
      expect(result.current.effectiveTheme).toBe('light');

      // Simulate theme change to dark
      mockThemeService.getEffectiveThemeMode.mockReturnValue('dark');
      act(() => {
        themeListener({
          mode: 'dark',
          systemTheme: 'light',
        });
      });

      expect(result.current.theme).toBe('dark');
      expect(result.current.effectiveTheme).toBe('dark');
    });

    it('should handle system theme changes', () => {
      let themeListener: (settings: any) => void;
      mockThemeService.addListener.mockImplementation((listener) => {
        themeListener = listener;
        return () => {};
      });

      mockThemeService.getThemeSettings.mockReturnValue({
        mode: 'system',
        systemTheme: 'light',
      });
      mockThemeService.getEffectiveThemeMode.mockReturnValue('light');

      const { result } = renderHook(() => useTheme());

      expect(result.current.systemTheme).toBe('light');
      expect(result.current.effectiveTheme).toBe('light');

      // Simulate system theme change
      mockThemeService.getEffectiveThemeMode.mockReturnValue('dark');
      act(() => {
        themeListener({
          mode: 'system',
          systemTheme: 'dark',
        });
      });

      expect(result.current.systemTheme).toBe('dark');
      expect(result.current.effectiveTheme).toBe('dark');
    });
  });
});