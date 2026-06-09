import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/bridge', () => ({
  bridge: {
    getThumbnailsBatch: vi.fn(),
  },
}));

describe('useThumbnailManager batching', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('limits concurrent bridge thumbnail batches for large folders', async () => {
    const { bridge } = await import('../services/bridge');
    const mockedGetThumbnailsBatch = vi.mocked(bridge.getThumbnailsBatch);

    let activeBatches = 0;
    let maxActiveBatches = 0;
    const resolvers: Array<() => void> = [];

    mockedGetThumbnailsBatch.mockImplementation(
      (paths: string[]) =>
        new Promise<Record<string, string | null>>((resolve) => {
          activeBatches++;
          maxActiveBatches = Math.max(maxActiveBatches, activeBatches);
          resolvers.push(() => {
            activeBatches--;
            resolve(Object.fromEntries(paths.map((path) => [path, `thumb:${path}`])));
          });
        })
    );

    const { requestThumbnail } = await import('./useThumbnailManager');

    for (let i = 0; i < 240; i++) {
      requestThumbnail(`C:\\images\\${i}.jpg`);
    }

    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(30);
    await Promise.resolve();

    expect(maxActiveBatches).toBeLessThanOrEqual(2);

    while (resolvers.length > 0) {
      resolvers.shift()?.();
      await Promise.resolve();
    }
  });
});

describe('invalidateThumbnail', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('discards the cached thumbnail and forces a fresh bridge fetch', async () => {
    const { bridge } = await import('../services/bridge');
    const mockedGetThumbnailsBatch = vi.mocked(bridge.getThumbnailsBatch);

    const path = 'C:\\images\\photo.jpg';
    mockedGetThumbnailsBatch
      .mockResolvedValueOnce({ [path]: 'thumb:v1' })
      .mockResolvedValueOnce({ [path]: 'thumb:v2' });

    const { requestThumbnail, invalidateThumbnail } = await import('./useThumbnailManager');

    // First request populates the cache.
    requestThumbnail(path);
    await vi.advanceTimersByTimeAsync(30);
    await Promise.resolve();
    expect(mockedGetThumbnailsBatch).toHaveBeenCalledTimes(1);

    // A repeat request is a cache hit — no second fetch.
    requestThumbnail(path);
    await vi.advanceTimersByTimeAsync(30);
    await Promise.resolve();
    expect(mockedGetThumbnailsBatch).toHaveBeenCalledTimes(1);

    // After an edit (rotate/flip) the bytes changed: invalidation must re-fetch.
    invalidateThumbnail(path);
    await vi.advanceTimersByTimeAsync(30);
    await Promise.resolve();
    expect(mockedGetThumbnailsBatch).toHaveBeenCalledTimes(2);
    expect(mockedGetThumbnailsBatch).toHaveBeenLastCalledWith([path]);
  });
});
