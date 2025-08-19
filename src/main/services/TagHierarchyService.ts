import { TagHierarchyNode, HierarchicalTag } from '../../types/global';
import { IMetadataRepository } from '../repositories/MetadataRepository';
import { IConfigurationRepository } from '../repositories/ConfigurationRepository';

export interface ITagHierarchyService {
  // Tag hierarchy management
  getTagHierarchy(): Promise<TagHierarchyNode[]>;
  createTag(parentId: string | undefined, name: string): Promise<TagHierarchyNode>;
  updateTag(tagId: string, name: string): Promise<TagHierarchyNode>;
  deleteTag(tagId: string): Promise<void>;
  moveTag(tagId: string, newParentId: string | undefined): Promise<TagHierarchyNode>;
  
  // Tag operations
  findTagById(tagId: string): Promise<TagHierarchyNode | undefined>;
  findTagByPath(path: string): Promise<TagHierarchyNode | undefined>;
  getTagPath(tagId: string): Promise<string>;
  getChildTags(parentId: string): Promise<TagHierarchyNode[]>;
  
  // File tagging operations
  addTagsToFile(filePath: string, tags: HierarchicalTag[]): Promise<void>;
  removeTagsFromFile(filePath: string, tags: HierarchicalTag[]): Promise<void>;
  getFilesTags(filePath: string): Promise<HierarchicalTag[]>;
  
  // Search and filter
  searchTags(query: string): Promise<TagHierarchyNode[]>;
  getFilesWithTag(tagPath: string, includeSubtags?: boolean): Promise<string[]>;
  
  // Validation
  validateTagName(name: string): { isValid: boolean; error?: string };
  validateTagHierarchy(tags: TagHierarchyNode[]): { isValid: boolean; errors: string[] };
}

export class TagHierarchyService implements ITagHierarchyService {
  private tagHierarchy: TagHierarchyNode[] = [];
  private tagCache: Map<string, TagHierarchyNode> = new Map();
  
  constructor(
    private metadataRepository: IMetadataRepository,
    private configurationRepository: IConfigurationRepository
  ) {}

  /**
   * Initialize the service by loading tag hierarchy from configuration
   */
  async initialize(): Promise<void> {
    try {
      const settings = await this.configurationRepository.loadSettings();
      this.tagHierarchy = settings.tagHierarchy || [];
      this.rebuildCache();
    } catch (error) {
      console.error('Error initializing tag hierarchy service:', error);
      this.tagHierarchy = [];
    }
  }

  /**
   * Get the complete tag hierarchy
   */
  async getTagHierarchy(): Promise<TagHierarchyNode[]> {
    return [...this.tagHierarchy];
  }

  /**
   * Create a new tag in the hierarchy
   */
  async createTag(parentId: string | undefined, name: string): Promise<TagHierarchyNode> {
    // Validate tag name
    const validation = this.validateTagName(name);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    // Check for duplicate names at the same level
    const siblings = parentId 
      ? await this.getChildTags(parentId)
      : this.tagHierarchy.filter(tag => !tag.parent);
    
    if (siblings.some(tag => tag.name.toLowerCase() === name.toLowerCase())) {
      throw new Error(`Tag "${name}" already exists at this level`);
    }

    // Determine level
    let level = 0;
    if (parentId) {
      const parent = await this.findTagById(parentId);
      if (!parent) {
        throw new Error(`Parent tag with ID "${parentId}" not found`);
      }
      level = parent.level + 1;
    }

    // Create new tag
    const newTag: TagHierarchyNode = {
      id: this.generateTagId(),
      name: name.trim(),
      parent: parentId,
      children: [],
      level
    };

    // Add to hierarchy
    if (parentId) {
      const parent = this.tagCache.get(parentId);
      if (parent) {
        parent.children.push(newTag);
      }
    } else {
      this.tagHierarchy.push(newTag);
    }

    // Update cache
    this.tagCache.set(newTag.id, newTag);

    // Save to configuration
    await this.saveTagHierarchy();

    return newTag;
  }

