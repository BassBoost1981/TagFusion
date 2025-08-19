import { useTranslation as useI18nTranslation } from 'react-i18next';

// Custom hook that provides typed translation function
export const useTranslation = (namespace?: string) => {
  const { t, i18n } = useI18nTranslation(namespace);
  
  return {
    t,
    i18n,
    changeLanguage: i18n.changeLanguage,
    currentLanguage: i18n.language,
    isLoading: !i18n.isInitialized
  };
};

// Helper hook for specific namespaces
export const useCommonTranslation = () => useTranslation('common');
export const useNavigationTranslation = () => useTranslation('navigation');
export const useToolbarTranslation = () => useTranslation('toolbar');
export const useContentTranslation = () => useTranslation('content');
export const usePropertiesTranslation = () => useTranslation('properties');
export const useTagsTranslation = () => useTranslation('tags');
export const useEditorTranslation = () => useTranslation('editor');
export const useViewerTranslation = () => useTranslation('viewer');
export const useExportTranslation = () => useTranslation('export');
export const useSettingsTranslation = () => useTranslation('settings');
export const useDialogsTranslation = () => useTranslation('dialogs');