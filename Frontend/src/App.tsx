import { lazy, Suspense, useEffect } from 'react';
import { Sidebar, MainContent, TagPanel, Toolbar, StatusBar } from './components/layout';
import { ToastContainer } from './components/ui/ToastContainer';
import { GlassContextMenu } from './components/ui/glass';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { useError, useSetError } from './stores/appStore';
import { useToastStore } from './stores/toastStore';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useAppInit } from './hooks/useAppInit';

// Lazy-loaded modals — nur geladen wenn geöffnet
const Lightbox = lazy(() => import('./components/lightbox/Lightbox').then((m) => ({ default: m.Lightbox })));
const TagManagerModal = lazy(() =>
  import('./components/tags/TagManagerModal').then((m) => ({ default: m.TagManagerModal }))
);
const RenameModal = lazy(() => import('./components/ui/RenameModal').then((m) => ({ default: m.RenameModal })));
const DeleteConfirmModal = lazy(() =>
  import('./components/ui/DeleteConfirmModal').then((m) => ({ default: m.DeleteConfirmModal }))
);
const PropertiesModal = lazy(() =>
  import('./components/ui/PropertiesModal').then((m) => ({ default: m.PropertiesModal }))
);

function App() {
  // Selective subscriptions — only re-render when error changes
  const error = useError();
  const setError = useSetError();

  // Init & keyboard shortcuts — no subscriptions in App
  useAppInit();
  useKeyboardShortcuts();

  // Route app errors through the unified toast system
  useEffect(() => {
    if (error) {
      useToastStore.getState().error(error);
      setError(null);
    }
  }, [error, setError]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      {/* Top Toolbar */}
      <Toolbar />

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Folder Navigation (mit Fehlerbehandlung) */}
        <ErrorBoundary>
          <Sidebar />
        </ErrorBoundary>

        {/* Main Content - Image Grid (mit Fehlerbehandlung) */}
        <ErrorBoundary>
          <MainContent />
        </ErrorBoundary>

        {/* Tag Panel - Right Side (mit Fehlerbehandlung) */}
        <ErrorBoundary>
          <TagPanel />
        </ErrorBoundary>
      </div>

      {/* Status Bar */}
      <StatusBar />

      {/* Lazy-loaded Modals — Suspense fallback null da Modals bedingt gerendert werden */}
      <Suspense fallback={null}>
        <TagManagerModal />
        <Lightbox />
        <RenameModal />
        <DeleteConfirmModal />
        <PropertiesModal />
      </Suspense>

      {/* Context Menu */}
      <GlassContextMenu />

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  );
}

export default App;
