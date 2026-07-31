import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { useLightboxStore } from '../stores/lightboxStore';
import { useModalStore } from '../stores/modalStore';
import { useTagStore } from '../stores/tagStore';
import { getNextGridIndex } from '../utils/gridNavigation';
import { isTextInputTarget } from '../utils/keyboardTarget';
import type { ImageFile } from '../types';

/**
 * One navigable cell of the grid, in display order. Folders and images share the
 * same grid, so the keyboard cursor walks all of them while ratings only apply
 * to images.
 * Eine navigierbare Rasterzelle in Anzeigereihenfolge — Ordner und Bilder gemischt.
 */
export type GridNavItem =
  | { kind: 'navigate-up' }
  | { kind: 'folder'; path: string }
  | { kind: 'image'; image: ImageFile };

const NAVIGATION_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']);
const RATING_KEYS = new Set(['0', '1', '2', '3', '4', '5']);

// Identity of a grid cell — re-anchors the cursor when the list is re-sorted or filtered.
// Identität einer Rasterzelle — verankert den Cursor bei Listenänderungen neu.
const keyOfItem = (item: GridNavItem): string =>
  item.kind === 'image' ? `image:${item.image.path}` : item.kind === 'folder' ? `folder:${item.path}` : 'navigate-up';

interface GridKeyboardNavigationOptions {
  /** All grid cells in display order / Alle Rasterzellen in Anzeigereihenfolge */
  items: GridNavItem[];
  /** Columns the grid currently renders — follows container width and zoom level */
  columnCount: number;
  /** Scrolls the virtualized grid so the given index becomes visible */
  onScrollToIndex: (index: number) => void;
}

/**
 * Keyboard workflow for the image grid: arrow/Home/End navigation (Shift extends
 * the selection from the anchor), Enter/Space to open, and 0-5 to rate the whole
 * selection. Stands down while a text field, a modal or the lightbox owns the
 * keyboard, and leaves every Ctrl/Alt/Meta combo to useKeyboardShortcuts.
 * Returns the focused cell index so the grid can mark it.
 * Tastatur-Workflow fuer das Bildraster — liefert den Fokusindex zurueck.
 */
