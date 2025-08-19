import { renderHook } from '@testing-library/react';
import { vi } from 'vitest';
import { useKeyboardShortcuts, KeyboardShortcutHandlers } from '../useKeyboardShortcuts';

// Mock handlers
const mockHandlers: Partial<KeyboardShortcutHandlers> = {
  onNavigateHome: vi.fn(),
  onNavigateBack: vi.fn(),
  onNavigateForward: vi.fn(),
  onNavigateUp: vi.fn(),
  onSelectAll: vi.fn(),
  onClearSelection: vi.fn(),
  onCopy: vi.fn(),
  onCut: vi.fn(),
  onPaste: vi.fn(),
  onDelete: vi.fn(),
  onRename: vi.fn(),
  onToggleFullscreen: vi.fn(),
  onZoomIn: vi.fn(),
  onZoomOut: vi.fn(),
  onZoomReset: vi.fn(),
  onFocusSearch: vi.fn(),
  onAddToFavorites: vi.fn(),
  onFindNext: vi.fn(),
  onFindPrevious: vi.fn(),
  onOpenFolder: vi.fn(),
  onRefresh: vi.fn(),
};

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up event listeners
    document.removeEventListener('keydown', vi.fn());
  });

  it('should register keyboard event listeners when enabled', () => {
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    
    renderHook(() => useKeyboardShortcuts(mockHandlers, { enabled: true }));
    
    expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('should not register keyboard event listeners when disabled', () => {
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    
    renderHook(() => useKeyboardShortcuts(mockHandlers, { enabled: false }));
    
    expect(addEventListenerSpy).not.toHaveBeenCalled();
  });

  it('should handle navigation shortcuts correctly', () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));

    // Test Alt+Home
    const homeEvent = new KeyboardEvent('keydown', {
      key: 'Home',
      altKey: true,
      bubbles: true,
    });
    document.dispatchEvent(homeEvent);
    expect(mockHandlers.onNavigateHome).toHaveBeenCalledTimes(1);

    // Test Alt+Left
    const backEvent = new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      altKey: true,
      bubbles: true,
    });
    document.dispatchEvent(backEvent);
    expect(mockHandlers.onNavigateBack).toHaveBeenCalledTimes(1);

    // Test Alt+Right
    const forwardEvent = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      altKey: true,
      bubbles: true,
    });
    document.dispatchEvent(forwardEvent);
    expect(mockHandlers.onNavigateForward).toHaveBeenCalledTimes(1);

    // Test Alt+Up
    const upEvent = new KeyboardEvent('keydown', {
      key: 'ArrowUp',
      altKey: true,
      bubbles: true,
    });
    document.dispatchEvent(upEvent);
    expect(mockHandlers.onNavigateUp).toHaveBeenCalledTimes(1);
  });

  it('should handle Ctrl shortcuts correctly', () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));

    // Test Ctrl+A
    const selectAllEvent = new KeyboardEvent('keydown', {
      key: 'a',
      ctrlKey: true,
      bubbles: true,
    });
    document.dispatchEvent(selectAllEvent);
    expect(mockHandlers.onSelectAll).toHaveBeenCalledTimes(1);

    // Test Ctrl+C
    const copyEvent = new KeyboardEvent('keydown', {
      key: 'c',
      ctrlKey: true,
      bubbles: true,
    });
    document.dispatchEvent(copyEvent);
    expect(mockHandlers.onCopy).toHaveBeenCalledTimes(1);

    // Test Ctrl+X
    const cutEvent = new KeyboardEvent('keydown', {
      key: 'x',
      ctrlKey: true,
      bubbles: true,
    });
    document.dispatchEvent(cutEvent);
    expect(mockHandlers.onCut).toHaveBeenCalledTimes(1);

    // Test Ctrl+V
    const pasteEvent = new KeyboardEvent('keydown', {
      key: 'v',
      ctrlKey: true,
      bubbles: true,
    });
    document.dispatchEvent(pasteEvent);
    expect(mockHandlers.onPaste).toHaveBeenCalledTimes(1);
  });

  it('should handle function keys correctly', () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));

    // Test F2
    const renameEvent = new KeyboardEvent('keydown', {
      key: 'F2',
      bubbles: true,
    });
    document.dispatchEvent(renameEvent);
    expect(mockHandlers.onRename).toHaveBeenCalledTimes(1);

    // Test F11
    const fullscreenEvent = new KeyboardEvent('keydown', {
      key: 'F11',
      bubbles: true,
    });
    document.dispatchEvent(fullscreenEvent);
    expect(mockHandlers.onToggleFullscreen).toHaveBeenCalledTimes(1);

    // Test Delete
    const deleteEvent = new KeyboardEvent('keydown', {
      key: 'Delete',
      bubbles: true,
    });
    document.dispatchEvent(deleteEvent);
    expect(mockHandlers.onDelete).toHaveBeenCalledTimes(1);

    // Test Escape
    const escapeEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
    });
    document.dispatchEvent(escapeEvent);
    expect(mockHandlers.onClearSelection).toHaveBeenCalledTimes(1);
  });

  it('should handle zoom shortcuts correctly', () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));

    // Test Ctrl++
    const zoomInEvent = new KeyboardEvent('keydown', {
      key: '+',
      ctrlKey: true,
      bubbles: true,
    });
    document.dispatchEvent(zoomInEvent);
    expect(mockHandlers.onZoomIn).toHaveBeenCalledTimes(1);

    // Test Ctrl+-
    const zoomOutEvent = new KeyboardEvent('keydown', {
      key: '-',
      ctrlKey: true,
      bubbles: true,
    });
    document.dispatchEvent(zoomOutEvent);
    expect(mockHandlers.onZoomOut).toHaveBeenCalledTimes(1);

    // Test Ctrl+0
    const zoomResetEvent = new KeyboardEvent('keydown', {
      key: '0',
      ctrlKey: true,
      bubbles: true,
    });
    document.dispatchEvent(zoomResetEvent);
    expect(mockHandlers.onZoomReset).toHaveBeenCalledTimes(1);
  });

  it('should ignore shortcuts when typing in input fields', () => {
    // Create a mock input element
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    renderHook(() => useKeyboardShortcuts(mockHandlers));

    // Test that Ctrl+A is ignored in input field
    const selectAllEvent = new KeyboardEvent('keydown', {
      key: 'a',
      ctrlKey: true,
      bubbles: true,
    });
    Object.defineProperty(selectAllEvent, 'target', {
      value: input,
      enumerable: true,
    });
    
    document.dispatchEvent(selectAllEvent);
    expect(mockHandlers.onSelectAll).not.toHaveBeenCalled();

    // Clean up
    document.body.removeChild(input);
  });

  it('should allow certain shortcuts even in input fields', () => {
    // Create a mock input element
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    renderHook(() => useKeyboardShortcuts(mockHandlers));

    // Test that F11 works even in input field
    const fullscreenEvent = new KeyboardEvent('keydown', {
      key: 'F11',
      bubbles: true,
    });
    Object.defineProperty(fullscreenEvent, 'target', {
      value: input,
      enumerable: true,
    });
    
    document.dispatchEvent(fullscreenEvent);
    expect(mockHandlers.onToggleFullscreen).toHaveBeenCalledTimes(1);

    // Clean up
    document.body.removeChild(input);
  });

  it('should return shortcut mappings', () => {
    const { result } = renderHook(() => useKeyboardShortcuts(mockHandlers));
    
    const mappings = result.current.getShortcutMappings();
    
    expect(mappings).toHaveProperty('navigation');
    expect(mappings).toHaveProperty('selection');
    expect(mappings).toHaveProperty('fileOperations');
    expect(mappings).toHaveProperty('view');
    expect(mappings).toHaveProperty('search');
    expect(mappings).toHaveProperty('favorites');
    expect(mappings).toHaveProperty('application');
    
    expect(mappings.navigation).toHaveProperty('Alt+Home');
    expect(mappings.selection).toHaveProperty('Ctrl+A');
    expect(mappings.fileOperations).toHaveProperty('Delete');
    expect(mappings.view).toHaveProperty('F11');
  });

  it('should handle application-specific shortcuts', () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));

    // Test 'f' key for favorites (without modifiers, not in input)
    const favoriteEvent = new KeyboardEvent('keydown', {
      key: 'f',
      bubbles: true,
    });
    Object.defineProperty(favoriteEvent, 'target', {
      value: document.body,
      enumerable: true,
    });
    
    document.dispatchEvent(favoriteEvent);
    expect(mockHandlers.onAddToFavorites).toHaveBeenCalledTimes(1);
  });

  it('should handle search shortcuts', () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));

    // Test F3 for find next
    const findNextEvent = new KeyboardEvent('keydown', {
      key: 'F3',
      bubbles: true,
    });
    document.dispatchEvent(findNextEvent);
    expect(mockHandlers.onFindNext).toHaveBeenCalledTimes(1);

    // Test Shift+F3 for find previous
    const findPrevEvent = new KeyboardEvent('keydown', {
      key: 'F3',
      shiftKey: true,
      bubbles: true,
    });
    document.dispatchEvent(findPrevEvent);
    expect(mockHandlers.onFindPrevious).toHaveBeenCalledTimes(1);
  });
});