import { useEffect, useRef, useState, useCallback } from 'react';
import { Collapsible } from '@base-ui-components/react/collapsible';
import { ScrollArea } from '@base-ui-components/react/scroll-area';
import { motion } from 'framer-motion';
import { HardDrive, FolderClosed, ChevronDown, FolderOpen, Loader2, Star, Plus, X, Monitor } from 'lucide-react';
import { useSidebarState, useCurrentFolder, useLoadImages, useNavigateToFolder, useAddCurrentFolderToFavorites } from '../../stores/appStore';
import type { FolderItem } from '../../types';
import { GlassIconButton } from '../ui/glass';
import { Skeleton } from '../ui/Skeleton';
import { useTranslation } from 'react-i18next';
import { SIDEBAR_WIDTH_MIN, SIDEBAR_WIDTH_MAX } from '../../constants/ui';

export function Sidebar() {
  const { t } = useTranslation();
  const { drives, favorites, expandedPaths, folderCache, loadingPaths, sidebarWidth, isLoadingDrives, setSidebarWidth, loadDrives, toggleFolder, removeFavorite } = useSidebarState();
  const currentFolder = useCurrentFolder();
  const loadImages = useLoadImages();
  const navigateToFolder = useNavigateToFolder();
  const addCurrentFolderToFavorites = useAddCurrentFolderToFavorites();
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    loadDrives();
  }, [loadDrives]);

  // Handle resize (drag right edge)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startX;
      const newWidth = Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, startWidth + diff));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [sidebarWidth, setSidebarWidth]);

  return (
    <aside
      ref={panelRef}
      className="h-full flex flex-col glass-sidebar relative"
      style={{ width: sidebarWidth }}
      data-testid="sidebar"
    >
      {/* Resize Handle (right edge) */}
      <div
        onMouseDown={handleMouseDown}
        className={`absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize group hover:bg-cyan-500/30 transition-colors z-10 ${isResizing ? 'bg-cyan-500/40' : ''}`}
      >
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-[var(--glass-border)] group-hover:bg-cyan-500/50 transition-colors" />
      </div>
      {/* Favorites Section - Fixed at top */}
      <div className="p-2 m-2 mb-0 flex-shrink-0 glass-section">
        {/* Glass Specular Highlight */}
        <div className="absolute inset-x-0 top-0 h-[1px] glass-specular" />
        <div className="flex items-center justify-between px-2 py-1.5">
          <div className="flex items-center gap-2">
            <Star size={14} className="text-cyan-400" />
            <h3 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
              {t('sidebar.favorites')}
            </h3>
          </div>
          <GlassIconButton
            onClick={addCurrentFolderToFavorites}
            disabled={!currentFolder}
            title={t('sidebar.favorites')}
            size="xs"
            variant="ghost"
          >
            <Plus size={14} />
          </GlassIconButton>
        </div>
        <ul aria-label={t('sidebar.favorites')} className="space-y-0.5">
          {favorites.map((fav) => (
            <FavoriteItem
              key={fav.path}
              path={fav.path}
              name={fav.name}
              isActive={currentFolder === fav.path}
              onSelect={navigateToFolder}
              onRemove={removeFavorite}
            />
          ))}
          {favorites.length === 0 && (
            <li className="px-2 py-2 text-xs text-[var(--color-text-muted)] italic">
              {t('sidebar.noFavorites')}
            </li>
          )}
        </ul>
      </div>

      {/* Drives Section - Scrollable */}
      <ScrollArea.Root className="flex-1 overflow-hidden">
        <ScrollArea.Viewport className="h-full w-full p-2">
          <div className="glass-section p-2 flex-1">
            {/* Glass Specular Highlight */}
            <div className="absolute inset-x-0 top-0 h-[1px] glass-specular" />
            <div className="flex items-center gap-2 px-2 py-1.5">
              <Monitor size={14} className="text-cyan-400" />
              <h3 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                {t('sidebar.recentFolders')}
              </h3>
            </div>
            <ul role="tree" aria-label={t('sidebar.recentFolders')} className="space-y-0.5">
              {isLoadingDrives ? (
                /* Skeleton placeholders while drives load */
                <div className="space-y-1.5 px-2 py-1">
                  {[...Array(4)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.08, duration: 0.3 }}
                      className="flex items-center gap-2"
                    >
                      <Skeleton className="w-4 h-4 rounded" />
                      <Skeleton className={`h-3 rounded ${i % 2 === 0 ? 'w-3/4' : 'w-1/2'}`} />
                    </motion.div>
                  ))}
                </div>
              ) : (
                drives.map((drive) => (
                  <TreeNode
                    key={drive.path}
                    item={drive}
                    level={0}
                    currentFolder={currentFolder}
                    expandedPaths={expandedPaths}
                    folderCache={folderCache}
                    loadingPaths={loadingPaths}
                    onToggle={toggleFolder}
                    onSelect={loadImages}
                  />
                ))
              )}
            </ul>
          </div>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" className="w-2 p-0.5 flex touch-none select-none transition-colors bg-transparent hover:bg-white/5">
          <ScrollArea.Thumb className="flex-1 rounded-full bg-cyan-500/30 hover:bg-cyan-500/50 transition-colors" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </aside>
  );
}

