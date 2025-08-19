import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { GridItem } from './ContentGrid';
import { ImageThumbnail } from './ImageThumbnail';
import { VideoThumbnail } from '../video/VideoThumbnail';
import './VirtualizedGrid.css';

interface VirtualizedGridProps {
  items: GridItem[];
  itemHeight: number;
  itemWidth: number;
  containerHeight: number;
  containerWidth: number;
  selectedItems: Set<string>;
  onItemSelect: (itemPath: string, multiSelect?: boolean) => void;
  onItemDoubleClick: (item: GridItem) => void;
  onContextMenu: (event: React.MouseEvent, item: GridItem) => void;
  thumbnailSize: number;
}

interface VirtualItem {
  index: number;
  item: GridItem;
  top: number;
  left: number;
}

export const VirtualizedGrid: React.FC<VirtualizedGridProps> = ({
  items,
  itemHeight,
  itemWidth,
  containerHeight,
  containerWidth,
  selectedItems,
  onItemSelect,
  onItemDoubleClick,
  onContextMenu,
  thumbnailSize,
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate grid dimensions
  const columnsPerRow = Math.floor(containerWidth / itemWidth);
  const totalRows = Math.ceil(items.length / columnsPerRow);
  const totalHeight = totalRows * itemHeight;

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const startRow = Math.floor(scrollTop / itemHeight);
    const endRow = Math.min(
      totalRows - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight)
    );
    
    const startIndex = startRow * columnsPerRow;
    const endIndex = Math.min(items.length - 1, (endRow + 1) * columnsPerRow - 1);
    
    return { startIndex, endIndex, startRow, endRow };
  }, [scrollTop, containerHeight, itemHeight, columnsPerRow, totalRows, items.length]);

  // Generate virtual items for visible range
  const virtualItems = useMemo(() => {
    const result: VirtualItem[] = [];
    
    for (let i = visibleRange.startIndex; i <= visibleRange.endIndex; i++) {
      if (i >= items.length) break;
      
      const row = Math.floor(i / columnsPerRow);
      const col = i % columnsPerRow;
      
      result.push({
        index: i,
        item: items[i],
        top: row * itemHeight,
        left: col * itemWidth,
      });
    }
    
    return result;
  }, [visibleRange, items, columnsPerRow, itemHeight, itemWidth]);

  // Handle scroll events
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    setScrollTop(target.scrollTop);
    setScrollLeft(target.scrollLeft);
  }, []);

  // Render individual grid item
  const renderItem = useCallback((virtualItem: VirtualItem) => {
    const { item, top, left, index } = virtualItem;
    const isSelected = selectedItems.has(item.path);

    const handleClick = (event: React.MouseEvent) => {
      event.preventDefault();
      onItemSelect(item.path, event.ctrlKey || event.metaKey);
    };

    const handleDoubleClick = (event: React.MouseEvent) => {
      event.preventDefault();
      onItemDoubleClick(item);
    };

    const handleContextMenuClick = (event: React.MouseEvent) => {
      event.preventDefault();
      onContextMenu(event, item);
    };

    return (
      <div
        key={`${item.path}-${index}`}
        className={`virtual-grid-item ${isSelected ? 'selected' : ''}`}
        style={{
          position: 'absolute',
          top: `${top}px`,
          left: `${left}px`,
          width: `${itemWidth}px`,
          height: `${itemHeight}px`,
        }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenuClick}
      >
        <div className="virtual-grid-item-content">
          {item.type === 'folder' ? (
            <div className="folder-icon">📁</div>
          ) : item.type === 'image' ? (
            <ImageThumbnail
              filePath={item.path}
              size={thumbnailSize}
              alt={item.name}
            />
          ) : item.type === 'video' ? (
            <VideoThumbnail
              filePath={item.path}
              size={thumbnailSize}
              alt={item.name}
            />
          ) : (
            <div className="file-icon">📄</div>
          )}
          
          <div className="virtual-grid-item-name" title={item.name}>
            {item.name}
          </div>
        </div>
      </div>
    );
  }, [selectedItems, onItemSelect, onItemDoubleClick, onContextMenu, itemWidth, itemHeight, thumbnailSize]);

  return (
    <div
      ref={containerRef}
      className="virtualized-grid"
      style={{ height: containerHeight, width: containerWidth }}
      onScroll={handleScroll}
    >
      <div
        className="virtualized-grid-content"
        style={{ height: totalHeight, position: 'relative' }}
      >
        {virtualItems.map(renderItem)}
      </div>
    </div>
  );
};

// Hook for managing virtualized grid state
export const useVirtualizedGrid = (
  items: GridItem[],
  containerRef: React.RefObject<HTMLElement>,
  itemSize: { width: number; height: number }
) => {
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    
    return () => window.removeEventListener('resize', updateSize);
  }, [containerRef]);

  const shouldVirtualize = items.length > 100; // Virtualize for large collections

  return {
    containerSize,
    shouldVirtualize,
    itemSize,
  };
};
