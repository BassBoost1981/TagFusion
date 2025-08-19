import React, { useState, useCallback } from 'react';
import { Toolbar, FilterCriteria } from '../toolbar/Toolbar';
import { LeftPanel } from '../panels/LeftPanel';
import { CenterPanel } from '../panels/CenterPanel';
import { RightPanel } from '../panels/RightPanel';
import { DragDropProvider } from '../common/DragDropProvider';
import { DragDropFeedback } from '../common/DragDropFeedback';
import { ContextMenuProvider } from '../../contexts/ContextMenuContext';
import { KeyboardShortcutsProvider } from '../../contexts/KeyboardShortcutsContext';
import { KeyboardShortcutsHelp } from '../common/KeyboardShortcutsHelp';
import { SettingsDialog } from '../settings/SettingsDialog';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { ToastProvider } from '../common/Toast';
import ExportDialog from '../export/ExportDialog';
import ExportProgressDialog from '../export/ExportProgressDialog';
import { MediaFile, FolderItem, HierarchicalTag, FavoriteFolder } from '../../../../types/global';
import { DragDropApi } from '../../api/dragDropApi';
import { useExport } from '../../hooks/useExport';
import { ShadcnTest } from '../test/ShadcnTest';
import './MainLayout.css';
import '../../styles/dragdrop.css';

