import React, { useState, useEffect } from 'react';
import { LazyImage } from '../common/LazyImage';

interface ImageThumbnailProps {
  filePath: string;
  size: number;
  className?: string;
}

export const ImageThumbnail: React.FC<ImageThumbnailProps> = ({
  filePath,
  size,
  className = '',
}) => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const generateThumbnail = async () => {
      try {
        setLoading(true);
        setError(false);
        
        const url = await window.electronAPI?.generateThumbnail(filePath, size);
        
        if (isMounted && url) {
          setThumbnailUrl(url);
        }
      } catch (err) {
        console.error('Failed to generate thumbnail:', err);
        if (isMounted) {
          setError(true);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    generateThumbnail();

    return () => {
      isMounted = false;
    };
  }, [filePath, size]);

  const placeholder = (
    <div className="image-thumbnail-placeholder">
      <div className="loading-spinner">⏳</div>
    </div>
  );

  const errorFallback = (
    <div className="image-thumbnail-error">
      <span className="error-icon">🖼️</span>
    </div>
  );

  if (error || !thumbnailUrl) {
    return (
      <div
        className={`image-thumbnail error ${className}`}
        style={{ width: size, height: size }}
      >
        {errorFallback}
      </div>
    );
  }

  return (
    <LazyImage
      src={thumbnailUrl}
      alt={filePath.split(/[\\\/]/).pop() || 'Image'}
      width={size}
      height={size}
      className={`image-thumbnail ${className}`}
      placeholder={loading ? placeholder : undefined}
      onError={() => setError(true)}
      threshold={0.1}
      rootMargin="100px"
    />
  );
};