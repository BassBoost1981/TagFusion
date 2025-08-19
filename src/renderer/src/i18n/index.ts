import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import language resources
import enTranslations from './locales/en.json';
import deTranslations from './locales/de.json';

const resources = {
  en: {
    common: enTranslations.common,
    navigation: enTranslations.navigation,
    toolbar: enTranslations.toolbar,
    content: enTranslations.content,
    properties: enTranslations.properties,
    tags: enTranslations.tags,
    editor: enTranslations.editor,
    viewer: enTranslations.viewer,
    export: enTranslations.export,
    settings: enTranslations.settings,
    dialogs: enTranslations.dialogs
  },
  de: {
    common: deTranslations.common,
    navigation: deTranslations.navigation,
    toolbar: deTranslations.toolbar,
    content: deTranslations.content,
    properties: deTranslations.properties,
    tags: deTranslations.tags,
    editor: deTranslations.editor,
    viewer: deTranslations.viewer,
    export: deTranslations.export,
    settings: deTranslations.settings,
    dialogs: deTranslations.dialogs
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: process.env.NODE_ENV === 'development',
    
    // Namespace separation
    defaultNS: 'common',
    ns: ['common', 'navigation', 'toolbar', 'content', 'properties', 'tags', 'editor', 'viewer', 'export', 'settings', 'dialogs'],
    
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    
    detection: {
      // Order of language detection methods
      order: ['localStorage', 'navigator', 'htmlTag', 'path', 'subdomain'],
      
      // Cache user language
      caches: ['localStorage'],
      
      // localStorage key
      lookupLocalStorage: 'preferred-language',
      
      // Optional: exclude certain languages
      excludeCacheFor: ['cimode'],
      
      // Check only supported languages
      checkWhitelist: true,
    },
    
    // Only allow supported languages
    supportedLngs: ['en', 'de'],
    nonExplicitSupportedLngs: true,
    
    // React-specific options
    react: {
      useSuspense: false, // Disable suspense for better error handling
    }
  });

export default i18n;