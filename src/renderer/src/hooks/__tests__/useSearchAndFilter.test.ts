import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSearchAndFilter } from '../useSearchAndFilter';
import { MediaFile, FolderItem, HierarchicalTag } from '../../../../types/global';

// Test data
const testFiles: MediaFile[] = [
  {
    path: 'C:\\Photos\\vacation.jpg',
    name: 'vacation.jpg',
    extension: '.jpg',
    size: 1024000,
    dateModified: new Date('2024-01-15'),
    type: 'image'
  },
  {
    path: 'C:\\Photos\\mountain_sunset.png',
    name: 'mountain_sunset.png',
    extension: '.png',
    size: 2048000,
    dateModified: new Date('2024-01-20'),
    type: 'image'
  },
  {
    path: 'C:\\Videos\\family_trip.mp4',
    name: 'family_trip.mp4',
    extension: '.mp4',
    size: 50000000,
    dateModified: new Date('2024-01-25'),
    type: 'video'
  }
];

const testFolders: FolderItem[] = [
  {
    name: 'Vacation Photos',
    path: 'C:\\Photos\\Vacation Photos',
    hasSubfolders: true,
    mediaCount: 25
  },
  {
    name: 'Nature',
    path: 'C:\\Photos\\Nature',
    hasSubfolders: false,
    mediaCount: 10
  }
];

const testTags: HierarchicalTag[] = [
  {
    category: 'Nature',
    subcategory: 'Landscape',
    tag: 'Mountains',
    fullPath: 'Nature/Landscape/Mountains'
  },
  {
    category: 'Nature',
    subcategory: 'Landscape',
    tag: 'Sunset',
    fullPath: 'Nature/Landscape/Sunset'
  },
  {
    category: 'Travel',
    subcategory: 'Vacation',
    tag: 'Beach',
    fullPath: 'Travel/Vacation/Beach'
  }
];

