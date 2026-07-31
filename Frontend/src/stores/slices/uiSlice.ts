import { StateCreator } from 'zustand';
import { ImageSlice, normalizeGridItems } from './imageSlice';
import type { Tag, ImageFile } from '../../types';
import { bridge } from '../../services/bridge';
import { NavigationSlice } from './navigationSlice';
import { useToastStore } from '../toastStore';
import { invalidateThumbnail } from '../../hooks/useThumbnailManager';
import {
  GRID_ZOOM_MIN,
  GRID_ZOOM_MAX,
  GRID_ZOOM_STEP,
  GRID_ZOOM_DEFAULT,
  SIDEBAR_WIDTH_DEFAULT,
  TAG_PANEL_WIDTH_DEFAULT,
} from '../../constants/ui';

let subscriptionsInitialized = false;

// Highest metadataUpdated requestId we've accepted — guards against out-of-order
// deliveries from cancelled background loads overwriting fresher data.
// Höchste akzeptierte requestId — verhindert, dass abgebrochene Hintergrund-Ladeläufe
// frischere Daten überschreiben.
let latestMetadataRequestId = 0;

/**
 * Extract the changed paths from a folderChanged event payload. The watcher also
 * reports folders and deleted files, so only non-empty strings are kept here and
 * the caller matches them against the images actually on screen.
 * Liest die geänderten Pfade aus dem folderChanged-Event. Der Watcher meldet auch
 * Ordner und gelöschte Dateien — daher nur Strings übernehmen und beim Aufrufer
 * gegen die tatsächlich angezeigten Bilder abgleichen.
 */
const extractChangedPaths = (data: unknown): string[] => {
  if (!data || typeof data !== 'object') return [];
  const { paths } = data as { paths?: unknown };
  if (!Array.isArray(paths)) return [];
  return paths.filter((path): path is string => typeof path === 'string' && path.length > 0);
};

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
  // Recursive mode — the backend enumerates the whole subtree and returns images only.
  // Rekursiv-Modus — das Backend durchläuft den Teilbaum und liefert nur Bilder.
  includeSubfolders: boolean;
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
  toggleIncludeSubfolders: () => void;
  clearFilters: () => void;
  setupSubscriptions: () => void;
  // Global search: search DB across all folders by terms (tags/filenames) and rating
  executeGlobalSearch: (terms?: string[], minRating?: number) => Promise<void>;
  exitGlobalSearch: () => void;
}

