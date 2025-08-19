import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { DragDropService } from '../services/DragDropService';
import { FileSystemRepository } from '../repositories/FileSystemRepository';
import { MetadataRepository } from '../repositories/MetadataRepository';
import { ConfigurationRepository } from '../repositories/ConfigurationRepository';
import { MediaFile, FolderItem, HierarchicalTag } from '../../types/global';

// Initialize services
const fileSystemRepository = new FileSystemRepository();
const metadataRepository = new MetadataRepository();
const configurationRepository = new ConfigurationRepository();
const dragDropService = new DragDropService(
  fileSystemRepository,
  metadataRepository,
  configurationRepository
);

export function registerDragDropHandlers(): void {
  // Move files to folder
  ipcMain.handle('dragdrop:moveFilesToFolder', async (
    event: IpcMainInvokeEvent,
    files: MediaFile[],
    targetFolder: FolderItem
  ) => {
    try {
      await dragDropService.moveFilesToFolder(files, targetFolder);
      return { success: true };
    } catch (error) {
      console.error('Failed to move files to folder:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  // Copy files to folder
  ipcMain.handle('dragdrop:copyFilesToFolder', async (
    event: IpcMainInvokeEvent,
    files: MediaFile[],
    targetFolder: FolderItem
  ) => {
    try {
      await dragDropService.copyFilesToFolder(files, targetFolder);
      return { success: true };
    } catch (error) {
      console.error('Failed to copy files to folder:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  // Add files to favorites
  ipcMain.handle('dragdrop:addFilesToFavorites', async (
    event: IpcMainInvokeEvent,
    files: MediaFile[]
  ) => {
    try {
      await dragDropService.addFilesToFavorites(files);
      return { success: true };
    } catch (error) {
      console.error('Failed to add files to favorites:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  // Add folder to favorites
  ipcMain.handle('dragdrop:addFolderToFavorites', async (
    event: IpcMainInvokeEvent,
    name: string,
    path: string
  ) => {
    try {
      await dragDropService.addFolderToFavorites(name, path);
      return { success: true };
    } catch (error) {
      console.error('Failed to add folder to favorites:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  // Assign tags to files
  ipcMain.handle('dragdrop:assignTagsToFiles', async (
    event: IpcMainInvokeEvent,
    files: MediaFile[],
    tags: HierarchicalTag[]
  ) => {
    try {
      await dragDropService.assignTagsToFiles(files, tags);
      return { success: true };
    } catch (error) {
      console.error('Failed to assign tags to files:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  // Reorder favorites
  ipcMain.handle('dragdrop:reorderFavorites', async (
    event: IpcMainInvokeEvent,
    favoriteIds: string[]
  ) => {
    try {
      await dragDropService.reorderFavorites(favoriteIds);
      return { success: true };
    } catch (error) {
      console.error('Failed to reorder favorites:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  // Reorganize tag
  ipcMain.handle('dragdrop:reorganizeTag', async (
    event: IpcMainInvokeEvent,
    tagId: string,
    newParentId: string | null
  ) => {
    try {
      await dragDropService.reorganizeTag(tagId, newParentId);
      return { success: true };
    } catch (error) {
      console.error('Failed to reorganize tag:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  // Remove favorite
  ipcMain.handle('dragdrop:removeFavorite', async (
    event: IpcMainInvokeEvent,
    favoriteId: string
  ) => {
    try {
      await dragDropService.removeFavorite(favoriteId);
      return { success: true };
    } catch (error) {
      console.error('Failed to remove favorite:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  // Get operation status (for progress tracking)
  ipcMain.handle('dragdrop:getOperationStatus', async (
    event: IpcMainInvokeEvent,
    operationId: string
  ) => {
    // This would be implemented if we need progress tracking
    // For now, return a simple status
    return { 
      operationId,
      status: 'completed',
      progress: 100 
    };
  });
}