// Favorite Item Component
interface FavoriteItemProps {
  path: string;
  name: string;
  isActive: boolean;
  onSelect: (path: string) => Promise<void>;
  onRemove: (path: string) => void;
}

function FavoriteItem({ path, name, isActive, onSelect, onRemove }: FavoriteItemProps) {
  return (
    <motion.li
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      whileHover={{ x: 4 }}
      transition={{ type: 'spring', damping: 25, stiffness: 400 }}
      className={`
        group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm
        transition-colors duration-150
        ${isActive
          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
          : 'text-[var(--color-text-primary)] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--color-text-primary)] border border-transparent'
        }
      `}
      onClick={() => onSelect(path)}
    >
      <motion.div whileHover={{ scale: 1.2, rotate: 15 }}>
        <Star size={16} className="text-cyan-400 flex-shrink-0" fill="currentColor" />
      </motion.div>
      <div className="flex-1 min-w-0">
        <div className="truncate font-medium">{name}</div>
        <div className="truncate text-xs text-[var(--color-text-muted)]">{path}</div>
      </div>
      <motion.button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(path);
        }}
        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-500/20 text-[var(--color-text-secondary)] hover:text-red-400 transition-all"
        title="Remove from favorites"
        whileHover={{ scale: 1.1, rotate: 90 }}
        whileTap={{ scale: 0.9 }}
      >
        <X size={14} />
      </motion.button>
    </motion.li>
  );
}

interface TreeNodeProps {
  item: FolderItem;
  level: number;
  currentFolder: string | null;
  expandedPaths: Set<string>;
  folderCache: Map<string, FolderItem[]>;
  loadingPaths: Set<string>;
  onToggle: (path: string) => Promise<void>;
  onSelect: (path: string) => Promise<void>;
}

