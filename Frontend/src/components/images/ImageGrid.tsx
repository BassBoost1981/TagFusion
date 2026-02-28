import { useMemo, useCallback, useState, useEffect, useRef, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { CornerLeftUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { VirtuosoGrid } from 'react-virtuoso';
import {
  useGridItems,
  useCurrentFolder,
  useNavigateUp,
  useImages,
  useZoomLevel,
  useIsLoadingImages,
  useFilterSort,
  useSelectedImages,
} from '../../stores/appStore';
import { ImageCard } from './ImageCard';
import { FolderCard } from './FolderCard';
import { EmptyState } from '../ui/EmptyState';
import { ImageGridSkeleton } from '../ui/Skeleton';
import type { GridItem } from '../../types';

// ============================================================
// Grid components — MUST be defined outside the component
// to prevent VirtuosoGrid from remounting on every render.
// ============================================================
const GAP = 10; // px gap between items
const HALF_GAP = GAP / 2;

const GridList = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ style, children, ...props }, ref) => (
    <div
      ref={ref}
      {...props}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        margin: `-${HALF_GAP}px`, // negative margin to offset item padding at edges
        ...style,
      }}
    >
      {children}
    </div>
  )
);
GridList.displayName = 'GridList';

// Item wrapper — width is set via CSS custom property --col-width (percentage)
// Padding creates the gap between items (NOT gap on the list)
function GridItemWrapper({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      style={{
        width: 'var(--col-width)',
        padding: `${HALF_GAP}px`,
        display: 'flex',
        flex: 'none',
        alignContent: 'stretch',
        boxSizing: 'border-box',
      }}
    >
      {children}
    </div>
  );
}

