import React, { useState, useCallback, useEffect } from 'react';
import { ContentGrid, GridItem } from '../content/ContentGrid';
import { useMultiSelectionWithItems } from '../../hooks/useMultiSelection';
import { useContextMenuContext } from '../../contexts/ContextMenuContext';
import { LoadingSpinner, LoadingState } from '../common/LoadingSpinner';
import { useServices } from '../../services/DIContainer';
import { MediaFile, FolderItem, HierarchicalTag } from '../../../../types/global';
import './CenterPanel.css';

interface CenterPanelProps {
  currentPath: string;
  searchQuery?: string;
  activeFilters?: any;
  onNavigate: (path: string) => void;
  onItemEdit?: (item: GridItem) => void;
  onItemView?: (item: GridItem) => void;
  selectedItems: Set<string>;
  onItemSelect: (itemPath: string, multiSelect?: boolean) => void;
  onFilesChange?: (files: MediaFile[]) => void;
}

export const CenterPanel: React.FC<CenterPanelProps> = ({
  currentPath,
  searchQuery = '',
  activeFilters,
  onNavigate,
  onItemEdit,
  onItemView,
  selectedItems,
  onItemSelect,
  onFilesChange,
}) => {
  const { showContextMenu } = useContextMenuContext();
  const { fileSystemService } = useServices();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [thumbnailSize, setThumbnailSize] = useState(80);
  const [items, setItems] = useState<GridItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<GridItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Search and filter function
  const filterItems = useCallback((items: GridItem[], query: string, filters?: any) => {
    let filtered = [...items];

    // Apply search query
    if (query.trim()) {
      const searchTerm = query.toLowerCase();

      // Check for special search patterns
      if (query.startsWith('tag:')) {
        const tagName = query.substring(4).toLowerCase();
        // Filter by tag (would need metadata integration)
        filtered = filtered.filter(item => {
          // This would need to check item metadata for tags
          return item.name.toLowerCase().includes(tagName);
        });
      } else if (query.startsWith('filename:')) {
        const filename = query.substring(9).toLowerCase();
        filtered = filtered.filter(item =>
          item.name.toLowerCase().includes(filename)
        );
      } else if (query.startsWith('extension:')) {
        const ext = query.substring(10).toLowerCase();
        filtered = filtered.filter(item =>
          item.name.toLowerCase().endsWith(`.${ext}`)
        );
      } else {
        // General search in filename
        filtered = filtered.filter(item =>
          item.name.toLowerCase().includes(searchTerm)
        );
      }
    }

    // Apply additional filters
    if (filters?.fileTypes && filters.fileTypes.length > 0) {
      filtered = filtered.filter(item =>
        filters.fileTypes.includes(item.type)
      );
    }

    return filtered;
  }, []);

  // Update filtered items when search query or items change
  useEffect(() => {
    const filtered = filterItems(items, searchQuery, activeFilters);
    setFilteredItems(filtered);
  }, [items, searchQuery, activeFilters, filterItems]);

  // Load directory contents when path changes
  useEffect(() => {
    const loadDirectoryContents = async () => {
      setLoading(true);
      try {
        const contents = await fileSystemService.getDirectoryContents(currentPath);
        
        const gridItems: GridItem[] = [
          // Add folders first
          ...contents.folders.map((folder: any, index: number) => ({
            id: `folder-${index}`,
            name: folder.name,
            path: folder.path,
            type: 'folder' as const,
            dateModified: new Date(folder.dateModified),
            hasSubfolders: folder.hasSubfolders || false,
            mediaCount: folder.mediaCount || 0,
            extension: '',
            size: 0,
          })),
          // Add files
          ...contents.files.map((file: any, index: number) => ({
            id: `file-${index}`,
            name: file.name,
            path: file.path,
            type: file.type as 'image' | 'video',
            size: file.size,
            dateModified: new Date(file.dateModified),
            extension: file.extension,
            hasSubfolders: false,
            mediaCount: 0,
          })),
        ];
        
        setItems(gridItems);
        
        // Extract MediaFiles and notify parent
        const mediaFiles = gridItems
          .filter(item => item.type === 'image' || item.type === 'video')
          .map(item => ({
            path: item.path,
            name: item.name,
            size: item.size,
            dateModified: item.dateModified,
            dateCreated: item.dateModified, // Use dateModified as fallback
            extension: item.extension,
            type: item.type as 'image' | 'video',
          }));
        
        if (onFilesChange) {
          onFilesChange(mediaFiles);
        }
      } catch (error) {
        console.error('Failed to load directory contents:', error);
        setItems([]);
        if (onFilesChange) {
          onFilesChange([]);
        }
      } finally {
        setLoading(false);
      }
    };

    loadDirectoryContents();
  }, [currentPath, fileSystemService]);

  // Fallback mock data for development
  const [mockItems] = useState<GridItem[]>([
    {
      id: '1',
      name: 'Documents',
      path: currentPath + 'Documents\\',
      type: 'folder',
      dateModified: new Date('2024-01-15'),
      hasSubfolders: true,
      mediaCount: 25,
      extension: '',
      size: 0,
    },
    {
      id: '2',
      name: 'Pictures',
      path: currentPath + 'Pictures\\',
      type: 'folder',
      dateModified: new Date('2024-01-14'),
      hasSubfolders: true,
      mediaCount: 150,
      extension: '',
      size: 0,
    },
    {
      id: '3',
      name: 'vacation.jpg',
      path: currentPath + 'vacation.jpg',
      type: 'image',
      size: 2500000,
      dateModified: new Date('2024-01-13'),
      extension: '.jpg',
      hasSubfolders: false,
      mediaCount: 0,
    },
    {
      id: '4',
      name: 'sunset.png',
      path: currentPath + 'sunset.png',
      type: 'image',
      size: 1800000,
      dateModified: new Date('2024-01-12'),
      extension: '.png',
      hasSubfolders: false,
      mediaCount: 0,
    },
    {
      id: '5',
      name: 'family_video.mp4',
      path: currentPath + 'family_video.mp4',
      type: 'video',
      size: 15000000,
      dateModified: new Date('2024-01-11'),
      extension: '.mp4',
      hasSubfolders: false,
      mediaCount: 0,
    },
  ]);

  // Use mock data if no real data is available (for development)
  const displayItems = items.length > 0 ? items : mockItems;
  
  // Update files when using mock data
  useEffect(() => {
    if (items.length === 0 && onFilesChange) {
      const mockMediaFiles = mockItems
        .filter(item => item.type === 'image' || item.type === 'video')
        .map(item => ({
          path: item.path,
          name: item.name,
          size: item.size,
          dateModified: item.dateModified,
          dateCreated: item.dateModified,
          extension: item.extension,
          type: item.type as 'image' | 'video',
        }));
      onFilesChange(mockMediaFiles);
    }
  }, [items.length, onFilesChange, mockItems]);

  // Initialize multi-selection hook
  const multiSelection = useMultiSelectionWithItems(displayItems);

  // Handle item selection
  const handleItemSelect = useCallback((item: GridItem, event: React.MouseEvent) => {
    const isMultiSelect = event.ctrlKey || event.metaKey;
    onItemSelect(item.path, isMultiSelect);
    multiSelection.handleItemClick(item, event);
  }, [onItemSelect, multiSelection]);

  // Handle keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle if we have focus on the content area
      const activeElement = document.activeElement;
      const isContentFocused = activeElement?.closest('.center-panel') !== null;
      
      if (!isContentFocused) return;
      
      if (event.ctrlKey) {
        switch (event.key) {
          case '1':
            event.preventDefault();
            setViewMode('grid');
            break;
          case '2':
            event.preventDefault();
            setViewMode('list');
            break;
          case 'a':
            event.preventDefault();
            multiSelection.selectAll();
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [multiSelection]);

  const handleItemDoubleClick = useCallback(async (item: GridItem) => {
    if (item.type === 'folder') {
      onNavigate(item.path);
    } else if (item.type === 'image') {
      // For images, open image editor
      try {
        const result = await window.electronAPI?.editor?.open(item as MediaFile);
        if (result?.success) {
          console.log('Image editor opened successfully for:', item.path);
        } else {
          console.error('Failed to open image editor:', result?.error);
        }
      } catch (error) {
        console.error('Failed to open image editor:', error);
      }
    } else if (item.type === 'video') {
      // For videos, open fullscreen viewer
      try {
        const result = await window.electronAPI?.viewer?.openFullscreen(item.path, [item.path]);
        if (result?.success) {
          console.log('Fullscreen viewer opened successfully for:', item.path);
        } else {
          console.error('Failed to open fullscreen viewer:', result?.error);
        }
      } catch (error) {
        console.error('Failed to open fullscreen viewer:', error);
      }
      console.log('electronAPI available:', !!window.electronAPI);
      console.log('viewer available:', !!window.electronAPI?.viewer);
      console.log('openFullscreen available:', !!window.electronAPI?.viewer?.openFullscreen);
      
      try {
        if (!window.electronAPI?.viewer?.openFullscreen) {
          console.error('Viewer API not available');
          return;
        }
        
        // Get all media files for navigation
        const mediaFiles = displayItems
          .filter(i => i.type === 'image' || i.type === 'video')
          .map(i => i.path);
        
        console.log('Calling viewer.openFullscreen with', mediaFiles.length, 'files');
        const result = await window.electronAPI.viewer.openFullscreen(item.path, mediaFiles);
        console.log('Viewer result:', result);
        
        if (result?.success) {
          console.log('Successfully opened fullscreen viewer');
        } else {
          console.error('Failed to open fullscreen viewer:', result?.error);
        }
      } catch (error) {
        console.error('Error opening fullscreen viewer:', error);
      }
    }
  }, [onNavigate, displayItems]);

  const handleContextMenu = useCallback((item: GridItem, event: React.MouseEvent) => {
    // Determine target type and selected items
    const isSelected = selectedItems.has(item.path);
    const selectedCount = selectedItems.size;
    
    if (selectedCount > 1 && isSelected) {
      // Multiple selection context menu
      const selectedItemsArray = displayItems.filter(i => selectedItems.has(i.path));
      showContextMenu(event, item, 'multiple', selectedItemsArray);
    } else {
      // Single item context menu
      if (item.type === 'folder') {
        showContextMenu(event, item as FolderItem, 'folder');
      } else {
        showContextMenu(event, item as MediaFile, 'file');
      }
    }
  }, [selectedItems, displayItems, showContextMenu]);

  const handleSortChange = useCallback((newSortBy: string) => {
    if (newSortBy === sortBy) {
      // Toggle sort order if same field
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy as 'name' | 'date' | 'size');
      setSortOrder('asc');
    }
  }, [sortBy]);

  const getSortIcon = (field: string) => {
    if (field !== sortBy) return '';
    return sortOrder === 'asc' ? ' ↑' : ' ↓';
  };

  return (
    <div className="center-panel">
      {/* Content Header */}
      <div className="content-header">
        <div className="path-info">
          <span className="item-count">
            {loading ? 'Loading...' : `${displayItems.length} items in ${currentPath}`}
          </span>
          {multiSelection.getSelectionCount() > 0 && (
            <span className="selection-count">
              ({multiSelection.getSelectionCount()} selected)
            </span>
          )}
        </div>
        
        <div className="view-controls">
          <div className="sort-controls">
            <button 
              className={`sort-btn ${sortBy === 'name' ? 'active' : ''}`}
              onClick={() => handleSortChange('name')}
              title="Sort by Name"
            >
              Name{getSortIcon('name')}
            </button>
            <button 
              className={`sort-btn ${sortBy === 'date' ? 'active' : ''}`}
              onClick={() => handleSortChange('date')}
              title="Sort by Date"
            >
              Date{getSortIcon('date')}
            </button>
            <button 
              className={`sort-btn ${sortBy === 'size' ? 'active' : ''}`}
              onClick={() => handleSortChange('size')}
              title="Sort by Size"
            >
              Size{getSortIcon('size')}
            </button>
          </div>
          
          {viewMode === 'grid' && (
            <div className="thumbnail-size-control">
              <input
                type="range"
                min="60"
                max="120"
                value={thumbnailSize}
                onChange={(e) => setThumbnailSize(Number(e.target.value))}
                className="thumbnail-slider"
                title="Thumbnail Size"
              />
            </div>
          )}
          
          <div className="view-mode-toggle">
            <button
              className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid View (Ctrl+1)"
            >
              ⊞
            </button>
            <button
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List View (Ctrl+2)"
            >
              ☰
            </button>
          </div>
        </div>
      </div>

      {/* Content Container - Scrollable */}
      <div className="content-container">
        <LoadingState
          isLoading={loading}
          loadingMessage="Loading directory contents..."
          onRetry={() => window.location.reload()}
        >
          <ContentGrid
            items={filteredItems}
            viewMode={viewMode}
            selectedItems={selectedItems}
            onItemSelect={handleItemSelect}
            onItemDoubleClick={handleItemDoubleClick}
            onContextMenu={handleContextMenu}
            thumbnailSize={thumbnailSize}
            sortBy={sortBy}
            sortOrder={sortOrder}
          />
        </LoadingState>
      </div>
      
      {/* Selection Actions Bar */}
      {selectedItems.size > 0 && (
        <div className="selection-actions">
          <div className="selection-info">
            {selectedItems.size} item{selectedItems.size > 1 ? 's' : ''} selected
          </div>
          <div className="selection-buttons">
            <button 
              className="action-btn"
              onClick={() => onItemSelect('', false)}
              title="Clear Selection (Esc)"
            >
              Clear
            </button>
            <button 
              className="action-btn primary"
              onClick={() => console.log('Batch operations not implemented yet')}
              title="Batch Operations"
            >
              Actions
            </button>
          </div>
        </div>
      )}
    </div>
  );
};