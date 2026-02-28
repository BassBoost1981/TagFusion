import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useTagStore } from '../tagStore'

// Mock bridge service
vi.mock('../../services/bridge', () => ({
  bridge: {
    saveTagLibrary: vi.fn().mockResolvedValue(true),
    getTagLibrary: vi.fn().mockResolvedValue(null),
    getFolderContents: vi.fn(),
    writeTags: vi.fn(),
    setRating: vi.fn(),
  }
}))

describe('tagStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useTagStore.setState({ categories: [], isModalOpen: false })
  })

  // ========================================================================
  // Category CRUD
  // ========================================================================

  it('addCategory creates a new category', () => {
    useTagStore.getState().addCategory('Natur')
    const cats = useTagStore.getState().categories
    expect(cats).toHaveLength(1)
    expect(cats[0].name).toBe('Natur')
    expect(cats[0].subcategories).toEqual([])
    expect(cats[0].id).toBeDefined()
  })

  it('renameCategory updates the name', () => {
    useTagStore.getState().addCategory('Alt')
    const id = useTagStore.getState().categories[0].id
    useTagStore.getState().renameCategory(id, 'Neu')
    expect(useTagStore.getState().categories[0].name).toBe('Neu')
  })

  it('deleteCategory removes the category', () => {
    useTagStore.getState().addCategory('Temp')
    const id = useTagStore.getState().categories[0].id
    useTagStore.getState().deleteCategory(id)
    expect(useTagStore.getState().categories).toHaveLength(0)
  })

  // ========================================================================
  // Subcategory CRUD
  // ========================================================================

  it('addSubcategory adds to correct category', () => {
    useTagStore.getState().addCategory('Natur')
    const catId = useTagStore.getState().categories[0].id
    useTagStore.getState().addSubcategory(catId, 'Landschaften')

    const subs = useTagStore.getState().categories[0].subcategories
    expect(subs).toHaveLength(1)
    expect(subs[0].name).toBe('Landschaften')
    expect(subs[0].tags).toEqual([])
  })

  it('deleteSubcategory removes correct subcategory', () => {
    useTagStore.getState().addCategory('Natur')
    const catId = useTagStore.getState().categories[0].id
    useTagStore.getState().addSubcategory(catId, 'A')
    useTagStore.getState().addSubcategory(catId, 'B')
    const subIdA = useTagStore.getState().categories[0].subcategories[0].id
    useTagStore.getState().deleteSubcategory(catId, subIdA)

    const subs = useTagStore.getState().categories[0].subcategories
    expect(subs).toHaveLength(1)
    expect(subs[0].name).toBe('B')
  })

  // ========================================================================
  // Tag CRUD
  // ========================================================================

  it('addTag adds a tag to subcategory', () => {
    useTagStore.getState().addCategory('Natur')
    const catId = useTagStore.getState().categories[0].id
    useTagStore.getState().addSubcategory(catId, 'Bäume')
    const subId = useTagStore.getState().categories[0].subcategories[0].id

    useTagStore.getState().addTag(catId, subId, 'Eiche')
    const tags = useTagStore.getState().categories[0].subcategories[0].tags
    expect(tags).toEqual(['Eiche'])
  })

  it('addTag prevents duplicates', () => {
    useTagStore.getState().addCategory('Natur')
    const catId = useTagStore.getState().categories[0].id
    useTagStore.getState().addSubcategory(catId, 'Bäume')
    const subId = useTagStore.getState().categories[0].subcategories[0].id

    useTagStore.getState().addTag(catId, subId, 'Eiche')
    useTagStore.getState().addTag(catId, subId, 'Eiche') // duplicate
    const tags = useTagStore.getState().categories[0].subcategories[0].tags
    expect(tags).toEqual(['Eiche'])
  })

  it('removeTag removes the correct tag', () => {
    useTagStore.getState().addCategory('Natur')
    const catId = useTagStore.getState().categories[0].id
    useTagStore.getState().addSubcategory(catId, 'Bäume')
    const subId = useTagStore.getState().categories[0].subcategories[0].id

    useTagStore.getState().addTag(catId, subId, 'Eiche')
    useTagStore.getState().addTag(catId, subId, 'Birke')
    useTagStore.getState().removeTag(catId, subId, 'Eiche')
    expect(useTagStore.getState().categories[0].subcategories[0].tags).toEqual(['Birke'])
  })

  // ========================================================================
  // Import / Export
  // ========================================================================

  it('importLibrary parses valid JSON with categories wrapper', () => {
    const json = JSON.stringify({
      version: '1.0',
      exportDate: '2025-01-01',
      categories: [
        { name: 'Natur', subcategories: [{ name: 'Bäume', tags: ['Eiche'] }] }
      ]
    })
    const result = useTagStore.getState().importLibrary(json)
    expect(result).toBe(true)
    expect(useTagStore.getState().categories).toHaveLength(1)
    expect(useTagStore.getState().categories[0].subcategories[0].tags).toEqual(['Eiche'])
  })

  it('importLibrary rejects invalid JSON', () => {
    const result = useTagStore.getState().importLibrary('not json')
    expect(result).toBe(false)
  })

  it('importLibrary rejects non-array categories', () => {
    const result = useTagStore.getState().importLibrary('{"categories": "nope"}')
    expect(result).toBe(false)
  })

  it('exportLibrary produces valid JSON', () => {
    useTagStore.getState().addCategory('Test')
    const json = useTagStore.getState().exportLibrary()
    const parsed = JSON.parse(json)
    expect(parsed.version).toBe('1.0')
    expect(parsed.categories).toHaveLength(1)
    expect(parsed.categories[0].name).toBe('Test')
  })

  // ========================================================================
  // Modal
  // ========================================================================

  it('openModal / closeModal toggles state', () => {
    useTagStore.getState().openModal()
    expect(useTagStore.getState().isModalOpen).toBe(true)
    useTagStore.getState().closeModal()
    expect(useTagStore.getState().isModalOpen).toBe(false)
  })
})

