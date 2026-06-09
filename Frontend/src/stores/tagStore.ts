import { create } from 'zustand';
import type { TagCategory, TagSubcategory, TagLibrary, RawImportCategory, RawImportSubcategory } from '../types';
import { bridge } from '../services/bridge';
import { useAppStore } from './appStore';

const generateId = () => crypto.randomUUID();
const STORAGE_KEY = 'tagfusion-tag-library';

const serializeLibrary = (categories: TagCategory[]): TagLibrary => ({
  version: '1.0',
  exportDate: new Date().toISOString(),
  categories,
});

const saveTagLibraryToLocalStorage = (categories: TagCategory[]) => {
  if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeLibrary(categories)));
  }
};

const loadTagLibrary = (): TagCategory[] => {
  try {
    const saved =
      typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function'
        ? localStorage.getItem(STORAGE_KEY)
        : null;

    if (!saved) return [];

    const library: TagLibrary = JSON.parse(saved);
    return library.categories.map((cat) => ({
      ...cat,
      id: cat.id || generateId(),
      subcategories: cat.subcategories.map((sub) => ({
        ...sub,
        id: sub.id || generateId(),
      })),
    }));
  } catch {
    return [];
  }
};

const persistTagLibrary = async (categories: TagCategory[]) => {
  const library = serializeLibrary(categories);
  const saved = await bridge.saveTagLibrary(library);

  if (!saved) {
    throw new Error('Tag-Bibliothek konnte nicht gespeichert werden.');
  }

  try {
    saveTagLibraryToLocalStorage(categories);
  } catch {
    // Ignore — localStorage may be unavailable in tests.
  }
};

const reportTagStoreError = (error: unknown) => {
  useAppStore.getState().setError((error as Error).message);
};

const tryPersistTagLibrary = async (categories: TagCategory[]) => {
  try {
    await persistTagLibrary(categories);
    return true;
  } catch (error) {
    reportTagStoreError(error);
    return false;
  }
};

const updateCategory = (
  categories: TagCategory[],
  categoryId: string,
  update: (category: TagCategory) => TagCategory
) => categories.map((cat) => (cat.id === categoryId ? update(cat) : cat));

const updateSubcategory = (
  categories: TagCategory[],
  categoryId: string,
  subId: string,
  update: (subcategory: TagSubcategory) => TagSubcategory
) =>
  updateCategory(categories, categoryId, (cat) => ({
    ...cat,
    subcategories: cat.subcategories.map((sub) => (sub.id === subId ? update(sub) : sub)),
  }));

interface TagStore {
  categories: TagCategory[];
  isModalOpen: boolean;

  openModal: () => void;
  closeModal: () => void;

