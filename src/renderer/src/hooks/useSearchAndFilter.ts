import { useState, useCallback, useEffect, useMemo } from 'react';
import { MediaFile, FolderItem, HierarchicalTag } from '../../../types/global';
import { FilterCriteria } from '../components/toolbar/Toolbar';

export interface SearchAndFilterState {
  searchQuery: string;
  filters: FilterCriteria;
  isSearching: boolean;
  searchResults: {
    files: MediaFile[];
    folders: FolderItem[];
    totalCount: number;
    searchTime: number;
  } | null;
  availableTags: HierarchicalTag[];
  tagHierarchy: TagHierarchyTree;
}

export interface TagHierarchyTree {
  [category: string]: {
    [subcategory: string]: string[];
  };
}

export interface UseSearchAndFilterReturn {
  state: SearchAndFilterState;
  actions: {
    setSearchQuery: (query: string) => void;
    setFilters: (filters: FilterCriteria) => void;
    clearSearch: () => void;
    clearFilters: () => void;
    clearAll: () => void;
    performSearch: (files: MediaFile[], folders: FolderItem[]) => Promise<void>;
    updateAvailableTags: (files: MediaFile[]) => Promise<void>;
  };
  computed: {
    hasActiveSearch: boolean;
    hasActiveFilters: boolean;
    activeFilterCount: number;
    isFiltered: boolean;
  };
}

const initialFilters: FilterCriteria = {
  fileTypes: [],
  tags: [],
};

