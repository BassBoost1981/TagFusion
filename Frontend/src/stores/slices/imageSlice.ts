import { StateCreator } from 'zustand';
import type { ImageFile, GridItem } from '../../types';
import { bridge } from '../../services/bridge';

export interface ImageSlice {
    gridItems: GridItem[];
    images: ImageFile[];
    selectedImages: Set<string>;
    lastSelectedImage: string | null;
    isLoadingImages: boolean;

    loadImages: (folderPath: string) => Promise<void>;
    refreshImages: () => Promise<void>;
    selectImage: (path: string, ctrlKey?: boolean, shiftKey?: boolean) => void;
    selectAllImages: () => void;
    clearSelection: () => void;
    updateImageTags: (imagePath: string, tags: string[]) => Promise<void>;
    updateImageRating: (imagePath: string, rating: number) => Promise<void>;
}

export const createImageSlice: StateCreator<
    ImageSlice & {
        currentFolder: string | null;
        setError: (error: string | null) => void;
        setCurrentFolder: (folder: string | null) => void;
    },
    [],
    [],
    ImageSlice
> = (set, get) => ({
    gridItems: [],
    images: [],
    selectedImages: new Set(),
    lastSelectedImage: null,
    isLoadingImages: false,

    loadImages: async (folderPath) => {
        try {
            set({ isLoadingImages: true, currentFolder: folderPath });
            get().setCurrentFolder(folderPath);
            const items = await bridge.getFolderContents(folderPath);

            const images = items
                .filter(i => !i.isFolder && i.imageData)
                .map(i => ({
                    ...i.imageData!,
                    tags: i.imageData!.tags || [],
                    rating: i.imageData!.rating || 0
                }));

            const normalizedGridItems = items.map(item => {
                if (item.isFolder) return item;
                const img = images.find(i => i.path === item.path);
                return { ...item, imageData: img };
            });

            set({
                gridItems: normalizedGridItems,
                images,
                selectedImages: new Set(),
                lastSelectedImage: null,
                isLoadingImages: false
            });
        } catch (error) {
            set({ isLoadingImages: false });
            get().setError((error as Error).message);
        }
    },

    refreshImages: async () => {
        const { currentFolder } = get();
        if (currentFolder) {
            const selectedPaths = get().selectedImages;
            try {
                const items = await bridge.getFolderContents(currentFolder);

                const images = items
                    .filter(i => !i.isFolder && i.imageData)
                    .map(i => ({
                        ...i.imageData!,
                        tags: i.imageData!.tags || [],
                        rating: i.imageData!.rating || 0
                    }));

                const normalizedGridItems = items.map(item => {
                    if (item.isFolder) return item;
                    const img = images.find(i => i.path === item.path);
                    return { ...item, imageData: img };
                });

                const validSelection = new Set(
                    Array.from(selectedPaths).filter(path => images.some(img => img.path === path))
                );
                set({ gridItems: normalizedGridItems, images, selectedImages: validSelection });
            } catch (error) {
                console.error('refreshImages error:', error);
            }
        }
    },

    selectImage: (path, ctrlKey = false, shiftKey = false) => {
        const { selectedImages, lastSelectedImage, images } = get();

        if (shiftKey && lastSelectedImage) {
            const lastIndex = images.findIndex(img => img.path === lastSelectedImage);
            const currentIndex = images.findIndex(img => img.path === path);

            if (lastIndex !== -1 && currentIndex !== -1) {
                const start = Math.min(lastIndex, currentIndex);
                const end = Math.max(lastIndex, currentIndex);
                const rangeSelection = new Set(ctrlKey ? selectedImages : []);

                for (let i = start; i <= end; i++) {
                    rangeSelection.add(images[i].path);
                }

                set({ selectedImages: rangeSelection });
                return;
            }
        }

        if (ctrlKey) {
            const newSelection = new Set(selectedImages);
            if (newSelection.has(path)) {
                newSelection.delete(path);
            } else {
                newSelection.add(path);
            }
            set({ selectedImages: newSelection, lastSelectedImage: path });
            return;
        }

        set({
            selectedImages: new Set([path]),
            lastSelectedImage: path
        });
    },

    selectAllImages: () => {
        const { images } = get();
        const firstImage = images.length > 0 ? images[0].path : null;
        set({
            selectedImages: new Set(images.map(img => img.path)),
            lastSelectedImage: firstImage
        });
    },

    clearSelection: () => set({ selectedImages: new Set(), lastSelectedImage: null }),

    updateImageTags: async (imagePath, tags) => {
        try {
            await bridge.writeTags(imagePath, tags);
            const { images, gridItems } = get();

            const updatedImages = images.map(img =>
                img.path === imagePath ? { ...img, tags } : img
            );

            const updatedGridItems = gridItems.map(item => {
                if (item.isFolder) return item;
                const updatedImg = updatedImages.find(img => img.path === item.path);
                return updatedImg ? { ...item, imageData: updatedImg } : item;
            });

            set({ images: updatedImages, gridItems: updatedGridItems });
        } catch (error) {
            get().setError((error as Error).message);
        }
    },

    updateImageRating: async (imagePath, rating) => {
        try {
            await bridge.setRating(imagePath, rating);
            const { images, gridItems } = get();

            const updatedImages = images.map(img =>
                img.path === imagePath ? { ...img, rating } : img
            );

            const updatedGridItems = gridItems.map(item => {
                if (item.isFolder) return item;
                const updatedImg = updatedImages.find(img => img.path === item.path);
                return updatedImg ? { ...item, imageData: updatedImg } : item;
            });

            set({ images: updatedImages, gridItems: updatedGridItems });
        } catch (error) {
            get().setError((error as Error).message);
        }
    },
});
