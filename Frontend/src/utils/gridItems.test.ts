import { describe, it, expect } from 'vitest';
import { filterAndSortGridItems, type GridFilterSortOptions } from './gridItems';
import type { GridItem, ImageFile } from '../types';

function img(fileName: string, overrides: Partial<ImageFile> = {}): GridItem {
  const image: ImageFile = {
    path: `C:\\${fileName}`,
    fileName,
    extension: '.jpg',
    fileSize: 1000,
    dateModified: '2026-01-01T00:00:00Z',
    dateCreated: '2026-01-01T00:00:00Z',
    tags: [],
    rating: 0,
    ...overrides,
  };
  return { path: image.path, name: fileName, isFolder: false, imageData: image };
}

function folder(name: string): GridItem {
  return { path: `C:\\${name}`, name, isFolder: true };
}

const baseOptions: GridFilterSortOptions = {
  searchQuery: '',
  sortBy: 'name',
  sortOrder: 'asc',
  filterRating: null,
  filterTags: new Set<string>(),
  isGlobalSearch: false,
};

describe('filterAndSortGridItems', () => {
  // Task #7 regression: global search used to bypass sort/filter entirely.
  it('sorts global search results by name (previously returned unsorted)', () => {
    const items = [img('zebra.jpg'), img('apple.jpg'), img('mango.jpg')];
    const result = filterAndSortGridItems(items, { ...baseOptions, isGlobalSearch: true });
    expect(result.map((i) => i.name)).toEqual(['apple.jpg', 'mango.jpg', 'zebra.jpg']);
  });

  it('applies the rating filter to global search results', () => {
    const items = [img('a.jpg', { rating: 5 }), img('b.jpg', { rating: 3 })];
    const result = filterAndSortGridItems(items, { ...baseOptions, isGlobalSearch: true, filterRating: 5 });
    expect(result.map((i) => i.name)).toEqual(['a.jpg']);
  });

  it('applies the tag filter to global search results', () => {
    const items = [img('a.jpg', { tags: ['sunset'] }), img('b.jpg', { tags: ['forest'] })];
    const result = filterAndSortGridItems(items, {
      ...baseOptions,
      isGlobalSearch: true,
      filterTags: new Set(['sunset']),
    });
    expect(result.map((i) => i.name)).toEqual(['a.jpg']);
  });

  it('does not re-apply the text query to global search results (backend already matched)', () => {
    // Backend matched on a tag, so the fileName need not contain the query.
    const items = [img('IMG_001.jpg', { tags: ['vacation'] })];
    const result = filterAndSortGridItems(items, { ...baseOptions, isGlobalSearch: true, searchQuery: 'vacation' });
    expect(result.map((i) => i.name)).toEqual(['IMG_001.jpg']);
  });

  it('filters by name or tag in normal (folder) mode', () => {
    const items = [img('beach.jpg'), img('mountain.jpg', { tags: ['beach'] }), img('city.jpg')];
    const result = filterAndSortGridItems(items, { ...baseOptions, searchQuery: 'beach' });
    expect(result.map((i) => i.name).sort()).toEqual(['beach.jpg', 'mountain.jpg']);
  });

  it('sorts images by size descending', () => {
    const items = [img('a.jpg', { fileSize: 100 }), img('b.jpg', { fileSize: 300 }), img('c.jpg', { fileSize: 200 })];
    const result = filterAndSortGridItems(items, { ...baseOptions, sortBy: 'size', sortOrder: 'desc' });
    expect(result.map((i) => i.name)).toEqual(['b.jpg', 'c.jpg', 'a.jpg']);
  });

  it('groups folders before images, each sorted by name', () => {
    const items = [img('photo.jpg'), folder('zeta'), folder('alpha')];
    const result = filterAndSortGridItems(items, { ...baseOptions });
    expect(result.map((i) => i.name)).toEqual(['alpha', 'zeta', 'photo.jpg']);
  });
});
