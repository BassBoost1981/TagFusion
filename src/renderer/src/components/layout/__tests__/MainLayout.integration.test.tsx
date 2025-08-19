import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { MainLayout } from '../MainLayout';

// Mock the API modules
vi.mock('../../../api/dragDropApi', () => ({
  DragDropApi: {
    moveFilesToFolder: vi.fn(),
    addFilesToFavorites: vi.fn(),
    assignTagsToFiles: vi.fn(),
    addFolderToFavorites: vi.fn(),
    reorderFavorites: vi.fn(),
    reorganizeTag: vi.fn(),
  },
}));

describe('MainLayout Keyboard Shortcuts Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', () => {
    render(<MainLayout />);
    
    // Check that the main layout is rendered
    expect(document.querySelector('.main-layout')).toBeInTheDocument();
  });

  it('should handle keyboard shortcuts', () => {
    render(<MainLayout />);
    
    // Test Escape key to clear selection
    fireEvent.keyDown(document, {
      key: 'Escape',
      bubbles: true,
    });
    
    // Should not throw any errors
    expect(document.querySelector('.main-layout')).toBeInTheDocument();
  });

  it('should show keyboard shortcuts help when settings is clicked', () => {
    render(<MainLayout />);
    
    // Find and click the settings button
    const settingsButton = screen.getByTitle('Settings');
    fireEvent.click(settingsButton);
    
    // Should show the keyboard shortcuts help dialog
    expect(screen.getByText('Tastenkürzel')).toBeInTheDocument();
  });

  it('should close keyboard shortcuts help when close button is clicked', () => {
    render(<MainLayout />);
    
    // Open the help dialog
    const settingsButton = screen.getByTitle('Settings');
    fireEvent.click(settingsButton);
    
    // Close the dialog
    const closeButton = screen.getByText('✕');
    fireEvent.click(closeButton);
    
    // Dialog should be closed
    expect(screen.queryByText('Tastenkürzel')).not.toBeInTheDocument();
  });

  it('should handle navigation shortcuts', () => {
    render(<MainLayout />);
    
    // Test Alt+Home shortcut
    fireEvent.keyDown(document, {
      key: 'Home',
      altKey: true,
      bubbles: true,
    });
    
    // Should not throw any errors
    expect(document.querySelector('.main-layout')).toBeInTheDocument();
  });
});