export const MainLayout: React.FC = () => {
  const [currentPath, setCurrentPath] = useState('C:\\');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [navigationHistory, setNavigationHistory] = useState<string[]>(['C:\\']);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [activeFilters, setActiveFilters] = useState<FilterCriteria>({
    fileTypes: [],
    tags: [],
  });
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentFiles, setCurrentFiles] = useState<MediaFile[]>([]);

  const handleFilesChange = useCallback((files: MediaFile[]) => {
    setCurrentFiles(files);
  }, []);

  // Export functionality
  const {
    isExporting,
    progress,
    showExportDialog,
    showProgressDialog,
    exportResult,
    openExportDialog,
    closeExportDialog,
    startExport,
    cancelExport,
    closeProgressDialog,
  } = useExport();

  const handleNavigate = useCallback((path: string) => {
    // Add to navigation history
    const newHistory = navigationHistory.slice(0, historyIndex + 1);
    newHistory.push(path);
    setNavigationHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    
    setCurrentPath(path);
    setSelectedItems(new Set()); // Clear selection when navigating
  }, [navigationHistory, historyIndex]);

  const handleNavigateBack = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setCurrentPath(navigationHistory[newIndex]);
      setSelectedItems(new Set());
    }
  }, [navigationHistory, historyIndex]);

  const handleNavigateForward = useCallback(() => {
    if (historyIndex < navigationHistory.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setCurrentPath(navigationHistory[newIndex]);
      setSelectedItems(new Set());
    }
  }, [navigationHistory, historyIndex]);

  const handleNavigateUp = useCallback(() => {
    const pathParts = currentPath.split('\\').filter(part => part.length > 0);
    if (pathParts.length > 1) {
      const parentPath = pathParts.slice(0, -1).join('\\') + '\\';
      handleNavigate(parentPath);
    } else if (pathParts.length === 1) {
      // Go to root of drive
      handleNavigate(pathParts[0] + '\\');
    }
  }, [currentPath, handleNavigate]);

  const handleNavigateHome = useCallback(() => {
    const homePath = 'C:\\Users\\' + (process.env.USERNAME || 'User') + '\\';
    handleNavigate(homePath);
  }, [handleNavigate]);

  const handleItemSelect = (itemPath: string, multiSelect: boolean = false) => {
    if (multiSelect) {
      const newSelection = new Set(selectedItems);
      if (newSelection.has(itemPath)) {
        newSelection.delete(itemPath);
      } else {
        newSelection.add(itemPath);
      }
      setSelectedItems(newSelection);
    } else {
      setSelectedItems(new Set([itemPath]));
    }
  };

  const handleThemeToggle = () => {
    // This will be handled by the ThemeProvider context
    console.log('Theme toggle requested - handled by ThemeProvider');
  };

  const handleFiltersChange = (filters: FilterCriteria) => {
    setActiveFilters(filters);
    // TODO: Apply filters to content display
  };

  const handleSettingsOpen = () => {
    setShowSettings(true);
  };

  // Keyboard shortcut handlers
  const keyboardHandlers = {
    // Navigation
    onNavigateHome: handleNavigateHome,
    onNavigateBack: handleNavigateBack,
    onNavigateForward: handleNavigateForward,
    onNavigateUp: handleNavigateUp,
    
    // Selection
    onSelectAll: useCallback(() => {
      // TODO: Implement select all functionality
      console.log('Select all items');
    }, []),
    
    onClearSelection: useCallback(() => {
      setSelectedItems(new Set());
    }, []),
    
    // File operations
    onCopy: useCallback(() => {
      if (selectedItems.size > 0) {
        console.log('Copy selected items:', Array.from(selectedItems));
        // TODO: Implement copy functionality
      }
    }, [selectedItems]),
    
    onCut: useCallback(() => {
      if (selectedItems.size > 0) {
        console.log('Cut selected items:', Array.from(selectedItems));
        // TODO: Implement cut functionality
      }
    }, [selectedItems]),
    
    onPaste: useCallback(() => {
      console.log('Paste items to current path:', currentPath);
      // TODO: Implement paste functionality
    }, [currentPath]),
    
    onDelete: useCallback(() => {
      if (selectedItems.size > 0) {
        console.log('Delete selected items:', Array.from(selectedItems));
        // TODO: Show delete confirmation dialog
      }
    }, [selectedItems]),
    
    onRename: useCallback(() => {
      if (selectedItems.size === 1) {
        const itemPath = Array.from(selectedItems)[0];
        console.log('Rename item:', itemPath);
        // TODO: Implement rename functionality
      }
    }, [selectedItems]),
    
    // View operations
    onToggleFullscreen: useCallback(() => {
      if (selectedItems.size === 1) {
        const itemPath = Array.from(selectedItems)[0];
        console.log('Toggle fullscreen for item:', itemPath);
        setIsFullscreen(!isFullscreen);
        // TODO: Open fullscreen viewer
      }
    }, [selectedItems, isFullscreen]),
    
    onZoomIn: useCallback(() => {
      console.log('Zoom in');
      // TODO: Implement zoom functionality
    }, []),
    
    onZoomOut: useCallback(() => {
      console.log('Zoom out');
      // TODO: Implement zoom functionality
    }, []),
    
    onZoomReset: useCallback(() => {
      console.log('Reset zoom');
      // TODO: Implement zoom reset functionality
    }, []),
    
    // Search and favorites
    onFocusSearch: useCallback(() => {
      // This will be handled by the Toolbar component
      console.log('Focus search input');
    }, []),
    
    onAddToFavorites: useCallback(() => {
      if (selectedItems.size > 0) {
        const itemPath = Array.from(selectedItems)[0];
        console.log('Add to favorites:', itemPath);
        // TODO: Implement add to favorites functionality
      } else {
        // Add current folder to favorites
        console.log('Add current folder to favorites:', currentPath);
        // TODO: Implement add current folder to favorites
      }
    }, [selectedItems, currentPath]),
    
    onFindNext: useCallback(() => {
      console.log('Find next search result');
      // TODO: Implement find next functionality
    }, []),
    
    onFindPrevious: useCallback(() => {
      console.log('Find previous search result');
      // TODO: Implement find previous functionality
    }, []),
    
    // Application
    onOpenFolder: useCallback(() => {
      console.log('Open folder dialog');
      // TODO: Implement open folder dialog
    }, []),
    
    onRefresh: useCallback(() => {
      console.log('Refresh current view');
      // TODO: Implement refresh functionality
    }, []),
    
    onToggleProperties: useCallback(() => {
      console.log('Toggle properties panel');
      // TODO: Implement toggle properties panel
    }, []),
    
    onTogglePreview: useCallback(() => {
      console.log('Toggle preview panel');
      // TODO: Implement toggle preview panel
    }, []),

    onExport: useCallback(() => {
      if (selectedItems.size > 0) {
        const filesToExport = currentFiles.filter(file => selectedItems.has(file.path));
        openExportDialog(filesToExport);
      }
    }, [selectedItems, currentFiles, openExportDialog]),
  };

  // Drag and drop handlers
  const handleFilesToFolder = useCallback(async (files: MediaFile[], targetFolder: FolderItem) => {
    try {
      const result = await DragDropApi.moveFilesToFolder(files, targetFolder);
      if (result.success) {
        console.log('Successfully moved files to folder');
        // TODO: Refresh the current directory view
      } else {
        console.error('Failed to move files:', result.error);
        // TODO: Show error notification
      }
    } catch (error) {
      console.error('Error moving files to folder:', error);
      // TODO: Show error notification
    }
  }, []);

  const handleFilesToFavorites = useCallback(async (files: MediaFile[], targetFavorite: FavoriteFolder) => {
    try {
      const result = await DragDropApi.addFilesToFavorites(files);
      if (result.success) {
        console.log('Successfully added files to favorites');
        // TODO: Refresh favorites list
      } else {
        console.error('Failed to add files to favorites:', result.error);
        // TODO: Show error notification
      }
    } catch (error) {
      console.error('Error adding files to favorites:', error);
      // TODO: Show error notification
    }
  }, []);

  const handleFilesToTag = useCallback(async (files: MediaFile[], tag: HierarchicalTag) => {
    try {
      const result = await DragDropApi.assignTagsToFiles(files, [tag]);
      if (result.success) {
        console.log('Successfully tagged files');
        // TODO: Refresh file metadata display
      } else {
        console.error('Failed to tag files:', result.error);
        // TODO: Show error notification
      }
    } catch (error) {
      console.error('Error tagging files:', error);
      // TODO: Show error notification
    }
  }, []);

  const handleFolderToFavorites = useCallback(async (folder: FolderItem) => {
    try {
      const result = await DragDropApi.addFolderToFavorites(folder.name, folder.path);
      if (result.success) {
        console.log('Successfully added folder to favorites');
        // TODO: Refresh favorites list
      } else {
        console.error('Failed to add folder to favorites:', result.error);
        // TODO: Show error notification
      }
    } catch (error) {
      console.error('Error adding folder to favorites:', error);
      // TODO: Show error notification
    }
  }, []);

  const handleTagToFiles = useCallback(async (tag: HierarchicalTag, files: MediaFile[]) => {
    try {
      const result = await DragDropApi.assignTagsToFiles(files, [tag]);
      if (result.success) {
        console.log('Successfully applied tag to files');
        // TODO: Refresh file metadata display
      } else {
        console.error('Failed to apply tag to files:', result.error);
        // TODO: Show error notification
      }
    } catch (error) {
      console.error('Error applying tag to files:', error);
      // TODO: Show error notification
    }
  }, []);

  const handleReorderFavorites = useCallback(async (favoriteIds: string[]) => {
    try {
      const result = await DragDropApi.reorderFavorites(favoriteIds);
      if (result.success) {
        console.log('Successfully reordered favorites');
        // TODO: Refresh favorites list
      } else {
        console.error('Failed to reorder favorites:', result.error);
        // TODO: Show error notification
      }
    } catch (error) {
      console.error('Error reordering favorites:', error);
      // TODO: Show error notification
    }
  }, []);

  const handleReorganizeTags = useCallback(async (tagId: string, newParentId: string | null) => {
    try {
      const result = await DragDropApi.reorganizeTag(tagId, newParentId);
      if (result.success) {
        console.log('Successfully reorganized tag');
        // TODO: Refresh tag hierarchy
      } else {
        console.error('Failed to reorganize tag:', result.error);
        // TODO: Show error notification
      }
    } catch (error) {
      console.error('Error reorganizing tag:', error);
      // TODO: Show error notification
    }
  }, []);

  // Context menu handlers
  const contextMenuHandlers = {
    onEdit: useCallback(async (item: MediaFile) => {
      console.log('Edit file:', item);
      try {
        const result = await window.electronAPI?.editor?.openImage(item.path);
        if (result?.success) {
          console.log('Successfully opened image editor');
        } else {
          console.error('Failed to open image editor:', result?.error);
        }
      } catch (error) {
        console.error('Error opening image editor:', error);
      }
    }, []),

    onFullscreen: useCallback(async (item: MediaFile) => {
      console.log('Open fullscreen viewer:', item);
      try {
        // Get all media files in current directory for navigation
        const fileList = currentFiles.map(file => file.path);
        const result = await window.electronAPI?.viewer?.openFullscreen(item.path, fileList);
        if (result?.success) {
          console.log('Successfully opened fullscreen viewer');
        } else {
          console.error('Failed to open fullscreen viewer:', result?.error);
        }
      } catch (error) {
        console.error('Error opening fullscreen viewer:', error);
      }
    }, [currentFiles]),

    onAddTags: useCallback((items: (MediaFile | FolderItem)[]) => {
      console.log('Add tags to items:', items);
      // TODO: Open tag assignment dialog
    }, []),

    onRate: useCallback((items: MediaFile[], rating: number) => {
      console.log('Rate files:', items, 'Rating:', rating);
      // TODO: Apply rating to files
    }, []),

    onCopy: useCallback((items: (MediaFile | FolderItem)[]) => {
      console.log('Copy items:', items);
      // TODO: Copy items to clipboard
    }, []),

    onCut: useCallback((items: (MediaFile | FolderItem)[]) => {
      console.log('Cut items:', items);
      // TODO: Cut items to clipboard
    }, []),

    onDelete: useCallback((items: (MediaFile | FolderItem)[]) => {
      console.log('Delete items:', items);
      // TODO: Show delete confirmation dialog
    }, []),

    onProperties: useCallback((item: MediaFile | FolderItem) => {
      console.log('Show properties:', item);
      // TODO: Open properties dialog
    }, []),

    onOpen: useCallback((item: FolderItem) => {
      console.log('Open folder:', item);
      handleNavigate(item.path);
    }, [handleNavigate]),

    onAddFavorite: useCallback((item: FolderItem) => {
      console.log('Add folder to favorites:', item);
      handleFolderToFavorites(item);
    }, [handleFolderToFavorites]),

    onBatchTag: useCallback((items: MediaFile[]) => {
      console.log('Batch tag files:', items);
      // TODO: Open batch tag dialog
    }, []),

    onEditTag: useCallback((tag: HierarchicalTag) => {
      console.log('Edit tag:', tag);
      // TODO: Open tag edit dialog
    }, []),

    onDeleteTag: useCallback((tag: HierarchicalTag) => {
      console.log('Delete tag:', tag);
      // TODO: Show delete tag confirmation dialog
    }, []),

    onAddSubcategory: useCallback((tag: HierarchicalTag) => {
      console.log('Add subcategory to tag:', tag);
      // TODO: Open add subcategory dialog
    }, []),

    onExportTag: useCallback((tag: HierarchicalTag) => {
      console.log('Export tag:', tag);
      // TODO: Export tag hierarchy
    }, []),

    onRenameFavorite: useCallback((favorite: FavoriteFolder) => {
      console.log('Rename favorite:', favorite);
      // TODO: Open rename favorite dialog
    }, []),

    onRemoveFavorite: useCallback((favorite: FavoriteFolder) => {
      console.log('Remove favorite:', favorite);
      // TODO: Remove favorite from list
    }, []),

    onExport: useCallback((items: MediaFile[]) => {
      console.log('Export files:', items);
      openExportDialog(items);
    }, [openExportDialog]),

    onBatchExport: useCallback((items: MediaFile[]) => {
      console.log('Batch export files:', items);
      openExportDialog(items);
    }, [openExportDialog]),
  };

  // Theme initialization is now handled by ThemeProvider

  const navigationHistoryState = {
    canGoBack: historyIndex > 0,
    canGoForward: historyIndex < navigationHistory.length - 1,
  };

  return (
    <ToastProvider>
      <ErrorBoundary>
        <ContextMenuProvider handlers={contextMenuHandlers}>
          <KeyboardShortcutsProvider handlers={keyboardHandlers}>
        <DragDropProvider
          options={{
            onFilesToFolder: handleFilesToFolder,
            onFilesToFavorites: handleFilesToFavorites,
            onFilesToTag: handleFilesToTag,
            onFolderToFavorites: handleFolderToFavorites,
            onTagToFiles: handleTagToFiles,
            onReorderFavorites: handleReorderFavorites,
            onReorganizeTags: handleReorganizeTags,
          }}
        >
          <MainLayoutContent
              currentPath={currentPath}
              selectedItems={selectedItems}
              searchQuery={searchQuery}
              navigationHistory={navigationHistoryState}
              activeFilters={activeFilters}
              showKeyboardHelp={showKeyboardHelp}
              showSettings={showSettings}
              isFullscreen={isFullscreen}
              currentFiles={currentFiles}
              showExportDialog={showExportDialog}
              showProgressDialog={showProgressDialog}
              progress={progress}
              isExporting={isExporting}
              exportResult={exportResult}
              onNavigate={handleNavigate}
              onNavigateHome={handleNavigateHome}
              onNavigateBack={handleNavigateBack}
              onNavigateForward={handleNavigateForward}
              onNavigateUp={handleNavigateUp}
              onItemSelect={handleItemSelect}
              onThemeToggle={handleThemeToggle}
              onFiltersChange={handleFiltersChange}
              onSettingsOpen={() => setShowKeyboardHelp(true)}
              onSearchChange={setSearchQuery}
              onItemEdit={(item) => console.log('Edit item:', item)}
              onItemView={(item) => console.log('View item:', item)}
              onFilesChange={handleFilesChange}
              setShowKeyboardHelp={setShowKeyboardHelp}
              setShowSettings={setShowSettings}
              closeExportDialog={closeExportDialog}
              startExport={startExport}
              cancelExport={cancelExport}
              closeProgressDialog={closeProgressDialog}
            />
          </DragDropProvider>
        </KeyboardShortcutsProvider>
      </ContextMenuProvider>
    </ErrorBoundary>
  </ToastProvider>
  );
};

