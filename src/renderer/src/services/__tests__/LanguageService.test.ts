import { vi, beforeEach, afterEach } from 'vitest';
import { LanguageService } from '../LanguageService';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

// Mock navigator
const navigatorMock = {
  language: 'en-US',
};

// Mock i18n
vi.mock('../../i18n', () => ({
  default: {
    changeLanguage: vi.fn().mockResolvedValue(undefined),
    language: 'en',
    isInitialized: true,
  }
}));

describe('LanguageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup global mocks
    Object.defineProperty(global, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
    
    Object.defineProperty(global, 'navigator', {
      value: navigatorMock,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getSupportedLanguages', () => {
    test('should return array of supported languages', () => {
      const languages = LanguageService.getSupportedLanguages();
      
      expect(languages).toHaveLength(2);
      expect(languages).toEqual([
        { code: 'en', name: 'English', nativeName: 'English' },
        { code: 'de', name: 'German', nativeName: 'Deutsch' }
      ]);
    });
  });

  describe('isLanguageSupported', () => {
    test('should return true for supported languages', () => {
      expect(LanguageService.isLanguageSupported('en')).toBe(true);
      expect(LanguageService.isLanguageSupported('de')).toBe(true);
    });

    test('should return false for unsupported languages', () => {
      expect(LanguageService.isLanguageSupported('fr')).toBe(false);
      expect(LanguageService.isLanguageSupported('es')).toBe(false);
      expect(LanguageService.isLanguageSupported('')).toBe(false);
    });
  });

  describe('getLanguageInfo', () => {
    test('should return language info for supported languages', () => {
      const englishInfo = LanguageService.getLanguageInfo('en');
      expect(englishInfo).toEqual({ code: 'en', name: 'English', nativeName: 'English' });

      const germanInfo = LanguageService.getLanguageInfo('de');
      expect(germanInfo).toEqual({ code: 'de', name: 'German', nativeName: 'Deutsch' });
    });

    test('should return undefined for unsupported languages', () => {
      expect(LanguageService.getLanguageInfo('fr')).toBeUndefined();
    });
  });

  describe('detectBestLanguage', () => {
    test('should return saved language if supported', () => {
      localStorageMock.getItem.mockReturnValue('de');
      
      const bestLanguage = LanguageService.detectBestLanguage();
      expect(bestLanguage).toBe('de');
      expect(localStorageMock.getItem).toHaveBeenCalledWith('preferred-language');
    });

    test('should return system language if no saved preference', () => {
      localStorageMock.getItem.mockReturnValue(null);
      navigatorMock.language = 'de-DE';
      
      const bestLanguage = LanguageService.detectBestLanguage();
      expect(bestLanguage).toBe('de');
    });

    test('should return language family if exact match not supported', () => {
      localStorageMock.getItem.mockReturnValue(null);
      navigatorMock.language = 'de-AT';
      
      const bestLanguage = LanguageService.detectBestLanguage();
      expect(bestLanguage).toBe('de');
    });

    test('should fallback to English if no matches', () => {
      localStorageMock.getItem.mockReturnValue(null);
      navigatorMock.language = 'fr-FR';
      
      const bestLanguage = LanguageService.detectBestLanguage();
      expect(bestLanguage).toBe('en');
    });

    test('should fallback to English if saved language is unsupported', () => {
      localStorageMock.getItem.mockReturnValue('fr');
      
      const bestLanguage = LanguageService.detectBestLanguage();
      expect(bestLanguage).toBe('en');
    });
  });

  describe('saveLanguagePreference', () => {
    test('should save language to localStorage', () => {
      LanguageService.saveLanguagePreference('de');
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith('preferred-language', 'de');
    });

    test('should handle localStorage errors gracefully', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });
      
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      expect(() => LanguageService.saveLanguagePreference('de')).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to save language preference to localStorage:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('changeLanguage', () => {
    test('should change to supported language', async () => {
      const i18n = await import('../../i18n');
      
      await LanguageService.changeLanguage('de');
      
      expect(i18n.default.changeLanguage).toHaveBeenCalledWith('de');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('preferred-language', 'de');
    });

    test('should fallback to English for unsupported language', async () => {
      const i18n = await import('../../i18n');
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      await LanguageService.changeLanguage('fr');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        "Language 'fr' is not supported. Falling back to English."
      );
      expect(i18n.default.changeLanguage).toHaveBeenCalledWith('en');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('preferred-language', 'en');
      
      consoleSpy.mockRestore();
    });
  });

  describe('getCurrentLanguageInfo', () => {
    test('should return current language info', () => {
      const info = LanguageService.getCurrentLanguageInfo();
      
      expect(info).toEqual({ code: 'en', name: 'English', nativeName: 'English' });
    });
  });
});