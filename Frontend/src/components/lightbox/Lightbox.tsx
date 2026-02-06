import { useEffect, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut,
  RotateCcw, RotateCw, Star, Tag, Info, FlipHorizontal, FlipVertical
} from 'lucide-react';
import { useLightboxStore } from '../../stores/lightboxStore';
import { useAppStore } from '../../stores/appStore';
import { bridge } from '../../services/bridge';

export function Lightbox() {
  const {
    isOpen, currentImage, currentIndex, images, zoomLevel,
    close, next, previous, zoomIn, zoomOut, resetZoom
  } = useLightboxStore();
  const { refreshImages } = useAppStore();

  const [fullImage, setFullImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showInfo, setShowInfo] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load full resolution image
  useEffect(() => {
    if (isOpen && currentImage) {
      setIsLoading(true);
      setFullImage(null);

      // Load full image via bridge
      bridge.getFullImage(currentImage.path)
        .then((base64) => {
          setFullImage(base64);
          setIsLoading(false);
        })
        .catch((err) => {
          console.error('Failed to load full image:', err);
          // Fallback to thumbnail
          setFullImage(currentImage.thumbnailBase64 || null);
          setIsLoading(false);
        });
    }
  }, [isOpen, currentImage?.path]);

  // Preload adjacent images for instant navigation
  useEffect(() => {
    if (!isOpen || images.length <= 1) return;

    const preloadIndices = [
      currentIndex - 1,
      currentIndex + 1
    ].filter(i => i >= 0 && i < images.length);

    preloadIndices.forEach(idx => {
      const img = images[idx];
      if (img?.path) {
        // Preload in background (result is cached by backend)
        bridge.getFullImage(img.path).catch(() => { });
      }
    });
  }, [isOpen, currentIndex, images]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
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
        setShowInfo(prev => !prev);
        break;
    }
  }, [isOpen, close, next, previous, zoomIn, zoomOut, resetZoom]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Rotate image
  const handleRotate = async (angle: number) => {
    if (!currentImage || isProcessing) return;
    setIsProcessing(true);
    try {
      await bridge.rotateImages([currentImage.path], angle);
      // Reload image
      const base64 = await bridge.getFullImage(currentImage.path);
      setFullImage(base64);
      // Refresh thumbnails in grid
      refreshImages();
    } catch (err) {
      console.error('Failed to rotate:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Flip image
  const handleFlip = async (horizontal: boolean) => {
    if (!currentImage || isProcessing) return;
    setIsProcessing(true);
    try {
      await bridge.flipImages([currentImage.path], horizontal);
      // Reload image
      const base64 = await bridge.getFullImage(currentImage.path);
      setFullImage(base64);
      // Refresh thumbnails in grid
      refreshImages();
    } catch (err) {
      console.error('Failed to flip:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!currentImage) return null;

  const imageUrl = fullImage
    ? `data:image/jpeg;base64,${fullImage}`
    : currentImage.thumbnailBase64
      ? `data:image/jpeg;base64,${currentImage.thumbnailBase64}`
      : currentImage.thumbnailUrl || '';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
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
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="relative z-10 w-[95vw] h-[90vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
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

            {/* Image - Maximized */}
            <motion.img
              src={imageUrl}
              alt={currentImage.fileName}
              className="w-full h-full object-contain select-none"
              style={{
                transform: `scale(${zoomLevel / 100})`,
                opacity: (isLoading || isProcessing) ? 0.3 : 1,
                filter: isProcessing ? 'blur(2px)' : 'none',
              }}
              draggable={false}
              initial={{ opacity: 0 }}
              animate={{ opacity: (isLoading || isProcessing) ? 0.3 : 1 }}
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
            <GlassIconButton onClick={close} title="Schließen (ESC)">
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
                onClick={(e) => { e.stopPropagation(); previous(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full transition-all hover:scale-110"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.2)',
                }}
                whileHover={{ background: 'rgba(6,182,212,0.3)' }}
                whileTap={{ scale: 0.95 }}
                title="Vorheriges (←)"
              >
                <ChevronLeft size={28} className="text-white" />
              </motion.button>

              <motion.button
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 20, opacity: 0 }}
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full transition-all hover:scale-110"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.2)',
                }}
                whileHover={{ background: 'rgba(6,182,212,0.3)' }}
                whileTap={{ scale: 0.95 }}
                title="Nächstes (→)"
              >
                <ChevronRight size={28} className="text-white" />
              </motion.button>
            </>
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
                    className="flex items-center gap-4"
                  >
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
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Controls */}
              <div className="flex items-center gap-2">
                <GlassIconButton onClick={() => setShowInfo(p => !p)} title="Info (I)">
                  <Info size={18} className={showInfo ? 'text-cyan-400' : ''} />
                </GlassIconButton>

                <div className="w-px h-6 bg-white/20 mx-2" />

                {/* Rotate Controls */}
                <GlassIconButton onClick={() => handleRotate(-90)} title="Links drehen" disabled={isProcessing}>
                  <RotateCcw size={18} />
                </GlassIconButton>
                <GlassIconButton onClick={() => handleRotate(90)} title="Rechts drehen" disabled={isProcessing}>
                  <RotateCw size={18} />
                </GlassIconButton>

                <div className="w-px h-6 bg-white/20 mx-1" />

                {/* Flip Controls */}
                <GlassIconButton onClick={() => handleFlip(true)} title="Horizontal spiegeln" disabled={isProcessing}>
                  <FlipHorizontal size={18} />
                </GlassIconButton>
                <GlassIconButton onClick={() => handleFlip(false)} title="Vertikal spiegeln" disabled={isProcessing}>
                  <FlipVertical size={18} />
                </GlassIconButton>

                <div className="w-px h-6 bg-white/20 mx-2" />

                {/* Zoom Controls */}
                <GlassIconButton onClick={zoomOut} title="Verkleinern (-)">
                  <ZoomOut size={18} />
                </GlassIconButton>
                <span className="text-white text-sm min-w-[50px] text-center">{zoomLevel}%</span>
                <GlassIconButton onClick={zoomIn} title="Vergrößern (+)">
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

// Helper Component
function GlassIconButton({
  children,
  onClick,
  title,
  disabled = false
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <motion.button
      onClick={disabled ? undefined : onClick}
      title={title}
      className={`p-2 rounded-lg transition-colors ${disabled
          ? 'text-white/30 cursor-not-allowed'
          : 'text-white/80 hover:text-white'
        }`}
      style={{
        background: disabled ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.15)',
      }}
      whileHover={disabled ? {} : { scale: 1.05, background: 'rgba(6,182,212,0.3)' }}
      whileTap={disabled ? {} : { scale: 0.95 }}
    >
      {children}
    </motion.button>
  );
}

