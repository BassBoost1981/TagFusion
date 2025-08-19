import i18n from '../i18n';

export interface LanguageInfo {
  code: string;
  name: string;
  nativeName: string;
}

export class LanguageService {
  private static readonly SUPPORTED_LANGUAGES: LanguageInfo[] = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'de', name: 'German', nativeName: 'Deutsch' }
  ];

  private static readonly STORAGE_KEY = 'preferred-language';

  /**
   * Get all supported languages
   */
  static getSupportedLanguages(): LanguageInfo[] {
    return [...this.SUPPORTED_LANGUAGES];
  }

  /**
   * Check if a language code is supported
   */
  static isLanguageSupported(languageCode: string): boolean {
    return this.SUPPORTED_LANGUAGES.some(lang => lang.code === languageCode);
  }

  /**
   * Get language info by code
   */
  static getLanguageInfo(languageCode: string): LanguageInfo | undefined {
    return this.SUPPORTED_LANGUAGES.find(lang => lang.code === languageCode);
  }

  /**
   * Detect the best language to use based on system settings and user preferences
   */
  static detectBestLanguage(): string {
    // 1. Check if user has a saved preference
    const savedLanguage = this.getSavedLanguage();
    if (savedLanguage && this.isLanguageSupported(savedLanguage)) {
      return savedLanguage;
    }

    // 2. Check system/browser language
    const systemLanguage = this.getSystemLanguage();
    if (systemLanguage && this.isLanguageSupported(systemLanguage)) {
      return systemLanguage;
    }

    // 3. Try to find a supported language that matches the system language family
    const languageFamily = systemLanguage?.split('-')[0];
    if (languageFamily && this.isLanguageSupported(languageFamily)) {
      return languageFamily;
    }

    // 4. Fallback to English
    return 'en';
  }

  /**
   * Get the system/browser language
   */
  private static getSystemLanguage(): string | null {
    if (typeof navigator !== 'undefined') {
      // Browser environment
      return navigator.language || (navigator as any).userLanguage;
    }
    
    // Electron main process environment
    if (typeof process !== 'undefined' && process.env) {
      return process.env.LANG || process.env.LANGUAGE || process.env.LC_ALL || process.env.LC_MESSAGES;
    }

    return null;
  }

  /**
   * Get saved language preference from localStorage
   */
  private static getSavedLanguage(): string | null {
    try {
      return localStorage.getItem(this.STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to read language preference from localStorage:', error);
      return null;
    }
  }

  /**
   * Save language preference to localStorage
   */
  static saveLanguagePreference(languageCode: string): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, languageCode);
    } catch (error) {
      console.warn('Failed to save language preference to localStorage:', error);
    }
  }

  /**
   * Change the current language
   */
  static async changeLanguage(languageCode: string): Promise<void> {
    if (!this.isLanguageSupported(languageCode)) {
      console.warn(`Language '${languageCode}' is not supported. Falling back to English.`);
      languageCode = 'en';
    }

    try {
      await i18n.changeLanguage(languageCode);
      this.saveLanguagePreference(languageCode);
    } catch (error) {
      console.error('Failed to change language:', error);
      // Fallback to English if language change fails
      if (languageCode !== 'en') {
        await i18n.changeLanguage('en');
      }
    }
  }

  /**
   * Initialize language detection and set the best language
   */
  static async initializeLanguage(): Promise<void> {
    const bestLanguage = this.detectBestLanguage();
    await this.changeLanguage(bestLanguage);
  }

  /**
   * Get current language code
   */
  static getCurrentLanguage(): string {
    return i18n.language || 'en';
  }

  /**
   * Get current language info
   */
  static getCurrentLanguageInfo(): LanguageInfo {
    const currentLang = this.getCurrentLanguage();
    return this.getLanguageInfo(currentLang) || this.SUPPORTED_LANGUAGES[0];
  }

  /**
   * Check if i18n is ready
   */
  static isReady(): boolean {
    return i18n.isInitialized;
  }

  /**
   * Wait for i18n to be ready
   */
  static async waitForReady(): Promise<void> {
    if (this.isReady()) {
      return;
    }

    return new Promise((resolve) => {
      const checkReady = () => {
        if (this.isReady()) {
          resolve();
        } else {
          setTimeout(checkReady, 10);
        }
      };
      checkReady();
    });
  }
}