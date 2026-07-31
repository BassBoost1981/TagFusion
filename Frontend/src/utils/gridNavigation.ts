/**
 * Computes the next selected index for keyboard navigation across a uniform grid
 * laid out left-to-right, top-to-bottom. Left/Right step by one; Up/Down step by a
 * full row (the column count); Home/End jump to the first/last item. Moves that
 * would leave the grid are clamped to stay put, and an empty selection (-1) enters
 * at the first item (or the last one for End).
 * Berechnet den nächsten Auswahlindex für die Tastatur-Navigation im Raster.
 */
export function getNextGridIndex(currentIndex: number, key: string, total: number, columns: number): number {
  if (total <= 0) return -1;
  const cols = Math.max(1, columns);

  // No current selection: navigation enters the grid at the first item (End: last).
  if (currentIndex < 0) return key === 'End' ? total - 1 : 0;

  switch (key) {
    case 'Home':
      return 0;
    case 'End':
      return total - 1;
    case 'ArrowRight':
      return currentIndex + 1 < total ? currentIndex + 1 : currentIndex;
    case 'ArrowLeft':
      return currentIndex - 1 >= 0 ? currentIndex - 1 : currentIndex;
    case 'ArrowDown':
      return currentIndex + cols < total ? currentIndex + cols : currentIndex;
    case 'ArrowUp':
      return currentIndex - cols >= 0 ? currentIndex - cols : currentIndex;
    default:
      return currentIndex;
  }
}
