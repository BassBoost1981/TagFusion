import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

interface MediaFile {
  name: string;
  path: string;
  size: number;
  type: string;
  dateModified: Date;
  tags?: string[];
  rating?: number;
  thumbnail?: string;
}

interface ModernFileGridProps {
  files: MediaFile[];
  onFileSelect?: (file: MediaFile) => void;
  onFileDoubleClick?: (file: MediaFile) => void;
  gridSize?: number;
  showTags?: boolean;
}

const ModernFileGrid: React.FC<ModernFileGridProps> = ({
  files,
  onFileSelect,
  onFileDoubleClick,
  gridSize = 150,
  showTags = true
}) => {
  const [selectedFiles, setSelectedFiles] = useState<MediaFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileClick = useCallback((file: MediaFile, event: React.MouseEvent) => {
    if (event.ctrlKey || event.metaKey) {
      // Toggle selection
      setSelectedFiles(prev => {
        const isSelected = prev.some(f => f.path === file.path);
        if (isSelected) {
          return prev.filter(f => f.path !== file.path);
        } else {
          return [...prev, file];
        }
      });
    } else {
      // Single selection
      setSelectedFiles([file]);
    }
    
    onFileSelect?.(file);
  }, [onFileSelect]);

  const handleFileDoubleClick = useCallback((file: MediaFile) => {
    onFileDoubleClick?.(file);
  }, [onFileDoubleClick]);

  if (isLoading) {
    return (
      <div className="modern-file-grid-loading">
        <div className="loading-spinner"></div>
        <p>Loading files...</p>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="modern-file-grid-empty">
        <div className="empty-icon">📁</div>
        <h3>No Files Found</h3>
        <p>This directory is empty or no files match your current filter.</p>
      </div>
    );
  }

  return (
    <div className="modern-file-grid" style={{ '--grid-size': `${gridSize}px` } as React.CSSProperties}>
      {/* Selection Info */}
      {selectedFiles.length > 0 && (
        <div className="selection-info">
          <span>{selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected</span>
          <button onClick={() => setSelectedFiles([])}>Clear Selection</button>
        </div>
      )}

      {/* File Grid */}
      <div className="file-grid-container">
        {files.map((file, index) => {
          const isSelected = selectedFiles.some(f => f.path === file.path);
          
          return (
            <div
              key={file.path}
              className={`file-item ${isSelected ? 'selected' : ''}`}
              onClick={(e) => handleFileClick(file, e)}
              onDoubleClick={() => handleFileDoubleClick(file)}
              style={{
                width: gridSize,
                height: gridSize + (showTags ? 60 : 40)
              }}
            >
              {/* Thumbnail */}
              <div className="file-thumbnail">
                {file.thumbnail ? (
                  <img src={file.thumbnail} alt={file.name} />
                ) : (
                  <div className="file-icon">
                    {file.type.startsWith('image/') ? '🖼️' : 
                     file.type.startsWith('video/') ? '🎥' : '📄'}
                  </div>
                )}
              </div>

              {/* File Info */}
              <div className="file-info">
                <div className="file-name" title={file.name}>
                  {file.name}
                </div>
                
                {showTags && file.tags && file.tags.length > 0 && (
                  <div className="file-tags">
                    {file.tags.slice(0, 2).map(tag => (
                      <span key={tag} className="tag">{tag}</span>
                    ))}
                    {file.tags.length > 2 && (
                      <span className="tag-more">+{file.tags.length - 2}</span>
                    )}
                  </div>
                )}

                {file.rating && file.rating > 0 && (
                  <div className="file-rating">
                    {'⭐'.repeat(file.rating)}
                  </div>
                )}
              </div>

              {/* Selection Indicator */}
              {isSelected && (
                <div className="selection-indicator">✓</div>
              )}
            </div>
          );
        })}
      </div>

      {/* File Count */}
      <div className="file-count">
        {files.length} file{files.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
};

// Export function to mount React component in existing DOM
export const mountModernFileGrid = (
  containerId: string, 
  props: ModernFileGridProps
) => {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container with id "${containerId}" not found`);
    return;
  }

  const root = createRoot(container);
  root.render(<ModernFileGrid {...props} />);
  
  return root;
};

export default ModernFileGrid;
