import React from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { LanguageService } from '../../services/LanguageService';
import './LanguageSelector.css';

interface LanguageSelectorProps {
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ className }) => {
  const { t, currentLanguage } = useTranslation('settings');
  const supportedLanguages = LanguageService.getSupportedLanguages();

  const handleLanguageChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = event.target.value;
    await LanguageService.changeLanguage(newLanguage);
  };

  return (
    <div className={`language-selector ${className || ''}`}>
      <label htmlFor="language-select" className="language-selector__label">
        {t('language')}
      </label>
      <select
        id="language-select"
        className="language-selector__select"
        value={currentLanguage}
        onChange={handleLanguageChange}
      >
        {supportedLanguages.map((language) => (
          <option key={language.code} value={language.code}>
            {language.nativeName}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSelector;