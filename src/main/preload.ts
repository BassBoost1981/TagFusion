import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App methods
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  
  // File system methods (will be added as we implement features)
  getDrives: () => ipcRenderer.invoke('fs:getDrives'),
  getDirectoryContents: (path: string) => ipcRenderer.invoke('fs:getDirectoryContents', path),
  
  // Metadata methods
  readMetadata: (filePath: string) => ipcRenderer.invoke('metadata:read', filePath),
  writeMetadata: (filePath: string, metadata: any) => ipcRenderer.invoke('metadata:write', filePath, metadata),
  
  // Image processing methods
  generateThumbnail: (filePath: string, size: number) => ipcRenderer.invoke('image:generateThumbnail', filePath, size),
  
  // Configuration methods
  loadSettings: () => ipcRenderer.invoke('config:load'),
  saveSettings: (settings: any) => ipcRenderer.invoke('config:save', settings),
  
  // Editor methods
  editor: {
    open: (file: any) => ipcRenderer.invoke('editor:open', file),
    close: (filePath: string) => ipcRenderer.invoke('editor:close', filePath),
    save: (filePath: string, operations: any[]) => ipcRenderer.invoke('editor:save', filePath, operations),
    saveCanvas: (canvasDataUrl: string, outputPath: string, quality?: number) => ipcRenderer.invoke('editor:saveCanvas', canvasDataUrl, outputPath, quality),
    getWindowId: (filePath: string) => ipcRenderer.invoke('editor:getWindowId', filePath),
  },

  // Viewer methods
  viewer: {
    open: (file: any, fileList: any[]) => ipcRenderer.invoke('viewer:open', file, fileList),
    close: () => ipcRenderer.invoke('viewer:close'),
    next: () => ipcRenderer.invoke('viewer:next'),
    previous: () => ipcRenderer.invoke('viewer:previous'),
    goToIndex: (index: number) => ipcRenderer.invoke('viewer:goToIndex', index),
    setZoom: (zoomLevel: number) => ipcRenderer.invoke('viewer:setZoom', zoomLevel),
    setPan: (panOffset: { x: number; y: number }) => ipcRenderer.invoke('viewer:setPan', panOffset),
    resetView: () => ipcRenderer.invoke('viewer:resetView'),
    startSlideshow: (interval?: number) => ipcRenderer.invoke('viewer:startSlideshow', interval),
    stopSlideshow: () => ipcRenderer.invoke('viewer:stopSlideshow'),
    setSlideshowInterval: (interval: number) => ipcRenderer.invoke('viewer:setSlideshowInterval', interval),
    toggleInfo: () => ipcRenderer.invoke('viewer:toggleInfo'),
    setShowInfo: (show: boolean) => ipcRenderer.invoke('viewer:setShowInfo', show),
    getState: () => ipcRenderer.invoke('viewer:getState'),
    onStateChanged: (callback: (state: any) => void) => {
      ipcRenderer.on('viewer:stateChanged', (_, state) => callback(state));
    },
  },

  // Metadata methods (extended)
  metadata: {
    read: (filePath: string) => ipcRenderer.invoke('metadata:read', filePath),
    write: (filePath: string, metadata: any) => ipcRenderer.invoke('metadata:write', filePath, metadata),
    readExif: (filePath: string) => ipcRenderer.invoke('metadata:readExif', filePath),
  },

  // Tag system methods
  tags: {
    getHierarchy: () => ipcRenderer.invoke('tags:getHierarchy'),
    createTag: (parentId: string | null, name: string) => ipcRenderer.invoke('tags:createTag', parentId, name),
    updateTag: (tagId: string, name: string) => ipcRenderer.invoke('tags:updateTag', tagId, name),
    deleteTag: (tagId: string) => ipcRenderer.invoke('tags:deleteTag', tagId),
    assignToFiles: (filePaths: string[], tagIds: string[]) => ipcRenderer.invoke('tags:assignToFiles', filePaths, tagIds),
    removeFromFiles: (filePaths: string[], tagIds: string[]) => ipcRenderer.invoke('tags:removeFromFiles', filePaths, tagIds),
  },

  // Rating methods
  rating: {
    setRating: (filePath: string, rating: number) => ipcRenderer.invoke('rating:setRating', filePath, rating),
    getRating: (filePath: string) => ipcRenderer.invoke('rating:getRating', filePath),
    setBatchRating: (filePaths: string[], rating: number) => ipcRenderer.invoke('rating:setBatchRating', filePaths, rating),
  },

  // Export methods
  export: {
    single: (file: any, settings: any) => ipcRenderer.invoke('export:single', file, settings),
    multiple: (files: any[], settings: any) => ipcRenderer.invoke('export:multiple', files, settings),
    selectDirectory: () => ipcRenderer.invoke('export:selectDirectory'),
    cancel: () => ipcRenderer.invoke('export:cancel'),
    getPresets: () => ipcRenderer.invoke('export:getPresets'),
    removeProgressListener: () => ipcRenderer.invoke('export:removeProgressListener'),
  },

  // Video methods
  video: {
    generateThumbnail: (filePath: string, options: any) => ipcRenderer.invoke('video:generateThumbnail', filePath, options),
    extractMetadata: (filePath: string) => ipcRenderer.invoke('video:extractMetadata', filePath),
    isVideoFile: (filePath: string) => ipcRenderer.invoke('video:isVideoFile', filePath),
    getSupportedFormats: () => ipcRenderer.invoke('video:getSupportedFormats'),
    generateBatchThumbnails: (filePaths: string[], options: any) => ipcRenderer.invoke('video:generateBatchThumbnails', filePaths, options),
    extractBatchMetadata: (filePaths: string[]) => ipcRenderer.invoke('video:extractBatchMetadata', filePaths),
  },

  // Convenience method for video thumbnails (for backward compatibility)
  generateVideoThumbnail: (filePath: string, options: any) => ipcRenderer.invoke('video:generateThumbnail', filePath, options),

  // General IPC methods
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
  on: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.on(channel, (_, ...args) => callback(...args));
  },
});

