import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MediaFile, HierarchicalTag } from '@/types/global';
import { useAppStore } from '@/stores/useAppStore';
import { useFileOperations } from '@/hooks/useFileOperations';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { FileGridItem } from './FileGridItem';
import { VirtualGrid } from './VirtualGrid';
import { ProgressBar } from './ProgressBar';
import { cn } from '@/lib/utils';

interface FileGridProps {
  className?: string;
  onFileSelect?: (file: MediaFile) => void;
  onFileDoubleClick?: (file: MediaFile) => void;
  onSelectionChange?: (files: MediaFile[]) => void;
}

export const FileGrid: React.FC<FileGridProps> = ({
  className,
  onFileSelect,
  onFileDoubleClick,
  onSelectionChange
}) => {
  const {
    filteredFiles,
    selectedFiles,
    isLoading,
    error,
    gridSize,
    showTags,
    showRatings,
    setSelectedFiles,
    addSelectedFile,
    removeSelectedFile,
    clearSelection
  } = useAppStore();

  const {
    isLoading: operationLoading,
    error: operationError,
    progress,
    refreshDirectory
  } = useFileOperations();

  const [dragSelection, setDragSelection] = useState<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);

  const [lastSelectedIndex, setLastSelectedIndex] = useState<number>(-1);

  // Memoized grid configuration
  const gridConfig = useMemo(() => ({
    itemWidth: gridSize,
    itemHeight: gridSize + (showTags ? 60 : 40),
    gap: 8,
    padding: 16
  }), [gridSize, showTags]);

  // Handle file selection
  const handleFileClick = useCallback((file: MediaFile, index: number, event: React.MouseEvent) => {
    event.preventDefault();
    
    if (event.ctrlKey || event.metaKey) {
      // Toggle selection
      const isSelected = selectedFiles.some(f => f.path === file.path);
      if (isSelected) {
        removeSelectedFile(file);
      } else {
        addSelectedFile(file);
      }
    } else if (event.shiftKey && lastSelectedIndex !== -1) {
      // Range selection
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const rangeFiles = filteredFiles.slice(start, end + 1);
      setSelectedFiles([...selectedFiles, ...rangeFiles.filter(f => 
        !selectedFiles.some(sf => sf.path === f.path)
      )]);
    } else {
      // Single selection
      setSelectedFiles([file]);
      setLastSelectedIndex(index);
    }

    onFileSelect?.(file);
    onSelectionChange?.(selectedFiles);
  }, [
    selectedFiles, 
    filteredFiles, 
    lastSelectedIndex, 
    addSelectedFile, 
    removeSelectedFile, 
    setSelectedFiles,
    onFileSelect,
    onSelectionChange
  ]);

  // Handle file double click
  const handleFileDoubleClick = useCallback((file: MediaFile) => {
    onFileDoubleClick?.(file);
  }, [onFileDoubleClick]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'a':
            event.preventDefault();
            setSelectedFiles(filteredFiles);
            break;
          case 'd':
            event.preventDefault();
            clearSelection();
            break;
        }
      } else if (event.key === 'Escape') {
        clearSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredFiles, setSelectedFiles, clearSelection]);

  // Render file item
  const renderFileItem = useCallback((file: MediaFile, index: number) => {
    const isSelected = selectedFiles.some(f => f.path === file.path);
    
    return (
      <FileGridItem
        key={file.path}
        file={file}
        index={index}
        isSelected={isSelected}
        showTags={showTags}
        showRatings={showRatings}
        size={gridSize}
        onClick={(event) => handleFileClick(file, index, event)}
        onDoubleClick={() => handleFileDoubleClick(file)}
      />
    );
  }, [
    selectedFiles, 
    showTags, 
    showRatings, 
    gridSize, 
    handleFileClick, 
    handleFileDoubleClick
  ]);

  // Loading state
  if (isLoading || operationLoading) {
    return (
      <div className={cn("file-grid-loading", className)}>
        <LoadingSpinner size="large" />
        <p className="loading-text">
          {operationLoading ? 'Processing files...' : 'Loading files...'}
        </p>
        {progress > 0 && (
          <ProgressBar 
            value={progress} 
            className="mt-4"
            showPercentage
          />
        )}
      </div>
    );
  }

  // Error state
  if (error || operationError) {
    return (
      <div className={cn("file-grid-error", className)}>
        <div className="error-icon">⚠️</div>
        <h3 className="error-title">Error Loading Files</h3>
        <p className="error-message">{error || operationError}</p>
        <button 
          className="retry-button"
          onClick={refreshDirectory}
        >
          Try Again
        </button>
      </div>
    );
  }

  // Empty state
  if (filteredFiles.length === 0) {
    return (
      <div className={cn("file-grid-empty", className)}>
        <div className="empty-icon">📁</div>
        <h3 className="empty-title">No Files Found</h3>
        <p className="empty-message">
          This directory is empty or no files match your current filter.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("file-grid", className)}>
      {/* Selection Info */}
      {selectedFiles.length > 0 && (
        <div className="selection-info">
          <span className="selection-count">
            {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
          </span>
          <button 
            className="clear-selection"
            onClick={clearSelection}
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* Virtual Grid */}
      <VirtualGrid
        items={filteredFiles}
        renderItem={renderFileItem}
        itemWidth={gridConfig.itemWidth}
        itemHeight={gridConfig.itemHeight}
        gap={gridConfig.gap}
        padding={gridConfig.padding}
        className="file-grid-container"
      />

      {/* File Count */}
      <div className="file-count">
        {filteredFiles.length} file{filteredFiles.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
};
