import { StateCreator } from 'zustand';
import type { ImageFile, GridItem } from '../../types';
import { bridge } from '../../services/bridge';

let latestLoadImagesRequestId = 0;

const extractImages = (items: GridItem[]): ImageFile[] =>
  items
    .filter((i) => !i.isFolder && i.imageData)
    .map((i) => ({
      ...i.imageData!,
      tags: i.imageData!.tags || [],
      rating: i.imageData!.rating || 0,
    }));

export const normalizeGridItems = (items: GridItem[], images: ImageFile[]): GridItem[] => {
  const imageMap = new Map(images.map((img) => [img.path, img]));
  return items.map((item) => {
    if (item.isFolder) return item;
    const img = imageMap.get(item.path);
    return img ? { ...item, imageData: img } : item;
  });
};

type BatchTagOperation = 'add' | 'remove';

const applyBatchTagMutation = (
  images: ImageFile[],
  imagePaths: string[],
  tag: string,
  operation: BatchTagOperation
) => {
  const normalizedTag = tag.trim();
  if (!normalizedTag) {
    return { updatedImages: images, changedPaths: [] as string[] };
  }

  const targetPaths = new Set(imagePaths);
  const changedPaths: string[] = [];

  const updatedImages = images.map((img) => {
    if (!targetPaths.has(img.path)) return img;

    const hasTag = img.tags.includes(normalizedTag);
    if (operation === 'add') {
      if (hasTag) return img;
      changedPaths.push(img.path);
      return { ...img, tags: [...img.tags, normalizedTag] };
    }

    if (!hasTag) return img;
    changedPaths.push(img.path);
    return { ...img, tags: img.tags.filter((existingTag) => existingTag !== normalizedTag) };
  });

  return { updatedImages, changedPaths };
};

