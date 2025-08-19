import { useEffect, useCallback, useRef } from 'react';
import { MediaFile, FolderItem } from '../../../types/global';

export interface KeyboardShortcutHandlers {
  // Navigation
  onNavigateHome: () => void;
  onNavigateBack: () => void;
  onNavigateForward: () => void;
  onNavigateUp: () => void;
  
  // Selection
  onSelectAll: () => void;
  onClearSelection: () => void;
  
  // File operations
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onRename: () => void;
  
  // View operations
  onToggleFullscreen: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  
  // Search and favorites
  onFocusSearch: () => void;
  onAddToFavorites: () => void;
  onFindNext: () => void;
  onFindPrevious: () => void;
  
  // Application
  onOpenFolder: () => void;
  onRefresh: () => void;
  onToggleProperties: () => void;
  onTogglePreview: () => void;
}

export interface KeyboardShortcutOptions {
  enabled?: boolean;
  preventDefault?: boolean;
  stopPropagation?: boolean;
  ignoreInputs?: boolean;
}

const DEFAULT_OPTIONS: KeyboardShortcutOptions = {
  enabled: true,
  preventDefault: true,
  stopPropagation: false,
  ignoreInputs: true,
};

export const useKeyboardShortcuts = (
  handlers: Partial<KeyboardShortcutHandlers>,
  options: KeyboardShortcutOptions = DEFAULT_OPTIONS
) => {
  const optionsRef = useRef({ ...DEFAULT_OPTIONS, ...options });
  const handlersRef = useRef(handlers);

  // Update refs when props change
  useEffect(() => {
    optionsRef.current = { ...DEFAULT_OPTIONS, ...options };
    handlersRef.current = handlers;
  }, [handlers, options]);

  const isInputElement = useCallback((element: Element | null): boolean => {
    if (!element || !element.tagName) {
      return false;
    }
    
    const tagName = element.tagName.toLowerCase();
    const inputTypes = ['input', 'textarea', 'select'];
    
    if (inputTypes.includes(tagName)) {
      return true;
    }
    
    // Check for contentEditable
    if (element.getAttribute('contenteditable') === 'true') {
      return true;
    }
    
    return false;
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const { enabled, preventDefault, stopPropagation, ignoreInputs } = optionsRef.current;
    
    if (!enabled) return;
    
    // Ignore shortcuts when typing in input fields (unless explicitly disabled)
    if (ignoreInputs && event.target && isInputElement(event.target as Element | null)) {
      // Allow some shortcuts even in input fields
      const allowedInInputs = [
        'Escape', // Clear selection/focus
        'F11', // Fullscreen
      ];
      
      if (!allowedInInputs.includes(event.key)) {
        return;
      }
    }

    const { key, ctrlKey, altKey, shiftKey, metaKey } = event;
    const handlers = handlersRef.current;
    let handled = false;

    // Navigation shortcuts
    if (altKey && !ctrlKey && !shiftKey && !metaKey) {
      switch (key) {
        case 'Home':
          handlers.onNavigateHome?.();
          handled = true;
          break;
        case 'ArrowLeft':
          handlers.onNavigateBack?.();
          handled = true;
          break;
        case 'ArrowRight':
          handlers.onNavigateForward?.();
          handled = true;
          break;
        case 'ArrowUp':
          handlers.onNavigateUp?.();
          handled = true;
          break;
      }
    }

    // Ctrl shortcuts
    if (ctrlKey && !altKey && !metaKey) {
      switch (key.toLowerCase()) {
        case 'a':
          if (!shiftKey) {
            handlers.onSelectAll?.();
            handled = true;
          }
          break;
        case 'c':
          if (!shiftKey) {
            handlers.onCopy?.();
            handled = true;
          }
          break;
        case 'x':
          if (!shiftKey) {
            handlers.onCut?.();
            handled = true;
          }
          break;
        case 'v':
          if (!shiftKey) {
            handlers.onPaste?.();
            handled = true;
          }
          break;
        case 'f':
          if (!shiftKey) {
            handlers.onFocusSearch?.();
            handled = true;
          }
          break;
        case 'd':
          if (!shiftKey) {
            handlers.onAddToFavorites?.();
            handled = true;
          }
          break;
        case 'o':
          if (!shiftKey) {
            handlers.onOpenFolder?.();
            handled = true;
          }
          break;
        case 'r':
          if (!shiftKey) {
            handlers.onRefresh?.();
            handled = true;
          }
          break;
        case '=':
        case '+':
          if (!shiftKey) {
            handlers.onZoomIn?.();
            handled = true;
          }
          break;
        case '-':
          if (!shiftKey) {
            handlers.onZoomOut?.();
            handled = true;
          }
          break;
        case '0':
          if (!shiftKey) {
            handlers.onZoomReset?.();
            handled = true;
          }
          break;
      }
    }

    // Function keys and other special keys
    if (!ctrlKey && !altKey && !metaKey) {
      switch (key) {
        case 'F2':
          if (!shiftKey) {
            handlers.onRename?.();
            handled = true;
          }
          break;
        case 'F3':
          if (shiftKey) {
            handlers.onFindPrevious?.();
          } else {
            handlers.onFindNext?.();
          }
          handled = true;
          break;
        case 'F5':
          if (!shiftKey) {
            handlers.onRefresh?.();
            handled = true;
          }
          break;
        case 'F11':
          if (!shiftKey) {
            handlers.onToggleFullscreen?.();
            handled = true;
          }
          break;
        case 'Delete':
          if (!shiftKey) {
            handlers.onDelete?.();
            handled = true;
          }
          break;
        case 'Escape':
          if (!shiftKey) {
            handlers.onClearSelection?.();
            handled = true;
          }
          break;
        case 'f':
          // Application-specific: F for favorite (without modifiers)
          if (!shiftKey && !isInputElement(event.target as Element | null)) {
            handlers.onAddToFavorites?.();
            handled = true;
          }
          break;
      }
    }

    // Handle event propagation
    if (handled) {
      if (preventDefault) {
        event.preventDefault();
      }
      if (stopPropagation) {
        event.stopPropagation();
      }
    }
  }, [isInputElement]);

  useEffect(() => {
    if (optionsRef.current.enabled) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown]);

  // Return current shortcut mappings for display purposes
  const getShortcutMappings = useCallback(() => {
    return {
      navigation: {
        'Alt+Home': 'Navigate to Home',
        'Alt+Left': 'Go Back',
        'Alt+Right': 'Go Forward',
        'Alt+Up': 'Go Up',
      },
      selection: {
        'Ctrl+A': 'Select All',
        'Escape': 'Clear Selection',
      },
      fileOperations: {
        'Ctrl+C': 'Copy',
        'Ctrl+X': 'Cut',
        'Ctrl+V': 'Paste',
        'Delete': 'Delete',
        'F2': 'Rename',
      },
      view: {
        'F11': 'Toggle Fullscreen',
        'Ctrl++': 'Zoom In',
        'Ctrl+-': 'Zoom Out',
        'Ctrl+0': 'Reset Zoom',
      },
      search: {
        'Ctrl+F': 'Focus Search',
        'F3': 'Find Next',
        'Shift+F3': 'Find Previous',
      },
      favorites: {
        'F': 'Add to Favorites',
        'Ctrl+D': 'Add to Favorites',
      },
      application: {
        'Ctrl+O': 'Open Folder',
        'F5': 'Refresh',
        'Ctrl+R': 'Refresh',
      },
    };
  }, []);

  return {
    getShortcutMappings,
  };
};