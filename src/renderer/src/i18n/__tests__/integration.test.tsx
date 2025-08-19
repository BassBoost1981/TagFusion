import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { LanguageProvider } from '../../components/common/LanguageProvider';
import { LanguageSelector } from '../../components/common/LanguageSelector';
import { useTranslation } from '../../hooks/useTranslation';

// Test component that uses translations
const TestComponent: React.FC = () => {
  const { t } = useTranslation('common');
  
  return (
    <div>
      <h1>{t('settings')}</h1>
      <LanguageSelector />
    </div>
  );
};

describe('i18n Integration', () => {
  test('should render translated content after initialization', async () => {
    render(
      <LanguageProvider>
        <TestComponent />
      </LanguageProvider>
    );

    // Wait for the language provider to initialize
    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    // Check that the language selector is rendered
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  test('should show fallback during initialization', () => {
    // Mock LanguageService to never resolve
    vi.doMock('../../services/LanguageService', () => ({
      LanguageService: {
        waitForReady: () => new Promise(() => {}), // Never resolves
        initializeLanguage: vi.fn(),
      }
    }));

    render(
      <LanguageProvider fallback={<div>Loading translations...</div>}>
        <TestComponent />
      </LanguageProvider>
    );

    expect(screen.getByText('Loading translations...')).toBeInTheDocument();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });
});