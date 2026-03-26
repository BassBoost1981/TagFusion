import { useState, useCallback } from 'react';
import { Image as ImageIcon, RefreshCw } from 'lucide-react';
import { Spinner } from '@heroui/react';

interface ImageThumbnailProps {
  thumbnail: string | null;
  thumbnailUrl?: string;
  fileName: string;
  isLoading: boolean;
  thumbnailSize?: number;
  onThumbnailError: () => void;
}

export function ImageThumbnail({
  thumbnail,
  thumbnailUrl,
  fileName,
  isLoading,
  thumbnailSize,
  onThumbnailError,
}: ImageThumbnailProps) {
  const [hasError, setHasError] = useState(false);
  // Handle both URL (from virtual host) and base64 (legacy) thumbnail formats
  const imageSrc = thumbnail
    ? thumbnail.startsWith('http') ? thumbnail : `data:image/jpeg;base64,${thumbnail}`
    : thumbnailUrl || null;

  const handleError = useCallback(() => {
    setHasError(true);
    onThumbnailError();
  }, [onThumbnailError]);

  const handleRetry = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setHasError(false);
      onThumbnailError();
    },
    [onThumbnailError]
  );

  return (
    <div
      className="bg-[var(--glass-bg)] relative overflow-hidden"
      style={{
        height: thumbnailSize ? `${thumbnailSize}px` : undefined,
        aspectRatio: thumbnailSize ? undefined : '1/1',
      }}
    >
      {/* Skeleton loading animation */}
      {isLoading && <div className="absolute inset-0 bg-[var(--glass-bg-hover)] animate-pulse" />}

      {/* Blurred background image for glass effect */}
      {!isLoading && imageSrc && !hasError && (
        <div
          className="absolute inset-0 scale-110 blur-xl opacity-50 saturate-150"
          style={{
            backgroundImage: `url(${imageSrc})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}

      {/* Spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <Spinner size="md" color="secondary" />
        </div>
      )}

      {/* Error state with retry button */}
      {!isLoading && hasError && !imageSrc && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10">
          <ImageIcon size={24} className="text-red-400/60" />
          <button
            onClick={handleRetry}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-all duration-200"
            title="Erneut laden"
          >
            <RefreshCw size={12} />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Main Image - GPU accelerated */}
      {!isLoading && imageSrc && !hasError ? (
        <img
          src={imageSrc}
          alt={fileName}
          className="relative z-[1] w-full h-full object-contain transition-opacity duration-300"
          style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}
          loading="lazy"
          decoding="async"
          onError={handleError}
        />
      ) : (
        !isLoading &&
        !hasError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageIcon size={32} className="text-[var(--color-text-muted)]" />
          </div>
        )
      )}
    </div>
  );
}
