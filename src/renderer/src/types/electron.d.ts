// Electron API types for renderer process
export interface ElectronAPI {
  fileSystem: {
    getDrives(): Promise<any[]>;
    getDirectoryContents(path: string): Promise<any>;
    createDirectory(path: string): Promise<{ success: boolean; error?: string }>;
    deleteFile(path: string): Promise<{ success: boolean; error?: string }>;
    moveFile(sourcePath: string, targetPath: string): Promise<{ success: boolean; error?: string }>;
    copyFile(sourcePath: string, targetPath: string): Promise<{ success: boolean; error?: string }>;
    renameFile(oldPath: string, newPath: string): Promise<{ success: boolean; error?: string }>;
    getFileStats(path: string): Promise<any>;
    watchDirectory(path: string, callback: (event: string, filename: string) => void): Promise<void>;
    unwatchDirectory(path: string): Promise<void>;
  };
  metadata: {
    readMetadata(filePath: string): Promise<any>;
    writeMetadata(filePath: string, metadata: any): Promise<void>;
  };
  thumbnails: {
    generateThumbnail(filePath: string, size: number): Promise<string>;
    getThumbnail(filePath: string): Promise<string | null>;
  };
  favorites: {
    getFavorites(): Promise<any[]>;
    addFavorite(name: string, path: string): Promise<{ success: boolean; error?: string }>;
    removeFavorite(id: string): Promise<{ success: boolean; error?: string }>;
    updateFavorite(id: string, updates: any): Promise<{ success: boolean; error?: string }>;
    reorderFavorites(favoriteIds: string[]): Promise<{ success: boolean; error?: string }>;
  };
  tags: {
    getTagHierarchy(): Promise<any[]>;
    createTag(parentId: string | null, name: string): Promise<{ success: boolean; error?: string }>;
    updateTag(tagId: string, name: string): Promise<{ success: boolean; error?: string }>;
    deleteTag(tagId: string): Promise<{ success: boolean; error?: string }>;
    assignTagsToFiles(filePaths: string[], tagIds: string[]): Promise<{ success: boolean; error?: string }>;
  };
  export: {
    exportFiles(files: any[], settings: any): Promise<{ success: boolean; error?: string }>;
  };
  editor: {
    openEditor(filePath: string): Promise<void>;
  };
  viewer: {
    openViewer(filePath: string): Promise<void>;
  };
  configuration: {
    getSettings(): Promise<any>;
    saveSettings(settings: any): Promise<{ success: boolean; error?: string }>;
    exportConfiguration(): Promise<{ success: boolean; data?: any; error?: string }>;
    importConfiguration(data: any): Promise<{ success: boolean; error?: string }>;
  };
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};