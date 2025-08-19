import { DriveInfo, DirectoryContent, DirectoryNode, MediaFile } from '../../types/global';

export interface IFileSystemRepository {
  // Core directory operations
  getDrives(): Promise<DriveInfo[]>;
  getDirectoryContents(path: string, useCache?: boolean): Promise<DirectoryContent>;
  getDirectoryTree(path: string, maxDepth?: number): Promise<DirectoryNode[]>;
  
  // File operations
  copyFile(source: string, destination: string): Promise<void>;
  moveFile(source: string, destination: string): Promise<void>;
  deleteFile(filePath: string): Promise<void>;
  
  // Directory operations
  createDirectory(path: string): Promise<void>;
  deleteDirectory(path: string): Promise<void>;
  
  // Utility methods
  getFileStats(filePath: string): Promise<{ size: number; dateModified: Date; dateCreated: Date } | null>;
  isDirectory(path: string): Promise<boolean>;
  isFile(path: string): Promise<boolean>;
  exists(path: string): Promise<boolean>;
  pathExists(path: string): Promise<boolean>;
  
  // Media-specific methods
  getSupportedExtensions(): { images: string[]; videos: string[] };
  isExtensionSupported(extension: string): boolean;
  getRecursiveMediaCount(path: string, maxDepth?: number): Promise<number>;
  
  // Cache management
  clearCache(): void;
  getCacheStats(): { size: number; entries: string[] };
  
  // Batch operations
  batchCopyFiles(operations: Array<{ source: string; destination: string }>): Promise<Array<{ success: boolean; error?: string }>>;
  batchMoveFiles(operations: Array<{ source: string; destination: string }>): Promise<Array<{ success: boolean; error?: string }>>;
  batchDeleteFiles(filePaths: string[]): Promise<Array<{ success: boolean; error?: string }>>;
}