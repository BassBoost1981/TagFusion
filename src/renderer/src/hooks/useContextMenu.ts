import { useState, useCallback } from 'react';
import { ContextMenuConfig, ContextMenuItem, ContextMenuAction, MediaFile, FolderItem, HierarchicalTag, FavoriteFolder } from '../../../types/global';

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
  // Favorite-specific handlers
  onRenameFavorite?: (favorite: FavoriteFolder) => void;
  onRemoveFavorite?: (favorite: FavoriteFolder) => void;
}

export const useContextMenu = (handlers: ContextMenuHandlers) => {
  const [contextMenu, setContextMenu] = useState<ContextMenuConfig | null>(null);

  const showContextMenu = useCallback((
    event: React.MouseEvent,
    target: MediaFile | FolderItem | HierarchicalTag | FavoriteFolder,
    targetType: 'file' | 'folder' | 'tag' | 'multiple' | 'favorite',
    selectedItems?: (MediaFile | FolderItem)[]
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const config: ContextMenuConfig = {
      items: generateMenuItems(targetType, target, selectedItems),
      position: { x: event.clientX, y: event.clientY },
      target,
      targetType,
      selectedItems
    };

    setContextMenu(config);
  }, []);

  const hideContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleContextMenuAction = useCallback((action: ContextMenuAction) => {
    const { type, target, selectedItems, payload } = action;

    switch (type) {
      case 'edit':
        if (target && 'type' in target) {
          handlers.onEdit?.(target as MediaFile);
        }
        break;

      case 'fullscreen':
        if (target && 'type' in target) {
          handlers.onFullscreen?.(target as MediaFile);
        }
        break;

      case 'addTags':
        if (selectedItems && selectedItems.length > 0) {
          handlers.onAddTags?.(selectedItems);
        } else if (target) {
          handlers.onAddTags?.([target as MediaFile | FolderItem]);
        }
        break;

      case 'rate':
        const mediaFiles = selectedItems?.filter(item => 'type' in item) as MediaFile[] || [];
        if (mediaFiles.length === 0 && target && 'type' in target) {
          mediaFiles.push(target as MediaFile);
        }
        if (mediaFiles.length > 0) {
          handlers.onRate?.(mediaFiles, payload);
        }
        break;

      case 'copy':
        if (selectedItems && selectedItems.length > 0) {
          handlers.onCopy?.(selectedItems);
        } else if (target) {
          handlers.onCopy?.([target as MediaFile | FolderItem]);
        }
        break;

      case 'cut':
        if (selectedItems && selectedItems.length > 0) {
          handlers.onCut?.(selectedItems);
        } else if (target) {
          handlers.onCut?.([target as MediaFile | FolderItem]);
        }
        break;

      case 'delete':
        if (selectedItems && selectedItems.length > 0) {
          handlers.onDelete?.(selectedItems);
        } else if (target) {
          handlers.onDelete?.([target as MediaFile | FolderItem]);
        }
        break;

      case 'properties':
        if (target) {
          handlers.onProperties?.(target as MediaFile | FolderItem);
        }
        break;

      case 'open':
        if (target && 'hasSubfolders' in target) {
          handlers.onOpen?.(target as FolderItem);
        }
        break;

      case 'addFavorite':
        if (target && 'hasSubfolders' in target) {
          handlers.onAddFavorite?.(target as FolderItem);
        }
        break;

      case 'batchTag':
        const files = selectedItems?.filter(item => 'type' in item) as MediaFile[] || [];
        if (files.length > 0) {
          handlers.onBatchTag?.(files);
        }
        break;

      case 'editTag':
        if (target && 'fullPath' in target) {
          handlers.onEditTag?.(target as HierarchicalTag);
        }
        break;

      case 'deleteTag':
        if (target && 'fullPath' in target) {
          handlers.onDeleteTag?.(target as HierarchicalTag);
        }
        break;

      case 'addSubcategory':
        if (target && 'fullPath' in target) {
          handlers.onAddSubcategory?.(target as HierarchicalTag);
        }
        break;

      case 'exportTag':
        if (target && 'fullPath' in target) {
          handlers.onExportTag?.(target as HierarchicalTag);
        }
        break;

      case 'renameFavorite':
        if (target && 'dateAdded' in target) {
          handlers.onRenameFavorite?.(target as FavoriteFolder);
        }
        break;

      case 'removeFavorite':
        if (target && 'dateAdded' in target) {
          handlers.onRemoveFavorite?.(target as FavoriteFolder);
        }
        break;
    }
  }, [handlers]);

  const generateMenuItems = (
    targetType: 'file' | 'folder' | 'tag' | 'multiple' | 'favorite',
    target: MediaFile | FolderItem | HierarchicalTag | FavoriteFolder,
    selectedItems?: (MediaFile | FolderItem)[]
  ): ContextMenuItem[] => {
    switch (targetType) {
      case 'file':
        return generateFileContextMenu(target as MediaFile);
      
      case 'folder':
        return generateFolderContextMenu(target as FolderItem);
      
      case 'tag':
        return generateTagContextMenu(target as HierarchicalTag);
      
      case 'multiple':
        return generateMultipleSelectionContextMenu(selectedItems || []);
      
      case 'favorite':
        return generateFavoriteContextMenu(target as FavoriteFolder);
      
      default:
        return [];
    }
  };

  const generateFileContextMenu = (file: MediaFile): ContextMenuItem[] => {
    const isImage = file.type === 'image';
    
    return [
      {
        id: 'edit',
        label: isImage ? 'Bearbeiten' : 'Wiedergeben',
        action: 'edit',
        shortcut: 'Enter',
        icon: isImage ? '✏️' : '▶️'
      },
      {
        id: 'fullscreen',
        label: 'Vollbild anzeigen',
        action: 'fullscreen',
        shortcut: 'F11',
        icon: '🔍'
      },
      {
        id: 'separator1',
        label: '',
        action: '',
        separator: true
      },
      {
        id: 'addTags',
        label: 'Tags hinzufügen',
        action: 'addTags',
        icon: '🏷️'
      },
      {
        id: 'rating',
        label: 'Bewertung',
        action: 'rating',
        icon: '⭐',
        submenu: [
          { id: 'rate1', label: '⭐', action: 'rate', value: 1 },
          { id: 'rate2', label: '⭐⭐', action: 'rate', value: 2 },
          { id: 'rate3', label: '⭐⭐⭐', action: 'rate', value: 3 },
          { id: 'rate4', label: '⭐⭐⭐⭐', action: 'rate', value: 4 },
          { id: 'rate5', label: '⭐⭐⭐⭐⭐', action: 'rate', value: 5 }
        ]
      },
      {
        id: 'separator2',
        label: '',
        action: '',
        separator: true
      },
      {
        id: 'copy',
        label: 'Kopieren',
        action: 'copy',
        shortcut: 'Ctrl+C',
        icon: '📋'
      },
      {
        id: 'cut',
        label: 'Ausschneiden',
        action: 'cut',
        shortcut: 'Ctrl+X',
        icon: '✂️'
      },
      {
        id: 'delete',
        label: 'Löschen',
        action: 'delete',
        shortcut: 'Delete',
        icon: '🗑️'
      },
      {
        id: 'separator3',
        label: '',
        action: '',
        separator: true
      },
      {
        id: 'properties',
        label: 'Eigenschaften',
        action: 'properties',
        icon: 'ℹ️'
      }
    ];
  };

  const generateFolderContextMenu = (folder: FolderItem): ContextMenuItem[] => {
    return [
      {
        id: 'open',
        label: 'Öffnen',
        action: 'open',
        shortcut: 'Enter',
        icon: '📁'
      },
      {
        id: 'addFavorite',
        label: 'Als Favorit hinzufügen',
        action: 'addFavorite',
        shortcut: 'F',
        icon: '⭐'
      },
      {
        id: 'separator1',
        label: '',
        action: '',
        separator: true
      },
      {
        id: 'batchTag',
        label: 'Alle Bilder taggen',
        action: 'batchTag',
        icon: '🏷️'
      },
      {
        id: 'separator2',
        label: '',
        action: '',
        separator: true
      },
      {
        id: 'properties',
        label: 'Eigenschaften',
        action: 'properties',
        icon: 'ℹ️'
      }
    ];
  };

  const generateTagContextMenu = (tag: HierarchicalTag): ContextMenuItem[] => {
    return [
      {
        id: 'editTag',
        label: 'Bearbeiten',
        action: 'editTag',
        icon: '✏️'
      },
      {
        id: 'addSubcategory',
        label: 'Neue Unterkategorie',
        action: 'addSubcategory',
        icon: '➕'
      },
      {
        id: 'separator1',
        label: '',
        action: '',
        separator: true
      },
      {
        id: 'deleteTag',
        label: 'Löschen',
        action: 'deleteTag',
        icon: '🗑️'
      },
      {
        id: 'separator2',
        label: '',
        action: '',
        separator: true
      },
      {
        id: 'exportTag',
        label: 'Exportieren',
        action: 'exportTag',
        icon: '📤'
      }
    ];
  };

  const generateMultipleSelectionContextMenu = (items: (MediaFile | FolderItem)[]): ContextMenuItem[] => {
    const hasFiles = items.some(item => 'type' in item);
    const hasFolders = items.some(item => 'hasSubfolders' in item);
    const fileCount = items.filter(item => 'type' in item).length;
    
    const menuItems: ContextMenuItem[] = [];

    if (hasFiles) {
      menuItems.push(
        {
          id: 'addTags',
          label: `${fileCount} Dateien taggen`,
          action: 'addTags',
          icon: '🏷️'
        },
        {
          id: 'rating',
          label: 'Bewertung setzen',
          action: 'rating',
          icon: '⭐',
          submenu: [
            { id: 'rate1', label: '⭐', action: 'rate', value: 1 },
            { id: 'rate2', label: '⭐⭐', action: 'rate', value: 2 },
            { id: 'rate3', label: '⭐⭐⭐', action: 'rate', value: 3 },
            { id: 'rate4', label: '⭐⭐⭐⭐', action: 'rate', value: 4 },
            { id: 'rate5', label: '⭐⭐⭐⭐⭐', action: 'rate', value: 5 }
          ]
        }
      );
    }

    menuItems.push(
      {
        id: 'separator1',
        label: '',
        action: '',
        separator: true
      },
      {
        id: 'copy',
        label: `${items.length} Elemente kopieren`,
        action: 'copy',
        shortcut: 'Ctrl+C',
        icon: '📋'
      },
      {
        id: 'cut',
        label: `${items.length} Elemente ausschneiden`,
        action: 'cut',
        shortcut: 'Ctrl+X',
        icon: '✂️'
      },
      {
        id: 'delete',
        label: `${items.length} Elemente löschen`,
        action: 'delete',
        shortcut: 'Delete',
        icon: '🗑️'
      }
    );

    return menuItems;
  };

  const generateFavoriteContextMenu = (favorite: FavoriteFolder): ContextMenuItem[] => {
    return [
      {
        id: 'renameFavorite',
        label: 'Umbenennen',
        action: 'renameFavorite',
        icon: '✏️'
      },
      {
        id: 'separator1',
        label: '',
        action: '',
        separator: true
      },
      {
        id: 'removeFavorite',
        label: 'Entfernen',
        action: 'removeFavorite',
        icon: '🗑️'
      }
    ];
  };

  return {
    contextMenu,
    showContextMenu,
    hideContextMenu,
    handleContextMenuAction
  };
};