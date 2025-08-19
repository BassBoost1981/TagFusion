import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useContextMenu, ContextMenuHandlers } from '../useContextMenu';
import { MediaFile, FolderItem, HierarchicalTag } from '../../../../types/global';

describe('useContextMenu', () => {
  const mockMediaFile: MediaFile = {
    path: '/test/image.jpg',
    name: 'image.jpg',
    extension: '.jpg',
    size: 1024,
    dateModified: new Date(),
    type: 'image'
  };

  const mockFolderItem: FolderItem = {
    name: 'Test Folder',
    path: '/test/folder',
    hasSubfolders: true,
    mediaCount: 5
  };

  const mockTag: HierarchicalTag = {
    category: 'Nature',
    subcategory: 'Landscape',
    tag: 'Mountains',
    fullPath: 'Nature/Landscape/Mountains'
  };

  const mockHandlers: ContextMenuHandlers = {
    onEdit: vi.fn(),
    onFullscreen: vi.fn(),
    onAddTags: vi.fn(),
    onRate: vi.fn(),
    onCopy: vi.fn(),
    onCut: vi.fn(),
    onDelete: vi.fn(),
    onProperties: vi.fn(),
    onOpen: vi.fn(),
    onAddFavorite: vi.fn(),
    onBatchTag: vi.fn(),
    onEditTag: vi.fn(),
    onDeleteTag: vi.fn(),
    onAddSubcategory: vi.fn(),
    onExportTag: vi.fn(),
    onRenameFavorite: vi.fn(),
    onRemoveFavorite: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with no context menu', () => {
    const { result } = renderHook(() => useContextMenu(mockHandlers));
    expect(result.current.contextMenu).toBeNull();
  });

  it('shows context menu for file', () => {
    const { result } = renderHook(() => useContextMenu(mockHandlers));

    const mockEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      clientX: 100,
      clientY: 200
    } as any;

    act(() => {
      result.current.showContextMenu(mockEvent, mockMediaFile, 'file');
    });

    expect(result.current.contextMenu).not.toBeNull();
    expect(result.current.contextMenu?.position).toEqual({ x: 100, y: 200 });
    expect(result.current.contextMenu?.target).toBe(mockMediaFile);
    expect(result.current.contextMenu?.targetType).toBe('file');
  });

  it('shows context menu for folder', () => {
    const { result } = renderHook(() => useContextMenu(mockHandlers));

    const mockEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      clientX: 150,
      clientY: 250
    } as any;

    act(() => {
      result.current.showContextMenu(mockEvent, mockFolderItem, 'folder');
    });

    expect(result.current.contextMenu?.target).toBe(mockFolderItem);
    expect(result.current.contextMenu?.targetType).toBe('folder');
  });

  it('shows context menu for tag', () => {
    const { result } = renderHook(() => useContextMenu(mockHandlers));

    const mockEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      clientX: 200,
      clientY: 300
    } as any;

    act(() => {
      result.current.showContextMenu(mockEvent, mockTag, 'tag');
    });

    expect(result.current.contextMenu?.target).toBe(mockTag);
    expect(result.current.contextMenu?.targetType).toBe('tag');
  });

  it('hides context menu', () => {
    const { result } = renderHook(() => useContextMenu(mockHandlers));

    const mockEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      clientX: 100,
      clientY: 200
    } as any;

    act(() => {
      result.current.showContextMenu(mockEvent, mockMediaFile, 'file');
    });

    expect(result.current.contextMenu).not.toBeNull();

    act(() => {
      result.current.hideContextMenu();
    });

    expect(result.current.contextMenu).toBeNull();
  });

  it('handles edit action for file', () => {
    const { result } = renderHook(() => useContextMenu(mockHandlers));

    act(() => {
      result.current.handleContextMenuAction({
        type: 'edit',
        target: mockMediaFile
      });
    });

    expect(mockHandlers.onEdit).toHaveBeenCalledWith(mockMediaFile);
  });

  it('handles rate action with payload', () => {
    const { result } = renderHook(() => useContextMenu(mockHandlers));

    act(() => {
      result.current.handleContextMenuAction({
        type: 'rate',
        target: mockMediaFile,
        payload: 5
      });
    });

    expect(mockHandlers.onRate).toHaveBeenCalledWith([mockMediaFile], 5);
  });

  it('handles multiple selection actions', () => {
    const { result } = renderHook(() => useContextMenu(mockHandlers));
    const selectedItems = [mockMediaFile];

    act(() => {
      result.current.handleContextMenuAction({
        type: 'copy',
        selectedItems
      });
    });

    expect(mockHandlers.onCopy).toHaveBeenCalledWith(selectedItems);
  });

  it('handles folder actions', () => {
    const { result } = renderHook(() => useContextMenu(mockHandlers));

    act(() => {
      result.current.handleContextMenuAction({
        type: 'open',
        target: mockFolderItem
      });
    });

    expect(mockHandlers.onOpen).toHaveBeenCalledWith(mockFolderItem);
  });

  it('handles tag actions', () => {
    const { result } = renderHook(() => useContextMenu(mockHandlers));

    act(() => {
      result.current.handleContextMenuAction({
        type: 'editTag',
        target: mockTag
      });
    });

    expect(mockHandlers.onEditTag).toHaveBeenCalledWith(mockTag);
  });

  it('generates correct file context menu items', () => {
    const { result } = renderHook(() => useContextMenu(mockHandlers));

    const mockEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      clientX: 100,
      clientY: 200
    } as any;

    act(() => {
      result.current.showContextMenu(mockEvent, mockMediaFile, 'file');
    });

    const items = result.current.contextMenu?.items || [];
    const editItem = items.find(item => item.id === 'edit');
    const ratingItem = items.find(item => item.id === 'rating');

    expect(editItem).toBeDefined();
    expect(editItem?.label).toBe('Bearbeiten');
    expect(editItem?.shortcut).toBe('Enter');

    expect(ratingItem).toBeDefined();
    expect(ratingItem?.submenu).toHaveLength(5);
  });

  it('generates correct folder context menu items', () => {
    const { result } = renderHook(() => useContextMenu(mockHandlers));

    const mockEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      clientX: 100,
      clientY: 200
    } as any;

    act(() => {
      result.current.showContextMenu(mockEvent, mockFolderItem, 'folder');
    });

    const items = result.current.contextMenu?.items || [];
    const openItem = items.find(item => item.id === 'open');
    const favoriteItem = items.find(item => item.id === 'addFavorite');

    expect(openItem).toBeDefined();
    expect(openItem?.label).toBe('Öffnen');

    expect(favoriteItem).toBeDefined();
    expect(favoriteItem?.label).toBe('Als Favorit hinzufügen');
  });

  it('generates correct tag context menu items', () => {
    const { result } = renderHook(() => useContextMenu(mockHandlers));

    const mockEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      clientX: 100,
      clientY: 200
    } as any;

    act(() => {
      result.current.showContextMenu(mockEvent, mockTag, 'tag');
    });

    const items = result.current.contextMenu?.items || [];
    const editItem = items.find(item => item.id === 'editTag');
    const deleteItem = items.find(item => item.id === 'deleteTag');

    expect(editItem).toBeDefined();
    expect(editItem?.label).toBe('Bearbeiten');

    expect(deleteItem).toBeDefined();
    expect(deleteItem?.label).toBe('Löschen');
  });

  it('generates correct multiple selection context menu', () => {
    const { result } = renderHook(() => useContextMenu(mockHandlers));
    const selectedItems = [mockMediaFile, mockFolderItem];

    const mockEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      clientX: 100,
      clientY: 200
    } as any;

    act(() => {
      result.current.showContextMenu(mockEvent, mockMediaFile, 'multiple', selectedItems);
    });

    const items = result.current.contextMenu?.items || [];
    const tagItem = items.find(item => item.id === 'addTags');
    const copyItem = items.find(item => item.id === 'copy');

    expect(tagItem).toBeDefined();
    expect(tagItem?.label).toBe('1 Dateien taggen');

    expect(copyItem).toBeDefined();
    expect(copyItem?.label).toBe('2 Elemente kopieren');
  });
});
