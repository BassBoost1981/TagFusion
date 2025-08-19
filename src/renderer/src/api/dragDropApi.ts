import { MediaFile, FolderItem, HierarchicalTag } from '../../../types/global';

export interface DragDropOperationResult {
  success: boolean;
  error?: string;
}

export interface DragDropOperationStatus {
  operationId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: number;
}

export class DragDropApi {
  /**
   * Move files to a target folder
   */
  static async moveFilesToFolder(files: MediaFile[], targetFolder: FolderItem): Promise<DragDropOperationResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'dragdrop:moveFilesToFolder',
        files,
        targetFolder
      );
      return result;
    } catch (error) {
      console.error('Failed to move files to folder:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Copy files to a target folder
   */
  static async copyFilesToFolder(files: MediaFile[], targetFolder: FolderItem): Promise<DragDropOperationResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'dragdrop:copyFilesToFolder',
        files,
        targetFolder
      );
      return result;
    } catch (error) {
      console.error('Failed to copy files to folder:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Add files to favorites by creating a favorite folder
   */
  static async addFilesToFavorites(files: MediaFile[]): Promise<DragDropOperationResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'dragdrop:addFilesToFavorites',
        files
      );
      return result;
    } catch (error) {
      console.error('Failed to add files to favorites:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Add a folder to favorites
   */
  static async addFolderToFavorites(name: string, path: string): Promise<DragDropOperationResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'dragdrop:addFolderToFavorites',
        name,
        path
      );
      return result;
    } catch (error) {
      console.error('Failed to add folder to favorites:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Assign tags to files
   */
  static async assignTagsToFiles(files: MediaFile[], tags: HierarchicalTag[]): Promise<DragDropOperationResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'dragdrop:assignTagsToFiles',
        files,
        tags
      );
      return result;
    } catch (error) {
      console.error('Failed to assign tags to files:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Reorder favorites
   */
  static async reorderFavorites(favoriteIds: string[]): Promise<DragDropOperationResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'dragdrop:reorderFavorites',
        favoriteIds
      );
      return result;
    } catch (error) {
      console.error('Failed to reorder favorites:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Reorganize tag hierarchy
   */
  static async reorganizeTag(tagId: string, newParentId: string | null): Promise<DragDropOperationResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'dragdrop:reorganizeTag',
        tagId,
        newParentId
      );
      return result;
    } catch (error) {
      console.error('Failed to reorganize tag:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Remove a favorite folder
   */
  static async removeFavorite(favoriteId: string): Promise<DragDropOperationResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'dragdrop:removeFavorite',
        favoriteId
      );
      return result;
    } catch (error) {
      console.error('Failed to remove favorite:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get operation status (for progress tracking)
   */
  static async getOperationStatus(operationId: string): Promise<DragDropOperationStatus> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'dragdrop:getOperationStatus',
        operationId
      );
      return result;
    } catch (error) {
      console.error('Failed to get operation status:', error);
      return {
        operationId,
        status: 'failed',
        progress: 0
      };
    }
  }
}