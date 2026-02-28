import { useSyncExternalStore } from 'react';
import { bridge } from '../services/bridge';

const BATCH_DELAY_MS = 30;
const BATCH_SIZE = 50;

// ============================================================================
// Singleton thumbnail manager — shared across all ImageCard instances
// ============================================================================

/** Cache: path → base64 thumbnail */
const cache = new Map<string, string | null>();

/** Paths waiting to be fetched in the next batch */
const pendingPaths = new Set<string>();

/** Paths currently being fetched */
const loadingPaths = new Set<string>();

/** Subscribers for reactivity */
const subscribers = new Set<() => void>();

let batchTimer: ReturnType<typeof setTimeout> | null = null;

function notify() {
  subscribers.forEach((cb) => cb());
}

async function fetchBatch(paths: string[]) {
  paths.forEach((p) => loadingPaths.add(p));
  notify();

  try {
    const result = await bridge.getThumbnailsBatch(paths);
    for (const path of paths) {
      cache.set(path, result[path] ?? null);
      loadingPaths.delete(path);
    }
  } catch (error) {
    console.error('[ThumbnailManager] Batch failed:', error);
    paths.forEach((p) => loadingPaths.delete(p));
  }

  notify();
}

function flushPending() {
  batchTimer = null;
  if (pendingPaths.size === 0) return;

  const paths = Array.from(pendingPaths);
  pendingPaths.clear();

  for (let i = 0; i < paths.length; i += BATCH_SIZE) {
    const chunk = paths.slice(i, i + BATCH_SIZE);
    fetchBatch(chunk);
  }
}

function scheduleBatch() {
  if (batchTimer !== null) return;
  batchTimer = setTimeout(flushPending, BATCH_DELAY_MS);
}

function requestThumbnail(path: string) {
  if (cache.has(path) || pendingPaths.has(path) || loadingPaths.has(path)) return;
  pendingPaths.add(path);
  scheduleBatch();
}

function subscribe(cb: () => void) {
  subscribers.add(cb);
  return () => { subscribers.delete(cb); };
}

// ============================================================================
// React Hook
// ============================================================================

/**
 * Hook to get a thumbnail for a given image path.
 * Automatically batches requests across all mounted ImageCards.
 * When the card becomes visible, call requestThumbnail() to enqueue it.
 *
 * @returns [thumbnail: string | null, isLoading: boolean]
 */
export function useThumbnail(imagePath: string, initialThumbnail?: string | null): [string | null, boolean] {
  // Seed cache from initial data if available
  if (initialThumbnail && !cache.has(imagePath)) {
    cache.set(imagePath, initialThumbnail);
  }

  // Subscribe to cache changes — snapshot is a string hash for this specific path
  useSyncExternalStore(
    subscribe,
    () => {
      const cached = cache.has(imagePath) ? 'y' : 'n';
      const loading = loadingPaths.has(imagePath) ? 'y' : 'n';
      return `${cached}-${loading}`;
    }
  );

  const thumbnail = cache.get(imagePath) ?? null;
  const isLoading = loadingPaths.has(imagePath) || pendingPaths.has(imagePath);

  return [thumbnail, isLoading];
}

export { requestThumbnail };

