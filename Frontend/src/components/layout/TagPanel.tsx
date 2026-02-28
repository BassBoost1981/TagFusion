import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { ScrollArea } from '@base-ui-components/react/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';
import { Tag, FolderOpen, Settings2, FolderTree, GripVertical, ChevronDown, Search } from 'lucide-react';
import { useTagPanelState } from '../../stores/appStore';
import { useTagStore } from '../../stores/tagStore';
import { AnimatedCounter, GlassTag, GlassIconButton, GlassInput } from '../ui';
import { TagTreeView } from '../tags';
import { useTranslation } from 'react-i18next';
import { TAG_PANEL_WIDTH_MIN, TAG_PANEL_WIDTH_MAX } from '../../constants/ui';

export function TagPanel() {
  const { t } = useTranslation();
  const { images, tagPanelWidth, setTagPanelWidth, filterTags, setFilterTags } = useTagPanelState();
  const { openModal, categories } = useTagStore();
  const [isResizing, setIsResizing] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const panelRef = useRef<HTMLElement>(null);

  // Collapsible state with localStorage persistence
  const [isFolderTagsCollapsed, setIsFolderTagsCollapsed] = useState(() => {
    return localStorage.getItem('tagfusion-folder-tags-collapsed') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('tagfusion-folder-tags-collapsed', String(isFolderTagsCollapsed));
  }, [isFolderTagsCollapsed]);

  // Handle resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = tagPanelWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = startX - e.clientX;
      const newWidth = Math.min(TAG_PANEL_WIDTH_MAX, Math.max(TAG_PANEL_WIDTH_MIN, startWidth + diff));
      setTagPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [tagPanelWidth, setTagPanelWidth]);

  // Get all tags from folder
  const folderTags = useMemo(() => {
    const tagCounts = new Map<string, number>();
    images.forEach(img => {
      img.tags?.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });
    return Array.from(tagCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [images]);

  return (
    <aside
      ref={panelRef}
      className="h-full flex flex-col glass-tagpanel relative"
      style={{ width: tagPanelWidth }}
      data-testid="tag-panel"
    >
      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className={`absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize group hover:bg-cyan-500/30 transition-colors z-10 ${isResizing ? 'bg-cyan-500/50' : ''}`}
      >
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical size={12} className="text-cyan-400" />
        </div>
      </div>

      {/* Content with Base UI ScrollArea */}
      <ScrollArea.Root className="flex-1 overflow-hidden">
        <ScrollArea.Viewport className="h-full w-full p-4 space-y-4">
          {/* Always show folder tags */}
          <div className="glass-section p-3">
            {/* Glass Specular Highlight */}
            <div className="absolute inset-x-0 top-0 h-[1px] glass-specular" />
            {/* Clickable Header */}
            <button
              onClick={() => setIsFolderTagsCollapsed(prev => !prev)}
              className={`flex items-center gap-2 w-full text-left cursor-pointer group ${!isFolderTagsCollapsed ? 'mb-3' : ''}`}
            >
              <FolderOpen size={14} className="text-cyan-400" />
              <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                {t('tagPanel.folderTags')}
              </h4>
              <span className="text-xs text-[var(--color-text-muted)]">
                (<AnimatedCounter value={folderTags.length} className="text-cyan-400" />)
              </span>
              <ChevronDown
                size={14}
                className={`text-cyan-400 ml-auto transition-transform duration-200 ${isFolderTagsCollapsed ? '-rotate-90' : ''}`}
              />
            </button>
            {/* Animated Content */}
            <AnimatePresence initial={false}>
              {!isFolderTagsCollapsed && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  {folderTags.length === 0 ? (
                    <div className="text-center py-6 text-[var(--color-text-muted)]">
                      <Tag size={24} className="mx-auto mb-2 opacity-50" />
                      <p className="text-sm">{t('tagPanel.noTags')}</p>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {folderTags.map(({ name, count }, index) => {
                        const isActive = filterTags.includes(name);
                        return (
                          <GlassTag
                            key={name}
                            active={isActive}
                            count={count}
                            variant="cyan"
                            delay={index}
                            onClick={() => {
                              if (isActive) {
                                setFilterTags(filterTags.filter(t => t !== name));
                              } else {
                                setFilterTags([...filterTags, name]);
                              }
                            }}
                            removable={false}
                          >
                            {name}
                          </GlassTag>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Tag Library Tree */}
          <div className="glass-section p-3">
            {/* Glass Specular Highlight */}
            <div className="absolute inset-x-0 top-0 h-[1px] glass-specular" />
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FolderTree size={14} className="text-cyan-400" />
                <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                  {t('tagPanel.title')}
                </h4>
              </div>
              <GlassIconButton
                onClick={openModal}
                title={t('common.edit')}
                size="xs"
                variant="ghost"
              >
                <Settings2 size={14} />
              </GlassIconButton>
            </div>
            {/* Search Bar */}
            <GlassInput
              leftIcon={<Search size={14} />}
              value={tagSearchQuery}
              onChange={(e) => setTagSearchQuery(e.target.value)}
              placeholder={t('tagPanel.addTag')}
              className="mb-3"
            />
            {categories.length > 0 ? (
              <TagTreeView searchQuery={tagSearchQuery} />
            ) : (
              <p className="text-xs text-[var(--color-text-muted)] text-center py-2">
                {t('tagPanel.selectImage')}
              </p>
            )}
          </div>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" className="w-2 p-0.5 flex touch-none select-none transition-colors bg-transparent hover:bg-white/5">
          <ScrollArea.Thumb className="flex-1 rounded-full bg-cyan-500/30 hover:bg-cyan-500/50 transition-colors" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </aside>
  );
}
