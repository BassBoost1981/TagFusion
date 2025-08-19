import React, { useState, useEffect, useRef, useCallback } from 'react';
import './LazyImage.css';

interface LazyImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  placeholder?: React.ReactNode;
  onLoad?: () => void;
  onError?: () => void;
  threshold?: number;
  rootMargin?: string;
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  width,
  height,
  className = '',
  placeholder,
  onLoad,
  onError,
  threshold = 0.1,
  rootMargin = '50px',
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    const currentImg = imgRef.current;
    if (!currentImg) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observerRef.current?.unobserve(entry.target);
          }
        });
      },
      {
        threshold,
        rootMargin,
      }
    );

    observerRef.current.observe(currentImg);

    return () => {
      if (observerRef.current && currentImg) {
        observerRef.current.unobserve(currentImg);
      }
    };
  }, [threshold, rootMargin]);

  // Handle image loading
  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    setHasError(false);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setHasError(true);
    setIsLoaded(false);
    onError?.();
  }, [onError]);

  // Default placeholder
  const defaultPlaceholder = (
    <div className="lazy-image-placeholder">
      <div className="lazy-image-placeholder-icon">🖼️</div>
    </div>
  );

  // Error fallback
  const errorFallback = (
    <div className="lazy-image-error">
      <div className="lazy-image-error-icon">❌</div>
      <div className="lazy-image-error-text">Failed to load</div>
    </div>
  );

  return (
    <div
      className={`lazy-image-container ${className}`}
      style={{ width, height }}
    >
      {!isInView && (placeholder || defaultPlaceholder)}
      
      {isInView && (
        <>
          {!isLoaded && !hasError && (placeholder || defaultPlaceholder)}
          
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            className={`lazy-image ${isLoaded ? 'loaded' : ''} ${hasError ? 'error' : ''}`}
            style={{ width, height }}
            onLoad={handleLoad}
            onError={handleError}
            loading="lazy"
          />
          
          {hasError && errorFallback}
        </>
      )}
    </div>
  );
};

// Hook for managing image cache
export const useImageCache = (maxSize: number = 100) => {
  const cache = useRef(new Map<string, string>());
  const accessOrder = useRef<string[]>([]);

  const getCachedImage = useCallback((key: string): string | undefined => {
    const cached = cache.current.get(key);
    if (cached) {
      // Move to end (most recently used)
      const index = accessOrder.current.indexOf(key);
      if (index > -1) {
        accessOrder.current.splice(index, 1);
      }
      accessOrder.current.push(key);
    }
    return cached;
  }, []);

  const setCachedImage = useCallback((key: string, value: string) => {
    // Remove oldest entries if cache is full
    while (cache.current.size >= maxSize && accessOrder.current.length > 0) {
      const oldest = accessOrder.current.shift();
      if (oldest) {
        cache.current.delete(oldest);
      }
    }

    cache.current.set(key, value);
    accessOrder.current.push(key);
  }, [maxSize]);

  const clearCache = useCallback(() => {
    cache.current.clear();
    accessOrder.current = [];
  }, []);

  const getCacheSize = useCallback(() => cache.current.size, []);

  return {
    getCachedImage,
    setCachedImage,
    clearCache,
    getCacheSize,
  };
};

// Preloader component for critical images
interface ImagePreloaderProps {
  sources: string[];
  onComplete?: (loaded: number, failed: number) => void;
}

export const ImagePreloader: React.FC<ImagePreloaderProps> = ({
  sources,
  onComplete,
}) => {
  const [loadedCount, setLoadedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  useEffect(() => {
    if (sources.length === 0) {
      onComplete?.(0, 0);
      return;
    }

    let loaded = 0;
    let failed = 0;

    const checkComplete = () => {
      if (loaded + failed === sources.length) {
        onComplete?.(loaded, failed);
      }
    };

    sources.forEach((src) => {
      const img = new Image();
      
      img.onload = () => {
        loaded++;
        setLoadedCount(loaded);
        checkComplete();
      };
      
      img.onerror = () => {
        failed++;
        setFailedCount(failed);
        checkComplete();
      };
      
      img.src = src;
    });
  }, [sources, onComplete]);

  return null; // This component doesn't render anything
};

// Hook for progressive image loading
export const useProgressiveImage = (src: string, placeholderSrc?: string) => {
  const [currentSrc, setCurrentSrc] = useState(placeholderSrc || '');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!src) return;

    setIsLoading(true);
    
    const img = new Image();
    img.onload = () => {
      setCurrentSrc(src);
      setIsLoading(false);
    };
    img.onerror = () => {
      setIsLoading(false);
    };
    img.src = src;
  }, [src]);

  return { src: currentSrc, isLoading };
};
