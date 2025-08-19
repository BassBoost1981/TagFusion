import { IFileSystemService } from './DIContainer';

export class FileSystemService implements IFileSystemService {
  async getDrives(): Promise<any[]> {
    try {
      // Use Electron IPC to get drives from main process
      const drives = await window.electronAPI?.fileSystem?.getDrives() || [];
      return drives;
    } catch (error) {
      console.error('Failed to get drives:', error);
      return [];
    }
  }

  async getDirectoryContents(path: string): Promise<any> {
    try {
      // Use Electron IPC to get directory contents from main process
      const contents = await window.electronAPI?.fileSystem?.getDirectoryContents(path);
      return contents || { files: [], folders: [] };
    } catch (error) {
      console.error('Failed to get directory contents:', error);
      return { files: [], folders: [] };
    }
  }

  async createDirectory(path: string): Promise<boolean> {
    try {
      const result = await window.electronAPI?.fileSystem?.createDirectory(path);
      return result?.success || false;
    } catch (error) {
      console.error('Failed to create directory:', error);
      return false;
    }
  }

  async deleteFile(path: string): Promise<boolean> {
    try {
      const result = await window.electronAPI?.fileSystem?.deleteFile(path);
      return result?.success || false;
    } catch (error) {
      console.error('Failed to delete file:', error);
      return false;
    }
  }

  async moveFile(sourcePath: string, targetPath: string): Promise<boolean> {
    try {
      const result = await window.electronAPI?.fileSystem?.moveFile(sourcePath, targetPath);
      return result?.success || false;
    } catch (error) {
      console.error('Failed to move file:', error);
      return false;
    }
  }

  async copyFile(sourcePath: string, targetPath: string): Promise<boolean> {
    try {
      const result = await window.electronAPI?.fileSystem?.copyFile(sourcePath, targetPath);
      return result?.success || false;
    } catch (error) {
      console.error('Failed to copy file:', error);
      return false;
    }
  }

  async renameFile(oldPath: string, newPath: string): Promise<boolean> {
    try {
      const result = await window.electronAPI?.fileSystem?.renameFile(oldPath, newPath);
      return result?.success || false;
    } catch (error) {
      console.error('Failed to rename file:', error);
      return false;
    }
  }

  async getFileStats(path: string): Promise<any> {
    try {
      const stats = await window.electronAPI?.fileSystem?.getFileStats(path);
      return stats;
    } catch (error) {
      console.error('Failed to get file stats:', error);
      return null;
    }
  }

  async watchDirectory(path: string, callback: (event: string, filename: string) => void): Promise<void> {
    try {
      await window.electronAPI?.fileSystem?.watchDirectory(path, callback);
    } catch (error) {
      console.error('Failed to watch directory:', error);
    }
  }

  async unwatchDirectory(path: string): Promise<void> {
    try {
      await window.electronAPI?.fileSystem?.unwatchDirectory(path);
    } catch (error) {
      console.error('Failed to unwatch directory:', error);
    }
  }
}