// Type definitions for the exposed API
export interface ElectronAPI {
  getVersion: () => Promise<string>;
  getDrives: () => Promise<any[]>;
  getDirectoryContents: (path: string) => Promise<any>;
  readMetadata: (filePath: string) => Promise<any>;
  writeMetadata: (filePath: string, metadata: any) => Promise<void>;
  generateThumbnail: (filePath: string, size: number) => Promise<string>;
  loadSettings: () => Promise<any>;
  saveSettings: (settings: any) => Promise<void>;
  editor: {
    open: (file: any) => Promise<{ success: boolean; windowId?: number; error?: string }>;
    close: (filePath: string) => Promise<{ success: boolean; error?: string }>;
    save: (filePath: string, operations: any[]) => Promise<{ success: boolean; outputPath?: string; error?: string }>;
    saveCanvas: (canvasDataUrl: string, outputPath: string, quality?: number) => Promise<{ success: boolean; error?: string }>;
    getWindowId: (filePath: string) => Promise<number | null>;
  };
  viewer: {
    open: (file: any, fileList: any[]) => Promise<boolean>;
    close: () => Promise<boolean>;
    next: () => Promise<boolean>;
    previous: () => Promise<boolean>;
    goToIndex: (index: number) => Promise<boolean>;
    setZoom: (zoomLevel: number) => Promise<boolean>;
    setPan: (panOffset: { x: number; y: number }) => Promise<boolean>;
    resetView: () => Promise<boolean>;
    startSlideshow: (interval?: number) => Promise<boolean>;
    stopSlideshow: () => Promise<boolean>;
    setSlideshowInterval: (interval: number) => Promise<boolean>;
    toggleInfo: () => Promise<boolean>;
    setShowInfo: (show: boolean) => Promise<boolean>;
    getState: () => Promise<any>;
    onStateChanged: (callback: (state: any) => void) => void;
  };
  metadata: {
    read: (filePath: string) => Promise<any>;
    write: (filePath: string, metadata: any) => Promise<void>;
    readExif: (filePath: string) => Promise<any>;
  };
  tags: {
    getHierarchy: () => Promise<any[]>;
    createTag: (parentId: string | null, name: string) => Promise<any>;
    updateTag: (tagId: string, name: string) => Promise<any>;
    deleteTag: (tagId: string) => Promise<any>;
    assignToFiles: (filePaths: string[], tagIds: string[]) => Promise<any>;
    removeFromFiles: (filePaths: string[], tagIds: string[]) => Promise<any>;
  };
  rating: {
    setRating: (filePath: string, rating: number) => Promise<any>;
    getRating: (filePath: string) => Promise<number>;
    setBatchRating: (filePaths: string[], rating: number) => Promise<any>;
  };
  export: {
    single: (file: any, settings: any) => Promise<any>;
    multiple: (files: any[], settings: any) => Promise<any>;
    selectDirectory: () => Promise<string | null>;
    cancel: () => Promise<boolean>;
    getPresets: () => Promise<any>;
    removeProgressListener: () => Promise<boolean>;
  };
  video: {
    generateThumbnail: (filePath: string, options: any) => Promise<any>;
    extractMetadata: (filePath: string) => Promise<any>;
    isVideoFile: (filePath: string) => Promise<boolean>;
    getSupportedFormats: () => Promise<string[]>;
    generateBatchThumbnails: (filePaths: string[], options: any) => Promise<Map<string, any>>;
    extractBatchMetadata: (filePaths: string[]) => Promise<Map<string, any>>;
  };
  generateVideoThumbnail: (filePath: string, options: any) => Promise<any>;
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  on: (channel: string, callback: (...args: any[]) => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}