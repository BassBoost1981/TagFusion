import { renderHook, act } from '@testing-library/react';
import { useMultiSelection, useMultiSelectionWithItems } from '../useMultiSelection';
import { GridItem } from '../../components/content/ContentGrid';

const mockItems: GridItem[] = [
  {
    id: '1',
    name: 'item1.jpg',
    path: 'C:\\item1.jpg',
    type: 'image',
    dateModified: new Date('2024-01-15'),
    hasSubfolders: false,
    mediaCount: 0,
    extension: '.jpg',
    size: 1000000,
  },
  {
    id: '2',
    name: 'item2.jpg',
    path: 'C:\\item2.jpg',
    type: 'image',
    dateModified: new Date('2024-01-14'),
    hasSubfolders: false,
    mediaCount: 0,
    extension: '.jpg',
    size: 2000000,
  },
  {
    id: '3',
    name: 'item3.jpg',
    path: 'C:\\item3.jpg',
    type: 'image',
    dateModified: new Date('2024-01-13'),
    hasSubfolders: false,
    mediaCount: 0,
    extension: '.jpg',
    size: 3000000,
  },
];

import { vi } from 'vitest';

// Mock mouse event
const createMockMouseEvent = (options: { ctrlKey?: boolean; shiftKey?: boolean } = {}) => ({
  preventDefault: vi.fn(),
  ctrlKey: options.ctrlKey || false,
  shiftKey: options.shiftKey || false,
  metaKey: false,
} as unknown as React.MouseEvent);

describe('useMultiSelection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with empty selection', () => {
    const { result } = renderHook(() => useMultiSelection());
    
    expect(result.current.selectedItems.size).toBe(0);
    expect(result.current.lastSelectedIndex).toBe(null);
    expect(result.current.selectionMode).toBe('single');
  });

  it('handles single selection', () => {
    const { result } = renderHook(() => useMultiSelection());
    
    act(() => {
      result.current.handleItemClick(mockItems[0], createMockMouseEvent(), 0);
    });
    
    expect(result.current.selectedItems.has('C:\\item1.jpg')).toBe(true);
    expect(result.current.selectedItems.size).toBe(1);
    expect(result.current.lastSelectedIndex).toBe(0);
    expect(result.current.selectionMode).toBe('single');
  });

  it('handles multi-selection with Ctrl+Click', () => {
    const { result } = renderHook(() => useMultiSelection());
    
    // First selection
    act(() => {
      result.current.handleItemClick(mockItems[0], createMockMouseEvent(), 0);
    });
    
    // Add second item with Ctrl
    act(() => {
      result.current.handleItemClick(mockItems[1], createMockMouseEvent({ ctrlKey: true }), 1);
    });
    
    expect(result.current.selectedItems.has('C:\\item1.jpg')).toBe(true);
    expect(result.current.selectedItems.has('C:\\item2.jpg')).toBe(true);
    expect(result.current.selectedItems.size).toBe(2);
    expect(result.current.selectionMode).toBe('multi');
  });

  it('toggles selection with Ctrl+Click', () => {
    const { result } = renderHook(() => useMultiSelection());
    
    // Select item
    act(() => {
      result.current.handleItemClick(mockItems[0], createMockMouseEvent(), 0);
    });
    
    // Toggle off with Ctrl+Click
    act(() => {
      result.current.handleItemClick(mockItems[0], createMockMouseEvent({ ctrlKey: true }), 0);
    });
    
    expect(result.current.selectedItems.has('C:\\item1.jpg')).toBe(false);
    expect(result.current.selectedItems.size).toBe(0);
  });

  it('selects all items', () => {
    const { result } = renderHook(() => useMultiSelection());
    
    act(() => {
      result.current.selectAll(mockItems);
    });
    
    expect(result.current.selectedItems.size).toBe(3);
    expect(result.current.selectedItems.has('C:\\item1.jpg')).toBe(true);
    expect(result.current.selectedItems.has('C:\\item2.jpg')).toBe(true);
    expect(result.current.selectedItems.has('C:\\item3.jpg')).toBe(true);
    expect(result.current.selectionMode).toBe('multi');
  });

  it('clears selection', () => {
    const { result } = renderHook(() => useMultiSelection());
    
    // First select some items
    act(() => {
      result.current.selectAll(mockItems);
    });
    
    // Then clear
    act(() => {
      result.current.clearSelection();
    });
    
    expect(result.current.selectedItems.size).toBe(0);
    expect(result.current.lastSelectedIndex).toBe(null);
    expect(result.current.selectionMode).toBe('single');
  });

  it('selects range of items', () => {
    const { result } = renderHook(() => useMultiSelection());
    
    act(() => {
      result.current.selectRange(0, 2, mockItems);
    });
    
    expect(result.current.selectedItems.size).toBe(3);
    expect(result.current.selectedItems.has('C:\\item1.jpg')).toBe(true);
    expect(result.current.selectedItems.has('C:\\item2.jpg')).toBe(true);
    expect(result.current.selectedItems.has('C:\\item3.jpg')).toBe(true);
    expect(result.current.selectionMode).toBe('range');
  });

  it('gets selected items correctly', () => {
    const { result } = renderHook(() => useMultiSelection());
    
    act(() => {
      result.current.handleItemClick(mockItems[0], createMockMouseEvent(), 0);
      result.current.handleItemClick(mockItems[2], createMockMouseEvent({ ctrlKey: true }), 2);
    });
    
    const selectedItems = result.current.getSelectedItems(mockItems);
    expect(selectedItems).toHaveLength(2);
    expect(selectedItems[0].name).toBe('item1.jpg');
    expect(selectedItems[1].name).toBe('item3.jpg');
  });

  it('returns correct selection count', () => {
    const { result } = renderHook(() => useMultiSelection());
    
    expect(result.current.getSelectionCount()).toBe(0);
    
    act(() => {
      result.current.handleItemClick(mockItems[0], createMockMouseEvent(), 0);
    });
    
    expect(result.current.getSelectionCount()).toBe(1);
    
    act(() => {
      result.current.selectAll(mockItems);
    });
    
    expect(result.current.getSelectionCount()).toBe(3);
  });
});

