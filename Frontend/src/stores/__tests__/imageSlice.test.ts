import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from '../appStore';
import { normalizeGridItems } from '../slices/imageSlice';
import type { ImageFile, GridItem } from '../../types';

// Mock bridge service
vi.mock('../../services/bridge', () => ({
  bridge: {
    getFolderContents: vi.fn(),
    writeTags: vi.fn().mockResolvedValue(true),
    setRating: vi.fn().mockResolvedValue(true),
    readTags: vi.fn(),
    saveTagLibrary: vi.fn().mockResolvedValue(true),
    getTagLibrary: vi.fn().mockResolvedValue(null),
  },
}));

const makeImage = (path: string, tags: string[] = [], rating = 0): ImageFile => ({
  path,
  fileName: path.split('\\').pop()!,
  extension: '.jpg',
  fileSize: 1024,
  dateModified: '2025-01-01',
  dateCreated: '2025-01-01',
  tags,
  rating,
});

const makeGridItem = (img: ImageFile): GridItem => ({
  path: img.path,
  name: img.fileName,
  isFolder: false,
  imageData: img,
});

const makeFolderItem = (path: string, name: string): GridItem => ({
  path,
  name,
  isFolder: true,
  subfolderCount: 2,
  imageCount: 5,
});

describe('normalizeGridItems (pure function)', () => {
  it('syncs image data into grid items', () => {
    const img = makeImage('C:\\a.jpg', ['Tag1'], 3);
    const items: GridItem[] = [makeGridItem(makeImage('C:\\a.jpg'))];
    const result = normalizeGridItems(items, [img]);

    expect(result[0].imageData?.tags).toEqual(['Tag1']);
    expect(result[0].imageData?.rating).toBe(3);
  });

  it('leaves folder items untouched', () => {
    const folder = makeFolderItem('C:\\Fotos', 'Fotos');
    const result = normalizeGridItems([folder], []);
    expect(result[0]).toEqual(folder);
  });

  it('returns original item if no matching image found', () => {
    const item = makeGridItem(makeImage('C:\\missing.jpg'));
    const result = normalizeGridItems([item], []);
    expect(result[0]).toBe(item);
  });
});

describe('imageSlice — selectImage', () => {
  const images = [makeImage('C:\\1.jpg'), makeImage('C:\\2.jpg'), makeImage('C:\\3.jpg'), makeImage('C:\\4.jpg')];

  beforeEach(() => {
    useAppStore.setState({
      images,
      gridItems: images.map(makeGridItem),
      selectedImages: new Set<string>(),
      lastSelectedImage: null,
    });
  });

  it('single click selects one image', () => {
    useAppStore.getState().selectImage('C:\\2.jpg');
    const state = useAppStore.getState();
    expect(state.selectedImages.size).toBe(1);
    expect(state.selectedImages.has('C:\\2.jpg')).toBe(true);
    expect(state.lastSelectedImage).toBe('C:\\2.jpg');
  });

  it('single click replaces previous selection', () => {
    useAppStore.getState().selectImage('C:\\1.jpg');
    useAppStore.getState().selectImage('C:\\3.jpg');
    expect(useAppStore.getState().selectedImages.size).toBe(1);
    expect(useAppStore.getState().selectedImages.has('C:\\3.jpg')).toBe(true);
  });

  it('ctrl+click toggles image in selection', () => {
    useAppStore.getState().selectImage('C:\\1.jpg');
    useAppStore.getState().selectImage('C:\\3.jpg', true);
    expect(useAppStore.getState().selectedImages.size).toBe(2);

    // Ctrl+click again to deselect
    useAppStore.getState().selectImage('C:\\1.jpg', true);
    expect(useAppStore.getState().selectedImages.size).toBe(1);
    expect(useAppStore.getState().selectedImages.has('C:\\3.jpg')).toBe(true);
  });

  it('shift+click selects range', () => {
    useAppStore.getState().selectImage('C:\\1.jpg');
    useAppStore.getState().selectImage('C:\\4.jpg', false, true);

    const sel = useAppStore.getState().selectedImages;
    expect(sel.size).toBe(4);
    expect(sel.has('C:\\1.jpg')).toBe(true);
    expect(sel.has('C:\\2.jpg')).toBe(true);
    expect(sel.has('C:\\3.jpg')).toBe(true);
    expect(sel.has('C:\\4.jpg')).toBe(true);
  });

  it('shift+ctrl extends selection with range', () => {
    useAppStore.getState().selectImage('C:\\1.jpg');
    useAppStore.getState().selectImage('C:\\2.jpg', true); // ctrl: add #2
    useAppStore.getState().selectImage('C:\\4.jpg', true, true); // shift+ctrl from #2 → #4

    const sel = useAppStore.getState().selectedImages;
    expect(sel.has('C:\\1.jpg')).toBe(true); // kept from ctrl
    expect(sel.has('C:\\2.jpg')).toBe(true);
    expect(sel.has('C:\\3.jpg')).toBe(true);
    expect(sel.has('C:\\4.jpg')).toBe(true);
  });
});

describe('imageSlice — selectAllImages / clearSelection', () => {
  beforeEach(() => {
    const images = [makeImage('C:\\a.jpg'), makeImage('C:\\b.jpg')];
    useAppStore.setState({
      images,
      gridItems: images.map(makeGridItem),
      selectedImages: new Set<string>(),
      lastSelectedImage: null,
    });
  });

  it('selectAllImages selects every image', () => {
    useAppStore.getState().selectAllImages();
    expect(useAppStore.getState().selectedImages.size).toBe(2);
  });

  it('clearSelection empties selection', () => {
    useAppStore.getState().selectAllImages();
    useAppStore.getState().clearSelection();
    expect(useAppStore.getState().selectedImages.size).toBe(0);
    expect(useAppStore.getState().lastSelectedImage).toBeNull();
  });
});