  addCategory: (name: string) => Promise<void>;
  renameCategory: (id: string, name: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  toggleCategoryExpand: (id: string) => void;

  addSubcategory: (categoryId: string, name: string) => Promise<void>;
  renameSubcategory: (categoryId: string, subId: string, name: string) => Promise<void>;
  deleteSubcategory: (categoryId: string, subId: string) => Promise<void>;

  addTag: (categoryId: string, subId: string, tag: string) => Promise<void>;
  removeTag: (categoryId: string, subId: string, tag: string) => Promise<void>;

  reorderCategories: (startIndex: number, endIndex: number) => Promise<void>;
  reorderSubcategories: (categoryId: string, startIndex: number, endIndex: number) => Promise<void>;
  reorderTags: (categoryId: string, subId: string, startIndex: number, endIndex: number) => Promise<void>;

  importLibrary: (json: string) => Promise<boolean>;
  exportLibrary: () => string;

  initialize: () => Promise<void>;
}

export const useTagStore = create<TagStore>((set, get) => ({
  categories: loadTagLibrary(),
  isModalOpen: false,

  initialize: async () => {
    const { categories } = get();
    if (categories.length > 0) return;

    try {
      const library = await bridge.getTagLibrary();
      if (library) {
        await get().importLibrary(JSON.stringify(library));
      }
    } catch (error) {
      reportTagStoreError(error);
    }
  },

  openModal: () => set({ isModalOpen: true }),
  closeModal: () => set({ isModalOpen: false }),

  addCategory: async (name) => {
    const { categories } = get();
    const updated = [...categories, { id: generateId(), name, subcategories: [], isExpanded: true }];

    if (await tryPersistTagLibrary(updated)) {
      set({ categories: updated });
    }
  },

  renameCategory: async (id, name) => {
    const { categories } = get();
    const updated = categories.map((cat) => (cat.id === id ? { ...cat, name } : cat));

    if (await tryPersistTagLibrary(updated)) {
      set({ categories: updated });
    }
  },

  deleteCategory: async (id) => {
    const { categories } = get();
    const updated = categories.filter((cat) => cat.id !== id);

    if (await tryPersistTagLibrary(updated)) {
      set({ categories: updated });
    }
  },

  toggleCategoryExpand: (id) => {
    const { categories } = get();
    const updated = categories.map((cat) => (cat.id === id ? { ...cat, isExpanded: !cat.isExpanded } : cat));
    set({ categories: updated });
  },

  addSubcategory: async (categoryId, name) => {
    const { categories } = get();
    const newSub: TagSubcategory = { id: generateId(), name, tags: [] };
    const updated = updateCategory(categories, categoryId, (cat) => ({
      ...cat,
      subcategories: [...cat.subcategories, newSub],
    }));

    if (await tryPersistTagLibrary(updated)) {
      set({ categories: updated });
    }
  },

  renameSubcategory: async (categoryId, subId, name) => {
    const { categories } = get();
    const updated = updateSubcategory(categories, categoryId, subId, (sub) => ({ ...sub, name }));

    if (await tryPersistTagLibrary(updated)) {
      set({ categories: updated });
    }
  },

  deleteSubcategory: async (categoryId, subId) => {
    const { categories } = get();
    const updated = updateCategory(categories, categoryId, (cat) => ({
      ...cat,
      subcategories: cat.subcategories.filter((sub) => sub.id !== subId),
    }));

    if (await tryPersistTagLibrary(updated)) {
      set({ categories: updated });
    }
  },

  addTag: async (categoryId, subId, tag) => {
    const { categories } = get();
    const updated = updateSubcategory(categories, categoryId, subId, (sub) =>
      sub.tags.includes(tag) ? sub : { ...sub, tags: [...sub.tags, tag] }
    );

    if (await tryPersistTagLibrary(updated)) {
      set({ categories: updated });
    }
  },

  removeTag: async (categoryId, subId, tag) => {
    const { categories } = get();
    const updated = updateSubcategory(categories, categoryId, subId, (sub) => ({
      ...sub,
      tags: sub.tags.filter((t) => t !== tag),
    }));

    if (await tryPersistTagLibrary(updated)) {
      set({ categories: updated });
    }
  },

  reorderCategories: async (startIndex, endIndex) => {
    const { categories } = get();
    const updated = Array.from(categories);
    const [removed] = updated.splice(startIndex, 1);
    updated.splice(endIndex, 0, removed);

    if (await tryPersistTagLibrary(updated)) {
      set({ categories: updated });
    }
  },

  reorderSubcategories: async (categoryId, startIndex, endIndex) => {
    const { categories } = get();
    const updated = categories.map((cat) => {
      if (cat.id !== categoryId) return cat;
      const subs = Array.from(cat.subcategories);
      const [removed] = subs.splice(startIndex, 1);
      subs.splice(endIndex, 0, removed);
      return { ...cat, subcategories: subs };
    });

    if (await tryPersistTagLibrary(updated)) {
      set({ categories: updated });
    }
  },

  reorderTags: async (categoryId, subId, startIndex, endIndex) => {
    const { categories } = get();
    const updated = categories.map((cat) => {
      if (cat.id !== categoryId) return cat;
      return {
        ...cat,
        subcategories: cat.subcategories.map((sub) => {
          if (sub.id !== subId) return sub;
          const tags = Array.from(sub.tags);
          const [removed] = tags.splice(startIndex, 1);
          tags.splice(endIndex, 0, removed);
          return { ...sub, tags };
        }),
      };
    });

    if (await tryPersistTagLibrary(updated)) {
      set({ categories: updated });
    }
  },

  importLibrary: async (json) => {
    try {
      const data = JSON.parse(json);
      const rawCategories = data.categories || data;
      if (!Array.isArray(rawCategories)) return false;

      const categories: TagCategory[] = (rawCategories as RawImportCategory[]).map((cat: RawImportCategory) => ({
        id: cat.id || generateId(),
        name: cat.name || 'Unbenannte Kategorie',
        isExpanded: true,
        subcategories: (cat.subcategories || []).map((sub: RawImportSubcategory) => ({
          id: sub.id || generateId(),
          name: sub.name || 'Unbenannte Unterkategorie',
          tags: sub.tags || [],
        })),
      }));

      await persistTagLibrary(categories);
      set({ categories });
      return true;
    } catch (e) {
      reportTagStoreError(e);
      return false;
    }
  },

  exportLibrary: () => {
    const { categories } = get();
    return JSON.stringify(
      {
        version: '1.0',
        exportDate: new Date().toISOString(),
        categories: categories.map(({ id, name, subcategories }) => ({
          id,
          name,
          subcategories: subcategories.map(({ id, name, tags }) => ({ id, name, tags })),
        })),
      },
      null,
      2
    );
  },
}));
