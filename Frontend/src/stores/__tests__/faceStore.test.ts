import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFaceStore } from '../faceStore';
import { useToastStore } from '../toastStore';
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

  it('loadReview surfaces a warning toast and does not open the panel when the bridge rejects', async () => {
    mockedBridge.getFaceReview.mockRejectedValue(new Error('timeout'));
    mockedBridge.getPersons.mockResolvedValue([]);

    await expect(useFaceStore.getState().loadReview('C:\\x')).resolves.not.toThrow();

    expect(useFaceStore.getState().isPanelOpen).toBe(false);
  });

  it('rejectSuggestion surfaces a warning toast when the bridge rejects', async () => {
    mockedBridge.rejectFaceSuggestion.mockRejectedValue(new Error('timeout'));

    await expect(useFaceStore.getState().rejectSuggestion([1], 'C:\\x')).resolves.not.toThrow();
  });

  it('ignoreGroup surfaces a warning toast when the bridge rejects', async () => {
    mockedBridge.ignoreFaces.mockRejectedValue(new Error('timeout'));

    await expect(useFaceStore.getState().ignoreGroup([1], 'C:\\x')).resolves.not.toThrow();
  });

  it('cancelScan surfaces a warning toast when the bridge rejects', async () => {
    mockedBridge.cancelFaceScan.mockRejectedValue(new Error('timeout'));

    await expect(useFaceStore.getState().cancelScan()).resolves.not.toThrow();
  });

  it('startScan sets isScanning before awaiting the bridge and reverts on failure', async () => {
    mockedBridge.scanFacesInFolder.mockRejectedValue(new Error('boom'));

    await useFaceStore.getState().startScan('C:\\fotos');

    expect(useFaceStore.getState().isScanning).toBe(false);
  });

  it('faceScanCompleted toasts a warning with the skipped count, or success when nothing was skipped', () => {
    mockedBridge.getFaceReview.mockResolvedValue({ suggestions: [], groups: [] });
    mockedBridge.getPersons.mockResolvedValue([]);
    useToastStore.setState({ toasts: [] });

    // setupFaceSubscriptions is guarded to run once per module lifetime, so both
    // scenarios are exercised against the single registered handler here.
    useFaceStore.getState().setupFaceSubscriptions(() => null);
    const handler = mockedBridge.on.mock.calls.find(([event]) => event === 'faceScanCompleted')![1];

    handler({ scanned: 10, faces: 3, skipped: 2, cancelled: false });
    let toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].type).toBe('warning');
    expect(toasts[0].message).toBe('Scan fertig: 3 Gesichter in 10 Bildern, 2 übersprungen');

    useToastStore.setState({ toasts: [] });
    handler({ scanned: 10, faces: 3, skipped: 0, cancelled: false });
    toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].type).toBe('success');
    expect(toasts[0].message).toBe('Scan fertig: 3 Gesichter in 10 Bildern');
  });
});
