import { MediaFile } from '../../types/global';

export interface FullscreenViewerState {
  currentFile: MediaFile;
  fileList: MediaFile[];
  currentIndex: number;
  zoomLevel: number;
  panOffset: { x: number; y: number };
  slideshowActive: boolean;
  slideshowInterval: number;
  showInfo: boolean;
}

export interface ViewerAPI {
  // Open and close
  open: (file: MediaFile, fileList: MediaFile[]) => Promise<boolean>;
  close: () => Promise<boolean>;
  
  // Navigation
  next: () => Promise<boolean>;
  previous: () => Promise<boolean>;
  goToIndex: (index: number) => Promise<boolean>;
  
  // Zoom and Pan
  setZoom: (zoomLevel: number) => Promise<boolean>;
  setPan: (panOffset: { x: number; y: number }) => Promise<boolean>;
  resetView: () => Promise<boolean>;
  
  // Slideshow
  startSlideshow: (interval?: number) => Promise<boolean>;
  stopSlideshow: () => Promise<boolean>;
  setSlideshowInterval: (interval: number) => Promise<boolean>;
  
  // Info overlay
  toggleInfo: () => Promise<boolean>;
  setShowInfo: (show: boolean) => Promise<boolean>;
  
  // State
  getState: () => Promise<FullscreenViewerState | null>;
  
  // Events
  onStateChanged: (callback: (state: FullscreenViewerState) => void) => void;
}

// Implementation for renderer process
export const createViewerAPI = (): ViewerAPI => {
  return {
    open: (file: MediaFile, fileList: MediaFile[]) => 
      window.electronAPI.invoke('viewer:open', file, fileList),
    
    close: () => 
      window.electronAPI.invoke('viewer:close'),
    
    next: () => 
      window.electronAPI.invoke('viewer:next'),
    
    previous: () => 
      window.electronAPI.invoke('viewer:previous'),
    
    goToIndex: (index: number) => 
      window.electronAPI.invoke('viewer:goToIndex', index),
    
    setZoom: (zoomLevel: number) => 
      window.electronAPI.invoke('viewer:setZoom', zoomLevel),
    
    setPan: (panOffset: { x: number; y: number }) => 
      window.electronAPI.invoke('viewer:setPan', panOffset),
    
    resetView: () => 
      window.electronAPI.invoke('viewer:resetView'),
    
    startSlideshow: (interval?: number) => 
      window.electronAPI.invoke('viewer:startSlideshow', interval),
    
    stopSlideshow: () => 
      window.electronAPI.invoke('viewer:stopSlideshow'),
    
    setSlideshowInterval: (interval: number) => 
      window.electronAPI.invoke('viewer:setSlideshowInterval', interval),
    
    toggleInfo: () => 
      window.electronAPI.invoke('viewer:toggleInfo'),
    
    setShowInfo: (show: boolean) => 
      window.electronAPI.invoke('viewer:setShowInfo', show),
    
    getState: () => 
      window.electronAPI.invoke('viewer:getState'),
    
    onStateChanged: (callback: (state: FullscreenViewerState) => void) => {
      window.electronAPI.on('viewer:stateChanged', callback);
    }
  };
};