export const useSearchAndFilter = (): UseSearchAndFilterReturn => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filters, setFilters] = useState<FilterCriteria>(initialFilters);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<SearchAndFilterState['searchResults']>(null);
  const [availableTags, setAvailableTags] = useState<HierarchicalTag[]>([]);
  const [tagHierarchy, setTagHierarchy] = useState<TagHierarchyTree>({});

  // Debounced search query
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Build tag hierarchy from available tags
  const buildTagHierarchy = useCallback((tags: HierarchicalTag[]): TagHierarchyTree => {
    const hierarchy: TagHierarchyTree = {};
    
    for (const tag of tags) {
      if (!hierarchy[tag.category]) {
        hierarchy[tag.category] = {};
      }
      
      const subcategory = tag.subcategory || '_root';
      if (!hierarchy[tag.category][subcategory]) {
        hierarchy[tag.category][subcategory] = [];
      }
      
      if (!hierarchy[tag.category][subcategory].includes(tag.tag)) {
        hierarchy[tag.category][subcategory].push(tag.tag);
      }
    }
    
    // Sort tags within each subcategory
    for (const category in hierarchy) {
      for (const subcategory in hierarchy[category]) {
        hierarchy[category][subcategory].sort();
      }
    }
    
    return hierarchy;
  }, []);

  // Update tag hierarchy when available tags change
  useEffect(() => {
    const hierarchy = buildTagHierarchy(availableTags);
    setTagHierarchy(hierarchy);
  }, [availableTags, buildTagHierarchy]);

  // Fuzzy matching algorithm
  const fuzzyMatch = useCallback((query: string, text: string): number => {
    if (!query || !text) return 0;
    
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();
    
    // Exact match gets highest score
    if (textLower === queryLower) return 1.0;
    
    // Contains match gets high score
    if (textLower.includes(queryLower)) {
      return 0.8 - (Math.abs(textLower.length - queryLower.length) / textLower.length) * 0.3;
    }
    
    // Starts with match gets good score
    if (textLower.startsWith(queryLower)) {
      return 0.7;
    }
    
    // Calculate Levenshtein distance for fuzzy matching
    const distance = levenshteinDistance(queryLower, textLower);
    const maxLength = Math.max(queryLower.length, textLower.length);
    
    if (maxLength === 0) return 0;
    
    const similarity = 1 - (distance / maxLength);
    
    // Only return meaningful similarities
    return similarity > 0.4 ? similarity : 0;
  }, []);

  // Levenshtein distance calculation
  const levenshteinDistance = useCallback((str1: string, str2: string): number => {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }
    
    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }, []);

  // Check if a file tag matches a required tag (including hierarchical matching)
  const isTagMatch = useCallback((requiredTag: HierarchicalTag, fileTag: HierarchicalTag): boolean => {
    // Exact match
    if (requiredTag.fullPath === fileTag.fullPath) {
      return true;
    }
    
    // Hierarchical match - if searching for "Nature", match "Nature/Landscape/Mountains"
    if (fileTag.fullPath.startsWith(requiredTag.fullPath + '/')) {
      return true;
    }
    
    // Category match
    if (requiredTag.fullPath === requiredTag.category && 
        fileTag.category === requiredTag.category) {
      return true;
    }
    
    // Subcategory match
    if (requiredTag.subcategory && 
        requiredTag.fullPath === `${requiredTag.category}/${requiredTag.subcategory}` &&
        fileTag.category === requiredTag.category &&
        fileTag.subcategory === requiredTag.subcategory) {
      return true;
    }
    
    return false;
  }, []);

  // Perform search and filtering
  const performSearch = useCallback(async (files: MediaFile[], folders: FolderItem[]) => {
    setIsSearching(true);
    const startTime = Date.now();
    
    try {
      let filteredFiles = [...files];
      let filteredFolders = [...folders];

      // Apply filename search if query is provided
      if (debouncedQuery.trim()) {
        const normalizedQuery = debouncedQuery.toLowerCase().trim();
        
        // Score and filter files
        const scoredFiles = filteredFiles.map(file => ({
          file,
          score: fuzzyMatch(normalizedQuery, file.name.toLowerCase())
        }));

        filteredFiles = scoredFiles
          .filter(item => item.score > 0.1)
          .sort((a, b) => b.score - a.score)
          .map(item => item.file);

        // Filter folders
        filteredFolders = filteredFolders.filter(folder => 
          fuzzyMatch(normalizedQuery, folder.name.toLowerCase()) > 0.3
        );
      }

      // Apply file type filter
      if (filters.fileTypes && filters.fileTypes.length > 0) {
        filteredFiles = filteredFiles.filter(file => 
          filters.fileTypes!.includes(file.type)
        );
      }

      // Apply size filter
      if (filters.sizeRange) {
        filteredFiles = filteredFiles.filter(file => 
          file.size >= (filters.sizeRange!.min || 0) &&
          file.size <= (filters.sizeRange!.max || Number.MAX_SAFE_INTEGER)
        );
      }

      // Note: Tag, rating, date, and camera filters would require IPC calls to main process
      // For now, we'll simulate the filtering on the renderer side
      // In a real implementation, these would be handled by the SearchService in the main process

      const searchTime = Date.now() - startTime;

      setSearchResults({
        files: filteredFiles,
        folders: filteredFolders,
        totalCount: filteredFiles.length + filteredFolders.length,
        searchTime
      });
    } catch (error) {
      console.error('Error performing search:', error);
      setSearchResults({
        files: [],
        folders: [],
        totalCount: 0,
        searchTime: Date.now() - startTime
      });
    } finally {
      setIsSearching(false);
    }
  }, [debouncedQuery, filters, fuzzyMatch]);

  // Update available tags from files
  const updateAvailableTags = useCallback(async (files: MediaFile[]) => {
    try {
      // In a real implementation, this would call the main process to extract tags
      // For now, we'll simulate with empty tags
      // const tags = await window.electronAPI.extractAllTags(files.map(f => f.path));
      const tags: HierarchicalTag[] = [];
      setAvailableTags(tags);
    } catch (error) {
      console.error('Error updating available tags:', error);
      setAvailableTags([]);
    }
  }, []);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults(null);
  }, []);

  // Clear filters
  const clearFilters = useCallback(() => {
    setFilters(initialFilters);
  }, []);

  // Clear all
  const clearAll = useCallback(() => {
    setSearchQuery('');
    setFilters(initialFilters);
    setSearchResults(null);
  }, []);

  // Computed values
  const computed = useMemo(() => {
    const hasActiveSearch = searchQuery.trim().length > 0;
    
    const hasActiveFilters = !!(
      (filters.fileTypes && filters.fileTypes.length > 0) ||
      (filters.tags && filters.tags.length > 0) ||
      filters.dateRange ||
      filters.rating !== undefined ||
      filters.sizeRange ||
      filters.cameraInfo
    );

    const activeFilterCount = [
      filters.fileTypes && filters.fileTypes.length > 0 && filters.fileTypes.length < 3,
      filters.tags && filters.tags.length > 0,
      filters.dateRange,
      filters.rating !== undefined,
      filters.sizeRange,
      filters.cameraInfo
    ].filter(Boolean).length;

    const isFiltered = hasActiveSearch || hasActiveFilters;

    return {
      hasActiveSearch,
      hasActiveFilters,
      activeFilterCount,
      isFiltered
    };
  }, [searchQuery, filters]);

  const state: SearchAndFilterState = {
    searchQuery,
    filters,
    isSearching,
    searchResults,
    availableTags,
    tagHierarchy
  };

  const actions = {
    setSearchQuery,
    setFilters,
    clearSearch,
    clearFilters,
    clearAll,
    performSearch,
    updateAvailableTags
  };

  return {
    state,
    actions,
    computed
  };
};