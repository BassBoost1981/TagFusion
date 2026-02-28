import { create } from 'zustand';
import type { ImageFile } from '../types';
import { LIGHTBOX_ZOOM_MIN, LIGHTBOX_ZOOM_MAX, LIGHTBOX_ZOOM_STEP, LIGHTBOX_ZOOM_DEFAULT } from '../constants/ui';

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
  zoomLevel: LIGHTBOX_ZOOM_DEFAULT,

  open: (image, images) => {
    const index = images.findIndex(img => img.path === image.path);
    set({
      isOpen: true,
      currentImage: image,
      currentIndex: index >= 0 ? index : 0,
      images,
      zoomLevel: LIGHTBOX_ZOOM_DEFAULT,
    });
  },

  close: () => {
    set({
      isOpen: false,
      currentImage: null,
      zoomLevel: LIGHTBOX_ZOOM_DEFAULT,
    });
  },

  next: () => {
    const { images, currentIndex } = get();
    if (images.length === 0) return;

    const nextIndex = (currentIndex + 1) % images.length;
    set({
      currentIndex: nextIndex,
      currentImage: images[nextIndex],
      zoomLevel: LIGHTBOX_ZOOM_DEFAULT,
    });
  },

  previous: () => {
    const { images, currentIndex } = get();
    if (images.length === 0) return;

    const prevIndex = currentIndex === 0 ? images.length - 1 : currentIndex - 1;
    set({
      currentIndex: prevIndex,
      currentImage: images[prevIndex],
      zoomLevel: LIGHTBOX_ZOOM_DEFAULT,
    });
  },

  goToIndex: (index) => {
    const { images } = get();
    if (index >= 0 && index < images.length) {
      set({
        currentIndex: index,
        currentImage: images[index],
        zoomLevel: LIGHTBOX_ZOOM_DEFAULT,
      });
    }
  },

  setZoom: (level) => {
    set({ zoomLevel: Math.max(LIGHTBOX_ZOOM_MIN, Math.min(LIGHTBOX_ZOOM_MAX, level)) });
  },

  zoomIn: () => {
    const { zoomLevel } = get();
    set({ zoomLevel: Math.min(LIGHTBOX_ZOOM_MAX, zoomLevel + LIGHTBOX_ZOOM_STEP) });
  },

  zoomOut: () => {
    const { zoomLevel } = get();
    set({ zoomLevel: Math.max(LIGHTBOX_ZOOM_MIN, zoomLevel - LIGHTBOX_ZOOM_STEP) });
  },

  resetZoom: () => {
    set({ zoomLevel: LIGHTBOX_ZOOM_DEFAULT });
  },
}));