export const createUISlice: StateCreator<UISlice & ImageSlice & NavigationSlice, [], [], UISlice> = (set, get) => ({
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
  includeSubfolders: false,
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

  // Reload the current folder so the grid immediately reflects the new scope.
  // Aktuellen Ordner neu laden, damit das Grid den neuen Umfang sofort zeigt.
  toggleIncludeSubfolders: () => {
    set({ includeSubfolders: !get().includeSubfolders });
    // During global search the grid renders searchResults, not gridItems — leave
    // the search first, otherwise the toggle flips state with no visible effect.
    // exitGlobalSearch reloads the folder itself with the flag just set above.
    // In der globalen Suche zeigt das Grid searchResults — erst die Suche
    // verlassen, sonst wirkt der Schalter kaputt. exitGlobalSearch lädt den
    // Ordner selbst neu, mit dem gerade gesetzten Umfang.
    if (get().isGlobalSearch) {
      get().exitGlobalSearch();
      return;
    }
    const folder = get().currentFolder;
    if (folder) get().loadImages(folder);
  },

  clearFilters: () => {
    const wasGlobal = get().isGlobalSearch;
    set({
      searchQuery: '',
      filterRating: null,
      filterTags: [],
      sortBy: 'name',
      sortOrder: 'asc',
      isGlobalSearch: false,
      isSearching: false,
      searchResults: [],
    });
    // If we were in global search mode, reload current folder to restore normal view
    if (wasGlobal) {
      const folder = get().currentFolder;
      if (folder) get().loadImages(folder);
    }
  },

  executeGlobalSearch: async (terms, minRating) => {
    set({ isGlobalSearch: true, isSearching: true });
    try {
      const results = await bridge.searchImages(terms, minRating, 200);
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
    if (subscriptionsInitialized) return;
    subscriptionsInitialized = true;

    // FileSystemWatcher: auto-refresh when files change in the watched folder
    bridge.on('folderChanged', (data) => {
      const { currentFolder, images } = get();

      // Drop the cached thumbnails of the changed files first — otherwise the grid
      // keeps showing the stale (or already evicted) cached copy after an external
      // edit, because the frontend cache is keyed by path only. Only paths that are
      // currently displayed are touched, so folder entries are ignored.
      // Thumbnails der geänderten Dateien zuerst verwerfen — sonst zeigt das Grid nach
      // einer externen Bearbeitung weiter die veraltete Kopie. Nur angezeigte Pfade
      // werden angefasst, Ordner-Einträge bleiben unberührt.
      const changedPaths = extractChangedPaths(data);
      if (changedPaths.length > 0 && images.length > 0) {
        const displayedPaths = new Map(images.map((img) => [img.path.toLowerCase(), img.path]));
        for (const changedPath of changedPaths) {
          const displayedPath = displayedPaths.get(changedPath.toLowerCase());
          if (displayedPath) invalidateThumbnail(displayedPath);
        }
      }

      if (currentFolder) {
        // Debounced refresh — the backend already debounces, but we add a small guard
        get().loadImages(currentFolder);
      }
    });

    // Show toast when background metadata loading fails
    bridge.on('metadataError', (data) => {
      const { error } = data as { error: string };
      useToastStore.getState().warning(`Metadaten-Laden fehlgeschlagen: ${error}`);
    });

    // Show progress for batch operations
    bridge.on('batchProgress', (data) => {
      const { current, total, operation } = data as { current: number; total: number; operation: string };
      if (current === total) {
        const label = operation === 'writeBatchTags' ? 'Batch-Tagging' : operation;
        useToastStore.getState().success(`${label} abgeschlossen (${total} Dateien)`);
      }
    });

    bridge.on('metadataUpdated', (data) => {
      if (!data || typeof data !== 'object') return;

      // Per-path metadata entry. The AI-status flags are optional so legacy
      // payloads without them keep the current values on merge.
      // Metadaten pro Pfad. Die KI-Status-Flags sind optional, damit alte
      // Payloads ohne diese Felder die aktuellen Werte beim Merge behalten.
      type MetadataEntry = { tags: string[]; rating: number; faceScanned?: boolean; hasDescription?: boolean };

      // New envelope shape: { requestId, metadata }. Fall back to the legacy raw
      // dictionary for any handler that hasn't been migrated yet.
      const envelope = data as {
        requestId?: number;
        metadata?: Record<string, MetadataEntry>;
      };
      const requestId = typeof envelope.requestId === 'number' ? envelope.requestId : 0;
      const metadataMap = envelope.metadata ?? (data as Record<string, MetadataEntry>);

      if (requestId > 0) {
        if (requestId < latestMetadataRequestId) return; // stale delivery
        latestMetadataRequestId = requestId;
      }

      const { images, gridItems } = get();
      let hasChanges = false;

      const normalizedMap = new Map<string, MetadataEntry>();
      for (const key in metadataMap) {
        if (Object.prototype.hasOwnProperty.call(metadataMap, key)) {
          normalizedMap.set(key.toLowerCase(), metadataMap[key]);
        }
      }

      const updatedImages = images.map((img) => {
        const meta = metadataMap[img.path] ?? normalizedMap.get(img.path.toLowerCase());
        if (meta) {
          hasChanges = true;
          return {
            ...img,
            tags: meta.tags || [],
            rating: meta.rating || 0,
            faceScanned: meta.faceScanned ?? img.faceScanned,
            hasDescription: meta.hasDescription ?? img.hasDescription,
          };
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