// Revert only the images whose backend write failed — successful writes stay applied.
// Nur fehlgeschlagene Bilder zuruecksetzen — erfolgreiche Schreibvorgaenge bleiben erhalten.
const revertFailedPaths = (
  currentImages: ImageFile[],
  prevImages: ImageFile[],
  failedPaths: Set<string>
): ImageFile[] => {
  const prevByPath = new Map(prevImages.map((img) => [img.path, img]));
  return currentImages.map((img) => (failedPaths.has(img.path) ? (prevByPath.get(img.path) ?? img) : img));
};

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
  addTagToImages: (imagePaths: string[], tag: string) => Promise<void>;
  removeTagFromImages: (imagePaths: string[], tag: string) => Promise<void>;
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
    const requestId = ++latestLoadImagesRequestId;

    try {
      set({ isLoadingImages: true, currentFolder: folderPath });
      get().setCurrentFolder(folderPath);
      const items = await bridge.getFolderContents(folderPath);
      const images = extractImages(items);

      if (requestId !== latestLoadImagesRequestId || get().currentFolder !== folderPath) {
        return;
      }

      set({
        gridItems: normalizeGridItems(items, images),
        images,
        selectedImages: new Set(),
        lastSelectedImage: null,
        isLoadingImages: false,
      });
    } catch (error) {
      if (requestId !== latestLoadImagesRequestId) {
        return;
      }

      set({ isLoadingImages: false });
      get().setError((error as Error).message);
    }
  },

  refreshImages: async () => {
    const { currentFolder } = get();
    if (currentFolder) {
      try {
        const items = await bridge.getFolderContents(currentFolder);
        // Stale guard: discard the response when the user navigated to another
        // folder while the refresh was in flight — otherwise a late response
        // would briefly show the old folder's grid.
        // Stale-Guard: Antwort verwerfen, wenn während des Refreshs in einen
        // anderen Ordner gewechselt wurde — sonst zeigt eine späte Antwort
        // kurz das Grid des alten Ordners.
        if (get().currentFolder !== currentFolder) return;
        const images = extractImages(items);
        const imagePathSet = new Set(images.map((img) => img.path));
        // Read the selection after the await so clicks made during the refresh survive.
        // Auswahl nach dem Await lesen, damit Klicks während des Refreshs erhalten bleiben.
        const validSelection = new Set(Array.from(get().selectedImages).filter((path) => imagePathSet.has(path)));
        set({ gridItems: normalizeGridItems(items, images), images, selectedImages: validSelection });
      } catch (error) {
        get().setError((error as Error).message);
      }
    }
  },

  selectImage: (path, ctrlKey = false, shiftKey = false) => {
    const { selectedImages, lastSelectedImage, images } = get();

    if (shiftKey && lastSelectedImage) {
      const lastIndex = images.findIndex((img) => img.path === lastSelectedImage);
      const currentIndex = images.findIndex((img) => img.path === path);

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
      lastSelectedImage: path,
    });
  },

  selectAllImages: () => {
    const { images } = get();
    const firstImage = images.length > 0 ? images[0].path : null;
    set({
      selectedImages: new Set(images.map((img) => img.path)),
      lastSelectedImage: firstImage,
    });
  },

  clearSelection: () => set({ selectedImages: new Set(), lastSelectedImage: null }),

  updateImageTags: async (imagePath, tags) => {
    const { images: prevImages, gridItems: prevGridItems } = get();
    const updatedImages = prevImages.map((img) => (img.path === imagePath ? { ...img, tags } : img));
    set({ images: updatedImages, gridItems: normalizeGridItems(prevGridItems, updatedImages) });

    try {
      await bridge.writeTags(imagePath, tags);
    } catch (error) {
      set({ images: prevImages, gridItems: prevGridItems });
      get().setError((error as Error).message);
    }
  },

  updateImageRating: async (imagePath, rating) => {
    const { images: prevImages, gridItems: prevGridItems } = get();
    const updatedImages = prevImages.map((img) => (img.path === imagePath ? { ...img, rating } : img));
    set({ images: updatedImages, gridItems: normalizeGridItems(prevGridItems, updatedImages) });

    try {
      await bridge.setRating(imagePath, rating);
    } catch (error) {
      set({ images: prevImages, gridItems: prevGridItems });
      get().setError((error as Error).message);
    }
  },

  addTagToImages: async (imagePaths, tag) => {
    const { images: prevImages, gridItems: prevGridItems } = get();
    const { updatedImages, changedPaths } = applyBatchTagMutation(prevImages, imagePaths, tag, 'add');

    if (changedPaths.length === 0) return;

    set({ images: updatedImages, gridItems: normalizeGridItems(prevGridItems, updatedImages) });

    try {
      // Backend reports success per path — revert only the failed ones instead of
      // rolling back the whole batch (partial success stays visible).
      // Backend meldet Erfolg pro Pfad — nur fehlgeschlagene Bilder zuruecksetzen.
      const results = (await bridge.updateBatchTag(changedPaths, tag, 'add')) ?? {};
      const failedPaths = changedPaths.filter((path) => !results[path]);
      if (failedPaths.length > 0) {
        const { images, gridItems } = get();
        const revertedImages = revertFailedPaths(images, prevImages, new Set(failedPaths));
        set({ images: revertedImages, gridItems: normalizeGridItems(gridItems, revertedImages) });
        get().setError(
          `Tag konnte für ${failedPaths.length} von ${changedPaths.length} Bildern nicht gespeichert werden`
        );
      }
    } catch (error) {
      set({ images: prevImages, gridItems: prevGridItems });
      get().setError((error as Error).message);
    }
  },

  removeTagFromImages: async (imagePaths, tag) => {
    const { images: prevImages, gridItems: prevGridItems } = get();
    const { updatedImages, changedPaths } = applyBatchTagMutation(prevImages, imagePaths, tag, 'remove');

    if (changedPaths.length === 0) return;

    set({ images: updatedImages, gridItems: normalizeGridItems(prevGridItems, updatedImages) });

    try {
      const results = (await bridge.updateBatchTag(changedPaths, tag, 'remove')) ?? {};
      const failedPaths = changedPaths.filter((path) => !results[path]);
      if (failedPaths.length > 0) {
        const { images, gridItems } = get();
        const revertedImages = revertFailedPaths(images, prevImages, new Set(failedPaths));
        set({ images: revertedImages, gridItems: normalizeGridItems(gridItems, revertedImages) });
        get().setError(
          `Tag konnte für ${failedPaths.length} von ${changedPaths.length} Bildern nicht gespeichert werden`
        );
      }
    } catch (error) {
      set({ images: prevImages, gridItems: prevGridItems });
      get().setError((error as Error).message);
    }
  },
});
