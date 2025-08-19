import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeSettings } from '../ThemeSettings';
import { useThemeContext } from '../../../contexts/ThemeContext';

// Mock the theme context
vi.mock('../../../contexts/ThemeContext', () => ({
  useThemeContext: vi.fn(),
}));

// Mock CSS import
vi.mock('../ThemeSettings.css', () => ({}));

const mockUseThemeContext = useThemeContext as any;

describe('ThemeSettings', () => {
  const mockSetTheme = vi.fn();
  
  const defaultThemeContext = {
    theme: 'system',
    effectiveTheme: 'light',
    systemTheme: 'light',
    setTheme: mockSetTheme,
    toggleTheme: vi.fn(),
    isSystemTheme: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseThemeContext.mockReturnValue(defaultThemeContext);
  });

  it('should render theme options', () => {
    render(<ThemeSettings />);

    expect(screen.getByText('Light')).toBeInTheDocument();
    expect(screen.getByText('Dark')).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('should show current theme as selected', () => {
    mockUseThemeContext.mockReturnValue({
      ...defaultThemeContext,
      theme: 'dark',
      effectiveTheme: 'dark',
      isSystemTheme: false,
    });

    render(<ThemeSettings />);

    const darkOption = screen.getByText('Dark').closest('.theme-option');
    expect(darkOption).toHaveClass('selected');
    expect(screen.getByText('Current')).toBeInTheDocument();
  });

  it('should call setTheme when option is clicked', () => {
    render(<ThemeSettings />);

    const darkOption = screen.getByText('Dark').closest('.theme-option');
    fireEvent.click(darkOption!);

    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('should call setTheme when radio button is changed', () => {
    render(<ThemeSettings />);

    const lightRadio = screen.getByDisplayValue('light');
    fireEvent.change(lightRadio, { target: { value: 'light' } });

    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });

  it('should show system theme in description', () => {
    mockUseThemeContext.mockReturnValue({
      ...defaultThemeContext,
      systemTheme: 'dark',
    });

    render(<ThemeSettings />);

    expect(screen.getByText('Follow system preference (currently dark)')).toBeInTheDocument();
  });

  it('should display current effective theme in preview', () => {
    mockUseThemeContext.mockReturnValue({
      ...defaultThemeContext,
      effectiveTheme: 'dark',
    });

    render(<ThemeSettings />);

    expect(screen.getByText('Currently showing: dark theme (from system)')).toBeInTheDocument();
  });

  it('should show manual theme source when not using system', () => {
    mockUseThemeContext.mockReturnValue({
      ...defaultThemeContext,
      theme: 'light',
      effectiveTheme: 'light',
      isSystemTheme: false,
    });

    render(<ThemeSettings />);

    expect(screen.getByText('Currently showing: light theme')).toBeInTheDocument();
  });

  it('should display theme information correctly', () => {
    mockUseThemeContext.mockReturnValue({
      ...defaultThemeContext,
      theme: 'dark',
      effectiveTheme: 'dark',
      systemTheme: 'light',
      isSystemTheme: false,
    });

    render(<ThemeSettings />);

    expect(screen.getByText('light')).toBeInTheDocument(); // System Theme
    expect(screen.getByText('dark')).toBeInTheDocument(); // Active Theme
    expect(screen.getByText('Manual selection')).toBeInTheDocument(); // Theme Source
  });

  it('should show system preference as theme source when using system theme', () => {
    render(<ThemeSettings />);

    expect(screen.getByText('System preference')).toBeInTheDocument();
  });

  it('should render preview components', () => {
    render(<ThemeSettings />);

    expect(screen.getByText('Preview')).toBeInTheDocument();
    expect(screen.getByText('Sample Text')).toBeInTheDocument();
    expect(screen.getByText('This is how text will appear in the selected theme.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Sample input field')).toBeInTheDocument();
    expect(screen.getByText('Button')).toBeInTheDocument();
    expect(screen.getByText('Primary')).toBeInTheDocument();
  });

  it('should have correct radio button states', () => {
    mockUseThemeContext.mockReturnValue({
      ...defaultThemeContext,
      theme: 'dark',
    });

    render(<ThemeSettings />);

    const lightRadio = screen.getByDisplayValue('light') as HTMLInputElement;
    const darkRadio = screen.getByDisplayValue('dark') as HTMLInputElement;
    const systemRadio = screen.getByDisplayValue('system') as HTMLInputElement;

    expect(lightRadio.checked).toBe(false);
    expect(darkRadio.checked).toBe(true);
    expect(systemRadio.checked).toBe(false);
  });

  it('should handle theme option clicks for all themes', () => {
    render(<ThemeSettings />);

    // Click light theme
    const lightOption = screen.getByText('Light').closest('.theme-option');
    fireEvent.click(lightOption!);
    expect(mockSetTheme).toHaveBeenCalledWith('light');

    // Click dark theme
    const darkOption = screen.getByText('Dark').closest('.theme-option');
    fireEvent.click(darkOption!);
    expect(mockSetTheme).toHaveBeenCalledWith('dark');

    // Click system theme
    const systemOption = screen.getByText('System').closest('.theme-option');
    fireEvent.click(systemOption!);
    expect(mockSetTheme).toHaveBeenCalledWith('system');
  });

  it('should display theme icons', () => {
    render(<ThemeSettings />);

    // Check for emoji icons (they should be in the document)
    const lightIcon = screen.getByText('☀️');
    const darkIcon = screen.getByText('🌙');
    const systemIcon = screen.getByText('🖥️');

    expect(lightIcon).toBeInTheDocument();
    expect(darkIcon).toBeInTheDocument();
    expect(systemIcon).toBeInTheDocument();
  });

  describe('accessibility', () => {
    it('should have proper heading structure', () => {
      render(<ThemeSettings />);

      expect(screen.getByRole('heading', { name: 'Theme Settings' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Preview' })).toBeInTheDocument();
    });

    it('should have proper radio button labels', () => {
      render(<ThemeSettings />);

      const lightRadio = screen.getByLabelText(/Light/);
      const darkRadio = screen.getByLabelText(/Dark/);
      const systemRadio = screen.getByLabelText(/System/);

      expect(lightRadio).toBeInTheDocument();
      expect(darkRadio).toBeInTheDocument();
      expect(systemRadio).toBeInTheDocument();
    });

    it('should have proper radio button grouping', () => {
      render(<ThemeSettings />);

      const radios = screen.getAllByRole('radio');
      radios.forEach(radio => {
        expect(radio).toHaveAttribute('name', 'theme');
      });
    });
  });

  describe('dynamic content', () => {
    it('should update system theme description dynamically', () => {
      const { rerender } = render(<ThemeSettings />);

      expect(screen.getByText('Follow system preference (currently light)')).toBeInTheDocument();

      // Update system theme
      mockUseThemeContext.mockReturnValue({
        ...defaultThemeContext,
        systemTheme: 'dark',
      });

      rerender(<ThemeSettings />);

      expect(screen.getByText('Follow system preference (currently dark)')).toBeInTheDocument();
    });

    it('should update preview text based on effective theme', () => {
      const { rerender } = render(<ThemeSettings />);

      expect(screen.getByText('Currently showing: light theme (from system)')).toBeInTheDocument();

      // Change to dark theme
      mockUseThemeContext.mockReturnValue({
        ...defaultThemeContext,
        effectiveTheme: 'dark',
      });

      rerender(<ThemeSettings />);

      expect(screen.getByText('Currently showing: dark theme (from system)')).toBeInTheDocument();
    });
  });
});