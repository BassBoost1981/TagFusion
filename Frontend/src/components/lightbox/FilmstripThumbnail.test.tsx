import { render, screen, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageFile } from '../../types';

vi.mock('../../services/bridge', () => ({
  bridge: {
    getThumbnailsBatch: vi.fn(),
  },
}));

function makeImage(path: string): ImageFile {
  return {
    path,
    fileName: path.split('/').pop() ?? path,
    extension: '.jpg',
    fileSize: 1,
    dateModified: new Date(0).toISOString(),
    dateCreated: new Date(0).toISOString(),
    rating: 0,
    tags: [],
  };
}

describe('FilmstripThumbnail', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('sources its image through the manager and refreshes after invalidation', async () => {
    const { bridge } = await import('../../services/bridge');
    const mockedBatch = vi.mocked(bridge.getThumbnailsBatch);

    const path = 'C:/images/photo.jpg';
    mockedBatch
      .mockResolvedValueOnce({ [path]: 'https://thumbs.tagfusion.local/v1.jpg' })
      .mockResolvedValueOnce({ [path]: 'https://thumbs.tagfusion.local/v2.jpg' });

    const { FilmstripThumbnail } = await import('./FilmstripThumbnail');
    const { invalidateThumbnail } = await import('../../hooks/useThumbnailManager');

    render(<FilmstripThumbnail image={makeImage(path)} isActive onSelect={() => {}} />);

    // Mount requests the thumbnail; the first batch resolves to v1.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30);
    });
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://thumbs.tagfusion.local/v1.jpg');

    // A lightbox edit invalidates the cached thumbnail — a fresh fetch returns v2.
    await act(async () => {
      invalidateThumbnail(path);
      await vi.advanceTimersByTimeAsync(30);
    });
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://thumbs.tagfusion.local/v2.jpg');
  });
});
