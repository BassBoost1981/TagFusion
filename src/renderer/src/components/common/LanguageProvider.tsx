import React, { ReactNode, Suspense } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';

interface LanguageProviderProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({
  children,
  fallback = <div className="loading">Loading translations...</div>,
}) => {
  return (
    <I18nextProvider i18n={i18n}>
      <Suspense fallback={fallback}>
        {children}
      </Suspense>
    </I18nextProvider>
  );
};