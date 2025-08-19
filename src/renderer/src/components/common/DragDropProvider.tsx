import React, { createContext, useContext, ReactNode } from 'react';
import { MediaFile, FolderItem, HierarchicalTag, FavoriteFolder } from '../../../../types/global';

export interface DragDropOptions {
  onFilesToFolder?: (files: MediaFile[], targetFolder: FolderItem) => Promise<void>;
  onFilesToFavorites?: (files: MediaFile[], targetFavorite: FavoriteFolder) => Promise<void>;
  onFilesToTag?: (files: MediaFile[], tag: HierarchicalTag) => Promise<void>;
  onFolderToFavorites?: (folder: FolderItem) => Promise<void>;
  onTagToFiles?: (tag: HierarchicalTag, files: MediaFile[]) => Promise<void>;
  onReorderFavorites?: (favoriteIds: string[]) => Promise<void>;
  onReorganizeTags?: (tagId: string, newParentId: string | null) => Promise<void>;
}

interface DragDropContextType {
  options: DragDropOptions;
  isDragging: boolean;
  dragData: any;
  setDragData: (data: any) => void;
  clearDragData: () => void;
}

const DragDropContext = createContext<DragDropContextType | undefined>(undefined);

interface DragDropProviderProps {
  children: ReactNode;
  options: DragDropOptions;
}

export const DragDropProvider: React.FC<DragDropProviderProps> = ({
  children,
  options,
}) => {
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragData, setDragDataState] = React.useState<any>(null);

  const setDragData = React.useCallback((data: any) => {
    setDragDataState(data);
    setIsDragging(true);
  }, []);

  const clearDragData = React.useCallback(() => {
    setDragDataState(null);
    setIsDragging(false);
  }, []);

  const contextValue: DragDropContextType = {
    options,
    isDragging,
    dragData,
    setDragData,
    clearDragData,
  };

  return (
    <DragDropContext.Provider value={contextValue}>
      {children}
    </DragDropContext.Provider>
  );
};

export const useDragDropContext = (): DragDropContextType => {
  const context = useContext(DragDropContext);
  if (context === undefined) {
    throw new Error('useDragDropContext must be used within a DragDropProvider');
  }
  return context;
};