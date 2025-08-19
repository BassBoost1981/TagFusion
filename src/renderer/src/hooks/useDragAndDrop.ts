import { useState, useCallback, useRef, useEffect } from 'react';
import { MediaFile, FolderItem, HierarchicalTag, FavoriteFolder } from '../../../types/global';

export type DragDataType = 'files' | 'folders' | 'tags' | 'favorites';

export interface DragData {
  type: DragDataType;
  items: (MediaFile | FolderItem | HierarchicalTag | FavoriteFolder)[];
  sourceId?: string;
  previewText?: string;
}

export interface DropTarget {
  type: 'folder' | 'favorite' | 'tag' | 'favorites-list' | 'tag-hierarchy';
  id: string;
  data?: any;
  element?: HTMLElement;
}

export interface DragState {
  isDragging: boolean;
  dragData: DragData | null;
  dragPreview: string;
  dropTarget: DropTarget | null;
  isValidDrop: boolean;
  dragPosition: { x: number; y: number };
}

export interface DragDropHandlers {
  onDragStart: (data: DragData, event: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (target: DropTarget, event: React.DragEvent) => void;
  onDragLeave: (event: React.DragEvent) => void;
  onDrop: (target: DropTarget, event: React.DragEvent) => void;
  onDragEnter: (target: DropTarget, event: React.DragEvent) => void;
}

export interface DragVisualFeedback {
  showDropZone: boolean;
  dropZoneType: 'folder' | 'favorite' | 'tag' | 'favorites-list';
  isValidDrop: boolean;
  previewText: string;
  dragPosition: { x: number; y: number };
}

export interface UseDragAndDropOptions {
  onFilesToFolder?: (files: MediaFile[], targetFolder: FolderItem) => void;
  onFilesToFavorites?: (files: MediaFile[], targetFavorite: FavoriteFolder) => void;
  onFilesToTag?: (files: MediaFile[], tag: HierarchicalTag) => void;
  onFolderToFavorites?: (folder: FolderItem) => void;
  onTagToFiles?: (tag: HierarchicalTag, files: MediaFile[]) => void;
  onReorderFavorites?: (favoriteIds: string[]) => void;
  onReorganizeTags?: (tagId: string, newParentId: string | null) => void;
}

export const useDragAndDrop = (options: UseDragAndDropOptions = {}) => {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    dragData: null,
    dragPreview: '',
    dropTarget: null,
    isValidDrop: false,
    dragPosition: { x: 0, y: 0 },
  });

  const dragImageRef = useRef<HTMLElement | null>(null);
  const dragPreviewRef = useRef<HTMLDivElement | null>(null);
  const activeDropZones = useRef<Set<HTMLElement>>(new Set());

  // Create drag preview element
  useEffect(() => {
    if (!dragPreviewRef.current) {
      const previewElement = document.createElement('div');
      previewElement.className = 'drag-preview';
      previewElement.style.cssText = `
        position: fixed;
        top: -1000px;
        left: -1000px;
        background: var(--color-primary);
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        pointer-events: none;
        z-index: 10000;
        white-space: nowrap;
        opacity: 0.9;
      `;
      document.body.appendChild(previewElement);
      dragPreviewRef.current = previewElement;
    }

    return () => {
      if (dragPreviewRef.current) {
        document.body.removeChild(dragPreviewRef.current);
        dragPreviewRef.current = null;
      }
    };
  }, []);

  // Update drag preview position
  useEffect(() => {
    if (dragState.isDragging && dragPreviewRef.current) {
      const preview = dragPreviewRef.current;
      preview.textContent = dragState.dragPreview;
      preview.style.left = `${dragState.dragPosition.x + 10}px`;
      preview.style.top = `${dragState.dragPosition.y - 10}px`;
      preview.style.display = 'block';
    } else if (dragPreviewRef.current) {
      dragPreviewRef.current.style.display = 'none';
    }
  }, [dragState.isDragging, dragState.dragPreview, dragState.dragPosition]);

  // Track mouse position during drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dragState.isDragging) {
        setDragState(prev => ({
          ...prev,
          dragPosition: { x: e.clientX, y: e.clientY },
        }));
      }
    };

    if (dragState.isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      return () => document.removeEventListener('mousemove', handleMouseMove);
    }
  }, [dragState.isDragging]);

  const createDragPreview = useCallback((data: DragData): string => {
    if (data.previewText) {
      return data.previewText;
    }

    const count = data.items.length;
    
    if (count === 1) {
      const item = data.items[0];
      let name = 'Unknown';
      
      if ('name' in item) {
        name = item.name;
      } else if ('tag' in item) {
        name = item.tag;
      } else if ('fullPath' in item) {
        name = (item as HierarchicalTag).fullPath;
      }
      
      return name;
    }
    
    // Pluralize based on type
    const typeMap: Record<DragDataType, string> = {
      files: count === 1 ? 'file' : 'files',
      folders: count === 1 ? 'folder' : 'folders',
      tags: count === 1 ? 'tag' : 'tags',
      favorites: count === 1 ? 'favorite' : 'favorites',
    };
    
    return `${count} ${typeMap[data.type]}`;
  }, []);

  const validateDrop = useCallback((dragData: DragData, target: DropTarget): boolean => {
    if (!dragData || !target) return false;

    // Prevent dropping on self
    if (dragData.sourceId === target.id) return false;

    switch (dragData.type) {
      case 'files':
        return target.type === 'folder' || 
               target.type === 'favorite' || 
               target.type === 'tag' ||
               target.type === 'favorites-list'; // For adding files to favorites
      
      case 'folders':
        return target.type === 'favorites-list' || target.type === 'folder'; // For moving folders
      
      case 'tags':
        return target.type === 'tag' || target.type === 'tag-hierarchy'; // For tag reorganization
      
      case 'favorites':
        return target.type === 'favorites-list'; // For reordering favorites
      
      default:
        return false;
    }
  }, []);

  const handleDragStart = useCallback((data: DragData, event: React.DragEvent) => {
    const preview = createDragPreview(data);
    
    setDragState({
      isDragging: true,
      dragData: data,
      dragPreview: preview,
      dropTarget: null,
      isValidDrop: false,
      dragPosition: { x: event.clientX, y: event.clientY },
    });

    // Set drag data for external drops and cross-component communication
    event.dataTransfer.effectAllowed = 'copyMove';
    event.dataTransfer.setData('application/json', JSON.stringify(data));
    event.dataTransfer.setData('text/plain', preview);
    
    // Set specific data types for better compatibility
    if (data.type === 'files') {
      const filePaths = data.items.map(item => (item as MediaFile).path);
      event.dataTransfer.setData('text/uri-list', filePaths.join('\n'));
    }

    // Create invisible drag image to use our custom preview
    const dragImage = document.createElement('div');
    dragImage.style.cssText = 'position: absolute; top: -1000px; width: 1px; height: 1px; opacity: 0;';
    document.body.appendChild(dragImage);
    event.dataTransfer.setDragImage(dragImage, 0, 0);
    
    // Clean up drag image after drag starts
    setTimeout(() => {
      if (document.body.contains(dragImage)) {
        document.body.removeChild(dragImage);
      }
    }, 0);

    // Add drag class to body for global styling
    document.body.classList.add('dragging');
  }, [createDragPreview]);

  const handleDragEnd = useCallback(() => {
    setDragState({
      isDragging: false,
      dragData: null,
      dragPreview: '',
      dropTarget: null,
      isValidDrop: false,
      dragPosition: { x: 0, y: 0 },
    });

    // Remove drag class from body
    document.body.classList.remove('dragging');
    
    // Clear all drop zone highlights
    activeDropZones.current.forEach(element => {
      element.classList.remove('drag-over', 'drag-valid', 'drag-invalid');
    });
    activeDropZones.current.clear();
  }, []);

  const handleDragEnter = useCallback((target: DropTarget, event: React.DragEvent) => {
    event.preventDefault();
    
    if (!dragState.dragData) return;
    
    const isValid = validateDrop(dragState.dragData, target);
    const element = event.currentTarget as HTMLElement;
    
    // Add visual feedback classes
    element.classList.add('drag-over');
    element.classList.add(isValid ? 'drag-valid' : 'drag-invalid');
    activeDropZones.current.add(element);
    
    setDragState(prev => ({
      ...prev,
      dropTarget: target,
      isValidDrop: isValid,
    }));
  }, [dragState.dragData, validateDrop]);

  const handleDragOver = useCallback((target: DropTarget, event: React.DragEvent) => {
    event.preventDefault();
    
    if (!dragState.dragData) return;
    
    const isValid = validateDrop(dragState.dragData, target);
    
    // Update drop effect
    event.dataTransfer.dropEffect = isValid ? 'move' : 'none';
    
    // Ensure state is updated
    setDragState(prev => ({
      ...prev,
      dropTarget: target,
      isValidDrop: isValid,
    }));
  }, [dragState.dragData, validateDrop]);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    const element = event.currentTarget as HTMLElement;
    
    // Only remove classes if we're actually leaving this element
    // (not just moving to a child element)
    if (!element.contains(event.relatedTarget as Node)) {
      element.classList.remove('drag-over', 'drag-valid', 'drag-invalid');
      activeDropZones.current.delete(element);
      
      setDragState(prev => ({
        ...prev,
        dropTarget: null,
        isValidDrop: false,
      }));
    }
  }, []);

  const handleDrop = useCallback((target: DropTarget, event: React.DragEvent) => {
    event.preventDefault();
    
    const { dragData } = dragState;
    if (!dragData || !validateDrop(dragData, target)) {
      handleDragEnd();
      return;
    }

    // Handle different drop scenarios
    switch (dragData.type) {
      case 'files':
        const files = dragData.items as MediaFile[];
        
        if (target.type === 'folder' && options.onFilesToFolder) {
          options.onFilesToFolder(files, target.data as FolderItem);
        } else if (target.type === 'favorite' && options.onFilesToFavorites) {
          options.onFilesToFavorites(files, target.data as FavoriteFolder);
        } else if (target.type === 'tag' && options.onFilesToTag) {
          options.onFilesToTag(files, target.data as HierarchicalTag);
        }
        break;

      case 'folders':
        if (target.type === 'favorites-list' && options.onFolderToFavorites) {
          const folder = dragData.items[0] as FolderItem;
          options.onFolderToFavorites(folder);
        }
        break;

      case 'tags':
        if (target.type === 'tag' && options.onReorganizeTags) {
          const tag = dragData.items[0] as HierarchicalTag;
          const targetTag = target.data as HierarchicalTag;
          // This would need tag IDs, which we'd need to add to HierarchicalTag
          console.log('Tag reorganization not fully implemented yet');
        }
        break;

      case 'favorites':
        if (target.type === 'favorites-list' && options.onReorderFavorites) {
          // Handle favorite reordering
          console.log('Favorite reordering handled by Favorites component');
        }
        break;
    }

    handleDragEnd();
  }, [dragState, validateDrop, options, handleDragEnd]);

  const handlers: DragDropHandlers = {
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
    onDragEnter: handleDragEnter,
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
  };

  const visualFeedback: DragVisualFeedback = {
    showDropZone: dragState.isDragging,
    dropZoneType: dragState.dropTarget?.type || 'folder',
    isValidDrop: dragState.isValidDrop,
    previewText: dragState.dragPreview,
    dragPosition: dragState.dragPosition,
  };

  return {
    dragState,
    handlers,
    visualFeedback,
    dragImageRef,
    dragPreviewRef,
  };
};