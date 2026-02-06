import { create } from 'zustand';
import type { TagCategory, TagSubcategory, TagLibrary, RawImportCategory, RawImportSubcategory } from '../types';
import { bridge } from '../services/bridge';

// Generate unique ID
const generateId = () => crypto.randomUUID();

// LocalStorage key
const STORAGE_KEY = 'tagfusion-tag-library';

// Load from localStorage
const loadTagLibrary = (): TagCategory[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const library: TagLibrary = JSON.parse(saved);
      return library.categories.map(cat => ({
        ...cat,
        id: cat.id || generateId(),
        subcategories: cat.subcategories.map(sub => ({
          ...sub,
          id: sub.id || generateId(),
        })),
      }));
    }
  } catch (e) {
    console.error('Failed to load tag library:', e);
  }
  return [];
};

// Save to localStorage and Backend
const saveTagLibrary = (categories: TagCategory[]) => {
  const library: TagLibrary = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    categories,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(library));

  // Save to backend (fire and forget)
  bridge.saveTagLibrary(library).catch(err => {
    console.error('Failed to save tag library to backend:', err);
  });
};

interface TagStore {
  // State
  categories: TagCategory[];
  isModalOpen: boolean;

  // Modal
  openModal: () => void;
  closeModal: () => void;

  // Category CRUD
  addCategory: (name: string) => void;
  renameCategory: (id: string, name: string) => void;
  deleteCategory: (id: string) => void;
  toggleCategoryExpand: (id: string) => void;

  // Subcategory CRUD
  addSubcategory: (categoryId: string, name: string) => void;
  renameSubcategory: (categoryId: string, subId: string, name: string) => void;
  deleteSubcategory: (categoryId: string, subId: string) => void;

  // Tag CRUD
  addTag: (categoryId: string, subId: string, tag: string) => void;
  removeTag: (categoryId: string, subId: string, tag: string) => void;

  // Reorder
  reorderCategories: (startIndex: number, endIndex: number) => void;
  reorderSubcategories: (categoryId: string, startIndex: number, endIndex: number) => void;
  reorderTags: (categoryId: string, subId: string, startIndex: number, endIndex: number) => void;

  // Import/Export
  importLibrary: (json: string) => boolean;
  exportLibrary: () => string;

  // Initialization
  initialize: () => Promise<void>;
}

