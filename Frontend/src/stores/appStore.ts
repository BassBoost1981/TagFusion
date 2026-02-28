import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { NavigationSlice, createNavigationSlice } from './slices/navigationSlice';
import { ImageSlice, createImageSlice } from './slices/imageSlice';
import { UISlice, createUISlice } from './slices/uiSlice';

type AppStore = NavigationSlice & ImageSlice & UISlice;

export const useAppStore = create<AppStore>()(
  devtools(
    (...a) => ({
      ...createNavigationSlice(...a),
      ...createImageSlice(...a),
      ...createUISlice(...a),
    }),
    { name: 'TagFusion AppStore', enabled: import.meta.env.DEV }
  )
);

// ============================================================================
// OPTIMIZED SELECTORS
// These selectors allow components to subscribe to specific parts of the store
// without re-rendering when unrelated parts change.
// ============================================================================

// Navigation selectors
export const useCurrentFolder = () => useAppStore((state) => state.currentFolder);
export const useSetCurrentFolder = () => useAppStore((state) => state.setCurrentFolder);
export const useNavigateToFolder = () => useAppStore((state) => state.navigateToFolder);
export const useNavigateUp = () => useAppStore((state) => state.navigateUp);
export const useDrives = () => useAppStore((state) => state.drives);
export const useLoadDrives = () => useAppStore((state) => state.loadDrives);
export const useLoadFolders = () => useAppStore((state) => state.loadFolders);
export const useLoadImages = () => useAppStore((state) => state.loadImages);
export const useAddCurrentFolderToFavorites = () => useAppStore((state) => state.addCurrentFolderToFavorites);

// Grid/Image selectors
export const useGridItems = () => useAppStore((state) => state.gridItems);
export const useImages = () => useAppStore((state) => state.images);
export const useIsLoadingImages = () => useAppStore((state) => state.isLoadingImages);

// Selection selectors
export const useSelectedImages = () => useAppStore((state) => state.selectedImages);
export const useSelectImage = () => useAppStore((state) => state.selectImage);
export const useClearSelection = () => useAppStore((state) => state.clearSelection);

// Zoom selectors
export const useZoomLevel = () => useAppStore((state) => state.zoomLevel);
export const useZoomControls = () => useAppStore(
  useShallow((state) => ({
    zoomLevel: state.zoomLevel,
    zoomIn: state.zoomIn,
    zoomOut: state.zoomOut,
    setZoomLevel: state.setZoomLevel
  }))
);

// Filter/Sort selectors
export const useFilterSort = () => useAppStore(
  useShallow((state) => ({
    searchQuery: state.searchQuery,
    sortBy: state.sortBy,
    sortOrder: state.sortOrder,
    filterRating: state.filterRating,
    filterTags: state.filterTags,
    setSearchQuery: state.setSearchQuery,
    setSortBy: state.setSortBy,
    setSortOrder: state.setSortOrder,
    toggleSortOrder: state.toggleSortOrder,
    setFilterRating: state.setFilterRating,
    setFilterTags: state.setFilterTags,
    clearFilters: state.clearFilters
  }))
);

// Image action selectors
export const useRefreshImages = () => useAppStore((state) => state.refreshImages);

// Tags selectors
export const useTags = () => useAppStore((state) => state.tags);
export const useUpdateImageTags = () => useAppStore((state) => state.updateImageTags);
export const useUpdateImageRating = () => useAppStore((state) => state.updateImageRating);

// Sidebar selectors
export const useSidebarState = () => useAppStore(
  useShallow((state) => ({
    drives: state.drives,
    favorites: state.favorites,
    expandedPaths: state.expandedPaths,
    folderCache: state.folderCache,
    loadingPaths: state.loadingPaths,
    sidebarWidth: state.sidebarWidth,
    isLoadingDrives: state.isLoadingDrives,
    loadDrives: state.loadDrives,
    toggleFolder: state.toggleFolder,
    setSidebarWidth: state.setSidebarWidth,
    addFavorite: state.addFavorite,
    removeFavorite: state.removeFavorite
  }))
);

// Tag Panel selectors
export const useTagPanelState = () => useAppStore(
  useShallow((state) => ({
    selectedImages: state.selectedImages,
    images: state.images,
    tags: state.tags,
    tagPanelWidth: state.tagPanelWidth,
    filterTags: state.filterTags,
    setTagPanelWidth: state.setTagPanelWidth,
    updateImageTags: state.updateImageTags,
    setFilterTags: state.setFilterTags
  }))
);

// Error selectors
export const useError = () => useAppStore((state) => state.error);
export const useSetError = () => useAppStore((state) => state.setError);
