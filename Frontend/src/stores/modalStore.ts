import { create } from 'zustand';

// ============================================================================
// DISCRIMINATED UNION — Type-safe modal data via ModalDataMap
// openModal('rename', { ... }) enforces correct data shape at call-site
// ============================================================================

export interface RenameData {
  path: string;
  name: string;
  isFolder: boolean;
}

export interface DeleteConfirmData {
  paths: string[];
}

export interface PropertiesData {
  path: string;
}

export interface TagLibraryImportConfirmData {
  /**
   * Categories in the current library — all of them are replaced by the import.
   * Kategorien der aktuellen Bibliothek — sie werden vom Import komplett ersetzt.
   */
  categoryCount: number;
}

/** Maps each modal type to its required data shape */
export interface ModalDataMap {
  rename: RenameData;
  deleteConfirm: DeleteConfirmData;
  properties: PropertiesData;
  tagLibraryImportConfirm: TagLibraryImportConfirmData;
}

export type ModalType = keyof ModalDataMap;

interface ModalState {
  type: ModalType | null;
  data: ModalDataMap[ModalType] | null;

  // Type-safe openModal — ensures data matches modal type
  openModal: <T extends ModalType>(type: T, data: ModalDataMap[T]) => void;
  closeModal: () => void;
}

export const useModalStore = create<ModalState>((set) => ({
  type: null,
  data: null,

  openModal: (type, data) => set({ type, data }),
  closeModal: () => set({ type: null, data: null }),
}));
