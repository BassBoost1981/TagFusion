import React, { createContext, useContext, ReactNode, useEffect } from 'react';

export interface KeyboardShortcutHandlers {
  // Navigation
  onNavigateHome?: () => void;
  onNavigateBack?: () => void;
  onNavigateForward?: () => void;
  onNavigateUp?: () => void;
  
  // Selection
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  
  // File operations
  onCopy?: () => void;
  onCut?: () => void;
  onPaste?: () => void;
  onDelete?: () => void;
  onRename?: () => void;
  
  // View operations
  onToggleFullscreen?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  
  // Search and favorites
  onFocusSearch?: () => void;
  onAddToFavorites?: () => void;
  onFindNext?: () => void;
  onFindPrevious?: () => void;
  
  // Application
  onOpenFolder?: () => void;
  onRefresh?: () => void;
  onToggleProperties?: () => void;
  onTogglePreview?: () => void;
  onExport?: () => void;
}

interface KeyboardShortcutsContextType {
  handlers: KeyboardShortcutHandlers;
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextType | undefined>(undefined);

interface KeyboardShortcutsProviderProps {
  children: ReactNode;
  handlers: KeyboardShortcutHandlers;
}

export const KeyboardShortcutsProvider: React.FC<KeyboardShortcutsProviderProps> = ({
  children,
  handlers,
}) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Prevent shortcuts when typing in input fields
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        // Allow some shortcuts even in input fields
        if (event.ctrlKey && event.key === 'a') {
          // Allow Ctrl+A in input fields
          return;
        }
        if (event.key === 'Escape') {
          // Allow Escape to blur input fields
          target.blur();
          return;
        }
        // Block other shortcuts in input fields
        return;
      }

      const { ctrlKey, altKey, shiftKey, key } = event;

      // Navigation shortcuts
      if (altKey && !ctrlKey && !shiftKey) {
        switch (key) {
          case 'Home':
            event.preventDefault();
            handlers.onNavigateHome?.();
            break;
          case 'ArrowLeft':
            event.preventDefault();
            handlers.onNavigateBack?.();
            break;
          case 'ArrowRight':
            event.preventDefault();
            handlers.onNavigateForward?.();
            break;
          case 'ArrowUp':
            event.preventDefault();
            handlers.onNavigateUp?.();
            break;
        }
      }

      // Ctrl shortcuts
      if (ctrlKey && !altKey) {
        switch (key) {
          case 'a':
            if (!shiftKey) {
              event.preventDefault();
              handlers.onSelectAll?.();
            }
            break;
          case 'c':
            if (!shiftKey) {
              event.preventDefault();
              handlers.onCopy?.();
            }
            break;
          case 'x':
            if (!shiftKey) {
              event.preventDefault();
              handlers.onCut?.();
            }
            break;
          case 'v':
            if (!shiftKey) {
              event.preventDefault();
              handlers.onPaste?.();
            }
            break;
          case 'f':
            if (!shiftKey) {
              event.preventDefault();
              handlers.onFocusSearch?.();
            }
            break;
          case 'o':
            if (!shiftKey) {
              event.preventDefault();
              handlers.onOpenFolder?.();
            }
            break;
          case 'd':
            if (!shiftKey) {
              event.preventDefault();
              handlers.onAddToFavorites?.();
            }
            break;
          case 'e':
            if (!shiftKey) {
              event.preventDefault();
              handlers.onExport?.();
            }
            break;
          case '+':
          case '=':
            event.preventDefault();
            handlers.onZoomIn?.();
            break;
          case '-':
            event.preventDefault();
            handlers.onZoomOut?.();
            break;
          case '0':
            event.preventDefault();
            handlers.onZoomReset?.();
            break;
        }
      }

      // Function keys
      if (!ctrlKey && !altKey && !shiftKey) {
        switch (key) {
          case 'F2':
            event.preventDefault();
            handlers.onRename?.();
            break;
          case 'F3':
            event.preventDefault();
            handlers.onFindNext?.();
            break;
          case 'F5':
            event.preventDefault();
            handlers.onRefresh?.();
            break;
          case 'F11':
            event.preventDefault();
            handlers.onToggleFullscreen?.();
            break;
          case 'Delete':
            event.preventDefault();
            handlers.onDelete?.();
            break;
          case 'Escape':
            event.preventDefault();
            handlers.onClearSelection?.();
            break;
        }
      }

      // Shift + Function keys
      if (shiftKey && !ctrlKey && !altKey) {
        switch (key) {
          case 'F3':
            event.preventDefault();
            handlers.onFindPrevious?.();
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);

  const contextValue: KeyboardShortcutsContextType = {
    handlers,
  };

  return (
    <KeyboardShortcutsContext.Provider value={contextValue}>
      {children}
    </KeyboardShortcutsContext.Provider>
  );
};

export const useKeyboardShortcutsContext = (): KeyboardShortcutsContextType => {
  const context = useContext(KeyboardShortcutsContext);
  if (context === undefined) {
    throw new Error('useKeyboardShortcutsContext must be used within a KeyboardShortcutsProvider');
  }
  return context;
};