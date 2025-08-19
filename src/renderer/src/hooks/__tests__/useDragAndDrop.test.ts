import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useDragAndDrop } from '../useDragAndDrop';
import { MediaFile, FolderItem, HierarchicalTag } from '../../../../types/global';

// Mock DOM methods
Object.defineProperty(document, 'createElement', {
  value: vi.fn(() => ({
    style: { cssText: '' },
    className: '',
    appendChild: vi.fn(),
    removeChild: vi.fn(),
  })),
});

Object.defineProperty(document.body, 'appendChild', {
  value: vi.fn(),
});

Object.defineProperty(document.body, 'removeChild', {
  value: vi.fn(),
});

Object.defineProperty(document.body, 'contains', {
  value: vi.fn(() => true),
});

describe('useDragAndDrop', () => {
  const mockMediaFile: MediaFile = {
    path: '/test/image.jpg',
    name: 'image.jpg',
    extension: '.jpg',
    size: 1024,
    dateModified: new Date(),
    type: 'image',
  };

  const mockFolderItem: FolderItem = {
    name: 'Test Folder',
    path: '/test/folder',
    hasSubfolders: false,
    mediaCount: 5,
  };

  const mockTag: HierarchicalTag = {
    category: 'Nature',
    subcategory: 'Landscape',
    tag: 'Mountains',
    fullPath: 'Nature/Landscape/Mountains',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useDragAndDrop());

    expect(result.current.dragState.isDragging).toBe(false);
    expect(result.current.dragState.dragData).toBeNull();
    expect(result.current.dragState.dropTarget).toBeNull();
    expect(result.current.dragState.isValidDrop).toBe(false);
  });

  it('should create drag preview for single file', () => {
    const { result } = renderHook(() => useDragAndDrop());

    const dragData = {
      type: 'files' as const,
      items: [mockMediaFile],
      sourceId: 'test-source',
    };

    const mockEvent = {
      dataTransfer: {
        effectAllowed: '',
        setData: vi.fn(),
        setDragImage: vi.fn(),
      },
      clientX: 100,
      clientY: 200,
    } as any;

    act(() => {
      result.current.handlers.onDragStart(dragData, mockEvent);
    });

    expect(result.current.dragState.isDragging).toBe(true);
    expect(result.current.dragState.dragPreview).toBe('image.jpg');
    expect(result.current.dragState.dragPosition).toEqual({ x: 100, y: 200 });
  });

  it('should create drag preview for multiple files', () => {
    const { result } = renderHook(() => useDragAndDrop());

    const dragData = {
      type: 'files' as const,
      items: [mockMediaFile, { ...mockMediaFile, name: 'image2.jpg' }],
      sourceId: 'test-source',
    };

    const mockEvent = {
      dataTransfer: {
        effectAllowed: '',
        setData: vi.fn(),
        setDragImage: vi.fn(),
      },
      clientX: 100,
      clientY: 200,
    } as any;

    act(() => {
      result.current.handlers.onDragStart(dragData, mockEvent);
    });

    expect(result.current.dragState.dragPreview).toBe('2 files');
  });

  it('should validate drop targets correctly', () => {
    const { result } = renderHook(() => useDragAndDrop());

    const filesDragData = {
      type: 'files' as const,
      items: [mockMediaFile],
      sourceId: 'test-source',
    };

    const folderDropTarget = {
      type: 'folder' as const,
      id: 'folder-1',
      data: mockFolderItem,
    };

    const mockEvent = {
      dataTransfer: {
        effectAllowed: '',
        setData: vi.fn(),
        setDragImage: vi.fn(),
      },
      clientX: 100,
      clientY: 200,
    } as any;

    // Start drag
    act(() => {
      result.current.handlers.onDragStart(filesDragData, mockEvent);
    });

    // Test drag over valid target
    const mockDragOverEvent = {
      preventDefault: vi.fn(),
      dataTransfer: { dropEffect: '' },
      currentTarget: document.createElement('div'),
    } as any;

    act(() => {
      result.current.handlers.onDragEnter(folderDropTarget, mockDragOverEvent);
    });

    expect(result.current.dragState.isValidDrop).toBe(true);
    expect(result.current.dragState.dropTarget).toBe(folderDropTarget);
  });

  it('should handle drag end correctly', () => {
    const { result } = renderHook(() => useDragAndDrop());

    const dragData = {
      type: 'files' as const,
      items: [mockMediaFile],
      sourceId: 'test-source',
    };

    const mockEvent = {
      dataTransfer: {
        effectAllowed: '',
        setData: vi.fn(),
        setDragImage: vi.fn(),
      },
      clientX: 100,
      clientY: 200,
    } as any;

    // Start drag
    act(() => {
      result.current.handlers.onDragStart(dragData, mockEvent);
    });

    expect(result.current.dragState.isDragging).toBe(true);

    // End drag
    act(() => {
      result.current.handlers.onDragEnd();
    });

    expect(result.current.dragState.isDragging).toBe(false);
    expect(result.current.dragState.dragData).toBeNull();
    expect(result.current.dragState.dropTarget).toBeNull();
  });

  it('should call appropriate handlers on drop', () => {
    const mockOnFilesToFolder = vi.fn();
    const { result } = renderHook(() => 
      useDragAndDrop({ onFilesToFolder: mockOnFilesToFolder })
    );

    const dragData = {
      type: 'files' as const,
      items: [mockMediaFile],
      sourceId: 'test-source',
    };

    const dropTarget = {
      type: 'folder' as const,
      id: 'folder-1',
      data: mockFolderItem,
    };

    const mockDragEvent = {
      dataTransfer: {
        effectAllowed: '',
        setData: vi.fn(),
        setDragImage: vi.fn(),
      },
      clientX: 100,
      clientY: 200,
    } as any;

    const mockDropEvent = {
      preventDefault: vi.fn(),
      dataTransfer: {
        getData: vi.fn(() => JSON.stringify(dragData)),
      },
    } as any;

    // Start drag
    act(() => {
      result.current.handlers.onDragStart(dragData, mockDragEvent);
    });

    // Enter drop target
    const mockDragEnterEvent = {
      preventDefault: vi.fn(),
      currentTarget: document.createElement('div'),
    } as any;

    act(() => {
      result.current.handlers.onDragEnter(dropTarget, mockDragEnterEvent);
    });

    // Drop
    act(() => {
      result.current.handlers.onDrop(dropTarget, mockDropEvent);
    });

    expect(mockOnFilesToFolder).toHaveBeenCalledWith([mockMediaFile], mockFolderItem);
  });

  it('should prevent invalid drops', () => {
    const { result } = renderHook(() => useDragAndDrop());

    const tagDragData = {
      type: 'tags' as const,
      items: [mockTag],
      sourceId: 'tag-1',
    };

    const folderDropTarget = {
      type: 'folder' as const,
      id: 'folder-1',
      data: mockFolderItem,
    };

    const mockEvent = {
      dataTransfer: {
        effectAllowed: '',
        setData: vi.fn(),
        setDragImage: vi.fn(),
      },
      clientX: 100,
      clientY: 200,
    } as any;

    // Start drag
    act(() => {
      result.current.handlers.onDragStart(tagDragData, mockEvent);
    });

    // Test drag over invalid target
    const mockDragOverEvent = {
      preventDefault: vi.fn(),
      dataTransfer: { dropEffect: '' },
      currentTarget: document.createElement('div'),
    } as any;

    act(() => {
      result.current.handlers.onDragEnter(folderDropTarget, mockDragOverEvent);
    });

    expect(result.current.dragState.isValidDrop).toBe(false);
  });

  it('should handle custom preview text', () => {
    const { result } = renderHook(() => useDragAndDrop());

    const dragData = {
      type: 'files' as const,
      items: [mockMediaFile],
      sourceId: 'test-source',
      previewText: 'Custom Preview Text',
    };

    const mockEvent = {
      dataTransfer: {
        effectAllowed: '',
        setData: vi.fn(),
        setDragImage: vi.fn(),
      },
      clientX: 100,
      clientY: 200,
    } as any;

    act(() => {
      result.current.handlers.onDragStart(dragData, mockEvent);
    });

    expect(result.current.dragState.dragPreview).toBe('Custom Preview Text');
  });
});