  /**
   * Update an existing tag's name
   */
  async updateTag(tagId: string, name: string): Promise<TagHierarchyNode> {
    // Validate tag name
    const validation = this.validateTagName(name);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    const tag = await this.findTagById(tagId);
    if (!tag) {
      throw new Error(`Tag with ID "${tagId}" not found`);
    }

    // Check for duplicate names at the same level
    const siblings = tag.parent 
      ? await this.getChildTags(tag.parent)
      : this.tagHierarchy.filter(t => !t.parent);
    
    if (siblings.some(t => t.id !== tagId && t.name.toLowerCase() === name.toLowerCase())) {
      throw new Error(`Tag "${name}" already exists at this level`);
    }

    // Update tag name
    tag.name = name.trim();

    // Save to configuration
    await this.saveTagHierarchy();

    return tag;
  }

  /**
   * Delete a tag and all its children
   */
  async deleteTag(tagId: string): Promise<void> {
    const tag = await this.findTagById(tagId);
    if (!tag) {
      throw new Error(`Tag with ID "${tagId}" not found`);
    }

    // Recursively collect all tag IDs to delete (including children)
    const tagsToDelete = this.collectTagAndChildren(tag);

    // Remove from parent's children or root level
    if (tag.parent) {
      const parent = this.tagCache.get(tag.parent);
      if (parent) {
        parent.children = parent.children.filter(child => child.id !== tagId);
      }
    } else {
      this.tagHierarchy = this.tagHierarchy.filter(t => t.id !== tagId);
    }

    // Remove from cache
    tagsToDelete.forEach(t => this.tagCache.delete(t.id));

    // Save to configuration
    await this.saveTagHierarchy();
  }

  /**
   * Move a tag to a new parent
   */
  async moveTag(tagId: string, newParentId: string | undefined): Promise<TagHierarchyNode> {
    const tag = await this.findTagById(tagId);
    if (!tag) {
      throw new Error(`Tag with ID "${tagId}" not found`);
    }

    // Validate new parent exists
    if (newParentId) {
      const newParent = await this.findTagById(newParentId);
      if (!newParent) {
        throw new Error(`New parent tag with ID "${newParentId}" not found`);
      }

      // Check for circular reference
      if (this.wouldCreateCircularReference(tagId, newParentId)) {
        throw new Error('Cannot move tag: would create circular reference');
      }
    }

    // Remove from current parent
    if (tag.parent) {
      const oldParent = this.tagCache.get(tag.parent);
      if (oldParent) {
        oldParent.children = oldParent.children.filter(child => child.id !== tagId);
      }
    } else {
      this.tagHierarchy = this.tagHierarchy.filter(t => t.id !== tagId);
    }

    // Add to new parent
    tag.parent = newParentId;
    if (newParentId) {
      const newParent = this.tagCache.get(newParentId);
      if (newParent) {
        newParent.children.push(tag);
        tag.level = newParent.level + 1;
      }
    } else {
      this.tagHierarchy.push(tag);
      tag.level = 0;
    }

    // Update levels for all children recursively
    this.updateChildrenLevels(tag);

    // Save to configuration
    await this.saveTagHierarchy();

    return tag;
  }

  /**
   * Find a tag by its ID
   */
  async findTagById(tagId: string): Promise<TagHierarchyNode | undefined> {
    return this.tagCache.get(tagId);
  }

  /**
   * Find a tag by its full path (e.g., "Nature/Landscape/Mountains")
   */
  async findTagByPath(path: string): Promise<TagHierarchyNode | undefined> {
    const parts = path.split('/').map(part => part.trim()).filter(part => part.length > 0);
    
    let currentLevel = this.tagHierarchy;
    let currentTag: TagHierarchyNode | undefined;

    for (const part of parts) {
      currentTag = currentLevel.find(tag => tag.name.toLowerCase() === part.toLowerCase());
      if (!currentTag) {
        return undefined;
      }
      currentLevel = currentTag.children;
    }

    return currentTag;
  }