export function useGridKeyboardNavigation({ items, columnCount, onScrollToIndex }: GridKeyboardNavigationOptions) {
  const currentFolder = useAppStore((s) => s.currentFolder);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const focusRef = useRef(-1);
  // The selection anchor as of our own last move — lets us tell a mouse click apart
  // from a Shift range that deliberately leaves the anchor behind.
  // Auswahlanker unseres letzten Zugs — trennt Mausklick von Shift-Bereichsauswahl.
  const syncedAnchorRef = useRef<string | null>(null);
  // Identity of the focused cell — the numeric index goes stale when the list
  // is filtered or re-sorted, the key survives.
  // Identität der fokussierten Zelle — der Zahlenindex veraltet bei Filter/
  // Sortierung, der Schlüssel bleibt gültig.
  const focusedKeyRef = useRef<string | null>(null);

  const moveFocus = useCallback((index: number, item?: GridNavItem) => {
    focusRef.current = index;
    focusedKeyRef.current = item ? keyOfItem(item) : null;
    syncedAnchorRef.current = useAppStore.getState().lastSelectedImage;
    setFocusedIndex(index);
  }, []);

  // Another folder means another item list — the cursor position no longer applies.
  // Anderer Ordner, andere Liste — Cursorposition verwerfen.
  useEffect(() => {
    moveFocus(-1);
  }, [currentFolder, moveFocus]);

  // Filter, sort or a reload reorder the list — a numeric index would silently
  // decorate a different tile, so the cursor follows the focused cell's identity.
  // Gone from the list means gone from the ring.
  // Filter/Sortierung ordnen die Liste um — der Cursor folgt der Identität der
  // Zelle statt dem alten Index; verschwundene Zellen verlieren den Ring.
  useEffect(() => {
    if (focusRef.current < 0) return;
    const key = focusedKeyRef.current;
    const index = key === null ? -1 : items.findIndex((item) => keyOfItem(item) === key);
    if (index !== focusRef.current) {
      focusRef.current = index;
      setFocusedIndex(index);
    }
  }, [items]);

  useEffect(() => {
    // The cell the keyboard acts on. When the anchor moved without us — a mouse click
    // on another image — the cursor follows it, otherwise it keeps its own position.
    // Cursorposition: einem Mausklick folgen, sonst die eigene Position behalten.
    const resolveCurrentIndex = (): number => {
      const focused = focusRef.current < items.length ? focusRef.current : -1;
      const { lastSelectedImage } = useAppStore.getState();
      if (focused >= 0 && lastSelectedImage === syncedAnchorRef.current) return focused;

      const selectedIndex = items.findIndex((i) => i.kind === 'image' && i.image.path === lastSelectedImage);
      return selectedIndex >= 0 ? selectedIndex : focused;
    };

    // Images become the selection; Shift extends the range from the existing anchor.
    // Folders and the parent tile hold no image selection, so a plain move clears it.
    // Ordner tragen keine Bildauswahl — ein Zug ohne Shift hebt sie auf.
    const applySelection = (item: GridNavItem, extend: boolean) => {
      const { selectImage, clearSelection } = useAppStore.getState();
      if (item.kind === 'image') {
        // Shift ranges must follow the display order the cursor walks — the raw
        // store order differs once filters or sorting are active.
        // Shift-Bereiche folgen der Anzeige-Reihenfolge des Cursors — die rohe
        // Store-Reihenfolge weicht bei aktiven Filtern/Sortierung ab.
        const displayOrder = extend ? items.flatMap((i) => (i.kind === 'image' ? [i.image.path] : [])) : undefined;
        selectImage(item.image.path, false, extend, displayOrder);
        return;
      }
      if (!extend) clearSelection();
    };

    // Enter/Space opens an image in the lightbox and enters a folder instead.
    // Enter/Leertaste: Bild in der Lightbox oeffnen, Ordner betreten.
    const activate = (item: GridNavItem) => {
      const { navigateToFolder, navigateUp } = useAppStore.getState();
      if (item.kind === 'image') {
        useLightboxStore.getState().open(item.image);
      } else if (item.kind === 'folder') {
        navigateToFolder(item.path);
      } else {
        navigateUp();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTextInputTarget(e.target)) return;
      // Stand down while ANY overlay owns the keyboard. Not every dialog lives in
      // modalStore: the tag manager has its own store flag, the shortcuts overlay
      // holds local state — the aria-modal query catches those and future ones.
      // Rating keys write into image files, so a missed overlay means silent bulk
      // writes behind a dialog.
      // Zurückhalten, solange IRGENDEIN Overlay die Tastatur besitzt. Nicht jeder
      // Dialog liegt im modalStore — die aria-modal-Abfrage fängt die übrigen ab.
      if (
        useModalStore.getState().type !== null ||
        useLightboxStore.getState().isOpen ||
        useTagStore.getState().isModalOpen ||
        document.querySelector('[aria-modal="true"]') !== null
      )
        return;
      // Ctrl/Alt/Meta combos belong to useKeyboardShortcuts (copy, zoom, select all, …).
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (items.length === 0) return;

      if (NAVIGATION_KEYS.has(e.key)) {
        e.preventDefault();
        const currentIndex = resolveCurrentIndex();
        const nextIndex = getNextGridIndex(currentIndex, e.key, items.length, columnCount);
        if (nextIndex < 0 || nextIndex === currentIndex) return;

        // Selection first — moveFocus records the anchor the selection left behind.
        // Auswahl zuerst — moveFocus merkt sich den daraus entstandenen Anker.
        applySelection(items[nextIndex], e.shiftKey);
        moveFocus(nextIndex, items[nextIndex]);
        onScrollToIndex(nextIndex);
        return;
      }

      if (e.key === 'Enter' || e.key === ' ') {
        const item = items[resolveCurrentIndex()];
        if (!item) return;
        e.preventDefault();
        activate(item);
        return;
      }

      if (RATING_KEYS.has(e.key)) {
        const { selectedImages, updateImageRating } = useAppStore.getState();
        if (selectedImages.size === 0) return;
        e.preventDefault();
        // Same write path as the star widget — optimistic update plus revert on failure.
        // Gleicher Schreibpfad wie die Sterne-Leiste.
        const rating = Number(e.key);
        for (const path of selectedImages) {
          void updateImageRating(path, rating);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, columnCount, onScrollToIndex, moveFocus]);

  return focusedIndex;
}
