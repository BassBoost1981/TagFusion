import React, { useState, useEffect, useCallback } from 'react';
import { MediaFile } from '../../../../types/global';
import { VideoPlayer } from './VideoPlayer';
import { videoApi } from '../../api/videoApi';
import './VideoViewer.css';

interface VideoViewerProps {
  file: MediaFile;
  isOpen: boolean;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

export const VideoViewer: React.FC<VideoViewerProps> = ({
  file,
  isOpen,
  onClose,
  onNext,
  onPrevious,
  hasNext = false,
  hasPrevious = false
}) => {
  const [metadata, setMetadata] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);

  // Load video metadata when file changes
  useEffect(() => {
    if (isOpen && file) {
      loadVideoMetadata();
    }
  }, [file, isOpen]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'ArrowLeft':
          if (e.altKey && hasPrevious && onPrevious) {
            e.preventDefault();
            onPrevious();
          }
          break;
        case 'ArrowRight':
          if (e.altKey && hasNext && onNext) {
            e.preventDefault();
            onNext();
          }
          break;
        case 'KeyH':
          e.preventDefault();
          setShowControls(prev => !prev);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, onNext, onPrevious, hasNext, hasPrevious]);

  const loadVideoMetadata = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const videoMetadata = await videoApi.extractVideoMetadata(file.path);
      setMetadata(videoMetadata);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load video metadata';
      setError(errorMessage);
      console.error('Failed to load video metadata:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVideoError = useCallback((error: string) => {
    setError(error);
  }, []);

  const handleVideoMetadata = useCallback((videoMetadata: { duration: number; width: number; height: number }) => {
    // Update metadata with video element data if we don't have it from the API
    if (!metadata) {
      setMetadata({
        duration: videoMetadata.duration,
        width: videoMetadata.width,
        height: videoMetadata.height,
        format: file.extension.substring(1),
        codec: 'unknown'
      });
    }
  }, [metadata, file.extension]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="video-viewer-overlay">
      <div className="video-viewer">
        {/* Header */}
        <div className={`video-viewer-header ${showControls ? 'visible' : 'hidden'}`}>
          <div className="header-left">
            <h2 className="video-title">{file.name}</h2>
            {metadata && (
              <div className="video-info">
                <span>{metadata.width}×{metadata.height}</span>
                <span>•</span>
                <span>{formatDuration(metadata.duration)}</span>
                <span>•</span>
                <span>{formatFileSize(file.size)}</span>
                {metadata.codec && metadata.codec !== 'unknown' && (
                  <>
                    <span>•</span>
                    <span>{metadata.codec.toUpperCase()}</span>
                  </>
                )}
              </div>
            )}
          </div>
          
          <div className="header-right">
            <button
              className="control-button"
              onClick={() => setShowControls(prev => !prev)}
              title="Toggle controls (H)"
            >
              {showControls ? '👁️' : '👁️‍🗨️'}
            </button>
            <button
              className="control-button"
              onClick={onClose}
              title="Close (Escape)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Video Player */}
        <div className="video-player-container">
          {isLoading && (
            <div className="video-loading">
              <div className="loading-spinner"></div>
              <span>Loading video...</span>
            </div>
          )}

          {error && (
            <div className="video-error">
              <div className="error-icon">⚠️</div>
              <h3>Failed to load video</h3>
              <p>{error}</p>
              <button onClick={loadVideoMetadata} className="retry-button">
                Try Again
              </button>
            </div>
          )}

          {!isLoading && !error && (
            <VideoPlayer
              file={file}
              autoPlay={false}
              controls={true}
              onLoadedMetadata={handleVideoMetadata}
              onError={handleVideoError}
              className="fullscreen-video-player"
            />
          )}
        </div>

        {/* Navigation */}
        {showControls && (hasPrevious || hasNext) && (
          <div className="video-navigation">
            {hasPrevious && (
              <button
                className="nav-button nav-previous"
                onClick={onPrevious}
                title="Previous video (Alt + ←)"
              >
                <svg viewBox="0 0 24 24" className="nav-icon">
                  <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" fill="currentColor"/>
                </svg>
                Previous
              </button>
            )}
            
            {hasNext && (
              <button
                className="nav-button nav-next"
                onClick={onNext}
                title="Next video (Alt + →)"
              >
                Next
                <svg viewBox="0 0 24 24" className="nav-icon">
                  <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" fill="currentColor"/>
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Metadata Panel (optional, can be toggled) */}
        {showControls && metadata && (
          <div className="video-metadata-panel">
            <div className="metadata-section">
              <h4>Video Information</h4>
              <div className="metadata-grid">
                <div className="metadata-item">
                  <span className="label">Duration:</span>
                  <span className="value">{formatDuration(metadata.duration)}</span>
                </div>
                <div className="metadata-item">
                  <span className="label">Resolution:</span>
                  <span className="value">{metadata.width}×{metadata.height}</span>
                </div>
                <div className="metadata-item">
                  <span className="label">File Size:</span>
                  <span className="value">{formatFileSize(file.size)}</span>
                </div>
                {metadata.fps && (
                  <div className="metadata-item">
                    <span className="label">Frame Rate:</span>
                    <span className="value">{metadata.fps.toFixed(1)} fps</span>
                  </div>
                )}
                {metadata.bitrate && (
                  <div className="metadata-item">
                    <span className="label">Bitrate:</span>
                    <span className="value">{Math.round(metadata.bitrate / 1000)} kbps</span>
                  </div>
                )}
                {metadata.codec && metadata.codec !== 'unknown' && (
                  <div className="metadata-item">
                    <span className="label">Codec:</span>
                    <span className="value">{metadata.codec.toUpperCase()}</span>
                  </div>
                )}
                <div className="metadata-item">
                  <span className="label">Format:</span>
                  <span className="value">{metadata.format.toUpperCase()}</span>
                </div>
                {metadata.creationDate && (
                  <div className="metadata-item">
                    <span className="label">Created:</span>
                    <span className="value">{new Date(metadata.creationDate).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoViewer;