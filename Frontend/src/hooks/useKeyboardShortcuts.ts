import { useEffect, useCallback } from 'react';
import { useAppStore } from '../stores/appStore';
import { useClipboardStore } from '../stores/clipboardStore';
import { useModalStore } from '../stores/modalStore';

/**
 * Keyboard shortcuts hook - reads state via getState() to avoid
 * subscribing App.tsx to every state change.
 */
export function useKeyboardShortcuts() {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore shortcuts when typing in input fields
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    // Read state on-demand instead of subscribing
    const state = useAppStore.getState();
    const { copy, cut, paste } = useClipboardStore.getState();
    const { openModal } = useModalStore.getState();

    // Escape: Clear selection
    if (e.key === 'Escape') {
      state.clearSelection();
      return;
    }

    // F2: Rename (single selection only)
    if (e.key === 'F2' && state.selectedImages.size === 1) {
      e.preventDefault();
      const path = Array.from(state.selectedImages)[0];
      const img = state.images.find(i => i.path === path);
      if (img) {
        openModal('rename', { path, name: img.fileName, isFolder: false });
      }
      return;
    }

    // Delete: Delete selected
    if (e.key === 'Delete' && state.selectedImages.size > 0) {
      e.preventDefault();
      openModal('deleteConfirm', { paths: Array.from(state.selectedImages) });
      return;
    }

    // Alt+Enter: Properties (single selection only)
    if (e.altKey && e.key === 'Enter' && state.selectedImages.size === 1) {
      e.preventDefault();
      const path = Array.from(state.selectedImages)[0];
      openModal('properties', { path });
      return;
    }

    if (e.ctrlKey) {
      // Ctrl+C: Copy
      if (e.key === 'c' || e.key === 'C') {
        if (state.selectedImages.size > 0) {
          e.preventDefault();
          copy(Array.from(state.selectedImages).map(path => ({ path, isFolder: false })));
        }
        return;
      }
      // Ctrl+X: Cut
      if (e.key === 'x' || e.key === 'X') {
        if (state.selectedImages.size > 0) {
          e.preventDefault();
          cut(Array.from(state.selectedImages).map(path => ({ path, isFolder: false })));
        }
        return;
      }
      // Ctrl+V: Paste
      if (e.key === 'v' || e.key === 'V') {
        if (state.currentFolder) {
          e.preventDefault();
          paste(state.currentFolder).then(() => state.refreshImages());
        }
        return;
      }
      // Ctrl+A: Select all
      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        state.selectAllImages();
        return;
      }
      // Zoom shortcuts
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        state.zoomIn();
      } else if (e.key === '-') {
        e.preventDefault();
        state.zoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        state.setZoomLevel(100);
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