// Placeholder shown during fast scrolling
function GridPlaceholder({ height, width }: { height: number; width: number; index: number }) {
  return (
    <div
      style={{
        width,
        height,
        padding: `${HALF_GAP}px`,
        display: 'flex',
        flex: 'none',
        alignContent: 'stretch',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="w-full rounded-xl overflow-hidden"
        style={{
          flex: 1,
          aspectRatio: '1/1',
          background: 'var(--glass-bg)',
          border: '1px solid rgba(6, 182, 212, 0.15)',
        }}
      >
        <div className="w-full h-full animate-pulse bg-cyan-500/5" />
      </div>
    </div>
  );
}

// Stable component references for VirtuosoGrid
const gridComponents = {
  List: GridList,
  Item: GridItemWrapper,
  ScrollSeekPlaceholder: GridPlaceholder,
};

// ============================================================
// Unified item type for the virtualized list
// ============================================================
type VirtualItem =
  | { type: 'navigate-up' }
  | { type: 'folder'; item: GridItem }
  | { type: 'image'; item: GridItem; isHighlighted: boolean; isDimmed: boolean };

export function ImageGrid() {
  // Individual selectors — only re-render when specific state changes
  const { t } = useTranslation();
  const gridItems = useGridItems();
  const currentFolder = useCurrentFolder();
  const navigateUp = useNavigateUp();
  const storeImages = useImages();
  const zoomLevel = useZoomLevel();
  const isLoadingImages = useIsLoadingImages();
  const selectedImages = useSelectedImages();
  const {
    searchQuery, sortBy, sortOrder, filterRating, filterTags,
    setSearchQuery, setFilterRating, setFilterTags
  } = useFilterSort();

  // Container ref for measuring width
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Measure container width with ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(([entry]) => {
      // contentBoxSize gives us the inner width (minus padding)
      const w = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
      setContainerWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Calculate item size based on zoom level (100% = 200px base)
  const itemSize = useMemo(() => {
    const baseSize = 200;
    return Math.round(baseSize * (zoomLevel / 100));
  }, [zoomLevel]);

  // Calculate column count and percentage-based column width
  // Using percentage ensures the full container width is always used (no rounding loss)
  const { colWidthPercent } = useMemo(() => {
    if (containerWidth === 0) return { colWidthPercent: '100%' };
    // How many columns fit? Each column takes itemSize + GAP (content + padding)
    const cols = Math.max(1, Math.floor(containerWidth / (itemSize + GAP)));
    // Percentage-based: exact distribution, no pixel rounding loss
    return { colWidthPercent: `${100 / cols}%` };
  }, [containerWidth, itemSize]);

  // Check if we can navigate up (not at root)
  const canNavigateUp = useMemo(() => {
    if (!currentFolder) return false;
    const normalized = currentFolder.replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    return parts.length > 1;
  }, [currentFolder]);

  // Pre-compute filterTags as Set for O(1) lookups instead of O(n) .includes()
  const filterTagsSet = useMemo(() => new Set(filterTags), [filterTags]);

  // Filter and sort items
  const filteredAndSortedItems = useMemo(() => {
    let items = [...gridItems];

    // Filter
    if (searchQuery || filterRating !== null || filterTagsSet.size > 0) {
      const query = searchQuery ? searchQuery.toLowerCase() : '';

      items = items.filter(item => {
        if (item.isFolder) {
          if (filterRating !== null || filterTagsSet.size > 0) return false;
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
          if (filterTagsSet.size > 0) {
            const imgTags = img.tags || [];
            if (!imgTags.some(t => filterTagsSet.has(t))) return false;
          }
          return true;
        }
      });
    }

    // Sort and Group
    const folders = items.filter(i => i.isFolder);
    const images = items.filter(i => !i.isFolder);

    const sortedFolders = [...folders].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const sortedImages = [...images].sort((aItem, bItem) => {
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

    return [...sortedFolders, ...sortedImages];
  }, [gridItems, searchQuery, sortBy, sortOrder, filterRating, filterTagsSet]);

  // Build unified virtual items array (navigate-up + folders + images)
  const virtualItems = useMemo<VirtualItem[]>(() => {
    const result: VirtualItem[] = [];

    if (canNavigateUp) {
      result.push({ type: 'navigate-up' });
    }

    for (const item of filteredAndSortedItems) {
      if (item.isFolder) {
        result.push({ type: 'folder', item });
      } else {
        const image = item.imageData;
        if (!image) continue;
        const imageTags = image.tags || [];
        const isHighlighted = filterTagsSet.size > 0 && imageTags.some(tag => filterTagsSet.has(tag));
        const isDimmed = filterTagsSet.size > 0 && !isHighlighted;
        result.push({ type: 'image', item, isHighlighted, isDimmed });
      }
    }

    return result;
  }, [canNavigateUp, filteredAndSortedItems, filterTagsSet]);

  // Reset functions are already available from useFilterSort() above

  const handleResetFilters = useCallback(() => {
    setSearchQuery('');
    setFilterRating(null);
    setFilterTags([]);
  }, [setSearchQuery, setFilterRating, setFilterTags]);

  // Render a single virtual item — ALL items wrapped in a uniform-size container
  // VirtuosoGrid requires all items to be the same size.
  const renderItem = useCallback((index: number) => {
    const vItem = virtualItems[index];
    if (!vItem) return null;

    // Uniform wrapper: flex: 1 fills the Item padding box, aspect-ratio ensures same height
    const uniformStyle: React.CSSProperties = {
      display: 'flex',
      flex: 1,
      aspectRatio: '1/1',
      overflow: 'hidden',
      borderRadius: '0.75rem', // rounded-xl
    };

    switch (vItem.type) {
      case 'navigate-up':
        return (
          <motion.div
            whileHover={{ scale: 1.03, y: -4 }}
            whileTap={{ scale: 0.98 }}
            onDoubleClick={() => navigateUp()}
            className="relative group cursor-pointer shadow-lg"
            style={uniformStyle}
          >
            <div className="relative flex flex-col w-full h-full backdrop-blur-glass-sm bg-[var(--glass-bg)] border border-cyan-500/15 rounded-xl overflow-hidden">
              <div className="flex-1 flex items-center justify-center bg-[var(--glass-bg)] relative overflow-hidden group-hover:bg-[var(--glass-bg-hover)] transition-colors">
                <div className="absolute inset-0 bg-cyan-500/5 blur-3xl rounded-full scale-50 group-hover:scale-100 transition-transform duration-500" />
                <CornerLeftUp size={56} className="text-cyan-400 drop-shadow-lg relative z-10 group-hover:text-cyan-300 transition-colors" strokeWidth={1.5} />
              </div>
              <div className="p-3 relative bg-[var(--glass-bg)] border-t border-[var(--glass-border)]">
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--glass-specular)] to-transparent" />
                <h3 className="text-sm font-medium text-[var(--color-text-primary)] truncate">..</h3>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{t('common.parentFolder')}</p>
              </div>
            </div>
          </motion.div>
        );

      case 'folder':
        return (
          <div style={uniformStyle}>
            <FolderCard item={vItem.item} />
          </div>
        );

      case 'image': {
        const image = vItem.item.imageData!;
        return (
          <div
            style={{ ...uniformStyle, opacity: vItem.isDimmed ? 0.3 : 1 }}
            className={vItem.isHighlighted ? 'ring-2 ring-cyan-400 rounded-xl' : ''}
          >
            <ImageCard image={image} allImages={storeImages} isSelected={selectedImages.has(image.path)} />
          </div>
        );
      }
    }
  }, [virtualItems, navigateUp, storeImages, selectedImages]);

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
    <div className="h-full p-4" ref={containerRef}>
      <div
        className="rounded-2xl p-4 backdrop-blur-glass-sm relative overflow-hidden bg-gradient-to-br from-cyan-500/08 to-cyan-500/02 border border-cyan-500/15 h-full flex flex-col"
        style={{ '--col-width': colWidthPercent } as React.CSSProperties}
      >
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent z-10 pointer-events-none" />

        {containerWidth > 0 && (
          <VirtuosoGrid
            key={currentFolder}
            style={{ flex: 1, minHeight: 0, overflowX: 'hidden' }}
            totalCount={virtualItems.length}
            overscan={600}
            components={gridComponents}
            itemContent={renderItem}
            scrollSeekConfiguration={{
              enter: (velocity) => Math.abs(velocity) > 800,
              exit: (velocity) => Math.abs(velocity) < 100,
            }}
          />
        )}
      </div>
    </div>
  );
}
