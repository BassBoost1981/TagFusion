import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../services/bridge', () => ({
  bridge: {
    getDrives: vi.fn(),
    getFolders: vi.fn().mockResolvedValue([]),
    getFolderContents: vi.fn().mockResolvedValue([]),
    watchFolder: vi.fn().mockResolvedValue(true),
    stopWatching: vi.fn().mockResolvedValue(true),
    selectFolder: vi.fn().mockResolvedValue(null),
    getAllTags: vi.fn().mockResolvedValue([]),
  },
}));

import { useAppStore } from '../appStore';
import { bridge } from '../../services/bridge';

const mockedBridge = vi.mocked(bridge);

describe('appStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      currentFolder: 'C:\\Alt',
      gridItems: [],
      images: [],
      selectedImages: new Set<string>(),
      lastSelectedImage: null,
      isLoadingImages: false,
      searchQuery: '',
      filterRating: null,
      filterTags: [],
      sortBy: 'name',
      sortOrder: 'asc',
      error: null,
    });
  });

  it('should update search query', () => {
    useAppStore.getState().setSearchQuery('test search');
    expect(useAppStore.getState().searchQuery).toBe('test search');
  });

  it('should toggle sort order', () => {
    const initialOrder = useAppStore.getState().sortOrder;
    useAppStore.getState().toggleSortOrder();
    expect(useAppStore.getState().sortOrder).toBe(initialOrder === 'asc' ? 'desc' : 'asc');
  });

  it('should clear filters', () => {
    useAppStore.getState().setSearchQuery('some query');
    useAppStore.getState().setFilterRating(4);
    useAppStore.getState().clearFilters();

    expect(useAppStore.getState().searchQuery).toBe('');
    expect(useAppStore.getState().filterRating).toBeNull();
  });

  it('navigateToFolder stops previous watcher before starting a new one', async () => {
    await useAppStore.getState().navigateToFolder('C:\\Fotos');

    expect(mockedBridge.stopWatching).toHaveBeenCalledTimes(1);
    expect(mockedBridge.watchFolder).toHaveBeenCalledWith('C:\\Fotos');
    expect(useAppStore.getState().currentFolder).toBe('C:\\Fotos');
  });

  it('openFolderDialog routes through navigateToFolder and starts watcher', async () => {
    mockedBridge.selectFolder.mockResolvedValueOnce('D:\\Bilder');

    await useAppStore.getState().openFolderDialog();

    expect(mockedBridge.selectFolder).toHaveBeenCalledTimes(1);
    expect(mockedBridge.stopWatching).toHaveBeenCalledTimes(1);
    expect(mockedBridge.watchFolder).toHaveBeenCalledWith('D:\\Bilder');
    expect(useAppStore.getState().currentFolder).toBe('D:\\Bilder');
  });

  it('addFavorite tolerates localStorage write failures', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });

    expect(() => useAppStore.getState().addFavorite('C:\\Fotos', 'Fotos')).not.toThrow();
    expect(useAppStore.getState().favorites).toContainEqual({ path: 'C:\\Fotos', name: 'Fotos' });

    setItemSpy.mockRestore();
  });

  it('removeFavorite tolerates localStorage write failures', () => {
    useAppStore.setState({ favorites: [{ path: 'C:\\Fotos', name: 'Fotos' }] });

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });

    expect(() => useAppStore.getState().removeFavorite('C:\\Fotos')).not.toThrow();
    expect(useAppStore.getState().favorites).toEqual([]);

    setItemSpy.mockRestore();
  });
});
