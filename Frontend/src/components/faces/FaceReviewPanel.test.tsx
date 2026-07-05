import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FaceReviewPanel } from './FaceReviewPanel';
import { useFaceStore } from '../../stores/faceStore';
import { useAppStore } from '../../stores/appStore';

vi.mock('../../services/bridge', () => ({
  bridge: {
    getFaceReview: vi.fn(),
    getPersons: vi.fn(),
    confirmFaceGroup: vi.fn(),
    rejectFaceSuggestion: vi.fn(),
    ignoreFaces: vi.fn(),
    healthCheck: vi.fn(),
    on: vi.fn(),
  },
}));

describe('FaceReviewPanel', () => {
  beforeEach(() => {
    useAppStore.setState({ currentFolder: 'C:\\Test' });
    useFaceStore.setState({
      isPanelOpen: true,
      review: {
        suggestions: [
          { personId: 1, personName: 'Max', score: 0.8, faceIds: [1, 2], sample: [{ faceId: 1, imagePath: 'C:\\a.jpg', crop: 'QUJD' }] },
        ],
        groups: [{ faceIds: [3], sample: [{ faceId: 3, imagePath: 'C:\\b.jpg', crop: 'QUJD' }] }],
      },
      persons: [{ id: 1, name: 'Max', faceCount: 2 }],
    });
  });

  it('renders suggestion question and unknown group', () => {
    render(<FaceReviewPanel />);

    expect(screen.getByText(/Max/)).toBeInTheDocument();
    expect(screen.getAllByRole('img').length).toBeGreaterThanOrEqual(2);
  });

  it('renders nothing when panel is closed', () => {
    useFaceStore.setState({ isPanelOpen: false });
    const { container } = render(<FaceReviewPanel />);
    expect(container.firstChild).toBeNull();
  });
});
