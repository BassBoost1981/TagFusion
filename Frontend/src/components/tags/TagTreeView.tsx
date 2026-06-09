import { useMemo, useState, useCallback } from 'react';
import { Collapsible } from '@base-ui-components/react/collapsible';
import { FolderTree, X, ChevronDown } from 'lucide-react';
import { useTagStore } from '../../stores/tagStore';
import { useSelectedImages, useImages, useAddTagToImages, useRemoveTagFromImages } from '../../stores/appStore';

interface TagTreeViewProps {
  onTagClick?: (tag: string) => void;
  searchQuery?: string;
}

/** Max tags to render per subcategory before "Mehr anzeigen" */
const TAGS_INITIAL_LIMIT = 30;

/**
 * Sublime-style fuzzy match: returns true if every character of `query`
 * appears in `target` in the same order (not necessarily adjacent).
 * Both strings should be pre-lowercased.
 */
function fuzzySubsequence(target: string, query: string): boolean {
  let qi = 0;
  for (let ti = 0; ti < target.length && qi < query.length; ti++) {
    if (target[ti] === query[qi]) qi++;
  }
  return qi === query.length;
}

export function TagTreeView({ onTagClick, searchQuery = '' }: TagTreeViewProps) {
  const { categories } = useTagStore();
  const selectedImages = useSelectedImages();
  const images = useImages();
  const addTagToImages = useAddTagToImages();
  const removeTagFromImages = useRemoveTagFromImages();

  // Track which categories are collapsed (all expanded by default)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  // Track which subcategories show all tags (beyond TAGS_INITIAL_LIMIT)
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());

  // O(1) lookup map for images by path
  const imageMap = useMemo(() => new Map(images.map((img) => [img.path, img])), [images]);

  // Get all unique tags from selected images
  const selectedImagesTags = useMemo(() => {
    const selectedImgs = Array.from(selectedImages)
      .map((path) => imageMap.get(path))
      .filter(Boolean);
    return new Set(selectedImgs.flatMap((img) => img!.tags));
  }, [imageMap, selectedImages]);

  // Filter categories based on search query.
  // Uses fuzzy subsequence matching (Sublime-style): every char of the query must
  // appear in order in the candidate tag. Falls back to substring match for very
  // short queries (1-2 chars) where fuzzy is too permissive.
  // Fuzzy-Suche im Sublime-Stil: Buchstaben muessen in Reihenfolge vorkommen.
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;

    const query = searchQuery.toLowerCase();
    const matcher =
      query.length <= 2
        ? (tag: string) => tag.toLowerCase().includes(query)
        : (tag: string) => fuzzySubsequence(tag.toLowerCase(), query);

    return categories
      .map((cat) => ({
        ...cat,
        subcategories: cat.subcategories
          .map((sub) => ({
            ...sub,
            tags: sub.tags.filter(matcher),
          }))
          .filter((sub) => sub.tags.length > 0),
      }))
      .filter((cat) => cat.subcategories.length > 0);
  }, [categories, searchQuery]);

  const toggleCategory = useCallback((catId: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }, []);

  const toggleSubExpand = useCallback((subId: string) => {
    setExpandedSubs((prev) => {
      const next = new Set(prev);
      if (next.has(subId)) next.delete(subId);
      else next.add(subId);
      return next;
    });
  }, []);

  // Add tag to selected images
  const handleTagClick = useCallback(
    async (tag: string) => {
      if (onTagClick) {
        onTagClick(tag);
        return;
      }

      if (selectedImages.size === 0) return;
      await addTagToImages(Array.from(selectedImages), tag);
    },
    [onTagClick, selectedImages, addTagToImages]
  );

  // Remove tag from selected images
  const handleRemoveTag = useCallback(
    async (tag: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (selectedImages.size === 0) return;
      await removeTagFromImages(Array.from(selectedImages), tag);
    },
    [selectedImages, removeTagFromImages]
  );

  if (filteredCategories.length === 0) {
    return (
      <div className="text-center py-4 text-slate-500">
        <FolderTree size={20} className="mx-auto mb-2 opacity-50" />
        <p className="text-xs">{searchQuery ? 'Keine Tags gefunden' : 'Keine Tag-Bibliothek'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2" role="tree" aria-label="Tag-Bibliothek">
      {filteredCategories.map((cat) => {
        const isExpanded = !collapsedCategories.has(cat.id);
        const totalTags = cat.subcategories.reduce((acc, sub) => acc + sub.tags.length, 0);

        return (
          <Collapsible.Root key={cat.id} open={isExpanded}>
            <div role="treeitem" aria-expanded={isExpanded}>
              {/* Category Header — clickable to collapse */}
              <button
                onClick={() => toggleCategory(cat.id)}
                className="flex items-center gap-1.5 px-2 py-1 text-sm text-cyan-400 font-medium w-full text-left group cursor-pointer"
              >
                <ChevronDown
                  size={12}
                  className={`text-cyan-400/60 transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`}
                />
                <span>{cat.name}</span>
                <span className="text-xs text-slate-500 ml-auto">{totalTags}</span>
              </button>

              {/* Subcategories — collapsible */}
              <Collapsible.Panel className="overflow-hidden transition-all duration-200 data-[ending-style]:h-0 data-[ending-style]:opacity-0 data-[starting-style]:h-0 data-[starting-style]:opacity-0">
                <div className="pl-2 space-y-1" role="group">
                  {cat.subcategories.map((sub) => {
                    const showAll = expandedSubs.has(sub.id);
                    const visibleTags = showAll ? sub.tags : sub.tags.slice(0, TAGS_INITIAL_LIMIT);
                    const hasMore = sub.tags.length > TAGS_INITIAL_LIMIT;

                    return (
                      <div key={sub.id} role="treeitem" aria-expanded={true}>
                        {/* Subcategory Header */}
                        <div className="flex items-center gap-1.5 px-2 py-0.5 text-xs text-slate-400">
                          <span>{sub.name}</span>
                          <span className="text-slate-500 ml-auto">{sub.tags.length}</span>
                        </div>

                        {/* Tags */}
                        {visibleTags.length > 0 && (
                          <div
                            className="pl-3 py-1 flex flex-wrap gap-1.5"
                            role="group"
                            aria-label={`Tags in ${sub.name}`}
                          >
                            {visibleTags.map((tag) => {
                              const isApplied = selectedImages.size > 0 && selectedImagesTags.has(tag);
                              return (
                                <div
                                  key={tag}
                                  className="inline-flex items-center gap-0.5 rounded-full text-xs cursor-pointer hover:scale-105 transition-transform"
                                  style={{
                                    background: isApplied
                                      ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.4) 0%, rgba(6, 182, 212, 0.2) 100%)'
                                      : 'linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(6, 182, 212, 0.05) 100%)',
                                    border: isApplied
                                      ? '1px solid rgba(6, 182, 212, 0.6)'
                                      : '1px solid rgba(6, 182, 212, 0.25)',
                                  }}
                                >
                                  <button
                                    onClick={() => handleTagClick(tag)}
                                    aria-pressed={isApplied}
                                    aria-label={
                                      selectedImages.size > 0
                                        ? `"${tag}" zu ${selectedImages.size} Bild(ern) hinzufügen`
                                        : tag
                                    }
                                    className={`px-2 py-0.5 ${isApplied ? 'text-cyan-300' : 'text-slate-200'}`}
                                    title={
                                      selectedImages.size > 0
                                        ? `"${tag}" zu ${selectedImages.size} Bild(ern) hinzufügen`
                                        : tag
                                    }
                                  >
                                    {tag}
                                  </button>
                                  {isApplied && (
                                    <button
                                      onClick={(e) => handleRemoveTag(tag, e)}
                                      aria-label={`"${tag}" von ${selectedImages.size} Bild(ern) entfernen`}
                                      className="pr-1.5 pl-0.5 py-0.5 text-cyan-400 hover:text-red-400 transition-colors"
                                      title={`"${tag}" von ${selectedImages.size} Bild(ern) entfernen`}
                                    >
                                      <X size={12} />
                                    </button>
                                  )}
                                </div>
                              );
                            })}

                            {/* "Mehr anzeigen" button */}
                            {hasMore && !showAll && (
                              <button
                                onClick={() => toggleSubExpand(sub.id)}
                                className="px-2 py-0.5 rounded-full text-xs text-cyan-400/70 hover:text-cyan-400 border border-cyan-500/20 hover:border-cyan-500/40 transition-colors"
                              >
                                +{sub.tags.length - TAGS_INITIAL_LIMIT} mehr
                              </button>
                            )}
                            {hasMore && showAll && (
                              <button
                                onClick={() => toggleSubExpand(sub.id)}
                                className="px-2 py-0.5 rounded-full text-xs text-slate-500 hover:text-slate-400 border border-white/10 hover:border-white/20 transition-colors"
                              >
                                Weniger
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Collapsible.Panel>
            </div>
          </Collapsible.Root>
        );
      })}
    </div>
  );
}
