import { MediaFile, FolderItem, HierarchicalTag, FavoriteFolder } from '../../types/global';
import { FileSystemRepository } from '../repositories/FileSystemRepository';
import { MetadataRepository } from '../repositories/MetadataRepository';
import { ConfigurationRepository } from '../repositories/ConfigurationRepository';

export class DragDropService {
  constructor(
    private fileSystemRepository: FileSystemRepository,
    private metadataRepository: MetadataRepository,
    private configurationRepository: ConfigurationRepository
  ) {}

  /**
   * Move files to a target folder
   */
  async moveFilesToFolder(files: MediaFile[], targetFolder: FolderItem): Promise<void> {
    try {
      for (const file of files) {
        const fileName = file.name;
        const targetPath = `${targetFolder.path}/${fileName}`;
        
        // Check if target file already exists
        const exists = await this.fileSystemRepository.fileExists(targetPath);
        if (exists) {
          // Generate unique name
          const uniquePath = await this.generateUniqueFileName(targetPath);
          await this.fileSystemRepository.moveFile(file.path, uniquePath);
        } else {
          await this.fileSystemRepository.moveFile(file.path, targetPath);
        }
      }
    } catch (error) {
      console.error('Failed to move files to folder:', error);
      throw new Error(`Failed to move files: ${error.message}`);
    }
  }

  /**
   * Copy files to a target folder
   */
  async copyFilesToFolder(files: MediaFile[], targetFolder: FolderItem): Promise<void> {
    try {
      for (const file of files) {
        const fileName = file.name;
        const targetPath = `${targetFolder.path}/${fileName}`;
        
        // Check if target file already exists
        const exists = await this.fileSystemRepository.fileExists(targetPath);
        if (exists) {
          // Generate unique name
          const uniquePath = await this.generateUniqueFileName(targetPath);
          await this.fileSystemRepository.copyFile(file.path, uniquePath);
        } else {
          await this.fileSystemRepository.copyFile(file.path, targetPath);
        }
      }
    } catch (error) {
      console.error('Failed to copy files to folder:', error);
      throw new Error(`Failed to copy files: ${error.message}`);
    }
  }

  /**
   * Add files to favorites by creating a favorite folder
   */
  async addFilesToFavorites(files: MediaFile[]): Promise<void> {
    try {
      // Get the common parent folder of the files
      const parentFolders = files.map(file => {
        const pathParts = file.path.split(/[/\\]/);
        pathParts.pop(); // Remove filename
        return pathParts.join('/');
      });

      // Find the most common parent folder
      const commonParent = this.findCommonParent(parentFolders);
      
      if (commonParent) {
        const folderName = commonParent.split(/[/\\]/).pop() || 'Files';
        await this.addFolderToFavorites(folderName, commonParent);
      }
    } catch (error) {
      console.error('Failed to add files to favorites:', error);
      throw new Error(`Failed to add files to favorites: ${error.message}`);
    }
  }

  /**
   * Add a folder to favorites
   */
  async addFolderToFavorites(name: string, path: string): Promise<void> {
    try {
      const settings = await this.configurationRepository.loadSettings();
      
      // Check if folder is already in favorites
      const existingFavorite = settings.favorites.find(fav => fav.path === path);
      if (existingFavorite) {
        throw new Error('Folder is already in favorites');
      }

      const newFavorite: FavoriteFolder = {
        id: this.generateId(),
        name,
        path,
        dateAdded: new Date(),
        order: settings.favorites.length,
      };

      settings.favorites.push(newFavorite);
      await this.configurationRepository.saveSettings(settings);
    } catch (error) {
      console.error('Failed to add folder to favorites:', error);
      throw new Error(`Failed to add folder to favorites: ${error.message}`);
    }
  }

  /**
   * Assign tags to files
   */
  async assignTagsToFiles(files: MediaFile[], tags: HierarchicalTag[]): Promise<void> {
    try {
      for (const file of files) {
        // Read existing metadata
        const metadata = await this.metadataRepository.readMetadata(file.path);
        
        // Add new tags (avoid duplicates)
        const existingTagPaths = metadata.tags.map(tag => tag.fullPath);
        const newTags = tags.filter(tag => !existingTagPaths.includes(tag.fullPath));
        
        if (newTags.length > 0) {
          metadata.tags.push(...newTags);
          await this.metadataRepository.writeMetadata(file.path, metadata);
        }
      }
    } catch (error) {
      console.error('Failed to assign tags to files:', error);
      throw new Error(`Failed to assign tags: ${error.message}`);
    }
  }

