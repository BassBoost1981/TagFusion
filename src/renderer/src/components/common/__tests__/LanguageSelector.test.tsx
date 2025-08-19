import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import LanguageSelector from '../LanguageSelector';

// Mock the useTranslation hook
const mockChangeLanguage = vi.fn();
const mockT = vi.fn((key: string) => key);

vi.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: mockT,
    changeLanguage: mockChangeLanguage,
    currentLanguage: 'en'
  })
}));

describe('LanguageSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders language selector with label', () => {
    render(<LanguageSelector />);
    
    expect(screen.getByLabelText('language')).toBeInTheDocument();
    expect(mockT).toHaveBeenCalledWith('language');
  });

  test('displays supported languages', () => {
    render(<LanguageSelector />);
    
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    
    // Check if English and German options are present
    expect(screen.getByDisplayValue('English')).toBeInTheDocument();
    expect(screen.getByText('Deutsch')).toBeInTheDocument();
  });

  test('shows current language as selected', () => {
    render(<LanguageSelector />);
    
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('en');
  });

  test('calls changeLanguage when selection changes', () => {
    render(<LanguageSelector />);
    
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'de' } });
    
    expect(mockChangeLanguage).toHaveBeenCalledWith('de');
  });

  test('applies custom className', () => {
    const customClass = 'custom-language-selector';
    render(<LanguageSelector className={customClass} />);
    
    const container = screen.getByRole('combobox').closest('.language-selector');
    expect(container).toHaveClass(customClass);
  });

  test('has proper accessibility attributes', () => {
    render(<LanguageSelector />);
    
    const label = screen.getByText('language');
    const select = screen.getByRole('combobox');
    
    expect(label).toHaveAttribute('for', 'language-select');
    expect(select).toHaveAttribute('id', 'language-select');
  });
});