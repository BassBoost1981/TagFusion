import { useMemo } from 'react';
import { Image as ImageIcon, Tag, X, ChevronUp } from 'lucide-react';
import { Spinner, Button, Tooltip } from '@heroui/react';
import {
  useCurrentFolder,
  useImages,
  useGridItems,
  useIsLoadingImages,
  useSelectedImages,
  useUpdateImageTags,
  useNavigateUp
} from '../../stores/appStore';
import { ImageGrid } from '../images/ImageGrid';
import { HeroSection } from '../dashboard';
import { Breadcrumb } from './Breadcrumb';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useSetError } from '../../stores/appStore';

export function MainContent() {
  const { t } = useTranslation();

  // Optimierte Selektoren — jeder subscribed nur auf seinen Wert
  const currentFolder = useCurrentFolder();
  const images = useImages();
  const gridItems = useGridItems();
  const isLoadingImages = useIsLoadingImages();
  const selectedImages = useSelectedImages();
  const updateImageTags = useUpdateImageTags();
  const navigateUp = useNavigateUp();
  const setError = useSetError();

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
    try {
      for (const imagePath of selectedImages) {
        const image = images.find((img) => img.path === imagePath);
        if (image) {
          await updateImageTags(imagePath, image.tags?.filter((t) => t !== tagToRemove) || []);
        }
      }
    } catch (error) {
      setError((error as Error).message);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden" data-testid="main-content">
      <AnimatePresence mode="wait">
        {!currentFolder && !isLoadingImages ? (
          <motion.div
            key="hero"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <HeroSection />
          </motion.div>
        ) : isLoadingImages ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex items-center justify-center"
          >
            <div className="flex flex-col items-center gap-4">
              <Spinner
                size="lg"
                color="primary"
                label={t('common.loadingItems')}
              />
            </div>
          </motion.div>
        ) : gridItems.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex items-center justify-center p-8"
          >
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[var(--glass-bg)] flex items-center justify-center">
                <ImageIcon size={36} className="text-[var(--color-text-muted)]" />
              </div>
              <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-2">
                {t('emptyState.folderEmpty')}
              </h3>
              <p className="text-[var(--color-text-muted)] text-sm">
                {t('emptyState.noImages')}
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            {/* Toolbar */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b border-[var(--glass-border)]"
              style={{
                boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.05)',
              }}
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
                  {gridItems.filter(i => i.isFolder).length > 0 && <span>{gridItems.filter(i => i.isFolder).length} {t('statusBar.folders')}</span>}
                  {gridItems.filter(i => i.isFolder).length > 0 && gridItems.filter(i => !i.isFolder).length > 0 && <span>•</span>}
                  {gridItems.filter(i => !i.isFolder).length > 0 && <span>{gridItems.filter(i => !i.isFolder).length} {t('statusBar.images')}</span>}
                </div>
              </div>
            </div>

            {/* Grid */}
            <div className="flex-1 min-h-0">
              <ImageGrid />
            </div>

            {/* Selected Image Tags Panel */}
            {selectedTags.length > 0 && (
              <div
                className="border-t border-[var(--glass-border)] bg-[var(--glass-bg)] overflow-hidden animate-slide-up"
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
                        {t('mainContent.selectedTags')}
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)]">({selectedTags.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedTags.map(({ name, count }) => (
                        <span
                          key={name}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs text-[var(--color-text-primary)] cursor-pointer group/tag
                                     transition-transform duration-200 ease-out hover:scale-105 hover:-translate-y-0.5 active:scale-95"
                          style={{
                            background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(6, 182, 212, 0.05) 100%)',
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
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

