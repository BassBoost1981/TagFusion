import { StateCreator } from 'zustand';
import type { FolderItem } from '../../types';
import { bridge } from '../../services/bridge';

export interface Favorite {
  path: string;
  name: string;
}

const loadFavorites = (): Favorite[] => {
  try {
    const saved = localStorage.getItem('tagfusion-favorites');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

const saveFavorites = (favorites: Favorite[]) => {
  localStorage.setItem('tagfusion-favorites', JSON.stringify(favorites));
};

export interface NavigationSlice {
  currentFolder: string | null;
  folders: FolderItem[];
  drives: FolderItem[];
  favorites: Favorite[];
  expandedPaths: Set<string>;
  folderCache: Map<string, FolderItem[]>;
  loadingPaths: Set<string>;
  isLoadingDrives: boolean;

  setCurrentFolder: (folder: string | null) => void;
  loadDrives: () => Promise<void>;
  loadFolders: (path: string) => Promise<void>;
  toggleFolder: (path: string) => Promise<void>;
  expandToPath: (path: string) => Promise<void>;
  navigateToFolder: (path: string) => Promise<void>;
  navigateUp: () => Promise<void>;
  addFavorite: (path: string, name: string) => void;
  removeFavorite: (path: string) => void;
  addCurrentFolderToFavorites: () => void;
  openFolderDialog: () => Promise<void>;
}

export const createNavigationSlice: StateCreator<
  NavigationSlice & {
    loadImages: (folderPath: string) => Promise<void>;
    setError: (error: string | null) => void;
  },
  [],
  [],
  NavigationSlice
> = (set, get) => ({
  currentFolder: null,
  folders: [],
  drives: [],
  favorites: loadFavorites(),
  expandedPaths: new Set(),
  folderCache: new Map(),
  loadingPaths: new Set(),
  isLoadingDrives: false,

  setCurrentFolder: (folder) => set({ currentFolder: folder }),

  loadDrives: async () => {
    try {
      set({ isLoadingDrives: true });
      const drives = await bridge.getDrives();
      set({ drives, isLoadingDrives: false });
    } catch (error) {
      set({ isLoadingDrives: false });
      get().setError((error as Error).message);
    }
  },

  loadFolders: async (path) => {
    try {
      const folders = await bridge.getFolders(path);
      set({ folders });
    } catch (error) {
      get().setError((error as Error).message);
    }
  },

  toggleFolder: async (path) => {
    const { expandedPaths, folderCache, loadingPaths } = get();
    const newExpanded = new Set(expandedPaths);

    if (newExpanded.has(path)) {
      newExpanded.delete(path);
      set({ expandedPaths: newExpanded });
    } else {
      newExpanded.add(path);
      set({ expandedPaths: newExpanded });

      if (!folderCache.has(path)) {
        const newLoading = new Set(loadingPaths);
        newLoading.add(path);
        set({ loadingPaths: newLoading });

        try {
          const subfolders = await bridge.getFolders(path);
          const newCache = new Map(get().folderCache);
          newCache.set(path, subfolders);
          const updatedLoading = new Set(get().loadingPaths);
          updatedLoading.delete(path);
          set({ folderCache: newCache, loadingPaths: updatedLoading });
        } catch (error) {
          const updatedLoading = new Set(get().loadingPaths);
          updatedLoading.delete(path);
          set({ loadingPaths: updatedLoading });
          get().setError((error as Error).message);
        }
      }
    }
  },

  expandToPath: async (targetPath) => {
    const { expandedPaths, folderCache } = get();
    const newExpanded = new Set(expandedPaths);
    const newCache = new Map(folderCache);

    const normalizedPath = targetPath.replace(/\\/g, '/').replace(/\/$/, '');
    const parts = normalizedPath.split('/').filter(Boolean);
    const pathsToExpand: string[] = [];

    for (let i = 0; i < parts.length; i++) {
      let segmentPath: string;
      if (i === 0) {
        segmentPath = parts[i] + '\\';
      } else {
        segmentPath = parts[0] + '\\' + parts.slice(1, i + 1).join('\\');
      }
      pathsToExpand.push(segmentPath);
    }

    for (const path of pathsToExpand) {
      newExpanded.add(path);
      if (!newCache.has(path)) {
        try {
          const subfolders = await bridge.getFolders(path);
          newCache.set(path, subfolders);
        } catch (error) {
          console.error('expandToPath error for', path, error);
        }
      }
    }

    set({ expandedPaths: newExpanded, folderCache: newCache });
  },

  navigateToFolder: async (path) => {
    await get().expandToPath(path);
    await get().loadImages(path);
    // Start watching the new folder for file changes
    bridge.watchFolder(path).catch(() => {});
  },

  navigateUp: async () => {
    const { currentFolder } = get();
    if (!currentFolder) return;

    const normalized = currentFolder.replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);

    if (parts.length <= 1) return;

    parts.pop();
    let parentPath = parts.join('\\');
    if (parts.length === 1 && parentPath.endsWith(':')) {
      parentPath += '\\';
    }

    await get().navigateToFolder(parentPath);
  },

  addFavorite: (path, name) => {
    const { favorites } = get();
    if (!favorites.some((f) => f.path === path)) {
      const newFavorites = [...favorites, { path, name }];
      saveFavorites(newFavorites);
      set({ favorites: newFavorites });
    }
  },

  removeFavorite: (path) => {
    const { favorites } = get();
    const newFavorites = favorites.filter((f) => f.path !== path);
    saveFavorites(newFavorites);
    set({ favorites: newFavorites });
  },

  addCurrentFolderToFavorites: () => {
    const { currentFolder } = get();
    if (currentFolder) {
      const name = currentFolder.split('\\').pop() || currentFolder;
      get().addFavorite(currentFolder, name);
    }
  },

  openFolderDialog: async () => {
    try {
      const folder = await bridge.selectFolder();
      if (folder) {
        await get().loadImages(folder);
      }
    } catch (error) {
      get().setError((error as Error).message);
    }
  },
});
