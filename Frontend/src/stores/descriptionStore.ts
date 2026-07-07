import { create } from 'zustand';
import { bridge } from '../services/bridge';
import type { AiServerStatusInfo, DescriptionPrecheck } from '../types';
import { DESCRIPTION_PROMPTS } from '../constants/descriptionPrompts';
import { useToastStore } from './toastStore';

let subscriptionsInitialized = false;
let statusPollTimer: ReturnType<typeof setInterval> | null = null;

const STORAGE_KEY = 'tagfusion.descriptionDialog';
const STATUS_POLL_MS = 2000;

function loadLastChoice(): { model: string; prompt: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as { model: string; prompt: string };
  } catch {
    // ignore broken storage / defekten Speicher ignorieren
  }
  return { model: '', prompt: DESCRIPTION_PROMPTS[0].text };
}

function saveLastChoice(model: string, prompt: string): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ model, prompt }));
}

interface DescriptionState {
  isDialogOpen: boolean;
  serverStatus: AiServerStatusInfo | null;
  precheck: DescriptionPrecheck | null;
  isScanning: boolean;
  progress: { current: number; total: number; described: number } | null;
  selectedModel: string;
  promptText: string;
  overwriteExisting: boolean;

  openDialog: (path: string) => Promise<void>;
  closeDialog: () => void;
  setModel: (model: string) => void;
  setPrompt: (prompt: string) => void;
  setOverwrite: (overwrite: boolean) => void;
  startScan: (path: string) => Promise<void>;
  cancelScan: () => Promise<void>;
  setupDescriptionSubscriptions: () => void;
}

export const useDescriptionStore = create<DescriptionState>((set, get) => ({
  isDialogOpen: false,
  serverStatus: null,
  precheck: null,
  isScanning: false,
  progress: null,
  selectedModel: loadLastChoice().model,
  promptText: loadLastChoice().prompt,
  overwriteExisting: false,

  openDialog: async (path) => {
    set({ isDialogOpen: true, serverStatus: null, precheck: null });
    try {
      const [status, precheck] = await Promise.all([
        bridge.getAiServerStatus(),
        bridge.getDescriptionPrecheck(path),
      ]);
      // Preselect the remembered model when still available, else the first.
      // Gemerktes Modell vorwählen, wenn verfügbar — sonst das erste.
      const remembered = get().selectedModel;
      const model = status.models.includes(remembered) ? remembered : (status.models[0] ?? '');
      set({ serverStatus: status, precheck, selectedModel: model });
    } catch (error) {
      useToastStore.getState().warning((error as Error).message);
      set({ serverStatus: { reachable: false, state: 'unreachable', model: '', progress: -1, message: '', models: [] } });
    }

    // Poll /status while the dialog is open so model load/download progress ticks live.
    // Status-Polling, solange der Dialog offen ist — Ladefortschritt tickt live.
    if (statusPollTimer !== null) clearInterval(statusPollTimer);
    statusPollTimer = setInterval(() => {
      if (!get().isDialogOpen) return;
      void bridge.getAiServerStatus()
        .then((status) => {
          const current = get();
          const model = status.models.includes(current.selectedModel)
            ? current.selectedModel
            : (status.models[0] ?? '');
          set({ serverStatus: status, selectedModel: model });
        })
        .catch(() => { /* transient poll errors stay silent / stille Poll-Fehler */ });
    }, STATUS_POLL_MS);
  },

  closeDialog: () => {
    if (statusPollTimer !== null) {
      clearInterval(statusPollTimer);
      statusPollTimer = null;
    }
    set({ isDialogOpen: false });
  },

  setModel: (model) => {
    set({ selectedModel: model });
    saveLastChoice(model, get().promptText);
  },

  setPrompt: (prompt) => {
    set({ promptText: prompt });
    saveLastChoice(get().selectedModel, prompt);
  },

  setOverwrite: (overwrite) => set({ overwriteExisting: overwrite }),

  startScan: async (path) => {
    const { selectedModel, promptText, overwriteExisting } = get();
    set({ isScanning: true, progress: null, isDialogOpen: false });
    try {
      await bridge.startDescriptionScan(path, selectedModel, promptText, overwriteExisting);
    } catch (error) {
      set({ isScanning: false });
      useToastStore.getState().warning((error as Error).message);
    }
  },

  cancelScan: async () => {
    try {
      await bridge.cancelDescriptionScan();
    } catch (error) {
      useToastStore.getState().warning((error as Error).message);
    }
  },

  setupDescriptionSubscriptions: () => {
    if (subscriptionsInitialized) return;
    subscriptionsInitialized = true;

    bridge.on('descriptionScanProgress', (data) => {
      const { current, total, described } = data as { current: number; total: number; described: number };
      set({ progress: { current, total, described } });
    });

    bridge.on('descriptionScanCompleted', (data) => {
      const { described, skipped, failed, cancelled, aborted } = data as {
        described: number; skipped: number; failed: number; cancelled: boolean; aborted: boolean;
      };
      set({ isScanning: false, progress: null });
      const toast = useToastStore.getState();
      if (cancelled) {
        toast.warning(`Beschreiben abgebrochen — ${described} Bilder beschrieben`);
        return;
      }
      if (aborted) {
        toast.warning(`KI-Server antwortet nicht mehr — Lauf abgebrochen. ${described} Bilder beschrieben.`);
        return;
      }
      if (failed > 0) {
        toast.warning(`Fertig: ${described} beschrieben, ${skipped} übersprungen, ${failed} fehlgeschlagen`);
      } else {
        toast.success(`Fertig: ${described} beschrieben, ${skipped} übersprungen`);
      }
    });
  },
}));
