import { useEffect, useCallback, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
  Star,
  Tag,
  Info,
  FlipHorizontal,
  FlipVertical,
  Film,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLightboxStore } from '../../stores/lightboxStore';
import { useAppStore, useSetError } from '../../stores/appStore';
import { bridge } from '../../services/bridge';
import { LIGHTBOX_ZOOM_DEFAULT } from '../../constants/ui';
import { GlassIconButton as GlassIconButtonBase } from '../ui/glass';
import { invalidateThumbnail } from '../../hooks/useThumbnailManager';
import { FilmstripThumbnail } from './FilmstripThumbnail';

export function Lightbox() {
  const {
    isOpen,
    currentImage,
    currentIndex,
    images,
    zoomLevel,
    close,
    next,
    previous,
    zoomIn,
    zoomOut,
    resetZoom,
    setZoom,
    goToIndex,
  } = useLightboxStore();
  const { refreshImages } = useAppStore();
  const setError = useSetError();
  const { t } = useTranslation();

  // Now holds an HTTPS URL (thumbs.tagfusion.local) rather than base64 —
  // avoids multi-megabyte JSON payloads on the WebView2 bridge.
  const [fullImage, setFullImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showInfo, setShowInfo] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showFilmstrip, setShowFilmstrip] = useState(true);
  const filmstripRef = useRef<HTMLDivElement>(null);
  const activeThumbRef = useRef<HTMLButtonElement>(null);

  // AI description — cached per path so filmstrip navigation doesn't refetch.
  // KI-Beschreibung — pro Pfad gecacht, damit Blättern nicht erneut lädt.
  const [description, setDescription] = useState<string | null>(null);
  const descriptionCacheRef = useRef<Map<string, string | null>>(new Map());
  const descriptionPathRef = useRef<string | null>(null);

  // Pan state
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const isZoomed = zoomLevel > LIGHTBOX_ZOOM_DEFAULT;

  // Reset pan when image changes or zoom resets
  useEffect(() => {
    setPanX(0);
    setPanY(0);
  }, [currentImage?.path]);

  // Reset pan when zoom goes back to default
  useEffect(() => {
    if (zoomLevel <= LIGHTBOX_ZOOM_DEFAULT) {
      setPanX(0);
      setPanY(0);
    }
  }, [zoomLevel]);

  // Load full resolution image — intentionally depends only on path, not the full object
  useEffect(() => {
    if (isOpen && currentImage) {
      setIsLoading(true);
      setFullImage(null);

      // Load full image via bridge — returns a virtual-host URL.
      bridge
        .getFullImage(currentImage.path)
        .then((url) => {
          setFullImage(url);
          setIsLoading(false);
        })
        .catch((err) => {
          setError((err as Error).message);
          // Fallback to existing thumbnail URL.
          setFullImage(currentImage.thumbnailUrl || null);
          setIsLoading(false);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentImage?.path]);

  // Load the AI description on demand when the image changes.
  // KI-Beschreibung bei Bildwechsel on-demand laden.
  useEffect(() => {
    if (!isOpen || !currentImage) return;
    const path = currentImage.path;
    descriptionPathRef.current = path;

    const cached = descriptionCacheRef.current.get(path);
    if (cached !== undefined) {
      setDescription(cached);
      return;
    }

    setDescription(null);
    bridge
      .getImageDescription(path)
      .then((text) => {
        descriptionCacheRef.current.set(path, text);
        // Out-of-order guard: apply only if this image is still the current one.
        // Out-of-Order-Guard: nur übernehmen, wenn das Bild noch das aktuelle ist.
        if (descriptionPathRef.current === path) setDescription(text);
      })
      .catch(() => {
        // Silent — the description row simply stays hidden.
        // Stumm — die Beschreibungszeile bleibt einfach ausgeblendet.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentImage?.path]);

  // Preload adjacent images for instant navigation. With URL-based full images,
  // preloading is essentially free (one HTTP fetch into the WebView2 cache),
  // so widen the window to \u00b13 for power-user keyboard navigation.
  // Preload-Fenster auf \u00b13 verbreitern \u2014 mit URL-basierten Bildern fast kostenlos.
  useEffect(() => {
    if (!isOpen || images.length <= 1) return;

    const preloadIndices = [
      currentIndex - 3,
      currentIndex - 2,
      currentIndex - 1,
      currentIndex + 1,
      currentIndex + 2,
      currentIndex + 3,
    ].filter((i) => i >= 0 && i < images.length);

    preloadIndices.forEach((idx) => {
      const img = images[idx];
      if (img?.path) {
        bridge.getFullImage(img.path).catch(() => {});
      }
    });
  }, [isOpen, currentIndex, images]);

  // Auto-scroll filmstrip to active thumbnail (React docs pattern)
  useEffect(() => {
    if (activeThumbRef.current && showFilmstrip) {
      activeThumbRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [currentIndex, showFilmstrip]);

  // Scroll-wheel zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? -10 : 10;
      const newZoom = zoomLevel + delta;
      setZoom(newZoom);
    },
    [zoomLevel, setZoom]
  );

  // Drag-to-pan handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isZoomed) return;
      e.preventDefault();
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY, panX, panY };
    },
    [isZoomed, panX, panY]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setPanX(dragStart.current.panX + dx);
      setPanY(dragStart.current.panY + dy);
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Double-click to toggle fit ↔ 100%
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (zoomLevel === LIGHTBOX_ZOOM_DEFAULT) {
        setZoom(200);
      } else {
        resetZoom();
      }
    },
    [zoomLevel, setZoom, resetZoom]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'Escape':
          close();
          break;
        case 'ArrowLeft':
          previous();
          break;
        case 'ArrowRight':
          next();
          break;
        case '+':
        case '=':
          zoomIn();
          break;
        case '-':
          zoomOut();
          break;
        case '0':
          resetZoom();
          break;
        case 'i':
          setShowInfo((prev) => !prev);
          break;
      }
    },
    [isOpen, close, next, previous, zoomIn, zoomOut, resetZoom]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const runImageMutation = async (mutate: (path: string) => Promise<unknown>) => {
    if (!currentImage || isProcessing) return;

    setIsProcessing(true);
    try {
      await mutate(currentImage.path);
      const url = await bridge.getFullImage(currentImage.path);
      setFullImage(url);
      invalidateThumbnail(currentImage.path);
      refreshImages();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Rotate image
  const handleRotate = async (angle: number) => {
    await runImageMutation((path) => bridge.rotateImages([path], angle));
  };

  // Flip image
  const handleFlip = async (horizontal: boolean) => {
    await runImageMutation((path) => bridge.flipImages([path], horizontal));
  };

  if (!currentImage) return null;

  const imageUrl = fullImage || currentImage.thumbnailUrl || '';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label={`${t('lightbox.info')}: ${currentImage.fileName}`}
          onClick={close}
        >
          {/* Backdrop with heavy blur */}
          <div
            className="absolute inset-0"
            style={{
              background: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(20px)',
            }}
          />

          {/* Main Image Container - Fullscreen optimized */}
          <motion.div
            ref={imageContainerRef}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="relative z-10 w-[95vw] h-[90vh] flex items-center justify-center overflow-hidden"
            style={{
              cursor: isZoomed ? (isDragging ? 'grabbing' : 'grab') : 'default',
            }}
            onClick={(e) => e.stopPropagation()}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={handleDoubleClick}
          >
            {/* Loading/Processing Spinner */}
            {(isLoading || isProcessing) && (
              <div className="absolute inset-0 flex items-center justify-center z-20">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-12 h-12 border-4 border-cyan-400/30 border-t-cyan-400 rounded-full"
                />
              </div>
            )}

            {/* Image - Maximized with Pan & Zoom */}
            <motion.img
              src={imageUrl}
              alt={currentImage.fileName}
              className="w-full h-full object-contain select-none"
              style={{
                transform: `translate(${panX}px, ${panY}px) scale(${zoomLevel / 100})`,
                opacity: isLoading || isProcessing ? 0.3 : 1,
                filter: isProcessing ? 'blur(2px)' : 'none',
                transition: isDragging ? 'none' : 'transform 0.15s ease-out',
              }}
              draggable={false}
              initial={{ opacity: 0 }}
              animate={{ opacity: isLoading || isProcessing ? 0.3 : 1 }}
            />
          </motion.div>

          {/* Top Bar - Glass */}
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between"
            style={{
              background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* File Info */}
            <div className="flex items-center gap-4">
              <span className="text-white font-medium">{currentImage.fileName}</span>
              <span className="text-slate-400 text-sm">
                {currentIndex + 1} / {images.length}
              </span>
            </div>
            {/* Close Button */}
            <GlassIconButton onClick={close} title={t('lightbox.close')}>
              <X size={20} />
            </GlassIconButton>
          </motion.div>

          {/* Navigation Arrows */}
          {images.length > 1 && (
            <>
              <motion.button
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                onClick={(e) => {
                  e.stopPropagation();
                  previous();
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full transition-all hover:scale-110"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.2)',
                }}
                whileHover={{ background: 'rgba(6,182,212,0.3)' }}
                whileTap={{ scale: 0.95 }}
                title={t('lightbox.previous')}
              >
                <ChevronLeft size={28} className="text-white" />
              </motion.button>

              <motion.button
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 20, opacity: 0 }}
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full transition-all hover:scale-110"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.2)',
                }}
                whileHover={{ background: 'rgba(6,182,212,0.3)' }}
                whileTap={{ scale: 0.95 }}
                title={t('lightbox.next')}
              >
                <ChevronRight size={28} className="text-white" />
              </motion.button>
            </>
          )}

          {/* Filmstrip / Thumbnail Navigation — absolute, above bottom bar */}
          {showFilmstrip && images.length > 1 && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ delay: 0.1 }}
              className="absolute bottom-14 left-0 right-0 z-20"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                ref={filmstripRef}
                className="flex gap-1 overflow-x-auto py-1.5 px-4 mx-auto max-w-[90vw]"
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                }}
              >
                {images.map((img, idx) => {
                  const isActive = idx === currentIndex;
                  return (
                    <FilmstripThumbnail
                      key={img.path}
                      ref={isActive ? activeThumbRef : null}
                      image={img}
                      isActive={isActive}
                      onSelect={() => goToIndex(idx)}
                    />
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Bottom Bar - Controls & Info */}
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="absolute bottom-0 left-0 right-0 p-4"
            style={{
              background: 'linear-gradient(0deg, rgba(0,0,0,0.7) 0%, transparent 100%)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              {/* Image Info */}
              <AnimatePresence>
                {showInfo && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex flex-col items-start gap-2"
                  >
                    <div className="flex items-center gap-4">
                      {/* Rating */}
                      <div className="flex items-center gap-1">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <Star
                            key={i}
                            size={16}
                            className={i < (currentImage.rating || 0) ? 'text-cyan-400' : 'text-slate-600'}
                            fill={i < (currentImage.rating || 0) ? 'currentColor' : 'none'}
                          />
                        ))}
                      </div>

                      {/* Tags */}
                      {currentImage.tags && currentImage.tags.length > 0 && (
                        <div className="flex items-center gap-2">
                          <Tag size={14} className="text-cyan-400" />
                          <span className="text-slate-300 text-sm">
                            {currentImage.tags.slice(0, 5).join(', ')}
                            {currentImage.tags.length > 5 && ` +${currentImage.tags.length - 5}`}
                          </span>
                        </div>
                      )}

                      {/* Dimensions */}
                      {currentImage.width && currentImage.height && (
                        <span className="text-slate-400 text-sm">
                          {currentImage.width} × {currentImage.height}
                        </span>
                      )}
                    </div>

                    {/* AI description — display only, hidden when none exists */}
                    {/* KI-Beschreibung — nur Anzeige, ohne Beschreibung ausgeblendet */}
                    {description && (
                      <div className="flex items-start gap-2 max-w-xl">
                        <span className="text-cyan-400 text-sm flex-shrink-0">{t('lightbox.description')}:</span>
                        <p className="text-slate-300 text-sm max-h-24 overflow-y-auto whitespace-pre-wrap">
                          {description}
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Controls */}
              <div className="flex items-center gap-2">
                <GlassIconButton onClick={() => setShowFilmstrip((p) => !p)} title={t('lightbox.filmstrip')}>
                  <Film size={18} className={showFilmstrip ? 'text-cyan-400' : ''} />
                </GlassIconButton>
                <GlassIconButton onClick={() => setShowInfo((p) => !p)} title={t('lightbox.info')}>
                  <Info size={18} className={showInfo ? 'text-cyan-400' : ''} />
                </GlassIconButton>

                <div className="w-px h-6 bg-white/20 mx-2" />

                {/* Rotate Controls */}
                <GlassIconButton
                  onClick={() => handleRotate(-90)}
                  title={t('lightbox.rotateLeft')}
                  disabled={isProcessing}
                >
                  <RotateCcw size={18} />
                </GlassIconButton>
                <GlassIconButton
                  onClick={() => handleRotate(90)}
                  title={t('lightbox.rotateRight')}
                  disabled={isProcessing}
                >
                  <RotateCw size={18} />
                </GlassIconButton>

                <div className="w-px h-6 bg-white/20 mx-1" />

                {/* Flip Controls */}
                <GlassIconButton
                  onClick={() => handleFlip(true)}
                  title={t('lightbox.flipHorizontal')}
                  disabled={isProcessing}
                >
                  <FlipHorizontal size={18} />
                </GlassIconButton>
                <GlassIconButton
                  onClick={() => handleFlip(false)}
                  title={t('lightbox.flipVertical')}
                  disabled={isProcessing}
                >
                  <FlipVertical size={18} />
                </GlassIconButton>

                <div className="w-px h-6 bg-white/20 mx-2" />

                {/* Zoom Controls */}
                <GlassIconButton onClick={zoomOut} title={t('lightbox.zoomOut')}>
                  <ZoomOut size={18} />
                </GlassIconButton>
                <span className="text-white text-sm min-w-[50px] text-center">{zoomLevel}%</span>
                <GlassIconButton onClick={zoomIn} title={t('lightbox.zoomIn')}>
                  <ZoomIn size={18} />
                </GlassIconButton>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Lightbox-specific wrapper for consistent dark-backdrop styling
function GlassIconButton({
  children,
  onClick,
  title,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <GlassIconButtonBase
      onClick={disabled ? undefined : onClick}
      title={title}
      disabled={disabled}
      variant="ghost"
      size="sm"
      className="!text-white/80 hover:!text-white !bg-white/10 hover:!bg-cyan-500/30 !border-white/15 !backdrop-blur-md"
    >
      {children}
    </GlassIconButtonBase>
  );
}
