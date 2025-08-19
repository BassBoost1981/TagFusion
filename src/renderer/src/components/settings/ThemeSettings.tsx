import React from 'react';
import { useThemeContext } from '../../contexts/ThemeContext';
import { ThemeMode } from '../../services/ThemeService';
import './ThemeSettings.css';

export const ThemeSettings: React.FC = () => {
  const { theme, effectiveTheme, systemTheme, setTheme, isSystemTheme } = useThemeContext();

  const handleThemeChange = (newTheme: ThemeMode) => {
    setTheme(newTheme);
  };

  const themeOptions = [
    {
      value: 'light' as ThemeMode,
      label: 'Light',
      description: 'Always use light theme',
      icon: '☀️'
    },
    {
      value: 'dark' as ThemeMode,
      label: 'Dark',
      description: 'Always use dark theme',
      icon: '🌙'
    },
    {
      value: 'system' as ThemeMode,
      label: 'System',
      description: `Follow system preference (currently ${systemTheme})`,
      icon: '🖥️'
    }
  ];

  return (
    <div className="theme-settings">
      <div className="theme-settings-header">
        <h3>Theme Settings</h3>
        <p className="theme-settings-description">
          Choose your preferred color theme for the application
        </p>
      </div>

      <div className="theme-options">
        {themeOptions.map((option) => (
          <label
            key={option.value}
            htmlFor={`theme-${option.value}`}
            className={`theme-option ${theme === option.value ? 'selected' : ''}`}
            onClick={() => handleThemeChange(option.value)}
          >
            <div className="theme-option-icon">
              {option.icon}
            </div>
            <div className="theme-option-content">
              <div className="theme-option-label">
                {option.label}
                {theme === option.value && (
                  <span className="theme-option-current">Current</span>
                )}
              </div>
              <div className="theme-option-description">
                {option.description}
              </div>
            </div>
            <div className="theme-option-radio">
              <input
                type="radio"
                name="theme"
                value={option.value}
                checked={theme === option.value}
                onChange={() => handleThemeChange(option.value)}
                id={`theme-${option.value}`}
                aria-label={`${option.label} theme`}
              />
            </div>
          </label>
        ))}
      </div>

      <div className="theme-preview">
        <div className="theme-preview-header">
          <h4>Preview</h4>
          <span className="theme-preview-current">
            Currently showing: {effectiveTheme} theme
            {isSystemTheme && ' (from system)'}
          </span>
        </div>
        <div className="theme-preview-content">
          <div className="theme-preview-panel">
            <div className="theme-preview-toolbar">
              <div className="theme-preview-buttons">
                <button className="theme-preview-button">Button</button>
                <button className="theme-preview-button primary">Primary</button>
              </div>
            </div>
            <div className="theme-preview-body">
              <div className="theme-preview-text">
                <h5>Sample Text</h5>
                <p>This is how text will appear in the selected theme.</p>
                <p className="theme-preview-secondary">Secondary text example.</p>
              </div>
              <div className="theme-preview-input">
                <input
                  type="text"
                  placeholder="Sample input field"
                  readOnly
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="theme-settings-info">
        <div className="theme-info-item">
          <strong>System Theme:</strong> {systemTheme}
        </div>
        <div className="theme-info-item">
          <strong>Active Theme:</strong> {effectiveTheme}
        </div>
        <div className="theme-info-item">
          <strong>Theme Source:</strong> {isSystemTheme ? 'System preference' : 'Manual selection'}
        </div>
      </div>
    </div>
  );
};