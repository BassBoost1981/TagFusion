// Electron API type definitions

export interface ElectronAPI {
  // App methods
  getVersion: () => Promise<string>;
  
  // File system methods
  fileSystem: {
    getDrives: () => Promise<any[]>;
    getDirectoryContents: (path: string) => Promise<any>;
    createDirectory?: (path: string) => Promise<{ success: boolean; error?: string }>;
    deleteFile?: (path: string) => Promise<{ success: boolean; error?: string }>;
    moveFile?: (sourcePath: string, targetPath: string) => Promise<{ success: boolean; error?: string }>;
    copyFile?: (sourcePath: string, targetPath: string) => Promise<{ success: boolean; error?: string }>;
    renameFile?: (oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>;
    getFileStats?: (path: string) => Promise<any>;
    watchDirectory?: (path: string, callback: (event: string, filename: string) => void) => Promise<void>;
    unwatchDirectory?: (path: string) => Promise<void>;
  };

  // Favorites methods
  favorites: {
    getFavorites: () => Promise<any[]>;
    addFavorite: (name: string, path: string) => Promise<{ success: boolean; error?: string }>;
    removeFavorite: (id: string) => Promise<{ success: boolean; error?: string }>;
    updateFavorite: (id: string, updates: any) => Promise<{ success: boolean; error?: string }>;
    reorderFavorites: (favoriteIds: string[]) => Promise<{ success: boolean; error?: string }>;
  };

  // Metadata methods
  metadata: {
    readMetadata: (filePath: string) => Promise<any>;
    writeMetadata: (filePath: string, metadata: any) => Promise<void>;
    writeRating: (filePath: string, rating: number) => Promise<{ success: boolean; error?: string }>;
    writeTags: (filePath: string, tags: any[]) => Promise<{ success: boolean; error?: string }>;
  };

  // Rating methods
  rating: {
    getRating: (filePath: string) => Promise<number>;
    setRating: (filePath: string, rating: number) => Promise<{ success: boolean; error?: string }>;
    setBatchRating: (filePaths: string[], rating: number) => Promise<{ success: boolean; error?: string }>;
    getAverageRating: (filePaths: string[]) => Promise<number>;
  };

  // Thumbnail methods
  thumbnails: {
    generateThumbnail: (filePath: string, size: number) => Promise<string>;
  };

  // Viewer methods
  viewer: {
    openFullscreen: (filePath: string, fileList?: string[]) => Promise<{ success: boolean; error?: string }>;
    close: () => Promise<{ success: boolean; error?: string }>;
  };

  // Editor methods
  editor: {
    openImage: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  };

  // Drag and drop methods
  dragDrop?: {
    moveFilesToFolder?: (files: any[], targetFolder: any) => Promise<{ success: boolean; error?: string }>;
    addFilesToFavorites?: (files: any[]) => Promise<{ success: boolean; error?: string }>;
    assignTagsToFiles?: (files: any[], tags: any[]) => Promise<{ success: boolean; error?: string }>;
    addFolderToFavorites?: (name: string, path: string) => Promise<{ success: boolean; error?: string }>;
    reorderFavorites?: (favoriteIds: string[]) => Promise<{ success: boolean; error?: string }>;
    reorganizeTag?: (tagId: string, newParentId: string | null) => Promise<{ success: boolean; error?: string }>;
  };
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};