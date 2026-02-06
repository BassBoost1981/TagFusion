import { useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { CornerLeftUp } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { ImageCard } from './ImageCard';
import { FolderCard } from './FolderCard';
import { EmptyState } from '../ui/EmptyState';
import { ImageGridSkeleton } from '../ui/Skeleton';
import { staggerContainer, staggerItem } from '../../styles/animations';

export function ImageGrid() {
  const {
    gridItems,
    currentFolder,
    navigateUp,
    images: storeImages,
    zoomLevel,
    searchQuery,
    sortBy,
    sortOrder,
    filterRating,
    filterTags,
    isLoadingImages
  } = useAppStore();

  // Calculate item size based on zoom level (100% = 200px base)
  const itemSize = useMemo(() => {
    const baseSize = 200;
    return Math.round(baseSize * (zoomLevel / 100));
  }, [zoomLevel]);

  // Check if we can navigate up (not at root)
  const canNavigateUp = useMemo(() => {
    if (!currentFolder) return false;
    const normalized = currentFolder.replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    return parts.length > 1;
  }, [currentFolder]);

  // Filter and sort items
  const filteredAndSortedItems = useMemo(() => {
    let items = [...gridItems];

    // Filter
    if (searchQuery || filterRating !== null || filterTags.length > 0) {
      const query = searchQuery ? searchQuery.toLowerCase() : '';

      items = items.filter(item => {
        if (item.isFolder) {
          if (filterRating !== null || filterTags.length > 0) return false;
          if (query) return item.name.toLowerCase().includes(query);
          return true;
        } else {
          const img = item.imageData;
          if (!img) return false;

          if (query) {
            const matchesName = (img.fileName || '').toLowerCase().includes(query);
            const matchesTags = (img.tags || []).some(tag => tag.toLowerCase().includes(query));
            if (!matchesName && !matchesTags) return false;
          }
          if (filterRating !== null && (img.rating || 0) !== filterRating) return false;
          if (filterTags.length > 0) {
            const imgTags = img.tags || [];
            if (!filterTags.every(t => imgTags.includes(t))) return false;
          }
          return true;
        }
      });
    }

    // Sort and Group
    const folders = items.filter(i => i.isFolder);
    const images = items.filter(i => !i.isFolder);

    folders.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    images.sort((aItem, bItem) => {
      const a = aItem.imageData;
      const b = bItem.imageData;
      if (!a || !b) return 0;

      let comparison = 0;
      switch (sortBy) {
        case 'name': comparison = (a.fileName || '').localeCompare(b.fileName || ''); break;
        case 'date': comparison = new Date(a.dateModified || 0).getTime() - new Date(b.dateModified || 0).getTime(); break;
        case 'size': comparison = (a.fileSize || 0) - (b.fileSize || 0); break;
        case 'rating': comparison = (a.rating || 0) - (b.rating || 0); break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return [...folders, ...images];
  }, [gridItems, searchQuery, sortBy, sortOrder, filterRating, filterTags]);

  // Get reset function for filter action
  const { setSearchQuery, setFilterRating, setFilterTags } = useAppStore();

  const handleResetFilters = useCallback(() => {
    setSearchQuery('');
    setFilterRating(null);
    setFilterTags([]);
  }, [setSearchQuery, setFilterRating, setFilterTags]);

  // Loading state
  if (isLoadingImages) {
    return (
      <div className="h-full p-4 overflow-auto">
        <div className="rounded-2xl p-4 backdrop-blur-glass-sm relative overflow-hidden bg-gradient-to-br from-cyan-500/08 to-cyan-500/02 border border-cyan-500/15">
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--glass-specular)] to-transparent z-10" />
          <ImageGridSkeleton count={12} itemSize={itemSize} />
        </div>
      </div>
    );
  }

  // Empty state (filtered but no results)
  if (filteredAndSortedItems.length === 0 && gridItems.length > 0) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <EmptyState type="no-results" onAction={handleResetFilters} />
      </div>
    );
  }

  return (
    <div className="h-full p-4 overflow-auto">
      <div
        className="rounded-2xl p-4 backdrop-blur-glass-sm relative overflow-hidden bg-gradient-to-br from-cyan-500/08 to-cyan-500/02 border border-cyan-500/15"
      >
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent z-10" />

        <motion.div
          key={currentFolder} // Re-animate only when folder changes
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid gap-5"
          style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(${itemSize}px, 1fr))`,
          }}
        >
          {/* Navigate Up Card */}
          {canNavigateUp && (
            <motion.div
              variants={staggerItem}
              whileHover={{ scale: 1.03, y: -4 }}
              whileTap={{ scale: 0.98 }}
              onDoubleClick={() => navigateUp()}
              className="relative group cursor-pointer rounded-xl overflow-hidden shadow-lg"
              style={{ height: itemSize }}
            >
              <div
                className="relative rounded-xl overflow-hidden backdrop-blur-glass-sm flex flex-col h-full bg-[var(--glass-bg)] border border-cyan-500/15"
              >
                  <div className="flex-1 flex items-center justify-center bg-[var(--glass-bg)] relative overflow-hidden group-hover:bg-[var(--glass-bg-hover)] transition-colors">
                  <div className="absolute inset-0 bg-cyan-500/5 blur-3xl rounded-full scale-50 group-hover:scale-100 transition-transform duration-500" />
                  <CornerLeftUp size={56} className="text-cyan-400 drop-shadow-lg relative z-10 group-hover:text-cyan-300 transition-colors" strokeWidth={1.5} />
                </div>
                <div className="p-3 relative bg-[var(--glass-bg)] border-t border-[var(--glass-border)]">
                  <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--glass-specular)] to-transparent" />
                  <h3 className="text-sm font-medium text-[var(--color-text-primary)] truncate">..</h3>
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-1">Übergeordneter Ordner</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Grid Items */}
          {filteredAndSortedItems.map((item) => {
            if (item.isFolder) {
              return (
                <motion.div key={item.path} variants={staggerItem}>
                  <FolderCard item={item} />
                </motion.div>
              );
            }

            const image = item.imageData;
            if (!image) return null;

            const imageTags = image.tags || [];
            const isHighlighted = filterTags.length > 0 && filterTags.some(tag => imageTags.includes(tag));
            const isDimmed = filterTags.length > 0 && !isHighlighted;

            return (
              <motion.div
                key={item.path}
                variants={staggerItem}
                style={{ opacity: isDimmed ? 0.3 : 1 }}
                className={isHighlighted ? 'ring-2 ring-cyan-400 rounded-xl' : ''}
              >
                <ImageCard image={image} allImages={storeImages} />
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
