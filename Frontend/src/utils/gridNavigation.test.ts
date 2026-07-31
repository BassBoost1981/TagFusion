import { describe, it, expect } from 'vitest';
import { getNextGridIndex } from './gridNavigation';

describe('getNextGridIndex', () => {
  const total = 10;
  const cols = 4;

  it('ArrowRight moves to the next item', () => {
    expect(getNextGridIndex(0, 'ArrowRight', total, cols)).toBe(1);
  });

  it('ArrowRight stays put at the last item', () => {
    expect(getNextGridIndex(9, 'ArrowRight', total, cols)).toBe(9);
  });

  it('ArrowLeft moves to the previous item', () => {
    expect(getNextGridIndex(5, 'ArrowLeft', total, cols)).toBe(4);
  });

  it('ArrowLeft stays put at the first item', () => {
    expect(getNextGridIndex(0, 'ArrowLeft', total, cols)).toBe(0);
  });

  it('ArrowDown moves down one row (by column count)', () => {
    expect(getNextGridIndex(1, 'ArrowDown', total, cols)).toBe(5);
  });

  it('ArrowDown does not move past the last row', () => {
    // 8 + 4 = 12 >= 10 -> stay
    expect(getNextGridIndex(8, 'ArrowDown', total, cols)).toBe(8);
  });

  it('ArrowUp moves up one row', () => {
    expect(getNextGridIndex(5, 'ArrowUp', total, cols)).toBe(1);
  });

  it('ArrowUp does not move above the first row', () => {
    // 2 - 4 < 0 -> stay
    expect(getNextGridIndex(2, 'ArrowUp', total, cols)).toBe(2);
  });

  it('Home jumps to the first item', () => {
    expect(getNextGridIndex(7, 'Home', total, cols)).toBe(0);
  });

  it('End jumps to the last item', () => {
    expect(getNextGridIndex(2, 'End', total, cols)).toBe(9);
  });

  it('End enters an unselected grid at the last item', () => {
    expect(getNextGridIndex(-1, 'End', total, cols)).toBe(9);
  });

  it('selects the first item when nothing is selected yet', () => {
    expect(getNextGridIndex(-1, 'ArrowRight', total, cols)).toBe(0);
    expect(getNextGridIndex(-1, 'ArrowUp', total, cols)).toBe(0);
  });

  it('returns -1 when there are no items', () => {
    expect(getNextGridIndex(-1, 'ArrowRight', 0, cols)).toBe(-1);
  });

  it('treats a zero column count as a single column', () => {
    expect(getNextGridIndex(0, 'ArrowDown', total, 0)).toBe(1);
  });
});
