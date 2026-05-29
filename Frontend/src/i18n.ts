import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// src/locales is the SINGLE source of truth for translations. They are bundled
// into JS by Vite (no runtime fetch / i18next-http-backend), so do NOT reintroduce
// public/locales or wwwroot/locales copies — they would never be read at runtime.
// src/locales ist die EINZIGE Quelle der Wahrheit für Übersetzungen (gebundlet, kein Laufzeit-Fetch).
//
// The default locale (de) is bundled statically so the app paints immediately
// without any async hop. Other locales are imported on demand when the user
// switches language — Vite splits them into separate chunks (locale-en, ...).
// Standardsprache (de) ist statisch gebundlet damit der App-Start nicht blockiert.
import deCommon from './locales/de/common.json';

type LocaleResource = Record<string, unknown>;
const lazyLocaleLoaders: Record<string, () => Promise<LocaleResource>> = {
  en: () => import('./locales/en/common.json').then((m) => (m.default ?? m) as LocaleResource),
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      de: { common: deCommon as unknown as LocaleResource },
    },
    fallbackLng: 'de',
    defaultNS: 'common',
    ns: ['common'],

    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'tagfusion-language',
    },

    interpolation: {
      escapeValue: false,
    },

    react: {
      useSuspense: false,
    },
  });

// Lazy-load any non-default locale on demand. Calling i18n.changeLanguage is
// safe because addResourceBundle finishes before the language change resolves.
i18n.on('languageChanged', (lng) => {
  if (lng === 'de' || i18n.hasResourceBundle(lng, 'common')) return;
  const loader = lazyLocaleLoaders[lng];
  if (!loader) return;
  loader()
    .then((resources) => {
      i18n.addResourceBundle(lng, 'common', resources, true, true);
      // Force a refresh so React subtree picks up the new bundle.
      void i18n.changeLanguage(lng);
    })
    .catch((err) => {
      console.warn(`[i18n] Failed to load locale ${lng}:`, err);
    });
});

export default i18n;
