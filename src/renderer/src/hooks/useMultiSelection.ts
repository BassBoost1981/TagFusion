import { useState, useCallback, useRef, useEffect } from 'react';
import { GridItem } from '../components/content/ContentGrid';

export interface MultiSelectionManager {
  selectedItems: Set<string>;
  lastSelectedIndex: number | null;
  selectionMode: 'single' | 'multi' | 'range';
  
  handleItemClick: (item: GridItem, event: React.MouseEvent, itemIndex: number) => void;
  selectAll: (items: GridItem[]) => void;
  clearSelection: () => void;
  selectRange: (startIndex: number, endIndex: number, items: GridItem[]) => void;
  toggleItem: (itemPath: string) => void;
  isSelected: (itemPath: string) => boolean;
  getSelectedItems: (items: GridItem[]) => GridItem[];
  getSelectionCount: () => number;
}

export const useMultiSelection = (): MultiSelectionManager => {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [selectionMode, setSelectionMode] = useState<'single' | 'multi' | 'range'>('single');
  
  // Ref to track if we're in the middle of a range selection
  const isRangeSelecting = useRef(false);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+A - Select All
      if (event.ctrlKey && event.key === 'a') {
        event.preventDefault();
        // This will be handled by the parent component
        // as it has access to the items array
        return;
      }
      
      // Escape - Clear Selection
      if (event.key === 'Escape') {
        event.preventDefault();
        clearSelection();
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleItemClick = useCallback((item: GridItem, event: React.MouseEvent, itemIndex: number) => {
    event.preventDefault();
    
    const isCtrlClick = event.ctrlKey || event.metaKey; // Support both Ctrl (Windows) and Cmd (Mac)
    const isShiftClick = event.shiftKey;
    
    if (isShiftClick && lastSelectedIndex !== null) {
      // Range selection (Shift+Click)
      setSelectionMode('range');
      isRangeSelecting.current = true;
      
      setSelectedItems(prev => {
        const newSelection = new Set(prev);
        const startIndex = Math.min(lastSelectedIndex, itemIndex);
        const endIndex = Math.max(lastSelectedIndex, itemIndex);
        
        // If we're extending a selection, keep existing items
        // If we're starting fresh, clear first
        if (!isCtrlClick && prev.size === 1) {
          newSelection.clear();
        }
        
        // Add range to selection
        for (let i = startIndex; i <= endIndex; i++) {
          // This will be handled by parent component with actual items array
        }
        
        return newSelection;
      });
      
      // Don't update lastSelectedIndex for range selections
      isRangeSelecting.current = false;
    } else if (isCtrlClick) {
      // Multi-selection (Ctrl+Click)
      setSelectionMode('multi');
      setSelectedItems(prev => {
        const newSelection = new Set(prev);
        if (newSelection.has(item.path)) {
          newSelection.delete(item.path);
        } else {
          newSelection.add(item.path);
        }
        return newSelection;
      });
      setLastSelectedIndex(itemIndex);
    } else {
      // Single selection (normal click)
      setSelectionMode('single');
      setSelectedItems(new Set([item.path]));
      setLastSelectedIndex(itemIndex);
    }
  }, [lastSelectedIndex]);

  const selectAll = useCallback((items: GridItem[]) => {
    setSelectedItems(new Set(items.map(item => item.path)));
    setSelectionMode('multi');
    setLastSelectedIndex(null);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedItems(new Set());
    setLastSelectedIndex(null);
    setSelectionMode('single');
  }, []);

  const selectRange = useCallback((startIndex: number, endIndex: number, items: GridItem[]) => {
    const start = Math.min(startIndex, endIndex);
    const end = Math.max(startIndex, endIndex);
    const rangeItems = items.slice(start, end + 1);
    
    setSelectedItems(prev => {
      const newSelection = new Set(prev);
      rangeItems.forEach(item => newSelection.add(item.path));
      return newSelection;
    });
    setSelectionMode('range');
  }, []);

  const toggleItem = useCallback((itemPath: string) => {
    setSelectedItems(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(itemPath)) {
        newSelection.delete(itemPath);
      } else {
        newSelection.add(itemPath);
      }
      return newSelection;
    });
  }, []);

  const isSelected = useCallback((itemPath: string) => {
    return selectedItems.has(itemPath);
  }, [selectedItems]);

  const getSelectedItems = useCallback((items: GridItem[]) => {
    return items.filter(item => selectedItems.has(item.path));
  }, [selectedItems]);

  const getSelectionCount = useCallback(() => {
    return selectedItems.size;
  }, [selectedItems]);

  return {
    selectedItems,
    lastSelectedIndex,
    selectionMode,
    handleItemClick,
    selectAll,
    clearSelection,
    selectRange,
    toggleItem,
    isSelected,
    getSelectedItems,
    getSelectionCount,
  };
};

// Enhanced hook that handles range selection with items array
export const useMultiSelectionWithItems = (items: GridItem[]) => {
  const baseSelection = useMultiSelection();
  
  const handleItemClick = useCallback((item: GridItem, event: React.MouseEvent) => {
    const itemIndex = items.findIndex(i => i.path === item.path);
    if (itemIndex === -1) return;
    
    const isShiftClick = event.shiftKey;
    const isCtrlClick = event.ctrlKey || event.metaKey;
    
    if (isShiftClick && baseSelection.lastSelectedIndex !== null) {
      // Handle range selection
      event.preventDefault();
      const startIndex = Math.min(baseSelection.lastSelectedIndex, itemIndex);
      const endIndex = Math.max(baseSelection.lastSelectedIndex, itemIndex);
      
      // Use the selectRange method instead
      if (!isCtrlClick) {
        baseSelection.clearSelection();
      }
      baseSelection.selectRange(startIndex, endIndex, items);
    } else {
      // Handle single/multi selection
      baseSelection.handleItemClick(item, event, itemIndex);
    }
  }, [items, baseSelection]);

  const selectAll = useCallback(() => {
    baseSelection.selectAll(items);
  }, [items, baseSelection]);

  // Handle keyboard shortcuts with items context
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle if we have focus on the content area
      const activeElement = document.activeElement;
      const isContentFocused = activeElement?.closest('.content-grid-container') !== null;
      
      if (!isContentFocused) return;
      
      if (event.ctrlKey && event.key === 'a') {
        event.preventDefault();
        selectAll();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectAll]);

  return {
    ...baseSelection,
    handleItemClick,
    selectAll,
  };
};