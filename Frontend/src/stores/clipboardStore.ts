import { create } from 'zustand';
import { bridge } from '../services/bridge';

interface ClipboardItem {
  path: string;
  isFolder: boolean;
}

interface ClipboardState {
  items: ClipboardItem[];
  operation: 'copy' | 'cut' | null;

  // Actions
  copy: (items: ClipboardItem[]) => void;
  cut: (items: ClipboardItem[]) => void;
  paste: (targetFolderPath: string) => Promise<void>;
  clear: () => void;
  hasItems: () => boolean;
}

export const useClipboardStore = create<ClipboardState>((set, get) => ({
  items: [],
  operation: null,

  copy: (items) => set({ items, operation: 'copy' }),
  cut: (items) => set({ items, operation: 'cut' }),

  paste: async (targetFolderPath) => {
    const { items, operation, clear } = get();
    if (!items.length || !operation) return;

    const paths = items.map(i => i.path);

    try {
      if (operation === 'copy') {
        await bridge.copyFiles(paths, targetFolderPath);
      } else {
        await bridge.moveFiles(paths, targetFolderPath);
        clear(); // Clear clipboard after moving
      }
    } catch (error) {
      console.error('Paste operation failed:', error);
      throw error;
    }
  },

  clear: () => set({ items: [], operation: null }),
  hasItems: () => get().items.length > 0,
}));
