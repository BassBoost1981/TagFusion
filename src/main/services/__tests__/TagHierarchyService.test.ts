import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TagHierarchyService } from '../TagHierarchyService';
import { TagHierarchyNode, HierarchicalTag, AppSettings } from '../../../types/global';

// Mock dependencies
const mockMetadataRepository = {
  extractTags: vi.fn(),
  writeTags: vi.fn(),
  readMetadata: vi.fn(),
  writeMetadata: vi.fn(),
  readEXIFData: vi.fn(),
  writeRating: vi.fn()
};

const mockConfigurationRepository = {
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
  exportConfiguration: vi.fn(),
  importConfiguration: vi.fn()
};

describe('TagHierarchyService', () => {
  let service: TagHierarchyService;
  let mockSettings: AppSettings;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup mock settings
    mockSettings = {
      language: 'en',
      theme: 'light',
      favorites: [],
      tagHierarchy: [
        {
          id: 'nature',
          name: 'Nature',
          parent: undefined,
          children: [
            {
              id: 'landscape',
              name: 'Landscape',
              parent: 'nature',
              children: [
                {
                  id: 'mountains',
                  name: 'Mountains',
                  parent: 'landscape',
                  children: [],
                  level: 2
                },
                {
                  id: 'lakes',
                  name: 'Lakes',
                  parent: 'landscape',
                  children: [],
                  level: 2
                }
              ],
              level: 1
            },
            {
              id: 'wildlife',
              name: 'Wildlife',
              parent: 'nature',
              children: [],
              level: 1
            }
          ],
          level: 0
        },
        {
          id: 'photography',
          name: 'Photography',
          parent: undefined,
          children: [],
          level: 0
        }
      ],
      thumbnailSize: 150,
      viewMode: 'grid'
    };

    mockConfigurationRepository.loadSettings.mockResolvedValue(mockSettings);
    mockConfigurationRepository.saveSettings.mockResolvedValue();

    service = new TagHierarchyService(mockMetadataRepository, mockConfigurationRepository);
    await service.initialize();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('initialization', () => {
    it('should load tag hierarchy from configuration', async () => {
      expect(mockConfigurationRepository.loadSettings).toHaveBeenCalled();
      
      const hierarchy = await service.getTagHierarchy();
      expect(hierarchy).toHaveLength(2);
      expect(hierarchy[0].name).toBe('Nature');
      expect(hierarchy[1].name).toBe('Photography');
    });

    it('should handle missing configuration gracefully', async () => {
      mockConfigurationRepository.loadSettings.mockRejectedValue(new Error('Config not found'));
      
      const newService = new TagHierarchyService(mockMetadataRepository, mockConfigurationRepository);
      await newService.initialize();
      
      const hierarchy = await newService.getTagHierarchy();
      expect(hierarchy).toEqual([]);
    });
  });

  describe('createTag', () => {
    it('should create a root level tag', async () => {
      const newTag = await service.createTag(undefined, 'Events');
      
      expect(newTag.name).toBe('Events');
      expect(newTag.parent).toBeUndefined();
      expect(newTag.level).toBe(0);
      expect(newTag.children).toEqual([]);
      expect(mockConfigurationRepository.saveSettings).toHaveBeenCalled();
    });

    it('should create a child tag', async () => {
      const newTag = await service.createTag('nature', 'Flowers');
      
      expect(newTag.name).toBe('Flowers');
      expect(newTag.parent).toBe('nature');
      expect(newTag.level).toBe(1);
      expect(mockConfigurationRepository.saveSettings).toHaveBeenCalled();
    });

    it('should reject invalid tag names', async () => {
      await expect(service.createTag(undefined, '')).rejects.toThrow('Tag name is required');
      await expect(service.createTag(undefined, 'Tag/With/Slash')).rejects.toThrow('invalid characters');
      await expect(service.createTag(undefined, 'A'.repeat(101))).rejects.toThrow('cannot exceed 100 characters');
    });

    it('should reject duplicate tag names at same level', async () => {
      await expect(service.createTag('nature', 'Landscape')).rejects.toThrow('already exists at this level');
    });

    it('should reject invalid parent ID', async () => {
      await expect(service.createTag('nonexistent', 'Test')).rejects.toThrow('Parent tag with ID "nonexistent" not found');
    });
  });

  describe('updateTag', () => {
    it('should update tag name', async () => {
      const updatedTag = await service.updateTag('photography', 'Photo Art');
      
      expect(updatedTag.name).toBe('Photo Art');
      expect(mockConfigurationRepository.saveSettings).toHaveBeenCalled();
    });

    it('should reject invalid tag names', async () => {
      await expect(service.updateTag('photography', '')).rejects.toThrow('Tag name is required');
    });

    it('should reject duplicate names at same level', async () => {
      await expect(service.updateTag('photography', 'Nature')).rejects.toThrow('already exists at this level');
    });

    it('should reject non-existent tag ID', async () => {
      await expect(service.updateTag('nonexistent', 'Test')).rejects.toThrow('Tag with ID "nonexistent" not found');
    });
  });

  describe('deleteTag', () => {
    it('should delete a tag and its children', async () => {
      await service.deleteTag('landscape');
      
      const hierarchy = await service.getTagHierarchy();
      const nature = hierarchy.find(tag => tag.name === 'Nature');
      expect(nature?.children).toHaveLength(1);
      expect(nature?.children[0].name).toBe('Wildlife');
      expect(mockConfigurationRepository.saveSettings).toHaveBeenCalled();
    });

    it('should delete a root level tag', async () => {
      await service.deleteTag('photography');
      
      const hierarchy = await service.getTagHierarchy();
      expect(hierarchy).toHaveLength(1);
      expect(hierarchy[0].name).toBe('Nature');
    });

    it('should reject non-existent tag ID', async () => {
      await expect(service.deleteTag('nonexistent')).rejects.toThrow('Tag with ID "nonexistent" not found');
    });
  });

  describe('moveTag', () => {
    it('should move tag to new parent', async () => {
      const movedTag = await service.moveTag('wildlife', 'landscape');
      
      expect(movedTag.parent).toBe('landscape');
      expect(movedTag.level).toBe(2);
      
      const landscape = await service.findTagById('landscape');
      expect(landscape?.children).toHaveLength(3);
      expect(landscape?.children.some(child => child.name === 'Wildlife')).toBe(true);
    });

    it('should move tag to root level', async () => {
      const movedTag = await service.moveTag('wildlife', undefined);
      
      expect(movedTag.parent).toBeUndefined();
      expect(movedTag.level).toBe(0);
      
      const hierarchy = await service.getTagHierarchy();
      expect(hierarchy).toHaveLength(3);
      expect(hierarchy.some(tag => tag.name === 'Wildlife')).toBe(true);
    });

    it('should reject circular references', async () => {
      await expect(service.moveTag('nature', 'landscape')).rejects.toThrow('circular reference');
    });

    it('should reject non-existent tag or parent', async () => {
      await expect(service.moveTag('nonexistent', 'nature')).rejects.toThrow('Tag with ID "nonexistent" not found');
      await expect(service.moveTag('wildlife', 'nonexistent')).rejects.toThrow('New parent tag with ID "nonexistent" not found');
    });
  });

  describe('findTagById', () => {
    it('should find existing tag', async () => {
      const tag = await service.findTagById('mountains');
      expect(tag?.name).toBe('Mountains');
      expect(tag?.level).toBe(2);
    });

    it('should return undefined for non-existent tag', async () => {
      const tag = await service.findTagById('nonexistent');
      expect(tag).toBeUndefined();
    });
  });

  describe('findTagByPath', () => {
    it('should find tag by full path', async () => {
      const tag = await service.findTagByPath('Nature/Landscape/Mountains');
      expect(tag?.name).toBe('Mountains');
      expect(tag?.id).toBe('mountains');
    });

    it('should find tag by partial path', async () => {
      const tag = await service.findTagByPath('Nature/Wildlife');
      expect(tag?.name).toBe('Wildlife');
    });

    it('should handle case insensitive search', async () => {
      const tag = await service.findTagByPath('nature/landscape/mountains');
      expect(tag?.name).toBe('Mountains');
    });

    it('should return undefined for non-existent path', async () => {
      const tag = await service.findTagByPath('Nature/NonExistent');
      expect(tag).toBeUndefined();
    });
  });

  describe('getTagPath', () => {
    it('should return full path for nested tag', async () => {
      const path = await service.getTagPath('mountains');
      expect(path).toBe('Nature/Landscape/Mountains');
    });

    it('should return simple name for root tag', async () => {
      const path = await service.getTagPath('nature');
      expect(path).toBe('Nature');
    });

    it('should reject non-existent tag', async () => {
      await expect(service.getTagPath('nonexistent')).rejects.toThrow('Tag with ID "nonexistent" not found');
    });
  });

  describe('getChildTags', () => {
    it('should return child tags', async () => {
      const children = await service.getChildTags('landscape');
      expect(children).toHaveLength(2);
      expect(children.map(child => child.name)).toEqual(['Mountains', 'Lakes']);
    });

    it('should return empty array for tag without children', async () => {
      const children = await service.getChildTags('mountains');
      expect(children).toEqual([]);
    });

    it('should return empty array for non-existent tag', async () => {
      const children = await service.getChildTags('nonexistent');
      expect(children).toEqual([]);
    });
  });

  describe('file tagging operations', () => {
    const testFilePath = '/test/image.jpg';
    const existingTags: HierarchicalTag[] = [
      {
        category: 'Nature',
        subcategory: 'Landscape',
        tag: 'Mountains',
        fullPath: 'Nature/Landscape/Mountains'
      }
    ];

    beforeEach(() => {
      mockMetadataRepository.extractTags.mockResolvedValue(existingTags);
      mockMetadataRepository.writeTags.mockResolvedValue();
    });

    describe('addTagsToFile', () => {
      it('should add new tags to file', async () => {
        const newTags: HierarchicalTag[] = [
          {
            category: 'Nature',
            subcategory: undefined,
            tag: 'Wildlife',
            fullPath: 'Nature/Wildlife'
          }
        ];

        await service.addTagsToFile(testFilePath, newTags);

        expect(mockMetadataRepository.extractTags).toHaveBeenCalledWith(testFilePath);
        expect(mockMetadataRepository.writeTags).toHaveBeenCalledWith(testFilePath, [
          ...existingTags,
          ...newTags
        ]);
      });

      it('should not add duplicate tags', async () => {
        const duplicateTags: HierarchicalTag[] = [
          {
            category: 'Nature',
            subcategory: 'Landscape',
            tag: 'Mountains',
            fullPath: 'Nature/Landscape/Mountains'
          }
        ];

        await service.addTagsToFile(testFilePath, duplicateTags);

        expect(mockMetadataRepository.writeTags).toHaveBeenCalledWith(testFilePath, existingTags);
      });
    });

    describe('removeTagsFromFile', () => {
      it('should remove specified tags from file', async () => {
        const tagsToRemove: HierarchicalTag[] = [
          {
            category: 'Nature',
            subcategory: 'Landscape',
            tag: 'Mountains',
            fullPath: 'Nature/Landscape/Mountains'
          }
        ];

        await service.removeTagsFromFile(testFilePath, tagsToRemove);

        expect(mockMetadataRepository.writeTags).toHaveBeenCalledWith(testFilePath, []);
      });

      it('should keep tags not in removal list', async () => {
        const additionalTag: HierarchicalTag = {
          category: 'Photography',
          subcategory: undefined,
          tag: 'Photography',
          fullPath: 'Photography'
        };

        mockMetadataRepository.extractTags.mockResolvedValue([...existingTags, additionalTag]);

        const tagsToRemove: HierarchicalTag[] = [
          {
            category: 'Nature',
            subcategory: 'Landscape',
            tag: 'Mountains',
            fullPath: 'Nature/Landscape/Mountains'
          }
        ];

        await service.removeTagsFromFile(testFilePath, tagsToRemove);

        expect(mockMetadataRepository.writeTags).toHaveBeenCalledWith(testFilePath, [additionalTag]);
      });
    });

    describe('getFilesTags', () => {
      it('should return file tags', async () => {
        const tags = await service.getFilesTags(testFilePath);
        expect(tags).toEqual(existingTags);
        expect(mockMetadataRepository.extractTags).toHaveBeenCalledWith(testFilePath);
      });

      it('should handle errors gracefully', async () => {
        mockMetadataRepository.extractTags.mockRejectedValue(new Error('File error'));
        
        const tags = await service.getFilesTags(testFilePath);
        expect(tags).toEqual([]);
      });
    });
  });

  describe('searchTags', () => {
    it('should find tags by name', async () => {
      const results = await service.searchTags('land');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Landscape');
    });

    it('should find tags case insensitively', async () => {
      const results = await service.searchTags('NATURE');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Nature');
    });

    it('should find multiple matching tags', async () => {
      const results = await service.searchTags('a'); // Should match 'Nature', 'Landscape', 'Lakes'
      expect(results.length).toBeGreaterThan(1);
    });

    it('should return empty array for no matches', async () => {
      const results = await service.searchTags('nonexistent');
      expect(results).toEqual([]);
    });
  });

  describe('validateTagName', () => {
    it('should accept valid tag names', () => {
      expect(service.validateTagName('Valid Tag')).toEqual({ isValid: true });
      expect(service.validateTagName('Tag123')).toEqual({ isValid: true });
      expect(service.validateTagName('Tag-With_Dash')).toEqual({ isValid: true });
    });

    it('should reject empty or whitespace names', () => {
      expect(service.validateTagName('')).toEqual({ 
        isValid: false, 
        error: 'Tag name is required' 
      });
      expect(service.validateTagName('   ')).toEqual({ 
        isValid: false, 
        error: 'Tag name cannot be empty' 
      });
    });

    it('should reject names with invalid characters', () => {
      const result = service.validateTagName('Tag/With/Slash');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('invalid characters');
    });

    it('should reject names that are too long', () => {
      const longName = 'A'.repeat(101);
      const result = service.validateTagName(longName);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('cannot exceed 100 characters');
    });
  });

  describe('validateTagHierarchy', () => {
    it('should validate correct hierarchy', () => {
      const result = service.validateTagHierarchy(mockSettings.tagHierarchy);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect duplicate IDs', () => {
      const invalidHierarchy: TagHierarchyNode[] = [
        {
          id: 'duplicate',
          name: 'Tag1',
          parent: undefined,
          children: [],
          level: 0
        },
        {
          id: 'duplicate',
          name: 'Tag2',
          parent: undefined,
          children: [],
          level: 0
        }
      ];

      const result = service.validateTagHierarchy(invalidHierarchy);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Duplicate tag ID'))).toBe(true);
    });

    it('should detect incorrect levels', () => {
      const invalidHierarchy: TagHierarchyNode[] = [
        {
          id: 'parent',
          name: 'Parent',
          parent: undefined,
          children: [
            {
              id: 'child',
              name: 'Child',
              parent: 'parent',
              children: [],
              level: 0 // Should be 1
            }
          ],
          level: 0
        }
      ];

      const result = service.validateTagHierarchy(invalidHierarchy);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('incorrect level'))).toBe(true);
    });

    it('should detect duplicate names at same level', () => {
      const invalidHierarchy: TagHierarchyNode[] = [
        {
          id: 'tag1',
          name: 'Duplicate',
          parent: undefined,
          children: [],
          level: 0
        },
        {
          id: 'tag2',
          name: 'Duplicate',
          parent: undefined,
          children: [],
          level: 0
        }
      ];

      const result = service.validateTagHierarchy(invalidHierarchy);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Duplicate tag name'))).toBe(true);
    });
  });

  describe('tagNodeToHierarchicalTag', () => {
    it('should convert tag node to hierarchical tag', async () => {
      const tagNode = await service.findTagById('mountains');
      if (!tagNode) throw new Error('Tag not found');

      const hierarchicalTag = await service.tagNodeToHierarchicalTag(tagNode);
      
      expect(hierarchicalTag).toEqual({
        category: 'Nature',
        subcategory: 'Landscape',
        tag: 'Mountains',
        fullPath: 'Nature/Landscape/Mountains'
      });
    });

    it('should handle root level tags', async () => {
      const tagNode = await service.findTagById('nature');
      if (!tagNode) throw new Error('Tag not found');

      const hierarchicalTag = await service.tagNodeToHierarchicalTag(tagNode);
      
      expect(hierarchicalTag).toEqual({
        category: 'Nature',
        subcategory: undefined,
        tag: 'Nature',
        fullPath: 'Nature'
      });
    });
  });

  describe('hierarchicalTagToPath', () => {
    it('should convert hierarchical tag to path', () => {
      const hierarchicalTag: HierarchicalTag = {
        category: 'Nature',
        subcategory: 'Landscape',
        tag: 'Mountains',
        fullPath: 'Nature/Landscape/Mountains'
      };

      const path = service.hierarchicalTagToPath(hierarchicalTag);
      expect(path).toBe('Nature/Landscape/Mountains');
    });
  });
});