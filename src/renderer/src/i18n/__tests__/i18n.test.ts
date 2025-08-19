import i18n from '../index';

describe('i18n Configuration', () => {
  beforeAll(async () => {
    // Wait for i18n to initialize
    await i18n.init();
  });

  test('should initialize with correct default language', () => {
    expect(i18n.isInitialized).toBe(true);
    expect(i18n.language).toBeDefined();
  });

  test('should have English as fallback language', () => {
    expect(i18n.options.fallbackLng).toEqual(['en']);
  });

  test('should support German and English languages', () => {
    const supportedLanguages = Object.keys(i18n.options.resources || {});
    expect(supportedLanguages).toContain('en');
    expect(supportedLanguages).toContain('de');
  });

  test('should have all required namespaces', () => {
    const expectedNamespaces = [
      'common', 'navigation', 'toolbar', 'content', 
      'properties', 'tags', 'editor', 'viewer', 
      'export', 'settings', 'dialogs'
    ];
    
    expectedNamespaces.forEach(ns => {
      expect(i18n.options.ns).toContain(ns);
    });
  });

  test('should translate common keys correctly in English', () => {
    i18n.changeLanguage('en');
    expect(i18n.t('common:ok')).toBe('OK');
    expect(i18n.t('common:cancel')).toBe('Cancel');
    expect(i18n.t('common:save')).toBe('Save');
  });

  test('should translate common keys correctly in German', () => {
    i18n.changeLanguage('de');
    expect(i18n.t('common:ok')).toBe('OK');
    expect(i18n.t('common:cancel')).toBe('Abbrechen');
    expect(i18n.t('common:save')).toBe('Speichern');
  });

  test('should handle pluralization correctly', () => {
    i18n.changeLanguage('en');
    expect(i18n.t('content:selectedItems', { count: 1 })).toBe('1 item selected');
    expect(i18n.t('content:selectedItems', { count: 5 })).toBe('5 items selected');
  });

  test('should handle interpolation correctly', () => {
    i18n.changeLanguage('en');
    expect(i18n.t('export:exporting', { current: 3, total: 10 })).toBe('Exporting 3 of 10...');
  });

  test('should fallback to English for missing translations', () => {
    i18n.changeLanguage('de');
    // Test with a key that might not exist in German
    const result = i18n.t('nonexistent:key', { fallbackLng: 'en' });
    expect(result).toBeDefined();
  });

  test('should change language dynamically', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.language).toBe('en');
    
    await i18n.changeLanguage('de');
    expect(i18n.language).toBe('de');
  });
});