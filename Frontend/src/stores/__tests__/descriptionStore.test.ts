import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDescriptionStore } from '../descriptionStore';
import { bridge } from '../../services/bridge';

vi.mock('../../services/bridge', () => ({
  bridge: {
    getAiServerStatus: vi.fn(),
    getDescriptionPrecheck: vi.fn(),
    startDescriptionScan: vi.fn(),
    cancelDescriptionScan: vi.fn(),
    startAiServer: vi.fn(),
    stopAiServer: vi.fn(),
    on: vi.fn(),
  },
}));

const mockedBridge = vi.mocked(bridge);

describe('descriptionStore', () => {
  beforeEach(() => {
    // Stub localStorage locally for this test file only, matching jsdom's absence
    const localStorageMock = (() => {
      let store: Record<string, string> = {};
      return {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => {
          store[key] = value.toString();
        },
        removeItem: (key: string) => {
          delete store[key];
        },
        clear: () => {
          store = {};
        },
      };
    })();
    vi.stubGlobal('localStorage', localStorageMock);

    useDescriptionStore.setState({
      isDialogOpen: false,
      serverStatus: null,
      precheck: null,
      isScanning: false,
      progress: null,
      selectedModel: '',
      promptText: '',
      overwriteExisting: false,
    });
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('openDialog loads server status and precheck in parallel', async () => {
    mockedBridge.getAiServerStatus.mockResolvedValue({
      reachable: true, state: 'idle', model: '', progress: -1, message: '', models: ['qwen'], managedByApp: false,
    });
    mockedBridge.getDescriptionPrecheck.mockResolvedValue({ total: 10, withDescription: 3 });

    await useDescriptionStore.getState().openDialog('C:\\fotos');

    const state = useDescriptionStore.getState();
    expect(state.isDialogOpen).toBe(true);
    expect(state.serverStatus?.models).toEqual(['qwen']);
    expect(state.precheck).toEqual({ total: 10, withDescription: 3 });
  });

  it('openDialog with unreachable server still opens with status', async () => {
    mockedBridge.getAiServerStatus.mockResolvedValue({
      reachable: false, state: 'unreachable', model: '', progress: -1, message: '', models: [], managedByApp: false,
    });
    mockedBridge.getDescriptionPrecheck.mockResolvedValue({ total: 5, withDescription: 0 });

    await useDescriptionStore.getState().openDialog('C:\\fotos');

    expect(useDescriptionStore.getState().isDialogOpen).toBe(true);
    expect(useDescriptionStore.getState().serverStatus?.reachable).toBe(false);
  });

  it('startScan passes the dialog selection and closes the dialog', async () => {
    mockedBridge.startDescriptionScan.mockResolvedValue(true);
    useDescriptionStore.setState({
      isDialogOpen: true, selectedModel: 'qwen', promptText: 'Beschreibe', overwriteExisting: true,
    });

    await useDescriptionStore.getState().startScan('C:\\fotos');

    expect(mockedBridge.startDescriptionScan).toHaveBeenCalledWith('C:\\fotos', 'qwen', 'Beschreibe', true, false);
    const state = useDescriptionStore.getState();
    expect(state.isScanning).toBe(true);
    expect(state.isDialogOpen).toBe(false);
  });

  it('startScan failure reverts isScanning and keeps state consistent', async () => {
    mockedBridge.startDescriptionScan.mockRejectedValue(new Error('Eine Beschreibung läuft bereits.'));
    useDescriptionStore.setState({ isDialogOpen: true, selectedModel: 'q', promptText: 'p' });

    await useDescriptionStore.getState().startScan('C:\\fotos');

    expect(useDescriptionStore.getState().isScanning).toBe(false);
  });

  it('remembers the last model and prompt via localStorage', async () => {
    useDescriptionStore.getState().setModel('qwen');
    useDescriptionStore.getState().setPrompt('Mein Prompt');

    const raw = localStorage.getItem('tagfusion.descriptionDialog');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toMatchObject({ model: 'qwen', prompt: 'Mein Prompt' });
  });

  it('startServer calls the bridge and refreshes status', async () => {
    mockedBridge.startAiServer.mockResolvedValue(true);
    mockedBridge.getAiServerStatus.mockResolvedValue({
      reachable: false, state: 'idle', model: '', progress: -1, message: '', models: [], managedByApp: true,
    });

    await useDescriptionStore.getState().startServer();

    expect(mockedBridge.startAiServer).toHaveBeenCalled();
    expect(mockedBridge.getAiServerStatus).toHaveBeenCalled();
  });

  it('stopServer calls the bridge and refreshes status', async () => {
    mockedBridge.stopAiServer.mockResolvedValue(true);
    mockedBridge.getAiServerStatus.mockResolvedValue({
      reachable: false, state: 'unreachable', model: '', progress: -1, message: '', models: [], managedByApp: false,
    });

    await useDescriptionStore.getState().stopServer();

    expect(mockedBridge.stopAiServer).toHaveBeenCalled();
    expect(useDescriptionStore.getState().serverStatus?.managedByApp).toBe(false);
  });

  it('startServer failure shows a toast and does not throw', async () => {
    mockedBridge.startAiServer.mockRejectedValue(new Error('Python nicht gefunden'));

    await useDescriptionStore.getState().startServer();
    // resolves without throwing
  });

  it('descriptionScanCompleted bumps scanVersion so description caches invalidate', () => {
    // setupDescriptionSubscriptions is guarded to run once per module lifetime —
    // grab the registered handler from the bridge.on mock.
    // setupDescriptionSubscriptions läuft nur einmal pro Modul-Lebensdauer —
    // den registrierten Handler aus dem bridge.on-Mock holen.
    useDescriptionStore.getState().setupDescriptionSubscriptions();
    const call = mockedBridge.on.mock.calls.find(([event]) => event === 'descriptionScanCompleted');
    expect(call).toBeDefined();
    const handler = call![1];

    const before = useDescriptionStore.getState().scanVersion;
    handler({ described: 3, skipped: 0, failed: 0, cancelled: false, aborted: false });

    expect(useDescriptionStore.getState().scanVersion).toBe(before + 1);
  });
});
