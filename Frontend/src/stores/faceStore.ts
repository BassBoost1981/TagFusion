import { create } from 'zustand';
import { bridge } from '../services/bridge';
import type { FaceReview, Person } from '../types';
import { useAppStore } from './appStore';
import { useToastStore } from './toastStore';

let subscriptionsInitialized = false;

interface FaceState {
  engineAvailable: boolean | null; // null = not yet checked / noch nicht geprüft
  isScanning: boolean;
  progress: { current: number; total: number; faces: number } | null;
  review: FaceReview | null;
  isPanelOpen: boolean;
  persons: Person[];

  checkEngine: () => Promise<void>;
  startScan: (path: string) => Promise<void>;
  cancelScan: () => Promise<void>;
  loadReview: (path: string) => Promise<void>;
  confirmGroup: (faceIds: number[], personName: string, path: string) => Promise<void>;
  rejectSuggestion: (faceIds: number[], path: string) => Promise<void>;
  ignoreGroup: (faceIds: number[], path: string) => Promise<void>;
  closePanel: () => void;
  setupFaceSubscriptions: (getCurrentFolder: () => string | null) => void;
}

export const useFaceStore = create<FaceState>((set, get) => ({
  engineAvailable: null,
  isScanning: false,
  progress: null,
  review: null,
  isPanelOpen: false,
  persons: [],

  checkEngine: async () => {
    try {
      const health = await bridge.healthCheck();
      set({ engineAvailable: health.faceEngineOk });
    } catch {
      set({ engineAvailable: false });
    }
  },

  startScan: async (path) => {
    try {
      set({ isScanning: true, progress: null });
      await bridge.scanFacesInFolder(path);
    } catch (error) {
      set({ isScanning: false });
      useToastStore.getState().warning((error as Error).message);
    }
  },

  cancelScan: async () => {
    try {
      await bridge.cancelFaceScan();
    } catch (error) {
      useToastStore.getState().warning((error as Error).message);
    }
  },

  loadReview: async (path) => {
    try {
      const [review, persons] = await Promise.all([bridge.getFaceReview(path), bridge.getPersons()]);
      set({ review, persons, isPanelOpen: true });
    } catch (error) {
      useToastStore.getState().warning((error as Error).message);
    }
  },

  confirmGroup: async (faceIds, personName, path) => {
    try {
      const result = await bridge.confirmFaceGroup(faceIds, personName);
      const toast = useToastStore.getState();
      if (result.failed > 0) {
        toast.warning(`${result.tagged} Bilder getaggt, ${result.failed} fehlgeschlagen`);
      } else {
        toast.success(`${result.tagged} Bilder mit "${personName}" getaggt`);
      }
      await get().loadReview(path);
    } catch (error) {
      useToastStore.getState().warning((error as Error).message);
    }
  },

  rejectSuggestion: async (faceIds, path) => {
    try {
      await bridge.rejectFaceSuggestion(faceIds);
      await get().loadReview(path);
    } catch (error) {
      useToastStore.getState().warning((error as Error).message);
    }
  },

  ignoreGroup: async (faceIds, path) => {
    try {
      await bridge.ignoreFaces(faceIds);
      await get().loadReview(path);
    } catch (error) {
      useToastStore.getState().warning((error as Error).message);
    }
  },

  closePanel: () => set({ isPanelOpen: false, review: null }),

  setupFaceSubscriptions: (getCurrentFolder) => {
    if (subscriptionsInitialized) return;
    subscriptionsInitialized = true;

    bridge.on('faceScanProgress', (data) => {
      const { current, total, faces } = data as { current: number; total: number; faces: number };
      set({ progress: { current, total, faces } });
    });

    bridge.on('faceScanCompleted', (data) => {
      const { scanned, faces, skipped, cancelled } = data as {
        scanned: number; faces: number; skipped: number; cancelled: boolean;
      };
      set({ isScanning: false, progress: null });
      // Reload the current folder so the status badges appear without re-navigating.
      // Runs in every completion case — partial results after cancel count too.
      // Aktuellen Ordner neu laden, damit Status-Badges ohne Ordnerwechsel erscheinen.
      // Läuft in jedem Abschlussfall — Teilergebnisse nach Abbruch zählen auch.
      void useAppStore.getState().refreshImages();
      const toast = useToastStore.getState();
      if (cancelled) {
        toast.warning('Gesichter-Scan abgebrochen');
        return;
      }
      if (skipped > 0) {
        toast.warning(`Scan fertig: ${faces} Gesichter in ${scanned} Bildern, ${skipped} übersprungen`);
      } else {
        toast.success(`Scan fertig: ${faces} Gesichter in ${scanned} Bildern`);
      }
      const folder = getCurrentFolder();
      if (folder) void get().loadReview(folder);
    });
  },
}));
