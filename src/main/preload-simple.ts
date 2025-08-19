import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App methods
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  
  // File system methods
  fileSystem: {
    getDrives: () => ipcRenderer.invoke('fs:getDrives'),
    getDirectoryContents: (path: string) => ipcRenderer.invoke('fs:getDirectoryContents', path),
  },

  // Favorites methods
  favorites: {
    getFavorites: () => ipcRenderer.invoke('favorites:getFavorites'),
    addFavorite: (name: string, path: string) => ipcRenderer.invoke('favorites:addFavorite', name, path),
    removeFavorite: (id: string) => ipcRenderer.invoke('favorites:removeFavorite', id),
    updateFavorite: (id: string, updates: any) => ipcRenderer.invoke('favorites:updateFavorite', id, updates),
    reorderFavorites: (favoriteIds: string[]) => ipcRenderer.invoke('favorites:reorderFavorites', favoriteIds),
  },

  // Metadata methods
  metadata: {
    readMetadata: (filePath: string) => ipcRenderer.invoke('metadata:read', filePath),
    writeMetadata: (filePath: string, metadata: any) => ipcRenderer.invoke('metadata:write', filePath, metadata),
    writeRating: (filePath: string, rating: number) => ipcRenderer.invoke('metadata:writeRating', filePath, rating),
    writeTags: (filePath: string, tags: any[]) => ipcRenderer.invoke('metadata:writeTags', filePath, tags),
  },

  // Rating methods
  rating: {
    getRating: (filePath: string) => ipcRenderer.invoke('rating:get', filePath),
    setRating: (filePath: string, rating: number) => ipcRenderer.invoke('rating:set', filePath, rating),
    setBatchRating: (filePaths: string[], rating: number) => ipcRenderer.invoke('rating:setBatch', filePaths, rating),
    getAverageRating: (filePaths: string[]) => ipcRenderer.invoke('rating:getAverage', filePaths),
  },

  // Thumbnail methods
  thumbnails: {
    generateThumbnail: (filePath: string, size: number) => ipcRenderer.invoke('image:generateThumbnail', filePath, size),
  },

  // Viewer methods
  viewer: {
    openFullscreen: (filePath: string, fileList?: string[]) => ipcRenderer.invoke('viewer:openFullscreen', filePath, fileList),
    close: () => ipcRenderer.invoke('viewer:close'),
  },

  // Editor methods
  editor: {
    openImage: (filePath: string) => ipcRenderer.invoke('editor:openImage', filePath),
  },
});