import { HierarchicalTag } from '../../../types/global';

export interface ITagService {
  getTagHierarchy(): Promise<HierarchicalTag[]>;
  createTag(parentId: string | null, name: string): Promise<any>;
  updateTag(tagId: string, name: string): Promise<void>;
  deleteTag(tagId: string): Promise<void>;
  assignTagsToFiles(filePaths: string[], tagIds: string[]): Promise<void>;
  removeTagsFromFiles(filePaths: string[], tagIds: string[]): Promise<void>;
}

export class TagService implements ITagService {
  async getTagHierarchy(): Promise<HierarchicalTag[]> {
    try {
      const hierarchy = await window.electronAPI?.tags?.getHierarchy();
      return hierarchy || [];
    } catch (error) {
      console.error('Failed to get tag hierarchy:', error);
      return [];
    }
  }

  async createTag(parentId: string | null, name: string): Promise<any> {
    try {
      const result = await window.electronAPI?.tags?.createTag(parentId, name);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to create tag');
      }
      return result;
    } catch (error) {
      console.error('Failed to create tag:', error);
      throw error;
    }
  }

  async updateTag(tagId: string, name: string): Promise<void> {
    try {
      const result = await window.electronAPI?.tags?.updateTag(tagId, name);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to update tag');
      }
    } catch (error) {
      console.error('Failed to update tag:', error);
      throw error;
    }
  }

  async deleteTag(tagId: string): Promise<void> {
    try {
      const result = await window.electronAPI?.tags?.deleteTag(tagId);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to delete tag');
      }
    } catch (error) {
      console.error('Failed to delete tag:', error);
      throw error;
    }
  }

  async assignTagsToFiles(filePaths: string[], tagIds: string[]): Promise<void> {
    try {
      const result = await window.electronAPI?.tags?.assignToFiles(filePaths, tagIds);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to assign tags to files');
      }
    } catch (error) {
      console.error('Failed to assign tags to files:', error);
      throw error;
    }
  }

  async removeTagsFromFiles(filePaths: string[], tagIds: string[]): Promise<void> {
    try {
      const result = await window.electronAPI?.tags?.removeFromFiles(filePaths, tagIds);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to remove tags from files');
      }
    } catch (error) {
      console.error('Failed to remove tags from files:', error);
      throw error;
    }
  }

  async getFileTags(filePath: string): Promise<HierarchicalTag[]> {
    try {
      const metadata = await window.electronAPI?.metadata?.read(filePath);
      return metadata?.tags || [];
    } catch (error) {
      console.error('Failed to get file tags:', error);
      return [];
    }
  }

  async searchByTags(tagIds: string[]): Promise<string[]> {
    try {
      // This would need to be implemented in the backend
      // For now, return empty array
      console.log('Search by tags not yet implemented:', tagIds);
      return [];
    } catch (error) {
      console.error('Failed to search by tags:', error);
      return [];
    }
  }

  validateTagName(name: string): { valid: boolean; error?: string } {
    if (!name || name.trim().length === 0) {
      return { valid: false, error: 'Tag name cannot be empty' };
    }

    if (name.length > 50) {
      return { valid: false, error: 'Tag name cannot exceed 50 characters' };
    }

    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(name)) {
      return { valid: false, error: 'Tag name contains invalid characters' };
    }

    return { valid: true };
  }

  formatTagPath(tag: HierarchicalTag, hierarchy: HierarchicalTag[]): string {
    const path: string[] = [];
    let current = tag;

    while (current) {
      path.unshift(current.name);
      if (current.parent) {
        current = this.findTagById(current.parent, hierarchy);
      } else {
        break;
      }
    }

    return path.join(' / ');
  }

  private findTagById(id: string, hierarchy: HierarchicalTag[]): HierarchicalTag | null {
    for (const tag of hierarchy) {
      if (tag.id === id) {
        return tag;
      }
      if (tag.children) {
        const found = this.findTagById(id, tag.children);
        if (found) return found;
      }
    }
    return null;
  }
}
