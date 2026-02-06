import { create } from 'zustand';

export type ModalType = 'rename' | 'deleteConfirm' | 'properties' | null;

interface RenameData {
  path: string;
  name: string;
  isFolder: boolean;
}

interface DeleteConfirmData {
  paths: string[];
}

interface PropertiesData {
  path: string;
}

export type ModalData = RenameData | DeleteConfirmData | PropertiesData | null;

interface ModalState {
  type: ModalType;
  data: ModalData;

  // Actions
  openModal: (type: ModalType, data: ModalData) => void;
  closeModal: () => void;
}

export const useModalStore = create<ModalState>((set) => ({
  type: null,
  data: null,

  openModal: (type, data) => set({ type, data }),
  closeModal: () => set({ type: null, data: null }),
}));
