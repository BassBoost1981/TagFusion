import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import LanguageProvider from '../LanguageProvider';

// Mock LanguageService
vi.mock('../../../services/LanguageService', () => ({
  LanguageService: {
    waitForReady: vi.fn(),
    initializeLanguage: vi.fn(),
  }
}));

describe('LanguageProvider', () => {
  let mockWaitForReady: any;
  let mockInitializeLanguage: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Get the mocked functions
    const { LanguageService } = await import('../../../services/LanguageService');
    mockWaitForReady = LanguageService.waitForReady as any;
    mockInitializeLanguage = LanguageService.initializeLanguage as any;
  });

  test('shows fallback while initializing', () => {
    mockWaitForReady.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(
      <LanguageProvider fallback={<div>Custom Loading...</div>}>
        <div>App Content</div>
      </LanguageProvider>
    );
    
    expect(screen.getByText('Custom Loading...')).toBeInTheDocument();
    expect(screen.queryByText('App Content')).not.toBeInTheDocument();
  });

  test('shows default fallback when none provided', () => {
    mockWaitForReady.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(
      <LanguageProvider>
        <div>App Content</div>
      </LanguageProvider>
    );
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('App Content')).not.toBeInTheDocument();
  });

  test('renders children after successful initialization', async () => {
    mockWaitForReady.mockResolvedValue(undefined);
    mockInitializeLanguage.mockResolvedValue(undefined);
    
    render(
      <LanguageProvider>
        <div>App Content</div>
      </LanguageProvider>
    );
    
    await waitFor(() => {
      expect(screen.getByText('App Content')).toBeInTheDocument();
    });
    
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    expect(mockWaitForReady).toHaveBeenCalled();
    expect(mockInitializeLanguage).toHaveBeenCalled();
  });

  test('renders children even after initialization error', async () => {
    mockWaitForReady.mockResolvedValue(undefined);
    mockInitializeLanguage.mockRejectedValue(new Error('Initialization failed'));
    
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    render(
      <LanguageProvider>
        <div>App Content</div>
      </LanguageProvider>
    );
    
    await waitFor(() => {
      expect(screen.getByText('App Content')).toBeInTheDocument();
    });
    
    expect(consoleSpy).toHaveBeenCalledWith('Failed to initialize language:', expect.any(Error));
    expect(warnSpy).toHaveBeenCalledWith('Language initialization error:', 'Initialization failed');
    
    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });

  test('handles waitForReady error gracefully', async () => {
    mockWaitForReady.mockRejectedValue(new Error('Wait failed'));
    
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    render(
      <LanguageProvider>
        <div>App Content</div>
      </LanguageProvider>
    );
    
    await waitFor(() => {
      expect(screen.getByText('App Content')).toBeInTheDocument();
    });
    
    expect(consoleSpy).toHaveBeenCalledWith('Failed to initialize language:', expect.any(Error));
    expect(warnSpy).toHaveBeenCalledWith('Language initialization error:', 'Wait failed');
    
    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });
});