import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image, CheckSquare, Tag, ZoomIn, ZoomOut, Star } from 'lucide-react';
import { AnimatedCounter } from '../ui';
import { useAppStore } from '../../stores/appStore';
import { useTranslation } from 'react-i18next';

export const StatusBar = () => {
    const { t } = useTranslation();
    const {
        images,
        selectedImages,
        zoomLevel,
        setZoomLevel,
        zoomIn,
        zoomOut
    } = useAppStore();

    // Calculate total unique tags
    const totalTags = useMemo(() => {
        const tagSet = new Set<string>();
        images.forEach(img => {
            img.tags?.forEach(tag => tagSet.add(tag));
        });
        return tagSet.size;
    }, [images]);

    // Calculate average rating
    const averageRating = useMemo(() => {
        const ratedImages = images.filter(img => img.rating && img.rating > 0);
        if (ratedImages.length === 0) return 0;
        const sum = ratedImages.reduce((acc, img) => acc + (img.rating || 0), 0);
        return sum / ratedImages.length;
    }, [images]);

    const ratedCount = useMemo(() => {
        return images.filter(img => img.rating && img.rating > 0).length;
    }, [images]);

    return (
        <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 400, damping: 25 }}
            className="h-8 px-4 flex items-center justify-between text-xs text-[var(--color-text-secondary)] relative glass-footer"
        >
            {/* Glass Specular Highlight */}
            <div className="absolute inset-x-0 top-0 h-[1px] glass-specular" />

            {/* Selected Image Path */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
                <AnimatePresence mode="wait">
                    {selectedImages.size === 1 && (
                        <motion.p
                            key={Array.from(selectedImages)[0]}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.2 }}
                            className="text-[var(--color-text-primary)] truncate"
                            title={Array.from(selectedImages)[0]}
                        >
                            {Array.from(selectedImages)[0]}
                        </motion.p>
                    )}
                    {selectedImages.size > 1 && (
                        <motion.p
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="text-[var(--color-text-secondary)]"
                        >
                            {selectedImages.size} {t('statusBar.selected')}
                        </motion.p>
                    )}
                </AnimatePresence>
            </div>

            <div className="flex items-center gap-6">
                <div className="flex items-center gap-1.5">
                    <Image size={12} className="text-[var(--color-text-muted)]" />
                    <AnimatedCounter value={images.length} className="text-[var(--color-text-secondary)]" duration={400} />
                    <span className="text-[var(--color-text-muted)]">{t('statusBar.images')}</span>
                </div>

                <AnimatePresence>
                    {selectedImages.size > 0 && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="flex items-center gap-1.5"
                        >
                            <CheckSquare size={12} className="text-cyan-400" />
                            <AnimatedCounter value={selectedImages.size} className="text-cyan-400" duration={200} />
                            <span className="text-[var(--color-text-muted)]">{t('statusBar.selected')}</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="flex items-center gap-1.5">
                    <Tag size={12} className="text-[var(--color-text-muted)]" />
                    <AnimatedCounter value={totalTags} className="text-[var(--color-text-secondary)]" duration={600} />
                    <span className="text-[var(--color-text-muted)]">Tags</span>
                </div>

                {/* Average Rating */}
                {ratedCount > 0 && (
                    <div className="flex items-center gap-1.5">
                        <Star size={12} className="text-cyan-400 fill-cyan-400" />
                        <span className="text-cyan-400">{averageRating.toFixed(1)}</span>
                        <span className="text-[var(--color-text-muted)]">Ø ({ratedCount})</span>
                    </div>
                )}

                {/* Zoom Controls */}
                <div className="flex items-center gap-2 ml-4 pl-4 border-l border-[var(--glass-border)]">
                    <button
                        onClick={zoomOut}
                        className="p-1 hover:bg-[var(--glass-bg-hover)] rounded transition-colors"
                        title="Zoom Out (Ctrl+-)"
                    >
                        <ZoomOut size={12} className="text-[var(--color-text-secondary)]" />
                    </button>

                    <div className="flex items-center gap-2 w-32">
                        <input
                            type="range"
                            min="50"
                            max="200"
                            step="10"
                            value={zoomLevel}
                            onChange={(e) => setZoomLevel(Number(e.target.value))}
                            className="w-full h-1 bg-[var(--color-bg-tertiary)] rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-3
                [&::-webkit-slider-thumb]:h-3
                [&::-webkit-slider-thumb]:bg-cyan-400
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:cursor-pointer
                [&::-webkit-slider-thumb]:transition-transform
                [&::-webkit-slider-thumb]:hover:scale-125"
                        />
                    </div>

                    <button
                        onClick={zoomIn}
                        className="p-1 hover:bg-[var(--glass-bg-hover)] rounded transition-colors"
                        title="Zoom In (Ctrl++)"
                    >
                        <ZoomIn size={12} className="text-[var(--color-text-secondary)]" />
                    </button>

                    <button
                        onClick={() => setZoomLevel(100)}
                        className="text-[var(--color-text-secondary)] hover:text-cyan-400 transition-colors min-w-[40px] text-right"
                        title="Reset (Ctrl+0)"
                    >
                        {zoomLevel}%
                    </button>
                </div>
            </div>
        </motion.div>
    );
};
