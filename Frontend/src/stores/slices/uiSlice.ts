import { StateCreator } from 'zustand';
import { ImageSlice } from './imageSlice';
import type { Tag, GridItem, ImageFile } from '../../types';
import { bridge } from '../../services/bridge';

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
}

export const createUISlice: StateCreator<
    UISlice & {
        images: ImageFile[];
        gridItems: GridItem[];
    },
    [],
    [],
    UISlice
> = (set, get) => ({
    tags: [],
    error: null,
    sidebarWidth: 280,
    tagPanelWidth: 320,
    zoomLevel: 100,
    searchQuery: '',
    sortBy: 'name',
    sortOrder: 'asc',
    filterRating: null,
    filterTags: [],

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
    setZoomLevel: (level) => set({ zoomLevel: Math.min(200, Math.max(50, level)) }),

    zoomIn: () => set((state) => ({
        zoomLevel: Math.min(200, state.zoomLevel + 10)
    })),

    zoomOut: () => set((state) => ({
        zoomLevel: Math.max(50, state.zoomLevel - 10)
    })),

    setSearchQuery: (query) => set({ searchQuery: query }),
    setSortBy: (sortBy) => set({ sortBy }),
    setSortOrder: (order) => set({ sortOrder: order }),
    toggleSortOrder: () => set((state) => ({ sortOrder: state.sortOrder === 'asc' ? 'desc' : 'asc' })),
    setFilterRating: (rating) => set({ filterRating: rating }),
    setFilterTags: (tags) => set({ filterTags: tags }),
    clearFilters: () => set({ searchQuery: '', filterRating: null, filterTags: [], sortBy: 'name', sortOrder: 'asc' }),

    setupSubscriptions: () => {
        bridge.on('metadataUpdated', (data) => {
            console.log('metadataUpdated received', data);
            if (!data || typeof data !== 'object') return;

            const { images, gridItems } = get();
            const metadataMap = data as Record<string, { tags: string[], rating: number }>;
            let hasChanges = false;

            const normalizedMap = new Map<string, { tags: string[], rating: number }>();
            for (const key in metadataMap) {
                if (Object.prototype.hasOwnProperty.call(metadataMap, key)) {
                    normalizedMap.set(key.toLowerCase(), metadataMap[key]);
                }
            }

            const updatedImages = images.map(img => {
                let meta = metadataMap[img.path];
                if (!meta) meta = normalizedMap.get(img.path.toLowerCase())!;
                if (meta) {
                    hasChanges = true;
                    return { ...img, tags: meta.tags || [], rating: meta.rating || 0 };
                }
                return img;
            });

            if (hasChanges) {
                const updatedGridItems = gridItems.map(item => {
                    if (item.isFolder) return item;
                    const updatedImg = updatedImages.find(img => img.path === item.path);
                    return updatedImg ? { ...item, imageData: updatedImg } : item;
                });
                // We use a cast here because this slice doesn't "know" about the combined state's precise structure
                set({ images: updatedImages, gridItems: updatedGridItems } as unknown as Partial<ImageSlice & UISlice>);
            }
        });
    },
});
