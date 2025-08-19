import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MediaFile, FolderItem } from '../../../../types/global';
import { VideoThumbnail } from '../video/VideoThumbnail';
import { ImageThumbnail } from './ImageThumbnail';
import { VirtualizedGrid, useVirtualizedGrid } from './VirtualizedGrid';
import { useServices } from '../../services/DIContainer';
import './ContentGrid.css';

export interface GridItem extends MediaFile, FolderItem {
  id: string;
  type: 'folder' | 'image' | 'video';
}

interface ContentGridProps {
  items: GridItem[];
  viewMode: 'grid' | 'list';
  selectedItems: Set<string>;
  onItemSelect: (item: GridItem, event: React.MouseEvent) => void;
  onItemDoubleClick: (item: GridItem) => void;
  onContextMenu: (item: GridItem, event: React.MouseEvent) => void;
  thumbnailSize: number;
  sortBy: 'name' | 'date' | 'size';
  sortOrder: 'asc' | 'desc';
}

export const ContentGrid: React.FC<ContentGridProps> = ({
  items,
  viewMode,
  selectedItems,
  onItemSelect,
  onItemDoubleClick,
  onContextMenu,
  thumbnailSize,
  sortBy,
  sortOrder,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate item dimensions based on view mode and thumbnail size
  const itemDimensions = useMemo(() => {
    if (viewMode === 'grid') {
      return {
        width: thumbnailSize + 32, // padding
        height: thumbnailSize + 60, // space for name
      };
    } else {
      return {
        width: 300,
        height: 40,
      };
    }
  }, [viewMode, thumbnailSize]);

  // Use virtualization hook
  const { containerSize, shouldVirtualize } = useVirtualizedGrid(
    items,
    containerRef,
    itemDimensions
  );

  // Sort items
  const sortedItems = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      let comparison = 0;
      
      // Always put folders first
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'date':
          comparison = new Date(a.dateModified).getTime() - new Date(b.dateModified).getTime();
          break;
        case 'size':
          comparison = (a.size || 0) - (b.size || 0);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }, [items, sortBy, sortOrder]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  const getItemIcon = (item: GridItem): string => {
    switch (item.type) {
      case 'folder':
        return '📁';
      case 'image':
        return '🖼️';
      case 'video':
        return '🎬';
      default:
        return '📄';
    }
  };

  const handleItemClick = useCallback((item: GridItem, event: React.MouseEvent) => {
    onItemSelect(item, event);
  }, [onItemSelect]);

  const handleItemDoubleClick = useCallback((item: GridItem) => {
    onItemDoubleClick(item);
  }, [onItemDoubleClick]);

  const handleContextMenu = useCallback((item: GridItem, event: React.MouseEvent) => {
    onContextMenu(item, event);
  }, [onContextMenu]);

  if (viewMode === 'list') {
    return (
      <div className="content-list" ref={containerRef}>
          <div className="list-header">
            <div className="col-name">Name</div>
            <div className="col-size">Size</div>
            <div className="col-date">Modified</div>
          </div>
          {sortedItems.map((item) => (
            <div
              key={item.id}
              className={`list-item ${selectedItems.has(item.path) ? 'selected' : ''}`}
              onClick={(e) => handleItemClick(item, e)}
              onDoubleClick={() => handleItemDoubleClick(item)}
              onContextMenu={(e) => handleContextMenu(item, e)}
            >
              <div className="col-name">
                <span className="item-icon">{getItemIcon(item)}</span>
                <span className="item-name">{item.name}</span>
              </div>
              <div className="col-size">
                {item.type === 'folder' 
                  ? `${item.mediaCount || 0} items`
                  : formatFileSize(item.size || 0)
                }
              </div>
              <div className="col-date">
                {formatDate(item.dateModified)}
              </div>
            </div>
          ))}
      </div>
    );
  }

  // Use virtualized grid for large collections
  if (shouldVirtualize && viewMode === 'grid') {
    return (
      <div ref={containerRef} className="content-grid-container">
        <VirtualizedGrid
          items={sortedItems}
          itemHeight={itemDimensions.height}
          itemWidth={itemDimensions.width}
          containerHeight={containerSize.height}
          containerWidth={containerSize.width}
          selectedItems={selectedItems}
          onItemSelect={onItemSelect}
          onItemDoubleClick={onItemDoubleClick}
          onContextMenu={(event, item) => onContextMenu(item, event)}
          thumbnailSize={thumbnailSize}
        />
      </div>
    );
  }

  // Regular grid view for smaller collections
  return (
    <div
      className="content-grid"
      ref={containerRef}
      style={{
        gridTemplateColumns: `repeat(auto-fill, minmax(${thumbnailSize + 40}px, 1fr))`,
      }}
    >
        {sortedItems.map((item) => (
          <div
            key={item.id}
            className={`grid-item ${item.type} ${selectedItems.has(item.path) ? 'selected' : ''}`}
            onClick={(e) => handleItemClick(item, e)}
            onDoubleClick={() => handleItemDoubleClick(item)}
            onContextMenu={(e) => handleContextMenu(item, e)}
          >
            <div 
              className="item-thumbnail"
              style={{ width: thumbnailSize, height: thumbnailSize }}
            >
              {item.type === 'video' ? (
                <VideoThumbnail
                  filePath={item.path}
                  size={thumbnailSize}
                  className="thumbnail-image"
                />
              ) : item.type === 'image' ? (
                <ImageThumbnail
                  filePath={item.path}
                  size={thumbnailSize}
                  className="thumbnail-image"
                />
              ) : (
                <div className="folder-thumbnail">
                  <span className="item-icon">{getItemIcon(item)}</span>
                </div>
              )}
            </div>
            <div className="item-info">
              <div className="item-name" title={item.name}>
                {item.name}
              </div>
              <div className="item-size">
                {item.type === 'folder' 
                  ? `${item.mediaCount || 0} items`
                  : formatFileSize(item.size || 0)
                }
              </div>
            </div>
          </div>
        ))}
    </div>
  );
};