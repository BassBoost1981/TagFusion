import { Image as ImageIcon } from 'lucide-react';
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
  const imageSrc = thumbnail
    ? `data:image/jpeg;base64,${thumbnail}`
    : thumbnailUrl || null;

  return (
    <div
      className="bg-[var(--glass-bg)] relative overflow-hidden"
      style={{
        height: thumbnailSize ? `${thumbnailSize}px` : undefined,
        aspectRatio: thumbnailSize ? undefined : '1/1',
      }}
    >
      {/* Skeleton loading animation */}
      {isLoading && (
        <div className="absolute inset-0 bg-[var(--glass-bg-hover)] animate-pulse" />
      )}

      {/* Blurred background image for glass effect */}
      {!isLoading && imageSrc && (
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

      {/* Main Image - GPU accelerated */}
      {!isLoading && thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={fileName}
          className="relative z-[1] w-full h-full object-contain transition-opacity duration-300"
          style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}
          loading="lazy"
          onError={onThumbnailError}
        />
      ) : !isLoading && thumbnail ? (
        <img
          src={`data:image/jpeg;base64,${thumbnail}`}
          alt={fileName}
          className="relative z-[1] w-full h-full object-contain transition-opacity duration-300"
          style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}
        />
      ) : !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <ImageIcon size={32} className="text-[var(--color-text-muted)]" />
        </div>
      )}
    </div>
  );
}

