import { render, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGridKeyboardNavigation, type GridNavItem } from './useGridKeyboardNavigation';
import { useAppStore } from '../stores/appStore';
import { useLightboxStore } from '../stores/lightboxStore';
import { useModalStore } from '../stores/modalStore';
import { useTagStore } from '../stores/tagStore';
import { bridge } from '../services/bridge';
import type { ImageFile } from '../types';

vi.mock('../services/bridge', () => ({
  bridge: {
    setRating: vi.fn().mockResolvedValue(true),
    writeTags: vi.fn().mockResolvedValue(true),
    getFolderContents: vi.fn().mockResolvedValue([]),
  },
}));

const mockedBridge = vi.mocked(bridge);

const makeImage = (path: string, rating = 0): ImageFile => ({
  path,
  fileName: path.split('\\').pop()!,
  extension: '.jpg',
  fileSize: 1024,
  dateModified: '2025-01-01',
  dateCreated: '2025-01-01',
  tags: [],
  rating,
});

const images = ['C:\\p0.jpg', 'C:\\p1.jpg', 'C:\\p2.jpg', 'C:\\p3.jpg', 'C:\\p4.jpg', 'C:\\p5.jpg'].map((p) =>
  makeImage(p)
);

// Six images, 3 columns -> two rows / Sechs Bilder, 3 Spalten -> zwei Zeilen
const IMAGE_ITEMS: GridNavItem[] = images.map((image) => ({ kind: 'image', image }));

const scrollToIndex = vi.fn();

function TestGrid({ items, columnCount = 3 }: { items: GridNavItem[]; columnCount?: number }) {
  const focusedIndex = useGridKeyboardNavigation({ items, columnCount, onScrollToIndex: scrollToIndex });
  return <div data-testid="focused">{focusedIndex}</div>;
}

const selectedPaths = () => Array.from(useAppStore.getState().selectedImages).sort();

const ratingOf = (path: string) => useAppStore.getState().images.find((img) => img.path === path)?.rating;

const press = (key: string, init: Partial<KeyboardEventInit> = {}, target: HTMLElement = document.body) =>
  fireEvent.keyDown(target, { key, ...init });