  /**
   * Get the full path of a tag
   */
  async getTagPath(tagId: string): Promise<string> {
    const tag = await this.findTagById(tagId);
    if (!tag) {
      throw new Error(`Tag with ID "${tagId}" not found`);
    }

    const pathParts: string[] = [];
    let currentTag: TagHierarchyNode | undefined = tag;

    while (currentTag) {
      pathParts.unshift(currentTag.name);
      currentTag = currentTag.parent ? this.tagCache.get(currentTag.parent) : undefined;
    }

    return pathParts.join('/');
  }

  /**
   * Get all child tags of a parent tag
   */
  async getChildTags(parentId: string): Promise<TagHierarchyNode[]> {
    const parent = await this.findTagById(parentId);
    return parent ? [...parent.children] : [];
  }

  /**
   * Add tags to a file
   */
  async addTagsToFile(filePath: string, tags: HierarchicalTag[]): Promise<void> {
    try {
      // Get existing tags
      const existingTags = await this.metadataRepository.extractTags(filePath);
      
      // Merge with new tags, avoiding duplicates
      const allTags = [...existingTags];
      
      for (const newTag of tags) {
        const exists = existingTags.some(existing => existing.fullPath === newTag.fullPath);
        if (!exists) {
          allTags.push(newTag);
        }
      }

      // Write back to file
      await this.metadataRepository.writeTags(filePath, allTags);
    } catch (error) {
      console.error(`Error adding tags to file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Remove tags from a file
   */
  async removeTagsFromFile(filePath: string, tags: HierarchicalTag[]): Promise<void> {
    try {
      // Get existing tags
      const existingTags = await this.metadataRepository.extractTags(filePath);
      
      // Filter out tags to remove
      const tagsToRemove = new Set(tags.map(tag => tag.fullPath));
      const remainingTags = existingTags.filter(tag => !tagsToRemove.has(tag.fullPath));

      // Write back to file
      await this.metadataRepository.writeTags(filePath, remainingTags);
    } catch (error) {
      console.error(`Error removing tags from file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Get all tags for a file
   */
  async getFilesTags(filePath: string): Promise<HierarchicalTag[]> {
    try {
      return await this.metadataRepository.extractTags(filePath);
    } catch (error) {
      console.error(`Error getting tags for file ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Search tags by name
   */
  async searchTags(query: string): Promise<TagHierarchyNode[]> {
    const results: TagHierarchyNode[] = [];
    const lowerQuery = query.toLowerCase();

    const searchRecursive = (tags: TagHierarchyNode[]) => {
      for (const tag of tags) {
        if (tag.name.toLowerCase().includes(lowerQuery)) {
          results.push(tag);
        }
        searchRecursive(tag.children);
      }
    };

    searchRecursive(this.tagHierarchy);
    return results;
  }

  /**
   * Get files that have a specific tag (placeholder - would need file indexing)
   */
  async getFilesWithTag(tagPath: string, includeSubtags: boolean = false): Promise<string[]> {
    // This is a placeholder implementation
    // In a real implementation, you would need to maintain an index of files and their tags
    // or scan through all files in the system
    console.warn('getFilesWithTag is not fully implemented - requires file indexing system');
    return [];
  }

  /**
   * Validate a tag name
   */
  validateTagName(name: string): { isValid: boolean; error?: string } {
    if (!name || typeof name !== 'string') {
      return { isValid: false, error: 'Tag name is required' };
    }

    const trimmedName = name.trim();
    
    if (trimmedName.length === 0) {
      return { isValid: false, error: 'Tag name cannot be empty' };
    }

    if (trimmedName.length > 100) {
      return { isValid: false, error: 'Tag name cannot exceed 100 characters' };
    }

    // Check for invalid characters
    const invalidChars = /[\/\\|<>:"*?]/;
    if (invalidChars.test(trimmedName)) {
      return { isValid: false, error: 'Tag name contains invalid characters: / \\ | < > : " * ?' };
    }

    return { isValid: true };
  }

  /**
   * Validate the entire tag hierarchy
   */
  validateTagHierarchy(tags: TagHierarchyNode[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const seenIds = new Set<string>();

    const validateRecursive = (tagList: TagHierarchyNode[], expectedLevel: number, parentPath: string = '') => {
      for (const tag of tagList) {
        // Check for duplicate IDs
        if (seenIds.has(tag.id)) {
          errors.push(`Duplicate tag ID: ${tag.id}`);
        } else {
          seenIds.add(tag.id);
        }

        // Validate tag name
        const nameValidation = this.validateTagName(tag.name);
        if (!nameValidation.isValid) {
          errors.push(`Invalid tag name "${tag.name}": ${nameValidation.error}`);
        }

        // Check level consistency
        if (tag.level !== expectedLevel) {
          errors.push(`Tag "${tag.name}" has incorrect level ${tag.level}, expected ${expectedLevel}`);
        }

        // Check for duplicate names at same level
        const currentPath = parentPath ? `${parentPath}/${tag.name}` : tag.name;
        const siblings = tagList.filter(t => t.id !== tag.id);
        if (siblings.some(sibling => sibling.name.toLowerCase() === tag.name.toLowerCase())) {
          errors.push(`Duplicate tag name "${tag.name}" at path "${currentPath}"`);
        }

        // Validate children recursively
        if (tag.children && tag.children.length > 0) {
          validateRecursive(tag.children, expectedLevel + 1, currentPath);
        }
      }
    };

    validateRecursive(tags, 0);

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Convert a TagHierarchyNode to HierarchicalTag format
   */
  async tagNodeToHierarchicalTag(tagNode: TagHierarchyNode): Promise<HierarchicalTag> {
    const fullPath = await this.getTagPath(tagNode.id);
    const pathParts = fullPath.split('/');

    return {
      category: pathParts[0] || tagNode.name,
      subcategory: pathParts.length > 2 ? pathParts[1] : undefined,
      tag: pathParts[pathParts.length - 1],
      fullPath
    };
  }

  /**
   * Convert HierarchicalTag to TagHierarchyNode path
   */
  hierarchicalTagToPath(hierarchicalTag: HierarchicalTag): string {
    return hierarchicalTag.fullPath;
  }

  // Private helper methods

  private generateTagId(): string {
    return `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private rebuildCache(): void {
    this.tagCache.clear();
    
    const addToCache = (tags: TagHierarchyNode[]) => {
      for (const tag of tags) {
        this.tagCache.set(tag.id, tag);
        if (tag.children) {
          addToCache(tag.children);
        }
      }
    };

    addToCache(this.tagHierarchy);
  }

  private collectTagAndChildren(tag: TagHierarchyNode): TagHierarchyNode[] {
    const result = [tag];
    
    if (tag.children) {
      for (const child of tag.children) {
        result.push(...this.collectTagAndChildren(child));
      }
    }
    
    return result;
  }

  private wouldCreateCircularReference(tagId: string, newParentId: string): boolean {
    let currentParent = this.tagCache.get(newParentId);
    
    while (currentParent) {
      if (currentParent.id === tagId) {
        return true;
      }
      currentParent = currentParent.parent ? this.tagCache.get(currentParent.parent) : undefined;
    }
    
    return false;
  }

  private updateChildrenLevels(tag: TagHierarchyNode): void {
    if (tag.children) {
      for (const child of tag.children) {
        child.level = tag.level + 1;
        this.updateChildrenLevels(child);
      }
    }
  }

  private async saveTagHierarchy(): Promise<void> {
    try {
      const settings = await this.configurationRepository.loadSettings();
      settings.tagHierarchy = this.tagHierarchy;
      await this.configurationRepository.saveSettings(settings);
    } catch (error) {
      console.error('Error saving tag hierarchy:', error);
      throw error;
    }
  }
}