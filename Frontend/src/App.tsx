import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar, MainContent, TagPanel, Toolbar, StatusBar } from './components/layout';
import { TagManagerModal } from './components/tags';
import { Lightbox } from './components/lightbox';
import { RenameModal, DeleteConfirmModal, PropertiesModal } from './components/ui';
import { ToastContainer } from './components/ui/ToastContainer';
import { GlassContextMenu } from './components/ui/glass';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { useAppStore } from './stores/appStore';
import { useTagStore } from './stores/tagStore';
import { useClipboardStore } from './stores/clipboardStore';
import { useModalStore } from './stores/modalStore';

function App() {
  const { loadAllTags, setupSubscriptions, error, setError, images, selectedImages, setZoomLevel, zoomIn, zoomOut, selectAllImages, clearSelection, currentFolder } = useAppStore();
  const { initialize: initTagStore } = useTagStore();
  const { copy, cut, paste } = useClipboardStore();
  const { openModal } = useModalStore();

  useEffect(() => {
    setupSubscriptions();
    loadAllTags();
    initTagStore();
  }, [loadAllTags, initTagStore, setupSubscriptions]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore shortcuts when typing in input fields
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    // Escape: Clear selection
    if (e.key === 'Escape') {
      clearSelection();
      return;
    }

    // F2: Rename (single selection only)
    if (e.key === 'F2' && selectedImages.size === 1) {
      e.preventDefault();
      const path = Array.from(selectedImages)[0];
      const img = images.find(i => i.path === path);
      if (img) {
        openModal('rename', { path, name: img.fileName, isFolder: false });
      }
      return;
    }

    // Delete: Delete selected
    if (e.key === 'Delete' && selectedImages.size > 0) {
      e.preventDefault();
      openModal('deleteConfirm', { paths: Array.from(selectedImages) });
      return;
    }

    // Alt+Enter: Properties (single selection only)
    if (e.altKey && e.key === 'Enter' && selectedImages.size === 1) {
      e.preventDefault();
      const path = Array.from(selectedImages)[0];
      openModal('properties', { path });
      return;
    }

    if (e.ctrlKey) {
      // Ctrl+C: Copy
      if (e.key === 'c' || e.key === 'C') {
        if (selectedImages.size > 0) {
          e.preventDefault();
          copy(Array.from(selectedImages).map(path => ({ path, isFolder: false })));
        }
        return;
      }
      // Ctrl+X: Cut
      if (e.key === 'x' || e.key === 'X') {
        if (selectedImages.size > 0) {
          e.preventDefault();
          cut(Array.from(selectedImages).map(path => ({ path, isFolder: false })));
        }
        return;
      }
      // Ctrl+V: Paste
      if (e.key === 'v' || e.key === 'V') {
        if (currentFolder) {
          e.preventDefault();
          paste(currentFolder).then(() => window.location.reload());
        }
        return;
      }
      // Ctrl+A: Select all
      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        selectAllImages();
        return;
      }
      // Zoom shortcuts
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        zoomIn();
      } else if (e.key === '-') {
        e.preventDefault();
        zoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        setZoomLevel(100);
      }
    }
  }, [zoomIn, zoomOut, setZoomLevel, selectAllImages, clearSelection, selectedImages, images, currentFolder, copy, cut, paste, openModal]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);



  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      {/* Top Toolbar */}
      <Toolbar />

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Folder Navigation */}
        <Sidebar />

        {/* Main Content - Image Grid (mit Fehlerbehandlung) */}
        <ErrorBoundary>
          <MainContent />
        </ErrorBoundary>

        {/* Tag Panel - Right Side */}
        <TagPanel />
      </div>

      {/* Status Bar */}
      <StatusBar />

      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-12 right-4 max-w-md p-4 rounded-xl glass border border-red-500/30 text-red-300"
          >
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <p className="font-medium">Fehler</p>
                <p className="text-sm opacity-80">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-300 transition-colors"
              >
                ×
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tag Manager Modal */}
      <TagManagerModal />

      {/* Lightbox */}
      <Lightbox />

      {/* Context Menu */}
      <GlassContextMenu />

      {/* File Operation Modals */}
      <RenameModal />
      <DeleteConfirmModal />
      <PropertiesModal />

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  );
}

export default App;

