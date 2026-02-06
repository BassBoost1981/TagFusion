import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Check, Tag } from 'lucide-react';
import { Card, CardFooter } from '@heroui/react';
import { useAppStore } from '../../stores/appStore';
import { useLightboxStore } from '../../stores/lightboxStore';
import { useToastStore } from '../../stores/toastStore';
import { bridge } from '../../services/bridge';
import type { ImageFile } from '../../types';
import { ImageThumbnail } from './ImageThumbnail';
import { StarRating } from './StarRating';
import { useImageContextMenu } from './useImageContextMenu';

interface ImageCardProps {
  image: ImageFile;
  thumbnailSize?: number;
  allImages?: ImageFile[];
}

export function ImageCard({ image, thumbnailSize, allImages = [] }: ImageCardProps) {
  const { selectedImages, selectImage, images: storeImages, updateImageRating } = useAppStore();
  const { open: openLightbox } = useLightboxStore();
  const [thumbnail, setThumbnail] = useState<string | null>(image.thumbnailBase64 || null);
  const [isLoading, setIsLoading] = useState(!image.thumbnailBase64 && !image.thumbnailUrl);
  const [rating, setRating] = useState(image.rating || 0);
  const [isSaving, setIsSaving] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const isSelected = selectedImages.has(image.path);
  const tagCount = image.tags?.length || 0;
  const handleContextMenu = useImageContextMenu({ image, allImages });

  // Sync rating from props when image changes
  useEffect(() => {
    setRating(image.rating || 0);
  }, [image.rating]);

  // Lazy loading with IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' } // Load 300px before becoming visible for faster perceived loading
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Load thumbnail when visible - with minimal delay to allow batching
  useEffect(() => {
    if (isVisible && !thumbnail && !image.thumbnailUrl) {
      // Small random delay to spread out requests and prevent all loading at once
      const delay = Math.random() * 50;
      const timer = setTimeout(() => {
        loadThumbnail();
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [isVisible, image.path, image.thumbnailUrl]);

  const loadThumbnail = useCallback(async () => {
    try {
      setIsLoading(true);
      const base64 = await bridge.getThumbnail(image.path);
      setThumbnail(base64);
    } catch (error) {
      console.error('Failed to load thumbnail:', error);
    } finally {
      setIsLoading(false);
    }
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
      useToastStore.getState().success(`Bewertung: ${'★'.repeat(newRating)}${'☆'.repeat(5 - newRating)}`);
    } catch (error) {
      console.error('Failed to save rating:', error);
      setRating(image.rating || 0); // Revert on error
      useToastStore.getState().error('Bewertung konnte nicht gespeichert werden');
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
    <motion.div
      ref={cardRef}
      whileHover={{
        scale: 1.03,
        y: -4,
      }}
      whileTap={{ scale: 0.98 }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 25,
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      className={`
        relative group cursor-pointer rounded-xl overflow-hidden
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
        className="relative rounded-xl overflow-hidden border-none bg-[var(--glass-bg)]"
      >
        {/* Thumbnail */}
        <ImageThumbnail
          thumbnail={thumbnail}
          thumbnailUrl={image.thumbnailUrl}
          fileName={image.fileName}
          isLoading={isLoading}
          thumbnailSize={thumbnailSize}
          onThumbnailError={() => { if (!thumbnail) loadThumbnail(); }}
        />

        {/* Overlays on top of thumbnail */}
        <div className="absolute inset-0 pointer-events-none" style={{ bottom: 'auto', height: thumbnailSize ? `${thumbnailSize}px` : '100%' }}>
          {/* Tag count badge */}
          {tagCount > 0 && (
            <motion.div
              className="absolute top-3 left-3 z-20 px-2.5 py-1 rounded-full bg-cyan-500/95 text-white text-xs font-bold flex items-center gap-1.5 shadow-depth-near"
              style={{
                transform: 'translateZ(25px)',
                boxShadow: '0 4px 12px rgba(6,182,212,0.4), inset 0 1px 0 rgba(255,255,255,0.3)',
              }}
              whileHover={{ scale: 1.1, y: -2 }}
            >
              <Tag size={11} />
              {tagCount}
            </motion.div>
          )}

          {/* Selection indicator */}
          <motion.div
            initial={false}
            animate={{
              opacity: isSelected ? 1 : 0,
              scale: isSelected ? 1 : 0.5,
              rotateZ: isSelected ? 0 : -180,
            }}
            className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center"
            style={{
              transform: 'translateZ(30px)',
              boxShadow: '0 6px 20px rgba(6,182,212,0.5), inset 0 1px 0 rgba(255,255,255,0.4)',
            }}
            whileHover={{ scale: 1.15, rotate: 5 }}
          >
            <Check size={16} className="text-white" strokeWidth={3} />
          </motion.div>

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
    </motion.div>
  );
}