function TreeNode({
  item,
  level,
  currentFolder,
  expandedPaths,
  folderCache,
  loadingPaths,
  onToggle,
  onSelect
}: TreeNodeProps) {
  const itemRef = useRef<HTMLDivElement>(null);
  const isExpanded = expandedPaths.has(item.path);
  const isLoading = loadingPaths.has(item.path);
  const isActive = currentFolder === item.path;
  const children = folderCache.get(item.path) || [];
  const isDrive = item.driveType !== undefined && item.driveType !== '';

  // Auto-scroll to active item
  useEffect(() => {
    if (isActive && itemRef.current) {
      // Wait for expansion animation to finish
      const timer = setTimeout(() => {
        itemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  const getIcon = () => {
    const iconProps = {
      size: 16,
      className: 'flex-shrink-0',
      strokeWidth: 2,
    };

    if (isDrive) {
      return (
        <motion.div
          whileHover={{ scale: 1.15, rotateY: 15 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          style={{
            transformStyle: 'preserve-3d',
            filter: 'drop-shadow(0 2px 4px rgba(6,182,212,0.4))',
          }}
        >
          <HardDrive {...iconProps} className="text-cyan-400 flex-shrink-0" />
        </motion.div>
      );
    }
    if (isExpanded) {
      return (
        <motion.div
          animate={{ rotateY: [0, 10, 0] }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          style={{
            transformStyle: 'preserve-3d',
            filter: 'drop-shadow(0 2px 4px rgba(6,182,212,0.4))',
          }}
        >
          <FolderOpen {...iconProps} className="text-cyan-400 flex-shrink-0" />
        </motion.div>
      );
    }
    if (isActive) {
      return (
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          style={{
            transformStyle: 'preserve-3d',
            filter: 'drop-shadow(0 2px 4px rgba(6,182,212,0.5))',
          }}
        >
          <FolderOpen {...iconProps} className="text-cyan-300 flex-shrink-0" />
        </motion.div>
      );
    }
    return (
      <motion.div
        whileHover={{ scale: 1.1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        <FolderClosed {...iconProps} className="text-[var(--color-text-secondary)] flex-shrink-0" />
      </motion.div>
    );
  };

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.hasSubfolders) {
      await onToggle(item.path);
    }
  };

  const handleSelect = async () => {
    await onSelect(item.path);
  };

  return (
    <Collapsible.Root open={isExpanded}>
      <li
        role="treeitem"
        aria-expanded={item.hasSubfolders ? isExpanded : undefined}
        aria-selected={isActive}
        aria-level={level + 1}
        aria-label={item.name}
      >
        <motion.div
          ref={itemRef}
          whileHover={{ x: 3 }}
          transition={{ type: 'spring', damping: 25, stiffness: 400 }}
          tabIndex={0}
          className={`
            flex items-center gap-1 py-1.5 px-2 rounded-lg cursor-pointer text-sm
            transition-colors duration-150 outline-none
            focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent
            ${isActive
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'text-[var(--color-text-primary)] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--color-text-primary)] border border-transparent'
            }
          `}
          style={{ paddingLeft: `calc(var(--sidebar-indent-base) + ${level} * var(--sidebar-indent-step))` }}
          onClick={handleSelect}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleSelect();
            } else if (e.key === 'ArrowRight' && item.hasSubfolders && !isExpanded) {
              e.preventDefault();
              onToggle(item.path);
            } else if (e.key === 'ArrowLeft' && isExpanded) {
              e.preventDefault();
              onToggle(item.path);
            }
          }}
        >
          {/* Expand/Collapse Arrow with 3D rotation */}
          <motion.button
            onClick={handleToggle}
            className="w-4 h-4 flex items-center justify-center flex-shrink-0"
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
          >
            {isLoading ? (
              <Loader2 size={12} className="text-[var(--color-text-secondary)] animate-spin" />
            ) : item.hasSubfolders ? (
              <motion.div
                animate={{ rotateZ: isExpanded ? 0 : -90 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown size={14} className="text-[var(--color-text-secondary)]" />
              </motion.div>
            ) : (
              <span className="w-3" />
            )}
          </motion.button>

          {/* Icon */}
          {getIcon()}

          {/* Name */}
          <span className="flex-1 truncate">{item.name}</span>
        </motion.div>

        {/* Children - Base UI Collapsible */}
        {children.length > 0 && (
          <Collapsible.Panel className="overflow-hidden transition-all duration-200 data-[ending-style]:h-0 data-[ending-style]:opacity-0 data-[starting-style]:h-0 data-[starting-style]:opacity-0">
            <ul role="group">
              {children.map((child) => (
                <TreeNode
                  key={child.path}
                  item={child}
                  level={level + 1}
                  currentFolder={currentFolder}
                  expandedPaths={expandedPaths}
                  folderCache={folderCache}
                  loadingPaths={loadingPaths}
                  onToggle={onToggle}
                  onSelect={onSelect}
                />
              ))}
            </ul>
          </Collapsible.Panel>
        )}
      </li>
    </Collapsible.Root>
  );
}