describe('useGridKeyboardNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      currentFolder: 'C:\\photos',
      images: images.map((img) => ({ ...img })),
      gridItems: [],
      selectedImages: new Set<string>(),
      lastSelectedImage: null,
    });
    useLightboxStore.setState({ isOpen: false, open: vi.fn() });
    useModalStore.setState({ type: null, data: null });
    useTagStore.setState({ isModalOpen: false });
  });

  describe('navigation', () => {
    it('enters the grid at the first item when nothing is selected', () => {
      render(<TestGrid items={IMAGE_ITEMS} />);

      press('ArrowRight');

      expect(selectedPaths()).toEqual(['C:\\p0.jpg']);
      expect(scrollToIndex).toHaveBeenCalledWith(0);
    });

    it('ArrowRight/ArrowLeft move the selection by one item', () => {
      useAppStore.setState({ selectedImages: new Set(['C:\\p2.jpg']), lastSelectedImage: 'C:\\p2.jpg' });
      render(<TestGrid items={IMAGE_ITEMS} />);

      press('ArrowRight');
      expect(selectedPaths()).toEqual(['C:\\p3.jpg']);

      press('ArrowLeft');
      expect(selectedPaths()).toEqual(['C:\\p2.jpg']);
    });

    it('ArrowDown/ArrowUp jump a full row using the column count', () => {
      useAppStore.setState({ selectedImages: new Set(['C:\\p1.jpg']), lastSelectedImage: 'C:\\p1.jpg' });
      render(<TestGrid items={IMAGE_ITEMS} columnCount={3} />);

      press('ArrowDown');
      expect(selectedPaths()).toEqual(['C:\\p4.jpg']);
      expect(scrollToIndex).toHaveBeenLastCalledWith(4);

      press('ArrowUp');
      expect(selectedPaths()).toEqual(['C:\\p1.jpg']);
    });

    it('follows the column count when the zoom level changes it', () => {
      useAppStore.setState({ selectedImages: new Set(['C:\\p0.jpg']), lastSelectedImage: 'C:\\p0.jpg' });
      const { rerender } = render(<TestGrid items={IMAGE_ITEMS} columnCount={3} />);

      press('ArrowDown');
      expect(selectedPaths()).toEqual(['C:\\p3.jpg']);

      rerender(<TestGrid items={IMAGE_ITEMS} columnCount={2} />);
      press('ArrowUp');
      expect(selectedPaths()).toEqual(['C:\\p1.jpg']);
    });

    it('Home and End jump to the first and last item', () => {
      render(<TestGrid items={IMAGE_ITEMS} />);

      press('End');
      expect(selectedPaths()).toEqual(['C:\\p5.jpg']);

      press('Home');
      expect(selectedPaths()).toEqual(['C:\\p0.jpg']);
    });

    it('stays put at the grid edges', () => {
      useAppStore.setState({ selectedImages: new Set(['C:\\p0.jpg']), lastSelectedImage: 'C:\\p0.jpg' });
      render(<TestGrid items={IMAGE_ITEMS} />);

      press('ArrowLeft');

      expect(selectedPaths()).toEqual(['C:\\p0.jpg']);
      expect(scrollToIndex).not.toHaveBeenCalled();
    });

    it('walks over folder tiles and clears the image selection there', () => {
      const mixed: GridNavItem[] = [
        { kind: 'navigate-up' },
        { kind: 'folder', path: 'C:\\photos\\sub' },
        { kind: 'image', image: images[0] },
      ];
      render(<TestGrid items={mixed} />);

      press('ArrowRight'); // -> navigate-up tile
      expect(selectedPaths()).toEqual([]);

      press('ArrowRight'); // -> folder tile
      expect(selectedPaths()).toEqual([]);

      press('ArrowRight'); // -> first image
      expect(selectedPaths()).toEqual(['C:\\p0.jpg']);
    });
  });

  describe('shift extends the selection', () => {
    it('grows the range from the anchor', () => {
      useAppStore.setState({ selectedImages: new Set(['C:\\p1.jpg']), lastSelectedImage: 'C:\\p1.jpg' });
      render(<TestGrid items={IMAGE_ITEMS} />);

      press('ArrowRight', { shiftKey: true });
      expect(selectedPaths()).toEqual(['C:\\p1.jpg', 'C:\\p2.jpg']);

      press('ArrowRight', { shiftKey: true });
      expect(selectedPaths()).toEqual(['C:\\p1.jpg', 'C:\\p2.jpg', 'C:\\p3.jpg']);
    });

    it('keeps the anchor so shrinking the range works', () => {
      useAppStore.setState({ selectedImages: new Set(['C:\\p0.jpg']), lastSelectedImage: 'C:\\p0.jpg' });
      render(<TestGrid items={IMAGE_ITEMS} columnCount={3} />);

      press('ArrowDown', { shiftKey: true });
      expect(selectedPaths()).toEqual(['C:\\p0.jpg', 'C:\\p1.jpg', 'C:\\p2.jpg', 'C:\\p3.jpg']);

      press('ArrowUp', { shiftKey: true });
      expect(selectedPaths()).toEqual(['C:\\p0.jpg']);
    });

    it('leaves the selection untouched when the cursor lands on a folder', () => {
      const mixed: GridNavItem[] = [
        { kind: 'image', image: images[0] },
        { kind: 'folder', path: 'C:\\photos\\sub' },
      ];
      useAppStore.setState({ selectedImages: new Set(['C:\\p0.jpg']), lastSelectedImage: 'C:\\p0.jpg' });
      render(<TestGrid items={mixed} />);

      press('ArrowRight', { shiftKey: true });

      expect(selectedPaths()).toEqual(['C:\\p0.jpg']);
    });

    it('ranges over the display order, skipping images filtered out of the grid', () => {
      // Grid shows only p0 and p2 (p1 is filtered out) — the range must not
      // silently include the invisible p1 from the raw store order.
      // Das Grid zeigt nur p0 und p2 — das unsichtbare p1 darf nicht mit in
      // die Bereichsauswahl rutschen.
      const filtered: GridNavItem[] = [
        { kind: 'image', image: images[0] },
        { kind: 'image', image: images[2] },
      ];
      useAppStore.setState({ selectedImages: new Set(['C:\\p0.jpg']), lastSelectedImage: 'C:\\p0.jpg' });
      render(<TestGrid items={filtered} />);

      press('ArrowRight', { shiftKey: true });

      expect(selectedPaths()).toEqual(['C:\\p0.jpg', 'C:\\p2.jpg']);
    });
  });

  describe('focus follows the item identity', () => {
    it('keeps the ring on the same item when the list is re-sorted', () => {
      const { rerender, getByTestId } = render(<TestGrid items={IMAGE_ITEMS} />);

      press('ArrowRight'); // cursor enters at p0 (index 0)
      expect(getByTestId('focused').textContent).toBe('0');

      rerender(<TestGrid items={[...IMAGE_ITEMS].reverse()} />);

      expect(getByTestId('focused').textContent).toBe('5');
    });

    it('clears the ring when the focused item is filtered out', () => {
      const { rerender, getByTestId } = render(<TestGrid items={IMAGE_ITEMS} />);

      press('ArrowRight'); // cursor enters at p0
      rerender(<TestGrid items={IMAGE_ITEMS.slice(1)} />);

      expect(getByTestId('focused').textContent).toBe('-1');
    });
  });

  describe('rating keys', () => {
    it('applies a rating to the whole selection', async () => {
      useAppStore.setState({
        selectedImages: new Set(['C:\\p0.jpg', 'C:\\p2.jpg']),
        lastSelectedImage: 'C:\\p2.jpg',
      });
      render(<TestGrid items={IMAGE_ITEMS} />);

      press('4');

      expect(ratingOf('C:\\p0.jpg')).toBe(4);
      expect(ratingOf('C:\\p2.jpg')).toBe(4);
      expect(ratingOf('C:\\p1.jpg')).toBe(0);
      await waitFor(() => expect(mockedBridge.setRating).toHaveBeenCalledTimes(2));
      expect(mockedBridge.setRating).toHaveBeenCalledWith('C:\\p0.jpg', 4);
      expect(mockedBridge.setRating).toHaveBeenCalledWith('C:\\p2.jpg', 4);
    });

    it('0 clears the rating of the selection', async () => {
      useAppStore.setState({
        images: images.map((img) => ({ ...img, rating: 5 })),
        selectedImages: new Set(['C:\\p1.jpg']),
        lastSelectedImage: 'C:\\p1.jpg',
      });
      render(<TestGrid items={IMAGE_ITEMS} />);

      press('0');

      expect(ratingOf('C:\\p1.jpg')).toBe(0);
      await waitFor(() => expect(mockedBridge.setRating).toHaveBeenCalledWith('C:\\p1.jpg', 0));
    });

    it('does nothing without a selection', () => {
      render(<TestGrid items={IMAGE_ITEMS} />);

      press('3');

      expect(mockedBridge.setRating).not.toHaveBeenCalled();
    });

    it('ignores digits that belong to a Ctrl combo', () => {
      useAppStore.setState({ selectedImages: new Set(['C:\\p0.jpg']), lastSelectedImage: 'C:\\p0.jpg' });
      render(<TestGrid items={IMAGE_ITEMS} />);

      press('0', { ctrlKey: true });

      expect(mockedBridge.setRating).not.toHaveBeenCalled();
      expect(ratingOf('C:\\p0.jpg')).toBe(0);
    });
  });

  describe('opening items', () => {
    it('Enter opens the focused image in the lightbox', () => {
      useAppStore.setState({ selectedImages: new Set(['C:\\p2.jpg']), lastSelectedImage: 'C:\\p2.jpg' });
      render(<TestGrid items={IMAGE_ITEMS} />);

      press('Enter');

      expect(useLightboxStore.getState().open).toHaveBeenCalledWith(images[2]);
    });

    it('Space opens the focused image as well', () => {
      useAppStore.setState({ selectedImages: new Set(['C:\\p0.jpg']), lastSelectedImage: 'C:\\p0.jpg' });
      render(<TestGrid items={IMAGE_ITEMS} />);

      press(' ');

      expect(useLightboxStore.getState().open).toHaveBeenCalledWith(images[0]);
    });

    it('Enter on a folder opens the folder instead of the lightbox', () => {
      const navigateToFolder = vi.fn();
      useAppStore.setState({ navigateToFolder });
      const mixed: GridNavItem[] = [{ kind: 'folder', path: 'C:\\photos\\sub' }, ...IMAGE_ITEMS];
      render(<TestGrid items={mixed} />);

      press('ArrowRight'); // cursor enters at the folder tile
      press('Enter');

      expect(navigateToFolder).toHaveBeenCalledWith('C:\\photos\\sub');
      expect(useLightboxStore.getState().open).not.toHaveBeenCalled();
    });

    it('Enter on the parent tile navigates up', () => {
      const navigateUp = vi.fn();
      useAppStore.setState({ navigateUp });
      const mixed: GridNavItem[] = [{ kind: 'navigate-up' }, ...IMAGE_ITEMS];
      render(<TestGrid items={mixed} />);

      press('ArrowRight');
      press('Enter');

      expect(navigateUp).toHaveBeenCalledTimes(1);
    });
  });

  describe('stands down', () => {
    it('while typing in a text input', () => {
      const { getByTestId } = render(
        <>
          <input data-testid="field" />
          <TestGrid items={IMAGE_ITEMS} />
        </>
      );
      useAppStore.setState({ selectedImages: new Set(['C:\\p0.jpg']), lastSelectedImage: 'C:\\p0.jpg' });
      const field = getByTestId('field');

      press('ArrowRight', {}, field);
      press('End', {}, field);
      press('5', {}, field);
      press('Enter', {}, field);

      expect(selectedPaths()).toEqual(['C:\\p0.jpg']);
      expect(mockedBridge.setRating).not.toHaveBeenCalled();
      expect(useLightboxStore.getState().open).not.toHaveBeenCalled();
      expect(scrollToIndex).not.toHaveBeenCalled();
    });

    it('while a modal is open', () => {
      useAppStore.setState({ selectedImages: new Set(['C:\\p0.jpg']), lastSelectedImage: 'C:\\p0.jpg' });
      useModalStore.setState({ type: 'properties', data: { path: 'C:\\p0.jpg' } });
      render(<TestGrid items={IMAGE_ITEMS} />);

      press('ArrowRight');
      press('5');

      expect(selectedPaths()).toEqual(['C:\\p0.jpg']);
      expect(mockedBridge.setRating).not.toHaveBeenCalled();
    });

    it('while the tag manager modal is open', () => {
      useAppStore.setState({ selectedImages: new Set(['C:\\p0.jpg']), lastSelectedImage: 'C:\\p0.jpg' });
      useTagStore.setState({ isModalOpen: true });
      render(<TestGrid items={IMAGE_ITEMS} />);

      press('ArrowRight');
      press('5');

      expect(selectedPaths()).toEqual(['C:\\p0.jpg']);
      expect(mockedBridge.setRating).not.toHaveBeenCalled();
    });

    it('while an aria-modal overlay (e.g. the shortcuts help) is in the DOM', () => {
      useAppStore.setState({ selectedImages: new Set(['C:\\p0.jpg']), lastSelectedImage: 'C:\\p0.jpg' });
      render(
        <>
          <div role="dialog" aria-modal="true" />
          <TestGrid items={IMAGE_ITEMS} />
        </>
      );

      press('ArrowRight');
      press('5');
      press('Enter');

      expect(selectedPaths()).toEqual(['C:\\p0.jpg']);
      expect(mockedBridge.setRating).not.toHaveBeenCalled();
      expect(useLightboxStore.getState().open).not.toHaveBeenCalled();
    });

    it('while the lightbox is open', () => {
      useAppStore.setState({ selectedImages: new Set(['C:\\p0.jpg']), lastSelectedImage: 'C:\\p0.jpg' });
      useLightboxStore.setState({ isOpen: true });
      render(<TestGrid items={IMAGE_ITEMS} />);

      press('ArrowRight');

      expect(selectedPaths()).toEqual(['C:\\p0.jpg']);
    });

    it('for Ctrl/Alt combos that belong to the global shortcuts', () => {
      useAppStore.setState({ selectedImages: new Set(['C:\\p0.jpg']), lastSelectedImage: 'C:\\p0.jpg' });
      render(<TestGrid items={IMAGE_ITEMS} />);

      press('ArrowRight', { ctrlKey: true });
      press('Enter', { altKey: true });

      expect(selectedPaths()).toEqual(['C:\\p0.jpg']);
      expect(useLightboxStore.getState().open).not.toHaveBeenCalled();
    });
  });
});