  /**
   * Reorder favorites
   */
  async reorderFavorites(favoriteIds: string[]): Promise<void> {
    try {
      const settings = await this.configurationRepository.loadSettings();
      
      // Create a map of current favorites
      const favoriteMap = new Map(settings.favorites.map(fav => [fav.id, fav]));
      
      // Reorder favorites based on the provided order
      const reorderedFavorites: FavoriteFolder[] = [];
      favoriteIds.forEach((id, index) => {
        const favorite = favoriteMap.get(id);
        if (favorite) {
          reorderedFavorites.push({
            ...favorite,
            order: index,
          });
        }
      });

      // Add any favorites that weren't in the reorder list
      settings.favorites.forEach(fav => {
        if (!favoriteIds.includes(fav.id)) {
          reorderedFavorites.push({
            ...fav,
            order: reorderedFavorites.length,
          });
        }
      });

      settings.favorites = reorderedFavorites;
      await this.configurationRepository.saveSettings(settings);
    } catch (error) {
      console.error('Failed to reorder favorites:', error);
      throw new Error(`Failed to reorder favorites: ${error.message}`);
    }
  }

  /**
   * Reorganize tag hierarchy
   */
  async reorganizeTag(tagId: string, newParentId: string | null): Promise<void> {
    try {
      const settings = await this.configurationRepository.loadSettings();
      
      // Find the tag to move
      const tagToMove = this.findTagInHierarchy(settings.tagHierarchy, tagId);
      if (!tagToMove) {
        throw new Error('Tag not found');
      }

      // Remove tag from current location
      this.removeTagFromHierarchy(settings.tagHierarchy, tagId);

      // Add tag to new location
      if (newParentId) {
        const newParent = this.findTagInHierarchy(settings.tagHierarchy, newParentId);
        if (!newParent) {
          throw new Error('New parent tag not found');
        }
        
        // Update tag level and parent
        tagToMove.parent = newParentId;
        tagToMove.level = newParent.level + 1;
        this.updateChildrenLevels(tagToMove, tagToMove.level);
        
        newParent.children.push(tagToMove);
      } else {
        // Move to root level
        tagToMove.parent = undefined;
        tagToMove.level = 0;
        this.updateChildrenLevels(tagToMove, 0);
        
        settings.tagHierarchy.push(tagToMove);
      }

      await this.configurationRepository.saveSettings(settings);
    } catch (error) {
      console.error('Failed to reorganize tag:', error);
      throw new Error(`Failed to reorganize tag: ${error.message}`);
    }
  }

  /**
   * Remove a favorite folder
   */
  async removeFavorite(favoriteId: string): Promise<void> {
    try {
      const settings = await this.configurationRepository.loadSettings();
      settings.favorites = settings.favorites.filter(fav => fav.id !== favoriteId);
      
      // Reorder remaining favorites
      settings.favorites.forEach((fav, index) => {
        fav.order = index;
      });

      await this.configurationRepository.saveSettings(settings);
    } catch (error) {
      console.error('Failed to remove favorite:', error);
      throw new Error(`Failed to remove favorite: ${error.message}`);
    }
  }

  // Helper methods

  private async generateUniqueFileName(filePath: string): Promise<string> {
    const pathParts = filePath.split('.');
    const extension = pathParts.pop();
    const basePath = pathParts.join('.');
    
    let counter = 1;
    let uniquePath = `${basePath} (${counter}).${extension}`;
    
    while (await this.fileSystemRepository.fileExists(uniquePath)) {
      counter++;
      uniquePath = `${basePath} (${counter}).${extension}`;
    }
    
    return uniquePath;
  }

  private findCommonParent(paths: string[]): string | null {
    if (paths.length === 0) return null;
    if (paths.length === 1) return paths[0];

    const pathArrays = paths.map(path => path.split(/[/\\]/));
    const commonParts: string[] = [];

    for (let i = 0; i < pathArrays[0].length; i++) {
      const part = pathArrays[0][i];
      if (pathArrays.every(pathArray => pathArray[i] === part)) {
        commonParts.push(part);
      } else {
        break;
      }
    }

    return commonParts.length > 0 ? commonParts.join('/') : null;
  }

  private findTagInHierarchy(hierarchy: any[], tagId: string): any | null {
    for (const tag of hierarchy) {
      if (tag.id === tagId) {
        return tag;
      }
      
      const found = this.findTagInHierarchy(tag.children || [], tagId);
      if (found) {
        return found;
      }
    }
    
    return null;
  }

  private removeTagFromHierarchy(hierarchy: any[], tagId: string): boolean {
    for (let i = 0; i < hierarchy.length; i++) {
      if (hierarchy[i].id === tagId) {
        hierarchy.splice(i, 1);
        return true;
      }
      
      if (this.removeTagFromHierarchy(hierarchy[i].children || [], tagId)) {
        return true;
      }
    }
    
    return false;
  }

  private updateChildrenLevels(tag: any, baseLevel: number): void {
    tag.children?.forEach((child: any) => {
      child.level = baseLevel + 1;
      this.updateChildrenLevels(child, child.level);
    });
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}