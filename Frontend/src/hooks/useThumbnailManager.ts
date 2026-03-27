import { useSyncExternalStore } from 'react';
import { bridge } from '../services/bridge';

const BATCH_DELAY_MS = 30;
const BATCH_SIZE = 80;
const MAX_MEMORY_CACHE_SIZE = 500; // Increased in-memory cache for faster access
const MAX_RETRY_COUNT = 2; // Retry failed thumbnail loads
const IDB_NAME = 'tagfusion-thumbnails';
const IDB_STORE = 'thumbnails';
const IDB_VERSION = 1;
const IDB_MAX_ENTRIES = 5000; // Max cached entries before eviction
const IDB_EVICTION_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes

// ============================================================================
// IndexedDB Layer — persistent second-level cache
// ============================================================================

let idb: IDBDatabase | null = null;
let idbReady = false;

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => {
      idb = req.result;
      idbReady = true;
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  });
}

// Initialize DB on module load + schedule periodic eviction
openIDB()
  .then(() => {
    // Evict old entries periodically
    setInterval(evictOldEntries, IDB_EVICTION_INTERVAL_MS);
    // Run once after init
    setTimeout(evictOldEntries, 10_000);
  })
  .catch((err) => {
    console.warn('[ThumbnailManager] IndexedDB unavailable, using memory-only cache:', err);
  });

/** Remove excess entries from IndexedDB to prevent unbounded growth */
function evictOldEntries(): void {
  if (!idbReady || !idb) return;
  try {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    const countReq = store.count();
    countReq.onsuccess = () => {
      const count = countReq.result;
      if (count <= IDB_MAX_ENTRIES) return;
      // Delete oldest entries (by key order) until we're at 80% capacity
      const target = Math.floor(IDB_MAX_ENTRIES * 0.8);
      const deleteCount = count - target;
      const cursorReq = store.openCursor();
      let deleted = 0;
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor && deleted < deleteCount) {
          cursor.delete();
          deleted++;
          cursor.continue();
        }
      };
    };
  } catch {
    // Best-effort eviction
  }
}

async function idbGet(key: string): Promise<string | null> {
  if (!idbReady || !idb) return null;
  return new Promise((resolve) => {
    try {
      const tx = idb!.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as string) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function idbPut(key: string, value: string): void {
  if (!idbReady || !idb) return;
  try {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.put(value, key);
  } catch {
    // Silently ignore — IndexedDB is best-effort
  }
}

// ============================================================================
// Singleton thumbnail manager — shared across all ImageCard instances
// ============================================================================

/** LRU Memory Cache: path → base64 thumbnail */
const cache = new Map<string, string | null>();

/** Paths waiting to be fetched in the next batch */
const pendingPaths = new Set<string>();

/** Paths currently being fetched */
const loadingPaths = new Set<string>();

/** Retry counts for failed paths */
const retryCounts = new Map<string, number>();

/** Subscribers for reactivity */
const subscribers = new Set<() => void>();

let batchTimer: ReturnType<typeof setTimeout> | null = null;

function notify() {
  subscribers.forEach((cb) => cb());
}

/** Set cache entry with LRU eviction when exceeding MAX_MEMORY_CACHE_SIZE */
function cacheSet(key: string, value: string | null) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);

  // Persist to IndexedDB (non-null only)
  if (value) {
    idbPut(key, value);
  }

  while (cache.size > MAX_MEMORY_CACHE_SIZE) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

async function fetchBatch(paths: string[]) {
  paths.forEach((p) => loadingPaths.add(p));
  notify();

  try {
    const result = await bridge.getThumbnailsBatch(paths);
    for (const path of paths) {
      const thumbnail = result[path] ?? null;
      cacheSet(path, thumbnail);
      loadingPaths.delete(path);
      // Clear retry count on success
      if (thumbnail) retryCounts.delete(path);
    }
  } catch (error) {
    console.error('[ThumbnailManager] Batch failed:', error);
    // Mark all as failed and schedule retry for eligible paths
    for (const p of paths) {
      loadingPaths.delete(p);
      const retries = retryCounts.get(p) ?? 0;
      if (retries < MAX_RETRY_COUNT) {
        retryCounts.set(p, retries + 1);
        // Re-queue for retry after delay
        setTimeout(() => {
          if (!cache.has(p) && !pendingPaths.has(p) && !loadingPaths.has(p)) {
            pendingPaths.add(p);
            scheduleBatch();
          }
        }, 1000 * (retries + 1)); // Exponential backoff: 1s, 2s
      }
    }
  }

  notify();
}

function flushPending() {
  batchTimer = null;
  if (pendingPaths.size === 0) return;

  const paths = Array.from(pendingPaths);
  pendingPaths.clear();

  const chunks: string[][] = [];
  for (let i = 0; i < paths.length; i += BATCH_SIZE) {
    chunks.push(paths.slice(i, i + BATCH_SIZE));
  }

  Promise.all(chunks.map((chunk) => fetchBatch(chunk))).catch((error) => {
    console.error('[ThumbnailManager] Parallel batch fetch failed:', error);
  });
}

function scheduleBatch() {
  if (batchTimer !== null) return;
  batchTimer = setTimeout(flushPending, BATCH_DELAY_MS);
}

function requestThumbnail(path: string) {
  if (cache.has(path) || pendingPaths.has(path) || loadingPaths.has(path)) return;

  // Try IndexedDB first (async, non-blocking)
  if (idbReady) {
    idbGet(path).then((cached) => {
      if (cached && !cache.has(path)) {
        // Found in IndexedDB — populate memory cache without network request
        cacheSet(path, cached);
        notify();
      } else if (!cache.has(path) && !pendingPaths.has(path) && !loadingPaths.has(path)) {
        // Not in IndexedDB either — schedule network fetch
        pendingPaths.add(path);
        scheduleBatch();
      }
    });
  } else {
    pendingPaths.add(path);
    scheduleBatch();
  }
}

/** Force retry a failed thumbnail (e.g., after user action) */
function retryThumbnail(path: string) {
  cache.delete(path);
  retryCounts.delete(path);
  loadingPaths.delete(path);
  pendingPaths.add(path);
  scheduleBatch();
}

function subscribe(cb: () => void) {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

// ============================================================================
// React Hook
// ============================================================================

/**
 * Hook to get a thumbnail for a given image path.
 * Automatically batches requests across all mounted ImageCards.
 * Two-level cache: Memory (fast) → IndexedDB (persistent) → Network (bridge).
 * Failed loads are retried up to MAX_RETRY_COUNT times with exponential backoff.
 *
 * @returns [thumbnail: string | null, isLoading: boolean]
 */
export function useThumbnail(imagePath: string, initialThumbnail?: string | null): [string | null, boolean] {
  if (initialThumbnail && !cache.has(imagePath)) {
    cacheSet(imagePath, initialThumbnail);
  }

  useSyncExternalStore(subscribe, () => {
    const cached = cache.has(imagePath) ? 'y' : 'n';
    const loading = loadingPaths.has(imagePath) ? 'y' : 'n';
    return `${cached}-${loading}`;
  });

  const thumbnail = cache.get(imagePath) ?? null;
  const isLoading = loadingPaths.has(imagePath) || pendingPaths.has(imagePath);

  return [thumbnail, isLoading];
}

export { requestThumbnail, retryThumbnail };
