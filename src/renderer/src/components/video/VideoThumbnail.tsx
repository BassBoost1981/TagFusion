import React, { useState, useEffect } from 'react';
import './VideoThumbnail.css';

interface VideoThumbnailProps {
  filePath: string;
  size: number;
  className?: string;
}

export const VideoThumbnail: React.FC<VideoThumbnailProps> = ({
  filePath,
  size,
  className = '',
}) => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const generateVideoThumbnail = async () => {
      try {
        setLoading(true);
        setError(false);
        
        console.log('🎬 Requesting video thumbnail for:', filePath);
        const result = await window.electronAPI?.video?.generateThumbnail(filePath, {
          width: size,
          height: size,
          quality: 80,
          timeOffset: 1.0
        });
        const url = result?.thumbnail;
        
        if (isMounted && url) {
          console.log('✅ Video thumbnail received:', url.substring(0, 50) + '...');
          setThumbnailUrl(url);
        }
      } catch (err) {
        console.error('❌ Failed to generate video thumbnail:', err);
        if (isMounted) {
          setError(true);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    generateVideoThumbnail();

    return () => {
      isMounted = false;
    };
  }, [filePath, size]);

  if (loading) {
    return (
      <div 
        className={`video-thumbnail loading ${className}`}
        style={{ width: size, height: size }}
      >
        <div className="loading-spinner">
          <span className="video-icon">🎬</span>
          <span className="loading-text">Loading...</span>
        </div>
      </div>
    );
  }

  if (error || !thumbnailUrl) {
    // Enhanced placeholder for videos
    const fileName = filePath.split(/[\\\/]/).pop()?.replace(/\.[^/.]+$/, '') || 'Video';
    const displayName = fileName.length > 10 ? fileName.substring(0, 8) + '...' : fileName;
    
    return (
      <div 
        className={`video-thumbnail error ${className}`}
        style={{ width: size, height: size }}
      >
        <div className="video-placeholder">
          <span className="video-icon">🎬</span>
          <span className="video-label">{displayName}</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`video-thumbnail ${className}`}
      style={{ width: size, height: size }}
    >
      {thumbnailUrl.startsWith('data:image/svg+xml') ? (
        // SVG placeholder
        <div 
          className="video-placeholder-svg"
          dangerouslySetInnerHTML={{ __html: atob(thumbnailUrl.split(',')[1]) }}
        />
      ) : (
        // Real thumbnail image
        <img
          src={thumbnailUrl}
          alt={filePath.split(/[\\\/]/).pop()}
          className="video-thumbnail-image"
          style={{ width: size, height: size }}
          loading="lazy"
          onError={() => setError(true)}
        />
      )}
    </div>
  );
};