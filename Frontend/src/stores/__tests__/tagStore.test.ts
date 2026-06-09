import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useTagStore } from '../tagStore';
import { bridge } from '../../services/bridge';

vi.mock('../../services/bridge', () => ({
  bridge: {
    saveTagLibrary: vi.fn().mockResolvedValue(true),
    getTagLibrary: vi.fn().mockResolvedValue(null),
    getFolderContents: vi.fn(),
    writeTags: vi.fn(),
    setRating: vi.fn(),
  },
}));

const mockedBridge = vi.mocked(bridge);

const createTreePath = async () => {
  await useTagStore.getState().addCategory('Natur');
  const catId = useTagStore.getState().categories[0].id;
  await useTagStore.getState().addSubcategory(catId, 'Bäume');
  const subId = useTagStore.getState().categories[0].subcategories[0].id;

  return { catId, subId };
};

const getFirstSubcategoryTags = () => useTagStore.getState().categories[0].subcategories[0].tags;

describe('tagStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTagStore.setState({ categories: [], isModalOpen: false });
  });

  it('addCategory creates a new category', async () => {
    await useTagStore.getState().addCategory('Natur');
    const cats = useTagStore.getState().categories;
    expect(cats).toHaveLength(1);
    expect(cats[0].name).toBe('Natur');
    expect(cats[0].subcategories).toEqual([]);
    expect(cats[0].id).toBeDefined();
  });

  it('renameCategory updates the name', async () => {
    await useTagStore.getState().addCategory('Alt');
    const id = useTagStore.getState().categories[0].id;
    await useTagStore.getState().renameCategory(id, 'Neu');
    expect(useTagStore.getState().categories[0].name).toBe('Neu');
  });

  it('deleteCategory removes the category', async () => {
    await useTagStore.getState().addCategory('Temp');
    const id = useTagStore.getState().categories[0].id;
    await useTagStore.getState().deleteCategory(id);
    expect(useTagStore.getState().categories).toHaveLength(0);
  });

  it('addSubcategory adds to correct category', async () => {
    await useTagStore.getState().addCategory('Natur');
    const catId = useTagStore.getState().categories[0].id;
    await useTagStore.getState().addSubcategory(catId, 'Landschaften');

    const subs = useTagStore.getState().categories[0].subcategories;
    expect(subs).toHaveLength(1);
    expect(subs[0].name).toBe('Landschaften');
    expect(subs[0].tags).toEqual([]);
  });

  it('deleteSubcategory removes correct subcategory', async () => {
    await useTagStore.getState().addCategory('Natur');
    const catId = useTagStore.getState().categories[0].id;
    await useTagStore.getState().addSubcategory(catId, 'A');
    await useTagStore.getState().addSubcategory(catId, 'B');
    const subIdA = useTagStore.getState().categories[0].subcategories[0].id;
    await useTagStore.getState().deleteSubcategory(catId, subIdA);

    const subs = useTagStore.getState().categories[0].subcategories;
    expect(subs).toHaveLength(1);
    expect(subs[0].name).toBe('B');
  });

  it('addTag adds a tag to subcategory', async () => {
    const { catId, subId } = await createTreePath();

    await useTagStore.getState().addTag(catId, subId, 'Eiche');
    expect(getFirstSubcategoryTags()).toEqual(['Eiche']);
  });

  it('addTag prevents duplicates', async () => {
    const { catId, subId } = await createTreePath();

    await useTagStore.getState().addTag(catId, subId, 'Eiche');
    await useTagStore.getState().addTag(catId, subId, 'Eiche');
    expect(getFirstSubcategoryTags()).toEqual(['Eiche']);
  });

  it('removeTag removes the correct tag', async () => {
    const { catId, subId } = await createTreePath();

    await useTagStore.getState().addTag(catId, subId, 'Eiche');
    await useTagStore.getState().addTag(catId, subId, 'Birke');
    await useTagStore.getState().removeTag(catId, subId, 'Eiche');
    expect(getFirstSubcategoryTags()).toEqual(['Birke']);
  });

  it('importLibrary parses valid JSON with categories wrapper', async () => {
    const json = JSON.stringify({
      version: '1.0',
      exportDate: '2025-01-01',
      categories: [{ name: 'Natur', subcategories: [{ name: 'Bäume', tags: ['Eiche'] }] }],
    });
    const result = await useTagStore.getState().importLibrary(json);
    expect(result).toBe(true);
    expect(useTagStore.getState().categories).toHaveLength(1);
    expect(useTagStore.getState().categories[0].subcategories[0].tags).toEqual(['Eiche']);
  });

  it('importLibrary rejects invalid JSON', async () => {
    const result = await useTagStore.getState().importLibrary('not json');
    expect(result).toBe(false);
  });

  it('importLibrary rejects non-array categories', async () => {
    const result = await useTagStore.getState().importLibrary('{"categories": "nope"}');
    expect(result).toBe(false);
  });

  it('exportLibrary produces valid JSON', async () => {
    await useTagStore.getState().addCategory('Test');
    const json = useTagStore.getState().exportLibrary();
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe('1.0');
    expect(parsed.categories).toHaveLength(1);
    expect(parsed.categories[0].name).toBe('Test');
  });

  it('does not mutate categories when backend persistence fails', async () => {
    mockedBridge.saveTagLibrary.mockResolvedValueOnce(false);

    await useTagStore.getState().addCategory('Fehlerfall');

    expect(useTagStore.getState().categories).toHaveLength(0);
  });

  it('openModal / closeModal toggles state', () => {
    useTagStore.getState().openModal();
    expect(useTagStore.getState().isModalOpen).toBe(true);
    useTagStore.getState().closeModal();
    expect(useTagStore.getState().isModalOpen).toBe(false);
  });
});
