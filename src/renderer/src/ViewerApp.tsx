import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MediaFile, EXIFData, HierarchicalTag } from '../types/global';
import { LanguageProvider } from './components/common/LanguageProvider';

interface FullscreenViewerState {
  currentFile: MediaFile;
  fileList: MediaFile[];
  currentIndex: number;
  zoomLevel: number;
  panOffset: { x: number; y: number };
  slideshowActive: boolean;
  slideshowInterval: number;
  showInfo: boolean;
}

interface ViewerAppProps {}

const ViewerApp: React.FC<ViewerAppProps> = () => {
  const [state, setState] = useState<FullscreenViewerState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCursor, setShowCursor] = useState(true);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  const [metadata, setMetadata] = useState<any>(null);
  const [exifData, setExifData] = useState<EXIFData | null>(null);
  
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cursorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const zoomTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // Initialize viewer state
  useEffect(() => {
    const initializeViewer = async () => {
      try {
        const viewerState = await window.electronAPI.viewer.getState();
        if (viewerState) {
          setState(viewerState);
          await loadFileMetadata(viewerState.currentFile);
        }
        setLoading(false);
      } catch (err) {
        console.error('Error initializing viewer:', err);
        setError('Failed to initialize viewer');
        setLoading(false);
      }
    };

    initializeViewer();
  }, []);

  // Listen for state changes from main process
  useEffect(() => {
    const handleStateChange = (newState: FullscreenViewerState) => {
      setState(newState);
      loadFileMetadata(newState.currentFile);
    };

    window.electronAPI.viewer.onStateChanged(handleStateChange);

    return () => {
      // Cleanup listener if needed
    };
  }, []);

  // Load metadata for current file
  const loadFileMetadata = async (file: MediaFile) => {
    try {
      const [metadataResult, exifResult] = await Promise.all([
        window.electronAPI.metadata.read(file.path),
        window.electronAPI.metadata.readExif(file.path)
      ]);
      
      setMetadata(metadataResult);
      setExifData(exifResult);
    } catch (err) {
      console.error('Error loading metadata:', err);
      setMetadata(null);
      setExifData(null);
    }
  };

  // Cursor management
  const showCursorTemporarily = useCallback(() => {
    setShowCursor(true);
    
    if (cursorTimeoutRef.current) {
      clearTimeout(cursorTimeoutRef.current);
    }
    
    cursorTimeoutRef.current = setTimeout(() => {
      setShowCursor(false);
    }, 3000);
  }, []);

  // Mouse movement handler
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    showCursorTemporarily();
    
    if (isDragging.current && state) {
      const deltaX = e.clientX - lastMousePos.current.x;
      const deltaY = e.clientY - lastMousePos.current.y;
      
      const newPanOffset = {
        x: state.panOffset.x + deltaX,
        y: state.panOffset.y + deltaY
      };
      
      window.electronAPI.viewer.setPan(newPanOffset);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
  }, [state, showCursorTemporarily]);

  // Mouse down handler for panning
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (state && state.zoomLevel > 1) {
      isDragging.current = true;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  }, [state]);

  // Mouse up handler
  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Keyboard event handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!state) return;

    switch (e.key) {
      case 'Escape':
        window.electronAPI.viewer.close();
        break;
      case 'ArrowRight':
      case ' ':
        e.preventDefault();
        window.electronAPI.viewer.next();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        window.electronAPI.viewer.previous();
        break;
      case 'Home':
        e.preventDefault();
        window.electronAPI.viewer.goToIndex(0);
        break;
      case 'End':
        e.preventDefault();
        window.electronAPI.viewer.goToIndex(state.fileList.length - 1);
        break;
      case '+':
      case '=':
        e.preventDefault();
        handleZoomIn();
        break;
      case '-':
        e.preventDefault();
        handleZoomOut();
        break;
      case '0':
        e.preventDefault();
        window.electronAPI.viewer.resetView();
        showZoomIndicatorTemporarily();
        break;
      case 'i':
      case 'I':
        e.preventDefault();
        window.electronAPI.viewer.toggleInfo();
        break;
      case 'f':
      case 'F':
        e.preventDefault();
        toggleSlideshow();
        break;
    }
  }, [state]);

  // Wheel event handler for zooming
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!state) return;
    
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.max(0.1, Math.min(10, state.zoomLevel + delta));
    
    window.electronAPI.viewer.setZoom(newZoom);
    showZoomIndicatorTemporarily();
  }, [state]);

  // Zoom functions
  const handleZoomIn = () => {
    if (state) {
      const newZoom = Math.min(10, state.zoomLevel * 1.2);
      window.electronAPI.viewer.setZoom(newZoom);
      showZoomIndicatorTemporarily();
    }
  };

  const handleZoomOut = () => {
    if (state) {
      const newZoom = Math.max(0.1, state.zoomLevel / 1.2);
      window.electronAPI.viewer.setZoom(newZoom);
      showZoomIndicatorTemporarily();
    }
  };

  const showZoomIndicatorTemporarily = () => {
    setShowZoomIndicator(true);
    
    if (zoomTimeoutRef.current) {
      clearTimeout(zoomTimeoutRef.current);
    }
    
    zoomTimeoutRef.current = setTimeout(() => {
      setShowZoomIndicator(false);
    }, 2000);
  };

  // Slideshow functions
  const toggleSlideshow = () => {
    if (state) {
      if (state.slideshowActive) {
        window.electronAPI.viewer.stopSlideshow();
      } else {
        window.electronAPI.viewer.startSlideshow();
      }
    }
  };

  const handleSlideshowIntervalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const interval = parseInt(e.target.value);
    if (!isNaN(interval) && interval > 0) {
      window.electronAPI.viewer.setSlideshowInterval(interval);
    }
  };

  // Navigation functions
  const goNext = () => window.electronAPI.viewer.next();
  const goPrevious = () => window.electronAPI.viewer.previous();

  // Setup event listeners
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mouseup', handleMouseUp);
      
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current);
      }
      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current);
      }
    };
  }, [handleKeyDown, handleMouseUp]);

  // Show cursor initially
  useEffect(() => {
    showCursorTemporarily();
  }, [showCursorTemporarily]);

  if (loading) {
    return (
      <div className="viewer-app">
        <div className="loading-indicator">
          <div className="spinner"></div>
          Loading...
        </div>
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="viewer-app">
        <div className="error-message">
          {error || 'No image to display'}
        </div>
      </div>
    );
  }

  const { currentFile, currentIndex, fileList, zoomLevel, panOffset, slideshowActive, slideshowInterval, showInfo } = state;

  return (
    <LanguageProvider fallback={<div className="viewer-loading">Loading viewer...</div>}>
      <div 
        className={`viewer-app ${showCursor ? 'show-cursor' : ''}`}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
        ref={containerRef}
      >
      {/* Main content */}
      <div className="viewer-container">
        {currentFile.type === 'image' ? (
          <img
            ref={imageRef}
            src={`file://${currentFile.path}`}
            alt={currentFile.name}
            className="viewer-image"
            style={{
              transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`,
              cursor: zoomLevel > 1 ? (isDragging.current ? 'grabbing' : 'grab') : 'default'
            }}
            draggable={false}
          />
        ) : (
          <video
            src={`file://${currentFile.path}`}
            className="viewer-video"
            controls
            autoPlay
          />
        )}
      </div>

      {/* Navigation arrows */}
      <button 
        className="nav-arrow left" 
        onClick={goPrevious}
        disabled={fileList.length <= 1}
      >
        ‹
      </button>
      <button 
        className="nav-arrow right" 
        onClick={goNext}
        disabled={fileList.length <= 1}
      >
        ›
      </button>

      {/* File counter */}
      <div className="file-counter">
        {currentIndex + 1} / {fileList.length}
      </div>

      {/* Zoom indicator */}
      <div className={`zoom-indicator ${showZoomIndicator ? 'visible' : ''}`}>
        {Math.round(zoomLevel * 100)}%
      </div>

      {/* Controls */}
      <div className="viewer-controls">
        <button className="control-button" onClick={goPrevious} disabled={fileList.length <= 1}>
          Previous
        </button>
        
        <div className="slideshow-controls">
          <button 
            className={`control-button ${slideshowActive ? 'active' : ''}`} 
            onClick={toggleSlideshow}
          >
            {slideshowActive ? 'Pause' : 'Play'}
          </button>
          <input
            type="number"
            className="slideshow-interval"
            value={slideshowInterval}
            onChange={handleSlideshowIntervalChange}
            min="1"
            max="60"
            title="Slideshow interval (seconds)"
          />
          <span style={{ color: 'white', fontSize: '12px' }}>s</span>
        </div>

        <button className="control-button" onClick={goNext} disabled={fileList.length <= 1}>
          Next
        </button>
        
        <button className="control-button" onClick={handleZoomOut} disabled={zoomLevel <= 0.1}>
          Zoom Out
        </button>
        <button className="control-button" onClick={() => window.electronAPI.viewer.resetView()}>
          Reset
        </button>
        <button className="control-button" onClick={handleZoomIn} disabled={zoomLevel >= 10}>
          Zoom In
        </button>
        
        <button 
          className={`control-button ${showInfo ? 'active' : ''}`} 
          onClick={() => window.electronAPI.viewer.toggleInfo()}
        >
          Info
        </button>
        
        <button className="control-button" onClick={() => window.electronAPI.viewer.close()}>
          Close
        </button>
      </div>

      {/* Info overlay */}
      <div className={`info-overlay ${showInfo ? 'visible' : ''}`}>
        <div className="info-section">
          <div className="info-title">File Information</div>
          <div className="info-item">Name: {currentFile.name}</div>
          <div className="info-item">Size: {formatFileSize(currentFile.size)}</div>
          <div className="info-item">Modified: {formatDate(currentFile.dateModified)}</div>
          {currentFile.dateCreated && (
            <div className="info-item">Created: {formatDate(currentFile.dateCreated)}</div>
          )}
        </div>

        {metadata && metadata.tags && metadata.tags.length > 0 && (
          <div className="info-section">
            <div className="info-title">Tags</div>
            <div className="info-tags">
              {metadata.tags.map((tag: HierarchicalTag, index: number) => (
                <span key={index} className="info-tag">
                  {tag.fullPath}
                </span>
              ))}
            </div>
          </div>
        )}

        {metadata && metadata.rating > 0 && (
          <div className="info-section">
            <div className="info-title">Rating</div>
            <div className="info-rating">
              {[1, 2, 3, 4, 5].map(star => (
                <span 
                  key={star} 
                  className={`star ${star <= metadata.rating ? '' : 'empty'}`}
                >
                  ★
                </span>
              ))}
            </div>
          </div>
        )}

        {exifData && (
          <div className="info-section">
            <div className="info-title">Camera Information</div>
            {exifData.camera.make && (
              <div className="info-item">Camera: {exifData.camera.make} {exifData.camera.model}</div>
            )}
            {exifData.camera.lens && (
              <div className="info-item">Lens: {exifData.camera.lens}</div>
            )}
            {exifData.settings.aperture && (
              <div className="info-item">Aperture: {exifData.settings.aperture}</div>
            )}
            {exifData.settings.shutterSpeed && (
              <div className="info-item">Shutter: {exifData.settings.shutterSpeed}</div>
            )}
            {exifData.settings.iso && (
              <div className="info-item">ISO: {exifData.settings.iso}</div>
            )}
            {exifData.settings.focalLength && (
              <div className="info-item">Focal Length: {exifData.settings.focalLength}</div>
            )}
          </div>
        )}
      </div>
    </div>
    </LanguageProvider>
  );
};

// Helper functions
const formatFileSize = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

const formatDate = (date: Date): string => {
  return new Date(date).toLocaleDateString() + ' ' + new Date(date).toLocaleTimeString();
};

export default ViewerApp;