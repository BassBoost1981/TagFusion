import { renderHook } from '@testing-library/react';
import { vi } from 'vitest';
import { useKeyboardShortcuts } from '../useKeyboardShortcuts';

describe('useKeyboardShortcuts - Simple Tests', () => {
  it('should create hook without errors', () => {
    const handlers = {
      onNavigateHome: vi.fn(),
    };

    const { result } = renderHook(() => useKeyboardShortcuts(handlers));
    
    expect(result.current.getShortcutMappings).toBeDefined();
  });

  it('should return shortcut mappings', () => {
    const handlers = {
      onNavigateHome: vi.fn(),
    };

    const { result } = renderHook(() => useKeyboardShortcuts(handlers));
    
    const mappings = result.current.getShortcutMappings();
    
    expect(mappings).toHaveProperty('navigation');
    expect(mappings).toHaveProperty('selection');
    expect(mappings).toHaveProperty('fileOperations');
    expect(mappings).toHaveProperty('view');
    expect(mappings).toHaveProperty('search');
    expect(mappings).toHaveProperty('favorites');
    expect(mappings).toHaveProperty('application');
  });

  it('should include expected shortcuts in navigation category', () => {
    const handlers = {
      onNavigateHome: vi.fn(),
    };

    const { result } = renderHook(() => useKeyboardShortcuts(handlers));
    
    const mappings = result.current.getShortcutMappings();
    
    expect(mappings.navigation).toHaveProperty('Alt+Home');
    expect(mappings.navigation).toHaveProperty('Alt+Left');
    expect(mappings.navigation).toHaveProperty('Alt+Right');
    expect(mappings.navigation).toHaveProperty('Alt+Up');
  });
});