describe('useSearchAndFilter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useSearchAndFilter());

    expect(result.current.state.searchQuery).toBe('');
    expect(result.current.state.filters.fileTypes).toEqual([]);
    expect(result.current.state.filters.tags).toEqual([]);
    expect(result.current.state.isSearching).toBe(false);
    expect(result.current.state.searchResults).toBeNull();
    expect(result.current.state.availableTags).toEqual([]);
    expect(result.current.state.tagHierarchy).toEqual({});
  });

  it('should update search query', () => {
    const { result } = renderHook(() => useSearchAndFilter());

    act(() => {
      result.current.actions.setSearchQuery('vacation');
    });

    expect(result.current.state.searchQuery).toBe('vacation');
    expect(result.current.computed.hasActiveSearch).toBe(true);
  });

  it('should update filters', () => {
    const { result } = renderHook(() => useSearchAndFilter());

    const newFilters = {
      fileTypes: ['image' as const],
      tags: [testTags[0]],
      rating: 4
    };

    act(() => {
      result.current.actions.setFilters(newFilters);
    });

    expect(result.current.state.filters.fileTypes).toEqual(['image']);
    expect(result.current.state.filters.tags).toEqual([testTags[0]]);
    expect(result.current.state.filters.rating).toBe(4);
    expect(result.current.computed.hasActiveFilters).toBe(true);
  });

  it('should calculate active filter count correctly', () => {
    const { result } = renderHook(() => useSearchAndFilter());

    act(() => {
      result.current.actions.setFilters({
        fileTypes: ['image'],
        tags: [testTags[0]],
        rating: 4,
        dateRange: { from: new Date(), to: new Date() }
      });
    });

    expect(result.current.computed.activeFilterCount).toBe(4);
  });

  it('should clear search', () => {
    const { result } = renderHook(() => useSearchAndFilter());

    act(() => {
      result.current.actions.setSearchQuery('vacation');
    });

    expect(result.current.state.searchQuery).toBe('vacation');

    act(() => {
      result.current.actions.clearSearch();
    });

    expect(result.current.state.searchQuery).toBe('');
    expect(result.current.state.searchResults).toBeNull();
  });

  it('should clear filters', () => {
    const { result } = renderHook(() => useSearchAndFilter());

    act(() => {
      result.current.actions.setFilters({
        fileTypes: ['image'],
        tags: [testTags[0]],
        rating: 4
      });
    });

    expect(result.current.computed.hasActiveFilters).toBe(true);

    act(() => {
      result.current.actions.clearFilters();
    });

    expect(result.current.state.filters.fileTypes).toEqual([]);
    expect(result.current.state.filters.tags).toEqual([]);
    expect(result.current.state.filters.rating).toBeUndefined();
    expect(result.current.computed.hasActiveFilters).toBe(false);
  });

  it('should clear all search and filters', () => {
    const { result } = renderHook(() => useSearchAndFilter());

    act(() => {
      result.current.actions.setSearchQuery('vacation');
      result.current.actions.setFilters({
        fileTypes: ['image'],
        tags: [testTags[0]]
      });
    });

    expect(result.current.computed.hasActiveSearch).toBe(true);
    expect(result.current.computed.hasActiveFilters).toBe(true);

    act(() => {
      result.current.actions.clearAll();
    });

    expect(result.current.state.searchQuery).toBe('');
    expect(result.current.state.filters.fileTypes).toEqual([]);
    expect(result.current.state.filters.tags).toEqual([]);
    expect(result.current.computed.hasActiveSearch).toBe(false);
    expect(result.current.computed.hasActiveFilters).toBe(false);
  });

  it('should perform filename search', async () => {
    const { result } = renderHook(() => useSearchAndFilter());

    act(() => {
      result.current.actions.setSearchQuery('vacation');
    });

    // Wait for debounce
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 350));
    });

    await act(async () => {
      await result.current.actions.performSearch(testFiles, testFolders);
    });

    expect(result.current.state.searchResults).not.toBeNull();
    expect(result.current.state.searchResults!.files).toHaveLength(1);
    expect(result.current.state.searchResults!.files[0].name).toBe('vacation.jpg');
    expect(result.current.state.searchResults!.folders).toHaveLength(1);
    expect(result.current.state.searchResults!.folders[0].name).toBe('Vacation Photos');
  });

  it('should filter by file type', async () => {
    const { result } = renderHook(() => useSearchAndFilter());

    act(() => {
      result.current.actions.setFilters({
        fileTypes: ['video'],
        tags: []
      });
    });

    await act(async () => {
      await result.current.actions.performSearch(testFiles, testFolders);
    });

    expect(result.current.state.searchResults!.files).toHaveLength(1);
    expect(result.current.state.searchResults!.files[0].type).toBe('video');
  });

  it('should filter by size range', async () => {
    const { result } = renderHook(() => useSearchAndFilter());

    act(() => {
      result.current.actions.setFilters({
        fileTypes: [],
        tags: [],
        sizeRange: { min: 1000000, max: 10000000 }
      });
    });

    await act(async () => {
      await result.current.actions.performSearch(testFiles, testFolders);
    });

    expect(result.current.state.searchResults!.files).toHaveLength(2);
    expect(result.current.state.searchResults!.files.every(file => 
      file.size >= 1000000 && file.size <= 10000000
    )).toBe(true);
  });

  it('should combine search and filters', async () => {
    const { result } = renderHook(() => useSearchAndFilter());

    act(() => {
      result.current.actions.setSearchQuery('mountain');
      result.current.actions.setFilters({
        fileTypes: ['image'],
        tags: []
      });
    });

    // Wait for debounce
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 350));
    });

    await act(async () => {
      await result.current.actions.performSearch(testFiles, testFolders);
    });

    expect(result.current.state.searchResults!.files).toHaveLength(1);
    expect(result.current.state.searchResults!.files[0].name).toBe('mountain_sunset.png');
    expect(result.current.state.searchResults!.files[0].type).toBe('image');
  });

  it('should build tag hierarchy correctly', async () => {
    const { result } = renderHook(() => useSearchAndFilter());

    // Simulate updating available tags
    act(() => {
      // Directly set available tags for testing
      result.current.state.availableTags = testTags;
    });

    // Wait for effect to run
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const hierarchy = result.current.state.tagHierarchy;
    
    expect(hierarchy['Nature']).toBeDefined();
    expect(hierarchy['Nature']['Landscape']).toBeDefined();
    expect(hierarchy['Nature']['Landscape']).toContain('Mountains');
    expect(hierarchy['Nature']['Landscape']).toContain('Sunset');
    
    expect(hierarchy['Travel']).toBeDefined();
    expect(hierarchy['Travel']['Vacation']).toBeDefined();
    expect(hierarchy['Travel']['Vacation']).toContain('Beach');
  });

  it('should handle search errors gracefully', async () => {
    const { result } = renderHook(() => useSearchAndFilter());

    // Mock console.error to avoid test output
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    act(() => {
      result.current.actions.setSearchQuery('test');
    });

    // Wait for debounce
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 350));
    });

    // Simulate error by passing invalid data
    await act(async () => {
      await result.current.actions.performSearch(null as any, null as any);
    });

    expect(result.current.state.searchResults).not.toBeNull();
    expect(result.current.state.searchResults!.files).toHaveLength(0);
    expect(result.current.state.searchResults!.folders).toHaveLength(0);
    expect(result.current.state.searchResults!.totalCount).toBe(0);

    consoleSpy.mockRestore();
  });

  it('should debounce search query updates', async () => {
    const { result } = renderHook(() => useSearchAndFilter());

    act(() => {
      result.current.actions.setSearchQuery('v');
    });

    act(() => {
      result.current.actions.setSearchQuery('va');
    });

    act(() => {
      result.current.actions.setSearchQuery('vac');
    });

    act(() => {
      result.current.actions.setSearchQuery('vacation');
    });

    // Immediately after setting, search should not have been performed yet
    expect(result.current.state.searchResults).toBeNull();

    // Wait for debounce
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 350));
    });

    // Now perform search to see if debounced query is used
    await act(async () => {
      await result.current.actions.performSearch(testFiles, testFolders);
    });

    expect(result.current.state.searchResults!.files).toHaveLength(1);
    expect(result.current.state.searchResults!.files[0].name).toBe('vacation.jpg');
  });

  it('should indicate when search is in progress', async () => {
    const { result } = renderHook(() => useSearchAndFilter());

    expect(result.current.state.isSearching).toBe(false);

    const searchPromise = act(async () => {
      await result.current.actions.performSearch(testFiles, testFolders);
    });

    // During search, isSearching should be true
    expect(result.current.state.isSearching).toBe(true);

    await searchPromise;

    // After search, isSearching should be false
    expect(result.current.state.isSearching).toBe(false);
  });

  it('should calculate computed values correctly', () => {
    const { result } = renderHook(() => useSearchAndFilter());

    // Initially no active search or filters
    expect(result.current.computed.hasActiveSearch).toBe(false);
    expect(result.current.computed.hasActiveFilters).toBe(false);
    expect(result.current.computed.activeFilterCount).toBe(0);
    expect(result.current.computed.isFiltered).toBe(false);

    act(() => {
      result.current.actions.setSearchQuery('test');
    });

    expect(result.current.computed.hasActiveSearch).toBe(true);
    expect(result.current.computed.isFiltered).toBe(true);

    act(() => {
      result.current.actions.setFilters({
        fileTypes: ['image'],
        tags: [testTags[0]],
        rating: 4
      });
    });

    expect(result.current.computed.hasActiveFilters).toBe(true);
    expect(result.current.computed.activeFilterCount).toBe(3);
    expect(result.current.computed.isFiltered).toBe(true);
  });
});