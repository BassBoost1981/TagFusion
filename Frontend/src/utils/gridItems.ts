import type { GridItem } from '../types';

export type SortBy = 'name' | 'date' | 'size' | 'rating';
export type SortOrder = 'asc' | 'desc';

export interface GridFilterSortOptions {
  searchQuery: string;
  sortBy: SortBy;
  sortOrder: SortOrder;
  filterRating: number | null;
  filterTags: Set<string>;
  /**
   * True when items come from backend global search, which already matched the
   * query — the local text filter is skipped, but rating/tag filters and sort
   * still apply.
   * True im globalen Suchmodus: Backend hat die Query schon angewendet, daher
   * wird nur noch nach Bewertung/Tags gefiltert und sortiert.
   */
  isGlobalSearch: boolean;
}

/**
 * Filters and sorts grid items, grouping folders (name-sorted) before images.
 * Shared by normal folder browsing and global search so both honor the same
 * sort/filter controls.
 * Filtert und sortiert Grid-Elemente; Ordner (nach Name) stehen vor Bildern.
 */
export function filterAndSortGridItems(items: GridItem[], options: GridFilterSortOptions): GridItem[] {
  const { sortBy, sortOrder, filterRating, filterTags } = options;
  // The backend already applied the query in global search, so don't re-filter by text.
  const query = !options.isGlobalSearch && options.searchQuery ? options.searchQuery.toLowerCase() : '';

  let result = items;

  if (query || filterRating !== null || filterTags.size > 0) {
    result = result.filter((item) => {
      if (item.isFolder) {
        if (filterRating !== null || filterTags.size > 0) return false;
        if (query) return item.name.toLowerCase().includes(query);
        return true;
      }

      const img = item.imageData;
      if (!img) return false;

      if (query) {
        const matchesName = (img.fileName || '').toLowerCase().includes(query);
        const matchesTags = (img.tags || []).some((tag) => tag.toLowerCase().includes(query));
        if (!matchesName && !matchesTags) return false;
      }
      if (filterRating !== null && (img.rating || 0) !== filterRating) return false;
      if (filterTags.size > 0) {
        const imgTags = img.tags || [];
        if (!imgTags.some((t) => filterTags.has(t))) return false;
      }
      return true;
    });
  }

  const folders = result.filter((i) => i.isFolder);
  const images = result.filter((i) => !i.isFolder);

  const sortedFolders = [...folders].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const sortedImages = [...images].sort((aItem, bItem) => {
    const a = aItem.imageData;
    const b = bItem.imageData;
    if (!a || !b) return 0;

    let comparison = 0;
    switch (sortBy) {
      case 'name':
        comparison = (a.fileName || '').localeCompare(b.fileName || '');
        break;
      case 'date':
        comparison = new Date(a.dateModified || 0).getTime() - new Date(b.dateModified || 0).getTime();
        break;
      case 'size':
        comparison = (a.fileSize || 0) - (b.fileSize || 0);
        break;
      case 'rating':
        comparison = (a.rating || 0) - (b.rating || 0);
        break;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  return [...sortedFolders, ...sortedImages];
}
