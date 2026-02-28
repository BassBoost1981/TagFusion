import { useState, useEffect, memo } from 'react';
import { Check, Tag } from 'lucide-react';
import { Card, CardFooter } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores/appStore';
import { useLightboxStore } from '../../stores/lightboxStore';
import { useToastStore } from '../../stores/toastStore';
import type { ImageFile } from '../../types';
import { ImageThumbnail } from './ImageThumbnail';
import { StarRating } from './StarRating';
import { useImageContextMenu } from './useImageContextMenu';
import { useThumbnail, requestThumbnail } from '../../hooks/useThumbnailManager';

interface ImageCardProps {
  image: ImageFile;
  thumbnailSize?: number;
  allImages?: ImageFile[];
  isSelected?: boolean;
}

export const ImageCard = memo(function ImageCard({ image, thumbnailSize, allImages = [], isSelected: isSelectedProp }: ImageCardProps) {
  const { t } = useTranslation();
  const selectImage = useAppStore((s) => s.selectImage);
  const updateImageRating = useAppStore((s) => s.updateImageRating);
  const storeImages = useAppStore((s) => s.images);
  const openLightbox = useLightboxStore((s) => s.open);
  const [thumbnail, isLoading] = useThumbnail(image.path, image.thumbnailBase64);
  const [rating, setRating] = useState(image.rating || 0);
  const [isSaving, setIsSaving] = useState(false);

  // Use prop if provided, otherwise fall back to store lookup
  const selectedImages = useAppStore((s) => isSelectedProp === undefined ? s.selectedImages : null);
  const isSelected = isSelectedProp ?? selectedImages?.has(image.path) ?? false;
  const tagCount = image.tags?.length || 0;
  const handleContextMenu = useImageContextMenu({ image, allImages });

  // Sync rating from props when image changes
  useEffect(() => {
    setRating(image.rating || 0);
  }, [image.rating]);

  // VirtuosoGrid only renders visible items — request thumbnail on mount
  useEffect(() => {
    requestThumbnail(image.path);
  }, [image.path]);

  const handleClick = (e: React.MouseEvent) => {
    selectImage(image.path, e.ctrlKey || e.metaKey, e.shiftKey);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Use provided images or fall back to store images
    const imageList = allImages.length > 0 ? allImages : storeImages;
    openLightbox(image, imageList);
  };

  const handleRating = async (e: React.MouseEvent, starIndex: number) => {
    e.stopPropagation();
    const newRating = starIndex + 1;
    setRating(newRating);
    setIsSaving(true);
    try {
      await updateImageRating(image.path, newRating);
      useToastStore.getState().success(`${t('imageCard.ratingSet')} ${'★'.repeat(newRating)}${'☆'.repeat(5 - newRating)}`);
    } catch (error) {
      console.error('Failed to save rating:', error);
      setRating(image.rating || 0); // Revert on error
      useToastStore.getState().error(t('imageCard.ratingFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearRating = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setRating(0);
    setIsSaving(true);
    try {
      await updateImageRating(image.path, 0);
    } catch (error) {
      console.error('Failed to clear rating:', error);
      setRating(image.rating || 0); // Revert on error
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      tabIndex={0}
      role="gridcell"
      aria-selected={isSelected}
      aria-label={`${image.fileName}${tagCount > 0 ? `, ${tagCount} tags` : ''}${rating > 0 ? `, ${rating} stars` : ''}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const imageList = allImages.length > 0 ? allImages : storeImages;
          openLightbox(image, imageList);
        } else if (e.key === ' ') {
          e.preventDefault();
          selectImage(image.path, e.ctrlKey || e.metaKey, e.shiftKey);
        }
      }}
      className={`
        relative group cursor-pointer rounded-xl overflow-hidden w-full h-full
        transition-transform duration-200 ease-out outline-none
        hover:scale-[1.03] hover:-translate-y-1
        active:scale-[0.98]
        focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]
        ${isSelected ? 'ring-2 ring-cyan-400/70 ring-offset-2 ring-offset-[var(--color-bg-primary)]' : ''}
      `}
      style={{
        boxShadow: isSelected
          ? '0 8px 32px rgba(6,182,212,0.35), 0 0 0 1px rgba(6,182,212,0.3)'
          : '0 4px 16px rgba(0,0,0,0.2)',
      }}
    >
      {/* Card Container - HeroUI with Blurred Footer */}
      <Card
        isFooterBlurred
        className="relative rounded-xl overflow-hidden border-none bg-[var(--glass-bg)] w-full h-full"
      >
        {/* Thumbnail */}
        <ImageThumbnail
          thumbnail={thumbnail}
          thumbnailUrl={image.thumbnailUrl}
          fileName={image.fileName}
          isLoading={isLoading}
          thumbnailSize={thumbnailSize}
          onThumbnailError={() => { if (!thumbnail) requestThumbnail(image.path); }}
        />

        {/* Overlays on top of thumbnail */}
        <div className="absolute inset-0 pointer-events-none" style={{ bottom: 'auto', height: thumbnailSize ? `${thumbnailSize}px` : '100%' }}>
          {/* Tag count badge */}
          {tagCount > 0 && (
            <div
              className="absolute top-3 left-3 z-20 px-2.5 py-1 rounded-full bg-cyan-500/95 text-white text-xs font-bold flex items-center gap-1.5 shadow-depth-near"
              style={{
                boxShadow: '0 4px 12px rgba(6,182,212,0.4), inset 0 1px 0 rgba(255,255,255,0.3)',
              }}
            >
              <Tag size={11} />
              {tagCount}
            </div>
          )}

          {/* Selection indicator */}
          <div
            className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center transition-all duration-200"
            style={{
              opacity: isSelected ? 1 : 0,
              transform: `scale(${isSelected ? 1 : 0.5}) rotate(${isSelected ? 0 : -180}deg)`,
              boxShadow: '0 6px 20px rgba(6,182,212,0.5), inset 0 1px 0 rgba(255,255,255,0.4)',
            }}
          >
            <Check size={16} className="text-white" strokeWidth={3} />
          </div>

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--glass-bg)] via-[var(--glass-bg)]/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>

        {/* Footer with filename and rating */}
        <CardFooter className="flex-col items-center gap-0 before:bg-white/10 border-white/20 border-1 overflow-hidden py-1.5 px-3 absolute before:rounded-xl rounded-large bottom-1 w-[calc(100%_-_8px)] shadow-small ml-1 z-10 transition-all duration-200">
          <p className="w-full text-xs text-white/90 font-medium truncate text-center max-h-0 opacity-0 group-hover:max-h-8 group-hover:opacity-100 group-hover:mb-1 transition-all duration-200 overflow-hidden">
            {image.fileName}
          </p>
          <StarRating
            rating={rating}
            isSaving={isSaving}
            onRate={handleRating}
            onClear={handleClearRating}
          />
        </CardFooter>
      </Card>
    </div>
  );
}, (prev, next) => {
  return prev.image.path === next.image.path &&
    prev.image.rating === next.image.rating &&
    prev.isSelected === next.isSelected &&
    prev.thumbnailSize === next.thumbnailSize &&
    prev.image.tags?.length === next.image.tags?.length &&
    prev.image.tags?.join(',') === next.image.tags?.join(',');
});