export const useTagStore = create<TagStore>((set, get) => ({
  categories: loadTagLibrary(),
  isModalOpen: false,

  initialize: async () => {
    const { categories } = get();
    if (categories.length === 0) {
      try {
        const library = await bridge.getTagLibrary();
        if (library) {
          get().importLibrary(JSON.stringify(library));
        }
      } catch (error) {
        console.error('Failed to initialize tag library from backend:', error);
      }
    }
  },

  openModal: () => set({ isModalOpen: true }),
  closeModal: () => set({ isModalOpen: false }),

  addCategory: (name) => {
    const { categories } = get();
    const newCategory: TagCategory = {
      id: generateId(),
      name,
      subcategories: [],
      isExpanded: true,
    };
    const updated = [...categories, newCategory];
    saveTagLibrary(updated);
    set({ categories: updated });
  },

  renameCategory: (id, name) => {
    const { categories } = get();
    const updated = categories.map(cat =>
      cat.id === id ? { ...cat, name } : cat
    );
    saveTagLibrary(updated);
    set({ categories: updated });
  },

  deleteCategory: (id) => {
    const { categories } = get();
    const updated = categories.filter(cat => cat.id !== id);
    saveTagLibrary(updated);
    set({ categories: updated });
  },

  toggleCategoryExpand: (id) => {
    const { categories } = get();
    const updated = categories.map(cat =>
      cat.id === id ? { ...cat, isExpanded: !cat.isExpanded } : cat
    );
    set({ categories: updated });
  },

  addSubcategory: (categoryId, name) => {
    const { categories } = get();
    const newSub: TagSubcategory = { id: generateId(), name, tags: [] };
    const updated = categories.map(cat =>
      cat.id === categoryId
        ? { ...cat, subcategories: [...cat.subcategories, newSub] }
        : cat
    );
    saveTagLibrary(updated);
    set({ categories: updated });
  },

  renameSubcategory: (categoryId, subId, name) => {
    const { categories } = get();
    const updated = categories.map(cat =>
      cat.id === categoryId
        ? {
          ...cat,
          subcategories: cat.subcategories.map(sub =>
            sub.id === subId ? { ...sub, name } : sub
          ),
        }
        : cat
    );
    saveTagLibrary(updated);
    set({ categories: updated });
  },

  deleteSubcategory: (categoryId, subId) => {
    const { categories } = get();
    const updated = categories.map(cat =>
      cat.id === categoryId
        ? { ...cat, subcategories: cat.subcategories.filter(sub => sub.id !== subId) }
        : cat
    );
    saveTagLibrary(updated);
    set({ categories: updated });
  },

  addTag: (categoryId, subId, tag) => {
    const { categories } = get();
    const updated = categories.map(cat =>
      cat.id === categoryId
        ? {
          ...cat,
          subcategories: cat.subcategories.map(sub =>
            sub.id === subId && !sub.tags.includes(tag)
              ? { ...sub, tags: [...sub.tags, tag] }
              : sub
          ),
        }
        : cat
    );
    saveTagLibrary(updated);
    set({ categories: updated });
  },

  removeTag: (categoryId, subId, tag) => {
    const { categories } = get();
    const updated = categories.map(cat =>
      cat.id === categoryId
        ? {
          ...cat,
          subcategories: cat.subcategories.map(sub =>
            sub.id === subId
              ? { ...sub, tags: sub.tags.filter(t => t !== tag) }
              : sub
          ),
        }
        : cat
    );
    saveTagLibrary(updated);
    set({ categories: updated });
  },

  reorderCategories: (startIndex, endIndex) => {
    const { categories } = get();
    const updated = Array.from(categories);
    const [removed] = updated.splice(startIndex, 1);
    updated.splice(endIndex, 0, removed);
    saveTagLibrary(updated);
    set({ categories: updated });
  },

  reorderSubcategories: (categoryId, startIndex, endIndex) => {
    const { categories } = get();
    const updated = categories.map(cat => {
      if (cat.id !== categoryId) return cat;
      const subs = Array.from(cat.subcategories);
      const [removed] = subs.splice(startIndex, 1);
      subs.splice(endIndex, 0, removed);
      return { ...cat, subcategories: subs };
    });
    saveTagLibrary(updated);
    set({ categories: updated });
  },

  reorderTags: (categoryId, subId, startIndex, endIndex) => {
    const { categories } = get();
    const updated = categories.map(cat => {
      if (cat.id !== categoryId) return cat;
      return {
        ...cat,
        subcategories: cat.subcategories.map(sub => {
          if (sub.id !== subId) return sub;
          const tags = Array.from(sub.tags);
          const [removed] = tags.splice(startIndex, 1);
          tags.splice(endIndex, 0, removed);
          return { ...sub, tags };
        }),
      };
    });
    saveTagLibrary(updated);
    set({ categories: updated });
  },

  importLibrary: (json) => {
    try {
      const data = JSON.parse(json);
      // Support both formats: with 'categories' array or direct array
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

      saveTagLibrary(categories);
      set({ categories });
      return true;
    } catch (e) {
      console.error('Failed to import library:', e);
      return false;
    }
  },

  exportLibrary: () => {
    const { categories } = get();
    const library: TagLibrary = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      categories: categories.map(({ id, name, subcategories }) => ({
        id,
        name,
        subcategories: subcategories.map(({ id, name, tags }) => ({ id, name, tags })),
      })),
    };
    return JSON.stringify(library, null, 2);
  },
}));

