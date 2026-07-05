import { describe, it, expect } from 'vitest';
import { parseSearchTerms } from './searchTerms';

describe('parseSearchTerms', () => {
  it('splits on whitespace', () => {
    expect(parseSearchTerms('urlaub strand')).toEqual(['urlaub', 'strand']);
  });

  it('splits on commas with optional spaces', () => {
    expect(parseSearchTerms('urlaub, strand,meer')).toEqual(['urlaub', 'strand', 'meer']);
  });

  it('collapses repeated separators and trims', () => {
    expect(parseSearchTerms('  urlaub,,   strand  ')).toEqual(['urlaub', 'strand']);
  });

  it('removes duplicate terms', () => {
    expect(parseSearchTerms('strand strand')).toEqual(['strand']);
  });

  it('returns empty array for empty or whitespace-only input', () => {
    expect(parseSearchTerms('')).toEqual([]);
    expect(parseSearchTerms('   ')).toEqual([]);
  });
});
