import { StateCreator } from 'zustand';
import { ImageSlice, normalizeGridItems } from './imageSlice';
import type { Tag, ImageFile } from '../../types';
import { bridge } from '../../services/bridge';
import { NavigationSlice } from './navigationSlice';
import {
  GRID_ZOOM_MIN,
  GRID_ZOOM_MAX,
  GRID_ZOOM_STEP,
  GRID_ZOOM_DEFAULT,
  SIDEBAR_WIDTH_DEFAULT,
  TAG_PANEL_WIDTH_DEFAULT,
} from '../../constants/ui';

export interface UISlice {
  tags: Tag[];
  error: string | null;
  sidebarWidth: number;
  tagPanelWidth: number;
  zoomLevel: number;
  searchQuery: string;
  sortBy: 'name' | 'date' | 'size' | 'rating';
  sortOrder: 'asc' | 'desc';
  filterRating: number | null;
  filterTags: string[];
  // Global search mode — cross-folder DB search
  isGlobalSearch: boolean;
  isSearching: boolean;
  searchResults: ImageFile[];

  loadAllTags: () => Promise<void>;
  setSidebarWidth: (width: number) => void;
  setTagPanelWidth: (width: number) => void;
  setError: (error: string | null) => void;
  setZoomLevel: (level: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setSearchQuery: (query: string) => void;
  setSortBy: (sortBy: 'name' | 'date' | 'size' | 'rating') => void;
  setSortOrder: (order: 'asc' | 'desc') => void;
  toggleSortOrder: () => void;
  setFilterRating: (rating: number | null) => void;
  setFilterTags: (tags: string[]) => void;
  clearFilters: () => void;
  setupSubscriptions: () => void;
  // Global search: search DB across all folders by tags/rating
  executeGlobalSearch: (tags?: string[], minRating?: number) => Promise<void>;
  exitGlobalSearch: () => void;
}

export const createUISlice: StateCreator<
  UISlice & ImageSlice & NavigationSlice,
  [],
  [],
  UISlice
> = (set, get) => ({
  tags: [],
  error: null,
  sidebarWidth: SIDEBAR_WIDTH_DEFAULT,
  tagPanelWidth: TAG_PANEL_WIDTH_DEFAULT,
  zoomLevel: GRID_ZOOM_DEFAULT,
  searchQuery: '',
  sortBy: 'name',
  sortOrder: 'asc',
  filterRating: null,
  filterTags: [],
  isGlobalSearch: false,
  isSearching: false,
  searchResults: [],

  loadAllTags: async () => {
    try {
      const tags = await bridge.getAllTags();
      set({ tags });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  setTagPanelWidth: (width) => set({ tagPanelWidth: width }),
  setError: (error) => set({ error }),
  setZoomLevel: (level) => set({ zoomLevel: Math.min(GRID_ZOOM_MAX, Math.max(GRID_ZOOM_MIN, level)) }),

  zoomIn: () =>
    set((state) => ({
      zoomLevel: Math.min(GRID_ZOOM_MAX, state.zoomLevel + GRID_ZOOM_STEP),
    })),

  zoomOut: () =>
    set((state) => ({
      zoomLevel: Math.max(GRID_ZOOM_MIN, state.zoomLevel - GRID_ZOOM_STEP),
    })),

  setSearchQuery: (query) => set({ searchQuery: query }),
  setSortBy: (sortBy) => set({ sortBy }),
  setSortOrder: (order) => set({ sortOrder: order }),
  toggleSortOrder: () => set((state) => ({ sortOrder: state.sortOrder === 'asc' ? 'desc' : 'asc' })),
  setFilterRating: (rating) => set({ filterRating: rating }),
  setFilterTags: (tags) => set({ filterTags: tags }),
  clearFilters: () => {
    const wasGlobal = get().isGlobalSearch;
    set({ searchQuery: '', filterRating: null, filterTags: [], sortBy: 'name', sortOrder: 'asc', isGlobalSearch: false, isSearching: false, searchResults: [] });
    // If we were in global search mode, reload current folder to restore normal view
    if (wasGlobal) {
      const folder = get().currentFolder;
      if (folder) get().loadImages(folder);
    }
  },

  executeGlobalSearch: async (tags, minRating) => {
    set({ isGlobalSearch: true, isSearching: true });
    try {
      const results = await bridge.searchImages(tags, minRating, 200);
      set({ searchResults: results, isSearching: false });
    } catch (error) {
      set({ isSearching: false, error: (error as Error).message });
    }
  },

  exitGlobalSearch: () => {
    set({ isGlobalSearch: false, isSearching: false, searchResults: [] });
    const folder = get().currentFolder;
    if (folder) get().loadImages(folder);
  },

  setupSubscriptions: () => {
    // FileSystemWatcher: auto-refresh when files change in the watched folder
    bridge.on('folderChanged', () => {
      const { currentFolder } = get();
      if (currentFolder) {
        // Debounced refresh — the backend already debounces, but we add a small guard
        get().loadImages(currentFolder);
      }
    });

    bridge.on('metadataUpdated', (data) => {
      // eslint-disable-next-line no-console
      console.log('metadataUpdated received', data);
      if (!data || typeof data !== 'object') return;

      const { images, gridItems } = get();
      const metadataMap = data as Record<string, { tags: string[]; rating: number }>;
      let hasChanges = false;

      const normalizedMap = new Map<string, { tags: string[]; rating: number }>();
      for (const key in metadataMap) {
        if (Object.prototype.hasOwnProperty.call(metadataMap, key)) {
          normalizedMap.set(key.toLowerCase(), metadataMap[key]);
        }
      }

      const updatedImages = images.map((img) => {
        let meta = metadataMap[img.path];
        if (!meta) meta = normalizedMap.get(img.path.toLowerCase())!;
        if (meta) {
          hasChanges = true;
          return { ...img, tags: meta.tags || [], rating: meta.rating || 0 };
        }
        return img;
      });

      if (hasChanges) {
        set({
          images: updatedImages,
          gridItems: normalizeGridItems(gridItems, updatedImages),
        } as unknown as Partial<ImageSlice & UISlice>);
      }
    });
  },
});
