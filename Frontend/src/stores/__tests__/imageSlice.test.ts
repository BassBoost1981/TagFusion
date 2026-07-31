import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from '../appStore';
import { normalizeGridItems } from '../slices/imageSlice';
import { bridge } from '../../services/bridge';
import type { ImageFile, GridItem } from '../../types';

// Mock bridge service
vi.mock('../../services/bridge', () => ({
  bridge: {
    getFolderContents: vi.fn(),
    writeTags: vi.fn().mockResolvedValue(true),
    setRating: vi.fn().mockResolvedValue(true),
    // Default: every requested path succeeds / Standard: jeder Pfad erfolgreich
    updateBatchTag: vi
      .fn()
      .mockImplementation((paths: string[]) => Promise.resolve(Object.fromEntries(paths.map((p) => [p, true])))),
    readTags: vi.fn(),
    saveTagLibrary: vi.fn().mockResolvedValue(true),
    getTagLibrary: vi.fn().mockResolvedValue(null),
  },
}));

const mockedBridge = vi.mocked(bridge);

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

const expectSelectedImages = (...paths: string[]) => {
  const selection = useAppStore.getState().selectedImages;

  expect(selection.size).toBe(paths.length);
  paths.forEach((path) => {
    expect(selection.has(path)).toBe(true);
  });
};

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
    vi.clearAllMocks();
    useAppStore.setState({
      images,
      gridItems: images.map(makeGridItem),
      selectedImages: new Set<string>(),
      lastSelectedImage: null,
      error: null,
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
    expectSelectedImages('C:\\3.jpg');
  });

  it('ctrl+click toggles image in selection', () => {
    useAppStore.getState().selectImage('C:\\1.jpg');
    useAppStore.getState().selectImage('C:\\3.jpg', true);
    expect(useAppStore.getState().selectedImages.size).toBe(2);

    useAppStore.getState().selectImage('C:\\1.jpg', true);
    expectSelectedImages('C:\\3.jpg');
  });

  it('shift+click selects range', () => {
    useAppStore.getState().selectImage('C:\\1.jpg');
    useAppStore.getState().selectImage('C:\\4.jpg', false, true);

    expectSelectedImages('C:\\1.jpg', 'C:\\2.jpg', 'C:\\3.jpg', 'C:\\4.jpg');
  });

  it('shift+ctrl extends selection with range', () => {
    useAppStore.getState().selectImage('C:\\1.jpg');
    useAppStore.getState().selectImage('C:\\2.jpg', true);
    useAppStore.getState().selectImage('C:\\4.jpg', true, true);

    expectSelectedImages('C:\\1.jpg', 'C:\\2.jpg', 'C:\\3.jpg', 'C:\\4.jpg');
  });

  it('shift range follows a provided display order instead of the raw store order', () => {
    // Display shows only 1 and 3 (2 is filtered out) — the range must skip it.
    // Anzeige enthält nur 1 und 3 (2 ist weggefiltert) — der Bereich überspringt es.
    useAppStore.getState().selectImage('C:\\1.jpg');
    useAppStore.getState().selectImage('C:\\3.jpg', false, true, ['C:\\1.jpg', 'C:\\3.jpg', 'C:\\4.jpg']);

    expectSelectedImages('C:\\1.jpg', 'C:\\3.jpg');
  });
});

describe('imageSlice — updateImageRating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const images = [makeImage('C:\\1.jpg'), makeImage('C:\\2.jpg'), makeImage('C:\\3.jpg')];
    useAppStore.setState({
      images,
      gridItems: images.map(makeGridItem),
      selectedImages: new Set<string>(),
      lastSelectedImage: null,
      error: null,
    });
  });

  it('reverts only the failed image when a bulk update partially fails', async () => {
    // One locked file must not roll back the ratings of the other images —
    // the backend already persisted those successfully.
    // Eine gesperrte Datei darf die Bewertungen der anderen Bilder nicht
    // zurückrollen — das Backend hat sie bereits erfolgreich gespeichert.
    mockedBridge.setRating.mockImplementation((path: string) =>
      path === 'C:\\2.jpg' ? Promise.reject(new Error('schreibgeschützt')) : Promise.resolve(true)
    );

    await Promise.all([
      useAppStore.getState().updateImageRating('C:\\1.jpg', 4),
      useAppStore.getState().updateImageRating('C:\\2.jpg', 4),
      useAppStore.getState().updateImageRating('C:\\3.jpg', 4),
    ]);

    const { images, error } = useAppStore.getState();
    expect(images.find((img) => img.path === 'C:\\1.jpg')?.rating).toBe(4);
    expect(images.find((img) => img.path === 'C:\\2.jpg')?.rating).toBe(0);
    expect(images.find((img) => img.path === 'C:\\3.jpg')?.rating).toBe(4);
    expect(error).toBe('schreibgeschützt');

    mockedBridge.setRating.mockResolvedValue(true);
  });
});

