import { useState, useEffect, useCallback } from 'react';
import { themeService, ThemeMode, ThemeSettings } from '../services/ThemeService';

export interface UseThemeReturn {
  theme: ThemeMode;
  effectiveTheme: 'light' | 'dark';
  systemTheme: 'light' | 'dark';
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  isSystemTheme: boolean;
}

export const useTheme = (): UseThemeReturn => {
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(() => 
    themeService.getThemeSettings()
  );

  useEffect(() => {
    // Subscribe to theme changes
    const unsubscribe = themeService.addListener(setThemeSettings);
    
    // Cleanup subscription on unmount
    return unsubscribe;
  }, []);

  const setTheme = useCallback((theme: ThemeMode) => {
    themeService.setTheme(theme);
  }, []);

  const toggleTheme = useCallback(() => {
    themeService.toggleTheme();
  }, []);

  const effectiveTheme = themeService.getEffectiveThemeMode();
  const isSystemTheme = themeSettings.mode === 'system';

  return {
    theme: themeSettings.mode,
    effectiveTheme,
    systemTheme: themeSettings.systemTheme || 'light',
    setTheme,
    toggleTheme,
    isSystemTheme
  };
};