interface MainLayoutContentProps {
  currentPath: string;
  selectedItems: Set<string>;
  searchQuery: string;
  navigationHistory: { canGoBack: boolean; canGoForward: boolean };
  activeFilters: FilterCriteria;
  showKeyboardHelp: boolean;
  showSettings: boolean;
  isFullscreen: boolean;
  currentFiles: MediaFile[];
  showExportDialog: boolean;
  showProgressDialog: boolean;
  progress: any;
  isExporting: boolean;
  exportResult: any;
  onNavigate: (path: string) => void;
  onNavigateHome: () => void;
  onNavigateBack: () => void;
  onNavigateForward: () => void;
  onNavigateUp: () => void;
  onItemSelect: (itemPath: string, multiSelect?: boolean) => void;
  onThemeToggle: () => void;
  onFiltersChange: (filters: FilterCriteria) => void;
  onSettingsOpen: () => void;
  onSearchChange: (query: string) => void;
  onItemEdit: (item: MediaFile) => void;
  onItemView: (item: MediaFile) => void;
  onFilesChange: (files: MediaFile[]) => void;
  setShowKeyboardHelp: (show: boolean) => void;
  setShowSettings: (show: boolean) => void;
  closeExportDialog: () => void;
  startExport: (files: MediaFile[], settings: any) => void;
  cancelExport: () => void;
  closeProgressDialog: () => void;
}

