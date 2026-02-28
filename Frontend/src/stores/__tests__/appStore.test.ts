import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../appStore';

describe('appStore', () => {
  beforeEach(() => {
    // Reset store state manually if needed, though Zustand doesn't have a built-in reset
    // For testing, we can just set the state to defaults
    useAppStore.setState({
      searchQuery: '',
      filterRating: null,
      filterTags: [],
      sortBy: 'name',
      sortOrder: 'asc',
    });
  });

  it('should update search query', () => {
    useAppStore.getState().setSearchQuery('test search');
    expect(useAppStore.getState().searchQuery).toBe('test search');
  });

  it('should toggle sort order', () => {
    const initialOrder = useAppStore.getState().sortOrder;
    useAppStore.getState().toggleSortOrder();
    expect(useAppStore.getState().sortOrder).toBe(initialOrder === 'asc' ? 'desc' : 'asc');
  });

  it('should clear filters', () => {
    useAppStore.getState().setSearchQuery('some query');
    useAppStore.getState().setFilterRating(4);
    useAppStore.getState().clearFilters();

    expect(useAppStore.getState().searchQuery).toBe('');
    expect(useAppStore.getState().filterRating).toBeNull();
  });
});
