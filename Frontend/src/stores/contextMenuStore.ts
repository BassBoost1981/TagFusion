import { create } from 'zustand';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}

export interface ContextMenuSection {
  items: ContextMenuItem[];
}

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  sections: ContextMenuSection[];

  // Actions
  show: (x: number, y: number, sections: ContextMenuSection[]) => void;
  hide: () => void;
}

export const useContextMenuStore = create<ContextMenuState>((set) => ({
  isOpen: false,
  x: 0,
  y: 0,
  sections: [],

  show: (x, y, sections) => set({ isOpen: true, x, y, sections }),
  hide: () => set({ isOpen: false, sections: [] }),
}));