describe('useMultiSelectionWithItems', () => {
  it('handles range selection with Shift+Click', () => {
    const { result } = renderHook(() => useMultiSelectionWithItems(mockItems));
    
    // First selection
    act(() => {
      result.current.handleItemClick(mockItems[0], createMockMouseEvent(), 0);
    });
    
    // Range selection with Shift
    act(() => {
      result.current.handleItemClick(mockItems[2], createMockMouseEvent({ shiftKey: true }), 2);
    });
    
    expect(result.current.selectedItems.size).toBe(3);
    expect(result.current.selectedItems.has('C:\\item1.jpg')).toBe(true);
    expect(result.current.selectedItems.has('C:\\item2.jpg')).toBe(true);
    expect(result.current.selectedItems.has('C:\\item3.jpg')).toBe(true);
  });

  it('extends range selection with Ctrl+Shift+Click', () => {
    const { result } = renderHook(() => useMultiSelectionWithItems(mockItems));
    
    // First selection
    act(() => {
      result.current.handleItemClick(mockItems[0], createMockMouseEvent(), 0);
    });
    
    // Add another item with Ctrl
    act(() => {
      result.current.handleItemClick(mockItems[2], createMockMouseEvent({ ctrlKey: true }), 2);
    });
    
    // Now extend range with Ctrl+Shift (should keep existing selection)
    act(() => {
      result.current.handleItemClick(mockItems[1], createMockMouseEvent({ ctrlKey: true, shiftKey: true }), 1);
    });
    
    expect(result.current.selectedItems.size).toBe(3);
  });
});