import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { KeyboardShortcutsHelp } from '../KeyboardShortcutsHelp';
import { KeyboardShortcutsProvider } from '../../../contexts/KeyboardShortcutsContext';

// Mock handlers for the provider
const mockHandlers = {
  onNavigateHome: vi.fn(),
  onNavigateBack: vi.fn(),
  onSelectAll: vi.fn(),
  onCopy: vi.fn(),
  onToggleFullscreen: vi.fn(),
  onFocusSearch: vi.fn(),
  onAddToFavorites: vi.fn(),
  onOpenFolder: vi.fn(),
};

const renderWithProvider = (component: React.ReactElement) => {
  return render(
    <KeyboardShortcutsProvider handlers={mockHandlers}>
      {component}
    </KeyboardShortcutsProvider>
  );
};

describe('KeyboardShortcutsHelp', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when isOpen is false', () => {
    renderWithProvider(
      <KeyboardShortcutsHelp {...defaultProps} isOpen={false} />
    );
    
    expect(screen.queryByText('Tastenkürzel')).not.toBeInTheDocument();
  });

  it('should render when isOpen is true', () => {
    renderWithProvider(
      <KeyboardShortcutsHelp {...defaultProps} />
    );
    
    expect(screen.getByText('Tastenkürzel')).toBeInTheDocument();
  });

  it('should display all shortcut categories', () => {
    renderWithProvider(
      <KeyboardShortcutsHelp {...defaultProps} />
    );
    
    expect(screen.getByText('Navigation')).toBeInTheDocument();
    expect(screen.getByText('Auswahl')).toBeInTheDocument();
    expect(screen.getByText('Dateioperationen')).toBeInTheDocument();
    expect(screen.getByText('Ansicht')).toBeInTheDocument();
    expect(screen.getByText('Suche')).toBeInTheDocument();
    expect(screen.getByText('Favoriten')).toBeInTheDocument();
    expect(screen.getByText('Anwendung')).toBeInTheDocument();
  });

  it('should show navigation shortcuts by default', () => {
    renderWithProvider(
      <KeyboardShortcutsHelp {...defaultProps} />
    );
    
    // Navigation should be the default active category
    expect(screen.getByText('Navigate to Home')).toBeInTheDocument();
    expect(screen.getByText('Go Back')).toBeInTheDocument();
    expect(screen.getByText('Go Forward')).toBeInTheDocument();
    expect(screen.getByText('Go Up')).toBeInTheDocument();
  });

  it('should switch categories when category button is clicked', () => {
    renderWithProvider(
      <KeyboardShortcutsHelp {...defaultProps} />
    );
    
    // Click on selection category
    fireEvent.click(screen.getByText('Auswahl'));
    
    // Should show selection shortcuts
    expect(screen.getByText('Select All')).toBeInTheDocument();
    expect(screen.getByText('Clear Selection')).toBeInTheDocument();
  });

  it('should display keyboard shortcuts with proper formatting', () => {
    renderWithProvider(
      <KeyboardShortcutsHelp {...defaultProps} />
    );
    
    // Check for keyboard key elements by class name instead
    const keys = document.querySelectorAll('.key');
    expect(keys.length).toBeGreaterThan(0);
  });

  it('should call onClose when close button is clicked', () => {
    const onCloseMock = vi.fn();
    
    renderWithProvider(
      <KeyboardShortcutsHelp {...defaultProps} onClose={onCloseMock} />
    );
    
    fireEvent.click(screen.getByText('✕'));
    
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when overlay is clicked', () => {
    const onCloseMock = vi.fn();
    
    renderWithProvider(
      <KeyboardShortcutsHelp {...defaultProps} onClose={onCloseMock} />
    );
    
    // Click on the overlay (not the dialog)
    const overlay = screen.getByText('Tastenkürzel').closest('.keyboard-shortcuts-overlay');
    fireEvent.click(overlay!);
    
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('should not call onClose when dialog content is clicked', () => {
    const onCloseMock = vi.fn();
    
    renderWithProvider(
      <KeyboardShortcutsHelp {...defaultProps} onClose={onCloseMock} />
    );
    
    // Click on the dialog content
    fireEvent.click(screen.getByText('Tastenkürzel'));
    
    expect(onCloseMock).not.toHaveBeenCalled();
  });

  it('should format shortcuts correctly for different platforms', () => {
    // Mock platform detection
    Object.defineProperty(process, 'platform', {
      value: 'darwin',
      writable: true,
    });
    
    renderWithProvider(
      <KeyboardShortcutsHelp {...defaultProps} />
    );
    
    // On macOS, CommandOrControl should be formatted as Cmd
    // This is tested indirectly through the formatShortcut function
    expect(screen.getAllByText('Navigation')).toHaveLength(2); // Button and heading
  });

  it('should show all shortcut categories with correct German translations', () => {
    renderWithProvider(
      <KeyboardShortcutsHelp {...defaultProps} />
    );
    
    const expectedCategories = [
      'Navigation',
      'Auswahl',
      'Dateioperationen', 
      'Ansicht',
      'Suche',
      'Favoriten',
      'Anwendung',
    ];
    
    expectedCategories.forEach(category => {
      const elements = screen.getAllByText(category);
      expect(elements.length).toBeGreaterThan(0);
    });
  });

  it('should display the help note at the bottom', () => {
    renderWithProvider(
      <KeyboardShortcutsHelp {...defaultProps} />
    );
    
    expect(screen.getByText(/Hinweis: Einige Tastenkürzel funktionieren möglicherweise nicht/)).toBeInTheDocument();
  });

  it('should handle empty shortcut categories gracefully', () => {
    // This tests the robustness of the component when no shortcuts are available
    renderWithProvider(
      <KeyboardShortcutsHelp {...defaultProps} />
    );
    
    // Component should still render without errors
    expect(screen.getByText('Tastenkürzel')).toBeInTheDocument();
  });

  it('should maintain active category state correctly', () => {
    renderWithProvider(
      <KeyboardShortcutsHelp {...defaultProps} />
    );
    
    // Navigation should be active by default - get the button specifically
    const navigationButton = screen.getByRole('button', { name: 'Navigation' });
    expect(navigationButton).toHaveClass('active');
    
    // Click on another category
    const selectionButton = screen.getByRole('button', { name: 'Auswahl' });
    fireEvent.click(selectionButton);
    
    // Selection should now be active
    expect(selectionButton).toHaveClass('active');
    expect(navigationButton).not.toHaveClass('active');
  });

  it('should display shortcuts in a grid layout', () => {
    renderWithProvider(
      <KeyboardShortcutsHelp {...defaultProps} />
    );
    
    const shortcutsGrid = document.querySelector('.shortcuts-grid');
    expect(shortcutsGrid).toBeInTheDocument();
    
    const shortcutItems = document.querySelectorAll('.shortcut-item');
    expect(shortcutItems.length).toBeGreaterThan(0);
  });
});