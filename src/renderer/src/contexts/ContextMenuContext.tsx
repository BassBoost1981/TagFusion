import React, { createContext, useContext, ReactNode, useCallback } from 'react';
import { MediaFile, FolderItem, HierarchicalTag } from '../../../types/global';

export interface ContextMenuHandlers {
  onEdit?: (item: MediaFile) => void;
  onFullscreen?: (item: MediaFile) => void;
  onAddTags?: (items: (MediaFile | FolderItem)[]) => void;
  onRate?: (items: MediaFile[], rating: number) => void;
  onCopy?: (items: (MediaFile | FolderItem)[]) => void;
  onCut?: (items: (MediaFile | FolderItem)[]) => void;
  onDelete?: (items: (MediaFile | FolderItem)[]) => void;
  onProperties?: (item: MediaFile | FolderItem) => void;
  onOpen?: (item: FolderItem) => void;
  onAddFavorite?: (item: FolderItem) => void;
  onBatchTag?: (items: MediaFile[]) => void;
  onEditTag?: (tag: HierarchicalTag) => void;
  onDeleteTag?: (tag: HierarchicalTag) => void;
  onAddSubcategory?: (tag: HierarchicalTag) => void;
  onExportTag?: (tag: HierarchicalTag) => void;
  onRenameFavorite?: (favorite: any) => void;
  onRemoveFavorite?: (favorite: any) => void;
  onExport?: (items: MediaFile[]) => void;
  onBatchExport?: (items: MediaFile[]) => void;
}

interface ContextMenuContextType {
  showContextMenu: (
    event: React.MouseEvent,
    target: any,
    type: 'file' | 'folder' | 'tag' | 'favorite' | 'multiple',
    items?: any[]
  ) => void;
}

const ContextMenuContext = createContext<ContextMenuContextType | undefined>(undefined);

interface ContextMenuProviderProps {
  children: ReactNode;
  handlers: ContextMenuHandlers;
}

export const ContextMenuProvider: React.FC<ContextMenuProviderProps> = ({
  children,
  handlers,
}) => {
  const showContextMenu = useCallback((
    event: React.MouseEvent,
    target: any,
    type: 'file' | 'folder' | 'tag' | 'favorite' | 'multiple',
    items?: any[]
  ) => {
    event.preventDefault();
    event.stopPropagation();

    // For now, just log the context menu request
    // In a full implementation, this would show an actual context menu
    console.log('Context menu requested:', {
      type,
      target,
      items,
      position: { x: event.clientX, y: event.clientY },
    });

    // Mock context menu actions based on type
    switch (type) {
      case 'file':
        console.log('File context menu options:', [
          'Edit',
          'Fullscreen',
          'Add Tags',
          'Rate',
          'Copy',
          'Cut',
          'Delete',
          'Properties',
          'Export',
        ]);
        break;
      case 'folder':
        console.log('Folder context menu options:', [
          'Open',
          'Add to Favorites',
          'Batch Tag',
          'Copy',
          'Cut',
          'Delete',
          'Properties',
        ]);
        break;
      case 'tag':
        console.log('Tag context menu options:', [
          'Edit',
          'Delete',
          'Add Subcategory',
          'Export',
        ]);
        break;
      case 'favorite':
        console.log('Favorite context menu options:', [
          'Rename',
          'Remove',
        ]);
        break;
      case 'multiple':
        console.log('Multiple selection context menu options:', [
          'Add Tags',
          'Rate',
          'Copy',
          'Cut',
          'Delete',
          'Batch Export',
        ]);
        break;
    }
  }, []);

  const contextValue: ContextMenuContextType = {
    showContextMenu,
  };

  return (
    <ContextMenuContext.Provider value={contextValue}>
      {children}
    </ContextMenuContext.Provider>
  );
};

export const useContextMenuContext = (): ContextMenuContextType => {
  const context = useContext(ContextMenuContext);
  if (context === undefined) {
    throw new Error('useContextMenuContext must be used within a ContextMenuProvider');
  }
  return context;
};