const MainLayoutContent: React.FC<MainLayoutContentProps> = ({
  currentPath,
  selectedItems,
  searchQuery,
  navigationHistory,
  activeFilters,
  showKeyboardHelp,
  showSettings,
  currentFiles,
  showExportDialog,
  showProgressDialog,
  progress,
  isExporting,
  onNavigate,
  onNavigateHome,
  onNavigateBack,
  onNavigateForward,
  onNavigateUp,
  onItemSelect,
  onThemeToggle,
  onFiltersChange,
  onSettingsOpen,
  onSearchChange,
  onItemEdit,
  onItemView,
  onFilesChange,
  setShowKeyboardHelp,
  setShowSettings,
  closeExportDialog,
  startExport,
  cancelExport,
  closeProgressDialog,
}) => {
  return (
    <div className="main-layout">
      <Toolbar
        currentPath={currentPath}
        searchQuery={searchQuery}
        navigationHistory={navigationHistory}
        activeFilters={activeFilters}
        onSearchChange={onSearchChange}
        onNavigateHome={onNavigateHome}
        onNavigateBack={onNavigateBack}
        onNavigateForward={onNavigateForward}
        onNavigateUp={onNavigateUp}
        onThemeToggle={onThemeToggle}
        onFiltersChange={onFiltersChange}
        onSettingsOpen={onSettingsOpen}
      />

      <div className="content-area">
        <LeftPanel
          currentPath={currentPath}
          onNavigate={onNavigate}
        />

        <div style={{ padding: '20px', background: 'var(--bg-secondary)' }}>
          <ShadcnTest />
        </div>

        <RightPanel
          selectedItems={selectedItems}
          currentPath={currentPath}
          selectedFiles={currentFiles.filter(file => selectedItems.has(file.path))}
        />
      </div>

      <DragDropFeedback />
      
      <KeyboardShortcutsHelp
        isOpen={showKeyboardHelp}
        onClose={() => setShowKeyboardHelp(false)}
      />

      <SettingsDialog
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* Export Dialogs */}
      <ExportDialog
        isOpen={showExportDialog}
        files={currentFiles.filter(file => selectedItems.has(file.path))}
        onClose={closeExportDialog}
        onExport={(settings) => {
          const filesToExport = currentFiles.filter(file => selectedItems.has(file.path));
          startExport(filesToExport, settings);
        }}
      />

      <ExportProgressDialog
        isOpen={showProgressDialog}
        progress={progress || {
          current: 0,
          total: 0,
          currentFile: '',
          completed: false
        }}
        onCancel={isExporting ? cancelExport : undefined}
        onClose={closeProgressDialog}
      />
    </div>
  );
};