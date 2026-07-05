import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFaceStore } from '../faceStore';
import { bridge } from '../../services/bridge';

vi.mock('../../services/bridge', () => ({
  bridge: {
    scanFacesInFolder: vi.fn(),
    cancelFaceScan: vi.fn(),
    getFaceReview: vi.fn(),
    confirmFaceGroup: vi.fn(),
    rejectFaceSuggestion: vi.fn(),
    ignoreFaces: vi.fn(),
    getPersons: vi.fn(),
    healthCheck: vi.fn(),
    on: vi.fn(),
  },
}));

const mockedBridge = vi.mocked(bridge);

describe('faceStore', () => {
  beforeEach(() => {
    useFaceStore.setState({
      engineAvailable: null,
      isScanning: false,
      progress: null,
      review: null,
      isPanelOpen: false,
      persons: [],
    });
    vi.clearAllMocks();
  });

  it('startScan sets isScanning and calls the bridge', async () => {
    mockedBridge.scanFacesInFolder.mockResolvedValue(true);

    await useFaceStore.getState().startScan('C:\\fotos');

    expect(mockedBridge.scanFacesInFolder).toHaveBeenCalledWith('C:\\fotos');
    expect(useFaceStore.getState().isScanning).toBe(true);
  });

  it('loadReview stores review data and opens the panel', async () => {
    mockedBridge.getFaceReview.mockResolvedValue({ suggestions: [], groups: [] });
    mockedBridge.getPersons.mockResolvedValue([{ id: 1, name: 'Max', faceCount: 2 }]);

    await useFaceStore.getState().loadReview('C:\\fotos');

    const state = useFaceStore.getState();
    expect(state.review).toEqual({ suggestions: [], groups: [] });
    expect(state.persons).toHaveLength(1);
    expect(state.isPanelOpen).toBe(true);
  });

  it('confirmGroup calls bridge and reloads the review', async () => {
    mockedBridge.confirmFaceGroup.mockResolvedValue({ tagged: 2, failed: 0 });
    mockedBridge.getFaceReview.mockResolvedValue({ suggestions: [], groups: [] });
    mockedBridge.getPersons.mockResolvedValue([]);

    await useFaceStore.getState().confirmGroup([1, 2], 'Max', 'C:\\fotos');

    expect(mockedBridge.confirmFaceGroup).toHaveBeenCalledWith([1, 2], 'Max');
    expect(mockedBridge.getFaceReview).toHaveBeenCalledWith('C:\\fotos');
  });

  it('checkEngine reads faceEngineOk from healthCheck', async () => {
    mockedBridge.healthCheck.mockResolvedValue({ faceEngineOk: true } as never);

    await useFaceStore.getState().checkEngine();

    expect(useFaceStore.getState().engineAvailable).toBe(true);
  });
});
