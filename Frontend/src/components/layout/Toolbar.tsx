import { useMemo, useState } from 'react';
import { Combobox } from '@base-ui-components/react/combobox';
import { Menu } from '@base-ui-components/react/menu';
import { Popover } from '@base-ui-components/react/popover';
import { motion } from 'framer-motion';
import { Search, SortAsc, SortDesc, Star, X, ChevronDown, FileImage, Tag, Home, RotateCcw, RotateCw, FlipHorizontal, FlipVertical, RefreshCw } from 'lucide-react';
import { Spinner } from '@heroui/react';
import { useAppStore } from '../../stores/appStore';
import { bridge } from '../../services/bridge';
import { GlassIconButton } from '../ui/glass';
import { ThemeToggle } from '../ui/ThemeToggle';
import { SettingsMenu } from './SettingsMenu';
import { useTranslation } from 'react-i18next';

interface SearchSuggestion {
  value: string;
  label: string;
  type: 'file' | 'tag';
}

export function Toolbar() {
  const { t } = useTranslation();

  const SORT_OPTIONS = [
    { value: 'name', label: t('toolbar.sort.name') },
    { value: 'date', label: t('toolbar.sort.date') },
    { value: 'size', label: t('toolbar.sort.size') },
    { value: 'rating', label: t('toolbar.sort.rating') },
  ] as const;

  const {
    searchQuery, setSearchQuery,
    sortBy, setSortBy,
    sortOrder, toggleSortOrder,
    filterRating, setFilterRating,
    clearFilters,
    images, tags,
    setCurrentFolder, clearSelection,
    selectedImages, refreshImages
  } = useAppStore();



  const [isEditing, setIsEditing] = useState(false);
  const hasSelection = selectedImages.size > 0;

  // Image edit handlers
  const handleRotate = async (angle: number) => {
    if (!hasSelection || isEditing) return;
    setIsEditing(true);
    try {
      const paths = Array.from(selectedImages);
      await bridge.rotateImages(paths, angle);
      await refreshImages();
    } catch (error) {
      console.error('Rotate failed:', error);
    } finally {
      setIsEditing(false);
    }
  };

  const handleFlip = async (horizontal: boolean) => {
    if (!hasSelection || isEditing) return;
    setIsEditing(true);
    try {
      const paths = Array.from(selectedImages);
      await bridge.flipImages(paths, horizontal);
      await refreshImages();
    } catch (error) {
      console.error('Flip failed:', error);
    } finally {
      setIsEditing(false);
    }
  };

  // Go to home screen
  const handleGoHome = () => {
    setCurrentFolder(null);
    clearSelection();
  };

  // Generate search suggestions from filenames and tags
  const suggestions = useMemo(() => {
    const results: SearchSuggestion[] = [];
    const query = searchQuery.toLowerCase();

    if (!query || query.length < 1) return [];

    // Add matching filenames
    const seenFiles = new Set<string>();
    images.forEach(img => {
      const fileName = img.fileName.toLowerCase();
      if (fileName.includes(query) && !seenFiles.has(img.fileName)) {
        seenFiles.add(img.fileName);
        results.push({ value: img.fileName, label: img.fileName, type: 'file' });
      }
    });

    // Add matching tags
    const seenTags = new Set<string>();
    tags.forEach(tag => {
      if (tag.name.toLowerCase().includes(query) && !seenTags.has(tag.name)) {
        seenTags.add(tag.name);
        results.push({ value: tag.name, label: tag.name, type: 'tag' });
      }
    });

    // Also check tags from images
    images.forEach(img => {
      img.tags?.forEach(tagName => {
        if (tagName.toLowerCase().includes(query) && !seenTags.has(tagName)) {
          seenTags.add(tagName);
          results.push({ value: tagName, label: tagName, type: 'tag' });
        }
      });
    });

    return results.slice(0, 10); // Limit to 10 suggestions
  }, [searchQuery, images, tags]);

  const hasActiveFilters = searchQuery || filterRating !== null;

  return (
    <motion.div
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      className="glass-toolbar flex flex-nowrap items-center gap-2 px-3 py-2 overflow-x-auto"
    >
      {/* Left: Logo */}
      <div className="flex items-center gap-3">
        <img
          src="/logo.png"
          alt="TagFusion"
          className="w-8 h-8"
          style={{
            filter: 'drop-shadow(0 2px 8px rgba(6,182,212,0.4))',
          }}
        />
        <span
          className="text-lg font-bold text-cyan-400 tracking-wider"
          style={{
            fontFamily: "'Orbitron', sans-serif",
            textShadow: '0 2px 8px rgba(6,182,212,0.3)',
          }}
        >
          TagFusion
        </span>
      </div>

      {/* Divider */}
      <div className="h-6 w-px bg-[var(--glass-border)]" />

      {/* Home Button */}
      <GlassIconButton
        onClick={handleGoHome}
        title={t('toolbar.home')}
        variant="ghost"
        size="md"
      >
        <Home size={18} />
      </GlassIconButton>

      {/* Search + Sort + Rating Group */}
      <div className="flex items-center gap-2">
        {/* Search with Autocomplete - Base UI Combobox */}
        <Combobox.Root<SearchSuggestion>
          value={undefined}
          onValueChange={(value) => {
            if (value) {
              setSearchQuery(value.value);
            }
          }}
          onInputValueChange={(inputValue) => setSearchQuery(inputValue)}
        >
          <div className="w-72 relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
              <Search size={16} className="text-[var(--color-text-secondary)]" />
            </div>
            <Combobox.Input
              value={searchQuery}
              placeholder={t('toolbar.search')}
              className="w-full h-8 pl-9 pr-8 rounded-lg backdrop-blur-glass-xs bg-[var(--glass-bg)] border border-[var(--glass-border)] text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all"
            />
            {searchQuery && (
              <Combobox.Clear
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-[var(--glass-bg-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              >
                <X size={14} />
              </Combobox.Clear>
            )}
          </div>
          <Combobox.Portal>
            <Combobox.Positioner side="bottom" align="start" sideOffset={4}>
              <Combobox.Popup className="w-72 py-1 rounded-xl backdrop-blur-glass-lg bg-[var(--glass-bg)] border border-[var(--glass-border)] shadow-glass-lg z-[100] outline-none transition-all data-[ending-style]:opacity-0 data-[ending-style]:scale-95 data-[starting-style]:opacity-0 data-[starting-style]:scale-95">
                <Combobox.List>
                  {suggestions.length > 0 ? (
                    suggestions.map((suggestion) => (
                      <Combobox.Item
                        key={`${suggestion.type}-${suggestion.value}`}
                        value={suggestion}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--glass-bg-hover)] cursor-pointer outline-none data-[highlighted]:bg-[var(--glass-bg-hover)] data-[highlighted]:text-cyan-400"
                      >
                        {suggestion.type === 'file' ? (
                          <FileImage size={14} className="text-[var(--color-text-muted)]" />
                        ) : (
                          <Tag size={14} className="text-cyan-500" />
                        )}
                        <span className="truncate">{suggestion.label}</span>
<span className="ml-auto text-xs text-[var(--color-text-muted)]">
                            {suggestion.type === 'file' ? t('toolbar.file') : t('toolbar.tag')}
                          </span>
                      </Combobox.Item>
                    ))
                  ) : searchQuery.length > 0 ? (
                    <Combobox.Empty className="px-3 py-2 text-sm text-[var(--color-text-muted)]">
                      {t('toolbar.noSuggestions')}
                    </Combobox.Empty>
                  ) : null}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>

        {/* Sort Dropdown - Base UI Menu */}
        <Menu.Root>
          <Menu.Trigger className="flex items-center gap-2 px-3 py-1.5 rounded-lg backdrop-blur-glass-xs bg-[var(--glass-bg)] hover:bg-[var(--glass-bg-hover)] border border-[var(--glass-border)] text-sm text-[var(--color-text-primary)] transition-colors data-[popup-open]:bg-[var(--glass-bg-hover)]">
            {sortOrder === 'asc' ? <SortAsc size={16} /> : <SortDesc size={16} />}
            <span>{SORT_OPTIONS.find(o => o.value === sortBy)?.label}</span>
            <ChevronDown size={14} className="transition-transform data-[popup-open]:rotate-180" />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner side="bottom" align="end" sideOffset={4}>
              <Menu.Popup className="w-40 py-1 rounded-xl backdrop-blur-glass-lg bg-[var(--glass-bg)] border border-[var(--glass-border)] shadow-glass-lg z-50 outline-none transition-all data-[ending-style]:opacity-0 data-[ending-style]:scale-95 data-[starting-style]:opacity-0 data-[starting-style]:scale-95">
                {SORT_OPTIONS.map((option) => (
                  <Menu.Item
                    key={option.value}
                    onClick={() => {
                      if (sortBy === option.value) {
                        toggleSortOrder();
                      } else {
                        setSortBy(option.value);
                      }
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-[var(--glass-bg-hover)] transition-colors cursor-pointer outline-none data-[highlighted]:bg-[var(--glass-bg-hover)] ${sortBy === option.value ? 'text-cyan-400' : 'text-[var(--color-text-primary)]'
                      }`}
                  >
                    <span>{option.label}</span>
                    {sortBy === option.value && (
                      sortOrder === 'asc' ? <SortAsc size={14} /> : <SortDesc size={14} />
                    )}
                  </Menu.Item>
                ))}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>

        {/* Rating Filter - Base UI Popover */}
        <Popover.Root>
          <Popover.Trigger
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors border ${filterRating !== null
              ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
              : 'backdrop-blur-glass-xs bg-[var(--glass-bg)] hover:bg-[var(--glass-bg-hover)] border-[var(--glass-border)] text-[var(--color-text-primary)] data-[popup-open]:bg-[var(--glass-bg-hover)]'
              }`}
          >
            <Star size={16} className={filterRating !== null ? 'fill-cyan-400' : ''} />
            <span>{filterRating !== null ? `≥${filterRating}` : t('toolbar.rating')}</span>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner side="bottom" align="end" sideOffset={4}>
              <Popover.Popup className="p-3 rounded-xl backdrop-blur-glass-lg bg-[var(--glass-bg)] border border-[var(--glass-border)] shadow-glass-lg z-50 outline-none transition-all data-[ending-style]:opacity-0 data-[ending-style]:scale-95 data-[starting-style]:opacity-0 data-[starting-style]:scale-95">
                <div className="flex items-center gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      onClick={() => setFilterRating(filterRating === rating ? null : rating)}
                      className="p-1.5 hover:bg-[var(--glass-bg-hover)] rounded-lg transition-colors"
                    >
                      <Star
                        size={20}
                        className={`transition-colors ${filterRating !== null && rating <= filterRating
                          ? 'text-cyan-400 fill-cyan-400'
                          : 'text-[var(--color-text-muted)]'
                          }`}
                      />
                    </button>
                  ))}
                </div>
                {filterRating !== null && (
                  <Popover.Close className="w-full text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] py-1">
                    {t('toolbar.resetFilter')}
                  </Popover.Close>
                )}
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <GlassIconButton
            onClick={clearFilters}
            title={t('toolbar.clearFilters')}
            variant="danger"
            size="sm"
          >
            <X size={16} />
          </GlassIconButton>
        )}

        {/* Image Edit Buttons - Show when images selected */}
        {hasSelection && (
          <>
            <div className="h-6 w-px bg-[var(--glass-border)]" />
            <div className="flex items-center gap-1">
              {isEditing ? (
                <div className="px-3 py-1.5">
                  <Spinner size="sm" color="secondary" />
                </div>
              ) : (
                <>
                  <GlassIconButton
                    onClick={() => handleRotate(-90)}
                    title={t('toolbar.rotate90Left')}
                    size="sm"
                  >
                    <RotateCcw size={16} />
                  </GlassIconButton>
                  <GlassIconButton
                    onClick={() => handleRotate(90)}
                    title={t('toolbar.rotate90Right')}
                    size="sm"
                  >
                    <RotateCw size={16} />
                  </GlassIconButton>
                  <GlassIconButton
                    onClick={() => handleRotate(180)}
                    title={t('toolbar.rotate180')}
                    size="sm"
                  >
                    <RefreshCw size={16} />
                  </GlassIconButton>
                  <div className="w-px h-4 bg-[var(--glass-border)] mx-1" />
                  <GlassIconButton
                    onClick={() => handleFlip(true)}
                    title={t('toolbar.flipHorizontal')}
                    size="sm"
                  >
                    <FlipHorizontal size={16} />
                  </GlassIconButton>
                  <GlassIconButton
                    onClick={() => handleFlip(false)}
                    title={t('toolbar.flipVertical')}
                    size="sm"
                  >
                    <FlipVertical size={16} />
                  </GlassIconButton>
                </>
              )}
              <span className="text-xs text-[var(--color-text-secondary)] ml-2">{selectedImages.size} {t('toolbar.selected')}</span>
            </div>
          </>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Theme Toggle + Settings - Right Side */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <SettingsMenu />
      </div>
    </motion.div>
  );
}

