import { describe, it, expect, beforeEach, vi } from 'vitest';

// Captured folderChanged/metadataUpdated listeners per event name.
// Registrierte Listener pro Event-Name.
const eventListeners = new Map<string, (data: unknown) => void>();

vi.mock('../../services/bridge', () => ({
  bridge: {
    on: vi.fn((event: string, callback: (data: unknown) => void) => {
      eventListeners.set(event, callback);
      return () => eventListeners.delete(event);
    }),
    getFolderContents: vi.fn().mockResolvedValue([]),
    getAllTags: vi.fn().mockResolvedValue([]),
    searchImages: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../hooks/useThumbnailManager', () => ({
  invalidateThumbnail: vi.fn(),
}));

import { useAppStore } from '../appStore';
import { bridge } from '../../services/bridge';
import { invalidateThumbnail } from '../../hooks/useThumbnailManager';
import type { ImageFile, GridItem } from '../../types';

const mockedBridge = vi.mocked(bridge);
const mockedInvalidateThumbnail = vi.mocked(invalidateThumbnail);

const makeImage = (path: string): ImageFile => ({
  path,
  fileName: path.split('\\').pop()!,
  extension: '.jpg',
  fileSize: 1024,
  dateModified: '2025-01-01',
  dateCreated: '2025-01-01',
  tags: [],
  rating: 0,
});

const makeGridItem = (img: ImageFile): GridItem => ({
  path: img.path,
  name: img.fileName,
  isFolder: false,
  imageData: img,
});

describe('uiSlice — folderChanged thumbnail invalidation', () => {
  const edited = makeImage('C:\\Fotos\\bearbeitet.jpg');
  const untouched = makeImage('C:\\Fotos\\unveraendert.jpg');

  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      currentFolder: 'C:\\Fotos',
      images: [edited, untouched],
      gridItems: [edited, untouched].map(makeGridItem),
      includeSubfolders: false,
      error: null,
    });
    useAppStore.getState().setupSubscriptions();
  });

  const emitFolderChanged = (data: unknown) => eventListeners.get('folderChanged')?.(data);

  it('invalidates only the changed images that are currently displayed', () => {
    emitFolderChanged({ paths: [edited.path, 'C:\\Fotos\\Unterordner', 'C:\\Fotos\\geloescht.jpg'] });

    expect(mockedInvalidateThumbnail).toHaveBeenCalledTimes(1);
    expect(mockedInvalidateThumbnail).toHaveBeenCalledWith(edited.path);
  });

  it('matches Windows paths case-insensitively and invalidates the displayed spelling', () => {
    emitFolderChanged({ paths: ['C:\\FOTOS\\BEARBEITET.JPG'] });

    expect(mockedInvalidateThumbnail).toHaveBeenCalledTimes(1);
    expect(mockedInvalidateThumbnail).toHaveBeenCalledWith(edited.path);
  });

  it('reloads the folder exactly once and survives a payload without paths', () => {
    emitFolderChanged({});

    expect(mockedInvalidateThumbnail).not.toHaveBeenCalled();
    expect(mockedBridge.getFolderContents).toHaveBeenCalledTimes(1);
  });

  it('tolerates a malformed payload without throwing', () => {
    expect(() => emitFolderChanged(null)).not.toThrow();
    expect(() => emitFolderChanged({ paths: 'C:\\Fotos\\bearbeitet.jpg' })).not.toThrow();
    expect(() => emitFolderChanged({ paths: [null, 42, ''] })).not.toThrow();
    expect(mockedInvalidateThumbnail).not.toHaveBeenCalled();
  });
});

describe('uiSlice — includeSubfolders toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      currentFolder: 'C:\\Fotos',
      images: [],
      gridItems: [],
      includeSubfolders: false,
      isGlobalSearch: false,
      isSearching: false,
      searchResults: [],
      error: null,
    });
  });

  it('passes includeSubfolders to the bridge and reloads the current folder', async () => {
    useAppStore.getState().toggleIncludeSubfolders();

    expect(useAppStore.getState().includeSubfolders).toBe(true);
    await vi.waitFor(() => expect(mockedBridge.getFolderContents).toHaveBeenCalledWith('C:\\Fotos', true));
  });

  it('reverts to the non-recursive scope on the second toggle', async () => {
    useAppStore.setState({ includeSubfolders: true });

    useAppStore.getState().toggleIncludeSubfolders();

    expect(useAppStore.getState().includeSubfolders).toBe(false);
    await vi.waitFor(() => expect(mockedBridge.getFolderContents).toHaveBeenCalledWith('C:\\Fotos', false));
  });

  it('leaves global search so the new scope is actually visible', async () => {
    // While search results cover the grid the toggle would otherwise flip state
    // with no visible effect.
    // Solange Suchergebnisse das Grid überdecken, wäre der Schalter sonst wirkungslos.
    useAppStore.setState({ isGlobalSearch: true, searchResults: [makeImage('C:\\anderswo\\x.jpg')] });

    useAppStore.getState().toggleIncludeSubfolders();

    expect(useAppStore.getState().includeSubfolders).toBe(true);
    expect(useAppStore.getState().isGlobalSearch).toBe(false);
    expect(useAppStore.getState().searchResults).toEqual([]);
    await vi.waitFor(() => expect(mockedBridge.getFolderContents).toHaveBeenCalledWith('C:\\Fotos', true));
    expect(mockedBridge.getFolderContents).toHaveBeenCalledTimes(1);
  });
});
