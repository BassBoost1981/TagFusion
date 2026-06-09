/**
 * Computes the next selected index for arrow-key navigation across a uniform grid
 * laid out left-to-right, top-to-bottom. Left/Right step by one; Up/Down step by a
 * full row (the column count). Moves that would leave the grid are clamped to stay
 * put, and an empty selection (-1) enters at the first item.
 * Berechnet den nächsten Auswahlindex für die Pfeiltasten-Navigation im Raster.
 */
export function getNextGridIndex(currentIndex: number, key: string, total: number, columns: number): number {
  if (total <= 0) return -1;
  const cols = Math.max(1, columns);

  // No current selection: any arrow enters the grid at the first item.
  if (currentIndex < 0) return 0;

  switch (key) {
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
