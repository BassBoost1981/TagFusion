export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeSettings {
  mode: ThemeMode;
  systemTheme?: 'light' | 'dark';
}

export class ThemeService {
  private static instance: ThemeService;
  private currentTheme: ThemeMode = 'system';
  private systemTheme: 'light' | 'dark' = 'light';
  private mediaQuery: MediaQueryList;
  private listeners: Set<(theme: ThemeSettings) => void> = new Set();

  constructor() {
    // Initialize system theme detection
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.systemTheme = this.mediaQuery.matches ? 'dark' : 'light';
    
    // Listen for system theme changes
    this.mediaQuery.addEventListener('change', this.handleSystemThemeChange);
    
    // Load saved theme preference
    this.loadThemeFromStorage();
    
    // Apply initial theme
    this.applyTheme();
  }

  public static getInstance(): ThemeService {
    if (!ThemeService.instance) {
      ThemeService.instance = new ThemeService();
    }
    return ThemeService.instance;
  }

  public static resetInstance(): void {
    if (ThemeService.instance) {
      ThemeService.instance.destroy();
      ThemeService.instance = null as any;
    }
  }

  private handleSystemThemeChange = (e: MediaQueryListEvent) => {
    this.systemTheme = e.matches ? 'dark' : 'light';
    
    // If using system theme, update the applied theme
    if (this.currentTheme === 'system') {
      this.applyTheme();
    }
    
    this.notifyListeners();
  };

  private loadThemeFromStorage(): void {
    try {
      const savedTheme = localStorage.getItem('theme') as ThemeMode;
      if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
        this.currentTheme = savedTheme;
      }
    } catch (error) {
      console.warn('Failed to load theme from storage:', error);
    }
  }

  private saveThemeToStorage(): void {
    try {
      localStorage.setItem('theme', this.currentTheme);
    } catch (error) {
      console.warn('Failed to save theme to storage:', error);
    }
  }

  private applyTheme(): void {
    const effectiveTheme = this.getEffectiveTheme();
    document.documentElement.setAttribute('data-theme', effectiveTheme);
    
    // Also set a class for additional styling if needed
    document.documentElement.classList.remove('theme-light', 'theme-dark');
    document.documentElement.classList.add(`theme-${effectiveTheme}`);
  }

  private getEffectiveTheme(): 'light' | 'dark' {
    if (this.currentTheme === 'system') {
      return this.systemTheme;
    }
    return this.currentTheme;
  }

  private notifyListeners(): void {
    const settings: ThemeSettings = {
      mode: this.currentTheme,
      systemTheme: this.systemTheme
    };
    
    this.listeners.forEach(listener => {
      try {
        listener(settings);
      } catch (error) {
        console.error('Error in theme listener:', error);
      }
    });
  }

  public setTheme(theme: ThemeMode): void {
    if (this.currentTheme === theme) {
      return;
    }
    
    this.currentTheme = theme;
    this.saveThemeToStorage();
    this.applyTheme();
    this.notifyListeners();
  }

  public getTheme(): ThemeMode {
    return this.currentTheme;
  }

  public getEffectiveThemeMode(): 'light' | 'dark' {
    return this.getEffectiveTheme();
  }

  public getSystemTheme(): 'light' | 'dark' {
    return this.systemTheme;
  }

  public getThemeSettings(): ThemeSettings {
    return {
      mode: this.currentTheme,
      systemTheme: this.systemTheme
    };
  }

  public toggleTheme(): void {
    const currentEffective = this.getEffectiveTheme();
    const newTheme = currentEffective === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }

  public addListener(listener: (theme: ThemeSettings) => void): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  public destroy(): void {
    this.mediaQuery.removeEventListener('change', this.handleSystemThemeChange);
    this.listeners.clear();
  }
}

// Export singleton instance
export const themeService = ThemeService.getInstance();