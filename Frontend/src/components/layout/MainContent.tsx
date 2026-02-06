import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image as ImageIcon, Tag, X, ChevronUp } from 'lucide-react';
import { Spinner, Button, Tooltip } from '@heroui/react';
import { useAppStore } from '../../stores/appStore';
import { ImageGrid } from '../images/ImageGrid';
import { HeroSection } from '../dashboard';
import { Breadcrumb } from './Breadcrumb';
import { useTranslation } from 'react-i18next';

export function MainContent() {
  const { t } = useTranslation();
  const { currentFolder, images, gridItems, isLoadingImages, selectedImages, updateImageTags, navigateUp } = useAppStore();

  // Check if we can navigate up (not at root)
  const canNavigateUp = useMemo(() => {
    if (!currentFolder) return false;
    const normalized = currentFolder.replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    return parts.length > 1;
  }, [currentFolder]);

  // Get tags from selected images only
  const selectedTags = useMemo(() => {
    if (selectedImages.size === 0) return [];

    const selectedImgs = images.filter(img => selectedImages.has(img.path));
    const tagCounts = new Map<string, number>();
    selectedImgs.forEach(img => {
      img.tags?.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    return Array.from(tagCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [images, selectedImages]);

  // Remove tag from all selected images
  const handleRemoveTag = async (tagToRemove: string) => {
    for (const imagePath of selectedImages) {
      const image = images.find((img) => img.path === imagePath);
      if (image) {
        await updateImageTags(imagePath, image.tags?.filter((t) => t !== tagToRemove) || []);
      }
    }
  };

  // Empty state - no folder selected
  if (!currentFolder && !isLoadingImages) {
    return <HeroSection />;
  }

  // Loading state
  if (isLoadingImages) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <Spinner
            size="lg"
            color="primary"
            label="Lade Elemente..."
          />
        </motion.div>
      </div>
    );
  }

  // No items in folder
  if (gridItems.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[var(--glass-bg)] flex items-center justify-center">
            <ImageIcon size={36} className="text-[var(--color-text-muted)]" />
          </div>
          <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-2">
            {t('emptyState.folderEmpty')}
          </h3>
          <p className="text-[var(--color-text-muted)] text-sm">
            {t('emptyState.noImages')}
          </p>
        </motion.div>
      </div>
    );
  }

  // Counts
  const folderCount = gridItems.filter(i => i.isFolder).length;
  const imageCount = gridItems.filter(i => !i.isFolder).length;

  // Image grid
  return (
    <div className="flex-1 flex flex-col overflow-hidden" data-testid="main-content">
      {/* Toolbar with 3D depth */}
      <motion.div
        className="flex items-center justify-between px-4 py-3 border-b border-[var(--glass-border)]"
        style={{
          transformStyle: 'preserve-3d',
          boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.05)',
        }}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Navigate Up Button */}
          <Tooltip content={t('common.parentFolder')} placement="bottom">
            <Button
              isIconOnly
              size="sm"
              variant="flat"
              isDisabled={!canNavigateUp}
              onPress={() => navigateUp()}
              className="flex-shrink-0 bg-[var(--glass-bg)] hover:bg-[var(--glass-bg-hover)] disabled:opacity-30"
            >
              <ChevronUp size={18} />
            </Button>
          </Tooltip>

          {/* Breadcrumb */}
          <Breadcrumb />

          {/* Stats */}
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] flex-shrink-0 ml-auto">
            {folderCount > 0 && <span>{folderCount} {t('statusBar.folders')}</span>}
            {folderCount > 0 && imageCount > 0 && <span>•</span>}
            {imageCount > 0 && <span>{imageCount} {t('statusBar.images')}</span>}
            {selectedImages.size > 0 && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="flex items-center gap-2"
              >
                <span>•</span>
                <motion.span
                  className="text-cyan-400 font-medium"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 0.5 }}
                  style={{ textShadow: '0 2px 8px rgba(6,182,212,0.3)' }}
                >
                  {selectedImages.size} {t('toolbar.selected')}
                </motion.span>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Grid */}
      <div className="flex-1 min-h-0">
        <ImageGrid />
      </div>

      {/* Selected Image Tags Panel */}
      <AnimatePresence>
        {selectedTags.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="border-t border-[var(--glass-border)] bg-[var(--glass-bg)] overflow-hidden"
          >
            <div className="p-3">
              <div
                className="rounded-xl p-3 relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12) 0%, rgba(6, 182, 212, 0.04) 100%)',
                  border: '1px solid rgba(6, 182, 212, 0.20)',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
                }}
              >
                {/* Glass Specular Highlight */}
                <div
                  className="absolute inset-x-0 top-0 h-[1px]"
                  style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)' }}
                />
                <div className="flex items-center gap-2 mb-2">
                  <Tag size={14} className="text-cyan-400" />
                  <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                    Tags der Auswahl
                  </span>
                  <span className="text-xs text-[var(--color-text-muted)]">({selectedTags.length})</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedTags.map(({ name, count }, index) => (
                    <motion.span
                      key={name}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{
                        delay: index * 0.04,
                        duration: 0.25,
                        ease: 'easeOut'
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs text-[var(--color-text-primary)] cursor-pointer group/tag"
                      style={{
                        background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(6, 182, 212, 0.05) 100%)',
                        // backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(6, 182, 212, 0.25)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1)',
                      }}
                    >
                      <Tag size={10} className="text-cyan-400" />
                      <span>{name}</span>
                      {selectedImages.size > 1 && (
                        <span className="text-cyan-400 text-[10px] font-medium">{count}</span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveTag(name);
                        }}
                        className="ml-0.5 p-0.5 rounded-full hover:bg-red-500/30 hover:scale-110 transition-all"
                      >
                        <X size={10} className="text-[var(--color-text-muted)] group-hover/tag:text-red-400" />
                      </button>
                    </motion.span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

