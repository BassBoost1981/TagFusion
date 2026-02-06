/**
 * Settings Store - Global app settings with localStorage persistence
 * Manages performance mode, language, and theme settings
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import i18n from '../i18n';

type Language = 'de' | 'en';
type Theme = 'light' | 'dark';

interface SettingsState {
  // Performance Mode - reduces backdrop-blur effects for better performance
  performanceMode: boolean;
  // Language setting
  language: Language;
  // Theme setting
  theme: Theme;

  // Actions
  setPerformanceMode: (enabled: boolean) => void;
  togglePerformanceMode: () => void;
  setLanguage: (lang: Language) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const applyTheme = (theme: Theme) => {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light-mode');
  } else {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light-mode');
  }
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Defaults
      performanceMode: false,
      language: 'de',
      theme: 'dark',

      setPerformanceMode: (enabled) => {
        set({ performanceMode: enabled });
        if (enabled) {
          document.documentElement.classList.add('performance-mode');
        } else {
          document.documentElement.classList.remove('performance-mode');
        }
      },

      togglePerformanceMode: () => {
        set((state) => {
          const newMode = !state.performanceMode;
          if (newMode) {
            document.documentElement.classList.add('performance-mode');
          } else {
            document.documentElement.classList.remove('performance-mode');
          }
          return { performanceMode: newMode };
        });
      },

      setLanguage: (lang) => {
        set({ language: lang });
        i18n.changeLanguage(lang);
      },

      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },

      toggleTheme: () => {
        set((state) => {
          const newTheme = state.theme === 'dark' ? 'light' : 'dark';
          applyTheme(newTheme);
          return { theme: newTheme };
        });
      },
    }),
    {
      name: 'tagfusion-settings',
      onRehydrateStorage: () => (state) => {
        if (state?.performanceMode) {
          document.documentElement.classList.add('performance-mode');
        }
        if (state?.theme) {
          applyTheme(state.theme);
        }
        if (state?.language) {
          i18n.changeLanguage(state.language);
        }
      },
    }
  )
);
