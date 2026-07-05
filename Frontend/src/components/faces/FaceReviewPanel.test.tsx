import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { act } from 'react';
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

  it('does not leak a typed name to another group after the review reloads', () => {
    const groupA = { faceIds: [10], sample: [{ faceId: 10, imagePath: 'C:\\a.jpg', crop: 'QUJD' }] };
    const groupB = { faceIds: [20], sample: [{ faceId: 20, imagePath: 'C:\\b.jpg', crop: 'QUJD' }] };
    useFaceStore.setState({
      isPanelOpen: true,
      review: { suggestions: [], groups: [groupA, groupB] },
      persons: [],
    });
    render(<FaceReviewPanel />);

    const inputs = screen.getAllByPlaceholderText('Name eingeben…');
    fireEvent.change(inputs[0], { target: { value: 'Anna' } });

    // Simulate reload after confirming group A: only group B remains.
    act(() => {
      useFaceStore.setState({ review: { suggestions: [], groups: [groupB] } });
    });

    const remaining = screen.getAllByPlaceholderText('Name eingeben…');
    expect((remaining[0] as HTMLInputElement).value).toBe('');
  });
});