describe('imageSlice — selectAllImages / clearSelection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const images = [makeImage('C:\\a.jpg'), makeImage('C:\\b.jpg')];
    useAppStore.setState({
      images,
      gridItems: images.map(makeGridItem),
      selectedImages: new Set<string>(),
      lastSelectedImage: null,
      error: null,
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

describe('imageSlice — batch tag updates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const images = [
      makeImage('C:\\1.jpg', ['Natur']),
      makeImage('C:\\2.jpg', ['Natur', 'Sommer']),
      makeImage('C:\\3.jpg', ['Stadt']),
    ];

    useAppStore.setState({
      images,
      gridItems: images.map(makeGridItem),
      selectedImages: new Set(['C:\\1.jpg', 'C:\\2.jpg']),
      lastSelectedImage: 'C:\\2.jpg',
      error: null,
    });
  });

  it('adds a tag to multiple images and calls the batch bridge once', async () => {
    await useAppStore.getState().addTagToImages(['C:\\1.jpg', 'C:\\2.jpg'], 'Urlaub');

    const { images } = useAppStore.getState();
    expect(images.find((img) => img.path === 'C:\\1.jpg')?.tags).toEqual(['Natur', 'Urlaub']);
    expect(images.find((img) => img.path === 'C:\\2.jpg')?.tags).toEqual(['Natur', 'Sommer', 'Urlaub']);
    expect(images.find((img) => img.path === 'C:\\3.jpg')?.tags).toEqual(['Stadt']);
    expect(mockedBridge.updateBatchTag).toHaveBeenCalledWith(['C:\\1.jpg', 'C:\\2.jpg'], 'Urlaub', 'add');
  });

  it('removes a tag from multiple images and calls the batch bridge once', async () => {
    await useAppStore.getState().removeTagFromImages(['C:\\1.jpg', 'C:\\2.jpg'], 'Natur');

    const { images } = useAppStore.getState();
    expect(images.find((img) => img.path === 'C:\\1.jpg')?.tags).toEqual([]);
    expect(images.find((img) => img.path === 'C:\\2.jpg')?.tags).toEqual(['Sommer']);
    expect(mockedBridge.updateBatchTag).toHaveBeenCalledWith(['C:\\1.jpg', 'C:\\2.jpg'], 'Natur', 'remove');
  });

  it('rolls back optimistic batch updates when the bridge call fails', async () => {
    mockedBridge.updateBatchTag.mockRejectedValueOnce(new Error('bridge failed'));

    await useAppStore.getState().addTagToImages(['C:\\1.jpg', 'C:\\2.jpg'], 'Urlaub');

    const { images, error } = useAppStore.getState();
    expect(images.find((img) => img.path === 'C:\\1.jpg')?.tags).toEqual(['Natur']);
    expect(images.find((img) => img.path === 'C:\\2.jpg')?.tags).toEqual(['Natur', 'Sommer']);
    expect(error).toBe('bridge failed');
  });

  it('reverts only failed paths on partial batch failure, successes stay applied', async () => {
    mockedBridge.updateBatchTag.mockResolvedValueOnce({ 'C:\\1.jpg': true, 'C:\\2.jpg': false });

    await useAppStore.getState().addTagToImages(['C:\\1.jpg', 'C:\\2.jpg'], 'Urlaub');

    const { images, error } = useAppStore.getState();
    expect(images.find((img) => img.path === 'C:\\1.jpg')?.tags).toEqual(['Natur', 'Urlaub']);
    expect(images.find((img) => img.path === 'C:\\2.jpg')?.tags).toEqual(['Natur', 'Sommer']);
    expect(error).toBe('Tag konnte für 1 von 2 Bildern nicht gespeichert werden');
  });
});

describe('imageSlice — refreshImages stale guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      images: [],
      gridItems: [],
      selectedImages: new Set<string>(),
      lastSelectedImage: null,
      error: null,
    });
  });

  it('discards a stale response when the folder changed during the refresh', async () => {
    const imgB = makeImage('C:\\B\\2.jpg');
    useAppStore.setState({ currentFolder: 'C:\\A' });

    // Refresh for folder A hangs until we resolve it manually.
    // Refresh für Ordner A hängt, bis wir ihn manuell auflösen.
    let resolveFetch!: (items: GridItem[]) => void;
    mockedBridge.getFolderContents.mockReturnValue(
      new Promise<GridItem[]>((resolve) => {
        resolveFetch = resolve;
      })
    );
    const refreshPromise = useAppStore.getState().refreshImages();

    // User navigates to folder B while the refresh is in flight.
    // Nutzer wechselt während des Refreshs in Ordner B.
    useAppStore.setState({ currentFolder: 'C:\\B', images: [imgB], gridItems: [makeGridItem(imgB)] });

    resolveFetch([makeGridItem(makeImage('C:\\A\\1.jpg'))]);
    await refreshPromise;

    // Folder B's state must survive; the stale folder-A response is discarded.
    // Ordner-B-Zustand bleibt erhalten; die veraltete Ordner-A-Antwort wird verworfen.
    expect(useAppStore.getState().images).toEqual([imgB]);
    expect(useAppStore.getState().gridItems).toEqual([makeGridItem(imgB)]);
  });

  it('applies the response when the folder is unchanged', async () => {
    const imgA = makeImage('C:\\A\\1.jpg');
    useAppStore.setState({ currentFolder: 'C:\\A' });
    mockedBridge.getFolderContents.mockResolvedValue([makeGridItem(imgA)]);

    await useAppStore.getState().refreshImages();

    expect(useAppStore.getState().images).toEqual([imgA]);
  });
});
