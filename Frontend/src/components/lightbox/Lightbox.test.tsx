import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Lightbox } from './Lightbox';
import { useLightboxStore } from '../../stores/lightboxStore';
import { bridge } from '../../services/bridge';
import i18n from '../../i18n';
import type { ImageFile } from '../../types';

vi.mock('../../services/bridge', () => ({
  bridge: {
    getFullImage: vi.fn(),
    getImageDescription: vi.fn(),
    rotateImages: vi.fn(),
    flipImages: vi.fn(),
    getThumbnailsBatch: vi.fn(),
  },
}));

function makeImage(path: string): ImageFile {
  return {
    path,
    fileName: path.split('\\').pop() ?? path,
    extension: '.jpg',
    fileSize: 1,
    dateModified: new Date(0).toISOString(),
    dateCreated: new Date(0).toISOString(),
    rating: 0,
    tags: [],
  };
}

describe('Lightbox description row', () => {
  beforeAll(async () => {
    // Force German so the translated label is deterministic in assertions.
    // Deutsch erzwingen, damit das übersetzte Label deterministisch ist.
    await i18n.changeLanguage('de');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(bridge.getFullImage).mockResolvedValue('https://thumbs.tagfusion.local/full.jpg');
  });

  it('shows the description when the bridge returns one', async () => {
    const image = makeImage('C:\\Bilder\\strand.jpg');
    vi.mocked(bridge.getImageDescription).mockResolvedValue('Ein Sonnenuntergang über dem Meer.');
    useLightboxStore.setState({ isOpen: true, currentImage: image, images: [image], currentIndex: 0 });

    render(<Lightbox />);

    expect(await screen.findByText('Ein Sonnenuntergang über dem Meer.')).toBeInTheDocument();
    expect(screen.getByText(/Beschreibung/)).toBeInTheDocument();
  });

  it('renders no description row when the bridge returns null', async () => {
    const image = makeImage('C:\\Bilder\\ohne.jpg');
    vi.mocked(bridge.getImageDescription).mockResolvedValue(null);
    useLightboxStore.setState({ isOpen: true, currentImage: image, images: [image], currentIndex: 0 });

    render(<Lightbox />);

    await waitFor(() => expect(bridge.getImageDescription).toHaveBeenCalledWith(image.path));
    expect(screen.queryByText(/Beschreibung/)).not.toBeInTheDocument();
  });
});
