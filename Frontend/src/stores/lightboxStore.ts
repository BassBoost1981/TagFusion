import { create } from 'zustand';
import type { ImageFile } from '../types';

interface LightboxState {
  isOpen: boolean;
  currentImage: ImageFile | null;
  currentIndex: number;
  images: ImageFile[];
  zoomLevel: number;
  
  // Actions
  open: (image: ImageFile, images: ImageFile[]) => void;
  close: () => void;
  next: () => void;
  previous: () => void;
  goToIndex: (index: number) => void;
  setZoom: (level: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}

export const useLightboxStore = create<LightboxState>((set, get) => ({
  isOpen: false,
  currentImage: null,
  currentIndex: 0,
  images: [],
  zoomLevel: 100,

  open: (image, images) => {
    const index = images.findIndex(img => img.path === image.path);
    set({
      isOpen: true,
      currentImage: image,
      currentIndex: index >= 0 ? index : 0,
      images,
      zoomLevel: 100,
    });
  },

  close: () => {
    set({
      isOpen: false,
      currentImage: null,
      zoomLevel: 100,
    });
  },

  next: () => {
    const { images, currentIndex } = get();
    if (images.length === 0) return;
    
    const nextIndex = (currentIndex + 1) % images.length;
    set({
      currentIndex: nextIndex,
      currentImage: images[nextIndex],
      zoomLevel: 100,
    });
  },

  previous: () => {
    const { images, currentIndex } = get();
    if (images.length === 0) return;
    
    const prevIndex = currentIndex === 0 ? images.length - 1 : currentIndex - 1;
    set({
      currentIndex: prevIndex,
      currentImage: images[prevIndex],
      zoomLevel: 100,
    });
  },

  goToIndex: (index) => {
    const { images } = get();
    if (index >= 0 && index < images.length) {
      set({
        currentIndex: index,
        currentImage: images[index],
        zoomLevel: 100,
      });
    }
  },

  setZoom: (level) => {
    set({ zoomLevel: Math.max(50, Math.min(300, level)) });
  },

  zoomIn: () => {
    const { zoomLevel } = get();
    set({ zoomLevel: Math.min(300, zoomLevel + 25) });
  },

  zoomOut: () => {
    const { zoomLevel } = get();
    set({ zoomLevel: Math.max(50, zoomLevel - 25) });
  },

  resetZoom: () => {
    set({ zoomLevel: 100 });
  },
}));

