import { promises as fs } from 'fs';
import { join, extname, basename, dirname } from 'path';
import { DriveInfo, DirectoryContent, FolderItem, MediaFile, DirectoryNode } from '../../types/global';
import { IFileSystemRepository } from '../interfaces/IFileSystemRepository';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export class FileSystemRepository implements IFileSystemRepository {
  private readonly supportedImageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'];
  private readonly supportedVideoExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm'];
  
  // Performance optimization: Cache for directory scanning
  private readonly directoryCache = new Map<string, { content: DirectoryContent; timestamp: number }>();
  private readonly cacheTimeout = 30000; // 30 seconds cache timeout
  
  // Performance optimization: Batch processing limits
  private readonly maxConcurrentOperations = 10;
  private readonly maxDirectoryDepth = 10;

  async getDrives(): Promise<DriveInfo[]> {
    const drives: DriveInfo[] = [];
    
    try {
      if (process.platform === 'win32') {
        // Windows: Use WMI to get accurate drive information
        await this.getWindowsDrives(drives);
      } else if (process.platform === 'darwin') {
        // macOS: Use diskutil and mount points
        await this.getMacOSDrives(drives);
      } else {
        // Linux: Use /proc/mounts and df
        await this.getLinuxDrives(drives);
      }
    } catch (error) {
      console.error('Error getting drives:', error);
      // Fallback to basic drive detection
      await this.getFallbackDrives(drives);
    }
    
    return drives.sort((a, b) => a.letter.localeCompare(b.letter));
  }

  private async getWindowsDrives(drives: DriveInfo[]): Promise<void> {
    try {
      // Use wmic to get drive information
      const { stdout } = await execAsync('wmic logicaldisk get size,freespace,caption,description,drivetype /format:csv');
      const lines = stdout.split('\n').filter(line => line.trim() && !line.startsWith('Node'));
      
      for (const line of lines) {
        const parts = line.split(',');
        if (parts.length >= 6) {
          const caption = parts[1]?.trim();
          const description = parts[2]?.trim();
          const driveType = parseInt(parts[3]?.trim() || '0');
          const freeSpace = parseInt(parts[4]?.trim() || '0');
          const totalSpace = parseInt(parts[5]?.trim() || '0');
          
          if (caption && caption.length >= 2) {
            const driveLetter = caption.charAt(0).toUpperCase();
            const drivePath = `${driveLetter}:\\`;
            
            try {
              await fs.access(drivePath);
              drives.push({
                letter: `${driveLetter}:`,
                label: description || await this.getDriveLabel(drivePath),
                path: drivePath,
                type: this.getWindowsDriveType(driveType),
                available: true,
                totalSpace: totalSpace || 0,
                freeSpace: freeSpace || 0,
              });
            } catch (error) {
              // Drive not accessible, skip
            }
          }
        }
      }
    } catch (error) {
      // Fallback to basic A-Z scanning
      await this.getFallbackWindowsDrives(drives);
    }
  }

  private async getMacOSDrives(drives: DriveInfo[]): Promise<void> {
    try {
      // Get mounted volumes
      const { stdout } = await execAsync('df -h');
      const lines = stdout.split('\n').slice(1); // Skip header
      
      for (const line of lines) {
        const parts = line.split(/\s+/);
        if (parts.length >= 6) {
          const mountPoint = parts[5];
          if (mountPoint && (mountPoint === '/' || mountPoint.startsWith('/Volumes/'))) {
            try {
              await fs.access(mountPoint);
              const stats = await fs.stat(mountPoint);
              
              drives.push({
                letter: basename(mountPoint) || 'Root',
                label: basename(mountPoint) || 'Macintosh HD',
                path: mountPoint,
                type: mountPoint === '/' ? 'local' : 'removable',
                available: true,
                totalSpace: this.parseSize(parts[1]),
                freeSpace: this.parseSize(parts[3]),
              });
            } catch (error) {
              // Mount point not accessible, skip
            }
          }
        }
      }
    } catch (error) {
      // Fallback to basic mount points
      await this.getFallbackUnixDrives(drives);
    }
  }

  private async getLinuxDrives(drives: DriveInfo[]): Promise<void> {
    try {
      // Read /proc/mounts for mounted filesystems
      const mountsContent = await fs.readFile('/proc/mounts', 'utf-8');
      const mounts = mountsContent.split('\n').filter(line => line.trim());
      
      const relevantMounts = mounts.filter(mount => {
        const parts = mount.split(' ');
        const mountPoint = parts[1];
        const fsType = parts[2];
        
        // Include root, media, and mnt mount points, exclude system filesystems
        return mountPoint && 
               (mountPoint === '/' || mountPoint.startsWith('/media/') || mountPoint.startsWith('/mnt/')) &&
               !['proc', 'sysfs', 'devpts', 'tmpfs', 'devtmpfs'].includes(fsType);
      });
      
      for (const mount of relevantMounts) {
        const parts = mount.split(' ');
        const device = parts[0];
        const mountPoint = parts[1];
        
        try {
          await fs.access(mountPoint);
          
          // Get disk usage information
          const { stdout } = await execAsync(`df -h "${mountPoint}"`);
          const dfLines = stdout.split('\n');
          if (dfLines.length >= 2) {
            const dfParts = dfLines[1].split(/\s+/);
            
            drives.push({
              letter: basename(mountPoint) || 'Root',
              label: basename(mountPoint) || device,
              path: mountPoint,
              type: mountPoint === '/' ? 'local' : 'removable',
              available: true,
              totalSpace: this.parseSize(dfParts[1]),
              freeSpace: this.parseSize(dfParts[3]),
            });
          }
        } catch (error) {
          // Mount point not accessible, skip
        }
      }
    } catch (error) {
      // Fallback to basic mount points
      await this.getFallbackUnixDrives(drives);
    }
  }

  private async getFallbackDrives(drives: DriveInfo[]): Promise<void> {
    if (process.platform === 'win32') {
      await this.getFallbackWindowsDrives(drives);
    } else {
      await this.getFallbackUnixDrives(drives);
    }
  }

  private async getFallbackWindowsDrives(drives: DriveInfo[]): Promise<void> {
    // Basic A-Z drive scanning for Windows
    for (let i = 65; i <= 90; i++) {
      const driveLetter = String.fromCharCode(i);
      const drivePath = `${driveLetter}:\\`;
      
      try {
        await fs.access(drivePath);
        drives.push({
          letter: `${driveLetter}:`,
          label: await this.getDriveLabel(drivePath),
          path: drivePath,
          type: this.getDriveType(driveLetter),
          available: true,
          totalSpace: 0,
          freeSpace: 0,
        });
      } catch (error) {
        // Drive not available, skip
      }
    }
  }

  private async getFallbackUnixDrives(drives: DriveInfo[]): Promise<void> {
    // Basic mount point scanning for Unix systems
    const commonPaths = ['/', '/Volumes', '/media', '/mnt'];
    
    for (const path of commonPaths) {
      try {
        await fs.access(path);
        const stats = await fs.stat(path);
        
        if (path === '/') {
          drives.push({
            letter: 'Root',
            label: 'Root',
            path: path,
            type: 'local',
            available: true,
            totalSpace: 0,
            freeSpace: 0,
          });
        } else {
          // Check for subdirectories in mount points
          const entries = await fs.readdir(path, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory()) {
              const mountPath = join(path, entry.name);
              try {
                await fs.access(mountPath);
                drives.push({
                  letter: entry.name,
                  label: entry.name,
                  path: mountPath,
                  type: 'removable',
                  available: true,
                  totalSpace: 0,
                  freeSpace: 0,
                });
              } catch (error) {
                // Mount not accessible, skip
              }
            }
          }
        }
      } catch (error) {
        // Path not available, skip
      }
    }
  }

  private getWindowsDriveType(driveType: number): 'local' | 'removable' | 'network' {
    // Windows drive types from WMI
    switch (driveType) {
      case 2: return 'removable'; // Floppy disk
      case 3: return 'local';     // Fixed disk
      case 4: return 'network';   // Network drive
      case 5: return 'removable'; // CD-ROM
      default: return 'local';
    }
  }

  private parseSize(sizeStr: string): number {
    if (!sizeStr) return 0;
    
    const units = { 'K': 1024, 'M': 1024 * 1024, 'G': 1024 * 1024 * 1024, 'T': 1024 * 1024 * 1024 * 1024 };
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)(K|M|G|T)?$/i);
    
    if (match) {
      const value = parseFloat(match[1]);
      const unit = match[2]?.toUpperCase() as keyof typeof units;
      return Math.round(value * (units[unit] || 1));
    }
    
    return 0;
  }

  async getDirectoryContents(path: string, useCache: boolean = true): Promise<DirectoryContent> {
    // Check cache first
    if (useCache) {
      const cached = this.directoryCache.get(path);
      if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
        return cached.content;
      }
    }

    const result: DirectoryContent = {
      folders: [],
      mediaFiles: [],
      path: path,
    };

    try {
      const entries = await fs.readdir(path, { withFileTypes: true });
      
      // Performance optimization: Process entries in batches
      const batches = this.createBatches(entries, this.maxConcurrentOperations);
      
      for (const batch of batches) {
        const promises = batch.map(async (entry) => {
          const fullPath = join(path, entry.name);
          
          try {
            if (entry.isDirectory()) {
              // Skip system and hidden directories
              if (this.shouldSkipDirectory(entry.name)) {
                return null;
              }
              
              const folderItem: FolderItem = {
                name: entry.name,
                path: fullPath,
                hasSubfolders: await this.hasSubfolders(fullPath),
                mediaCount: await this.getMediaCount(fullPath),
              };
              
              return { type: 'folder', item: folderItem };
            } else if (entry.isFile()) {
              const mediaFile = await this.createMediaFile(fullPath, entry.name);
              if (mediaFile) {
                return { type: 'media', item: mediaFile };
              }
            }
          } catch (error) {
            // Skip files/folders that can't be accessed
            console.warn(`Skipping ${fullPath}: ${error}`);
          }
          
          return null;
        });
        
        const batchResults = await Promise.all(promises);
        
        // Process batch results
        for (const batchResult of batchResults) {
          if (batchResult) {
            if (batchResult.type === 'folder') {
              result.folders.push(batchResult.item as FolderItem);
            } else if (batchResult.type === 'media') {
              result.mediaFiles.push(batchResult.item as MediaFile);
            }
          }
        }
      }
      
      // Sort folders and files
      result.folders.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      result.mediaFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      
      // Cache the result
      if (useCache) {
        this.directoryCache.set(path, { content: result, timestamp: Date.now() });
        
        // Clean up old cache entries
        this.cleanupCache();
      }
      
    } catch (error) {
      console.error(`Error reading directory ${path}:`, error);
    }
    
    return result;
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private cleanupCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, value] of this.directoryCache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.directoryCache.delete(key);
    }
  }

  async getDirectoryTree(path: string, maxDepth: number = 2): Promise<DirectoryNode[]> {
    // Prevent excessive recursion
    const safeMaxDepth = Math.min(maxDepth, this.maxDirectoryDepth);
    return this.buildDirectoryTree(path, 0, safeMaxDepth);
  }

  private async buildDirectoryTree(path: string, currentDepth: number, maxDepth: number): Promise<DirectoryNode[]> {
    const nodes: DirectoryNode[] = [];
    
    if (currentDepth >= maxDepth) {
      return nodes;
    }
    
    try {
      const entries = await fs.readdir(path, { withFileTypes: true });
      
      // Filter directories first to avoid unnecessary processing
      const directories = entries.filter(entry => 
        entry.isDirectory() && !this.shouldSkipDirectory(entry.name)
      );
      
      // Performance optimization: Process directories in batches
      const batches = this.createBatches(directories, this.maxConcurrentOperations);
      
      for (const batch of batches) {
        const promises = batch.map(async (entry) => {
          const fullPath = join(path, entry.name);
          
          try {
            // Check access before proceeding
            await fs.access(fullPath);
            
            const [children, hasChildren] = await Promise.all([
              this.buildDirectoryTree(fullPath, currentDepth + 1, maxDepth),
              this.hasSubfolders(fullPath)
            ]);
            
            const node: DirectoryNode = {
              name: entry.name,
              path: fullPath,
              children: children,
              hasChildren: hasChildren,
            };
            
            return node;
          } catch (error) {
            // Skip directories that can't be accessed
            console.warn(`Skipping directory ${fullPath}: ${error}`);
            return null;
          }
        });
        
        const batchResults = await Promise.all(promises);
        
        // Add valid nodes to the result
        for (const node of batchResults) {
          if (node) {
            nodes.push(node);
          }
        }
      }
    } catch (error) {
      console.error(`Error building directory tree for ${path}:`, error);
    }
    
    return nodes.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }

  private async createMediaFile(filePath: string, fileName: string): Promise<MediaFile | null> {
    const ext = extname(fileName).toLowerCase();
    
    if (!this.isMediaFile(ext)) {
      return null;
    }
    
    try {
      const stats = await fs.stat(filePath);
      
      return {
        path: filePath,
        name: fileName,
        extension: ext,
        size: stats.size,
        dateModified: stats.mtime,
        dateCreated: stats.birthtime,
        type: this.getMediaType(ext),
      };
    } catch (error) {
      console.error(`Error creating media file for ${filePath}:`, error);
      return null;
    }
  }

  private isMediaFile(extension: string): boolean {
    return this.supportedImageExtensions.includes(extension) || 
           this.supportedVideoExtensions.includes(extension);
  }

  private getMediaType(extension: string): 'image' | 'video' {
    return this.supportedImageExtensions.includes(extension) ? 'image' : 'video';
  }

  private shouldSkipDirectory(dirName: string): boolean {
    // Skip system directories and hidden directories
    const skipPatterns = [
      /^\./,                    // Hidden directories (starting with .)
      /^__pycache__$/,         // Python cache
      /^node_modules$/,        // Node.js modules
      /^\.git$/,               // Git directory
      /^\.vscode$/,            // VS Code settings
      /^System Volume Information$/, // Windows system
      /^\$RECYCLE\.BIN$/,      // Windows recycle bin
      /^Thumbs\.db$/,          // Windows thumbnails
      /^\.DS_Store$/,          // macOS metadata
      /^\.Trash$/,             // macOS trash
      /^\.Trashes$/,           // macOS trash
      /^lost\+found$/,         // Linux lost+found
      /^proc$/,                // Linux proc
      /^sys$/,                 // Linux sys
      /^dev$/,                 // Linux dev
      /^tmp$/,                 // Temporary directories
      /^temp$/i,               // Temporary directories (case insensitive)
      /^cache$/i,              // Cache directories
      /^\.cache$/,             // Hidden cache directories
    ];
    
    return skipPatterns.some(pattern => pattern.test(dirName));
  }

  private async hasSubfolders(path: string): Promise<boolean> {
    try {
      const entries = await fs.readdir(path, { withFileTypes: true });
      return entries.some(entry => entry.isDirectory() && !this.shouldSkipDirectory(entry.name));
    } catch (error) {
      return false;
    }
  }

  private async getMediaCount(path: string): Promise<number> {
    try {
      const entries = await fs.readdir(path, { withFileTypes: true });
      let count = 0;
      
      // Performance optimization: Only check file extensions, don't create full MediaFile objects
      for (const entry of entries) {
        if (entry.isFile()) {
          const ext = extname(entry.name).toLowerCase();
          if (this.isMediaFile(ext)) {
            count++;
          }
        }
      }
      
      return count;
    } catch (error) {
      return 0;
    }
  }

  // Performance optimization: Recursive media count with depth limit
  async getRecursiveMediaCount(path: string, maxDepth: number = 3): Promise<number> {
    return this.countMediaRecursively(path, 0, maxDepth);
  }

  private async countMediaRecursively(path: string, currentDepth: number, maxDepth: number): Promise<number> {
    if (currentDepth >= maxDepth) {
      return 0;
    }

    try {
      const entries = await fs.readdir(path, { withFileTypes: true });
      let count = 0;
      
      const promises: Promise<number>[] = [];
      
      for (const entry of entries) {
        if (entry.isFile()) {
          const ext = extname(entry.name).toLowerCase();
          if (this.isMediaFile(ext)) {
            count++;
          }
        } else if (entry.isDirectory() && !this.shouldSkipDirectory(entry.name)) {
          const fullPath = join(path, entry.name);
          promises.push(this.countMediaRecursively(fullPath, currentDepth + 1, maxDepth));
        }
      }
      
      // Wait for all subdirectory counts
      const subcounts = await Promise.all(promises);
      count += subcounts.reduce((sum, subcount) => sum + subcount, 0);
      
      return count;
    } catch (error) {
      return 0;
    }
  }

  private async getDriveLabel(drivePath: string): Promise<string> {
    // TODO: Implement actual drive label detection
    // For now, return generic labels
    const driveLetter = drivePath.charAt(0).toUpperCase();
    
    switch (driveLetter) {
      case 'C': return 'Local Disk';
      case 'D': return 'Data';
      default: return 'Drive';
    }
  }

  private getDriveType(driveLetter: string): 'local' | 'removable' | 'network' {
    // TODO: Implement actual drive type detection
    // For now, assume C: is local, others might be removable
    return driveLetter === 'C' ? 'local' : 'removable';
  }

  async copyFile(source: string, destination: string): Promise<void> {
    try {
      await fs.copyFile(source, destination);
    } catch (error) {
      console.error(`Error copying file from ${source} to ${destination}:`, error);
      throw error;
    }
  }

  async moveFile(source: string, destination: string): Promise<void> {
    try {
      await fs.rename(source, destination);
    } catch (error) {
      console.error(`Error moving file from ${source} to ${destination}:`, error);
      throw error;
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.error(`Error deleting file ${filePath}:`, error);
      throw error;
    }
  }

  async createDirectory(path: string): Promise<void> {
    try {
      await fs.mkdir(path, { recursive: true });
    } catch (error) {
      console.error(`Error creating directory ${path}:`, error);
      throw error;
    }
  }

  async deleteDirectory(path: string): Promise<void> {
    try {
      await fs.rmdir(path, { recursive: true });
    } catch (error) {
      console.error(`Error deleting directory ${path}:`, error);
      throw error;
    }
  }

  // Additional utility methods for enhanced functionality
  
  async getFileStats(filePath: string): Promise<{ size: number; dateModified: Date; dateCreated: Date } | null> {
    try {
      const stats = await fs.stat(filePath);
      return {
        size: stats.size,
        dateModified: stats.mtime,
        dateCreated: stats.birthtime,
      };
    } catch (error) {
      console.error(`Error getting file stats for ${filePath}:`, error);
      return null;
    }
  }

  async isDirectory(path: string): Promise<boolean> {
    try {
      const stats = await fs.stat(path);
      return stats.isDirectory();
    } catch (error) {
      return false;
    }
  }

  async isFile(path: string): Promise<boolean> {
    try {
      const stats = await fs.stat(path);
      return stats.isFile();
    } catch (error) {
      return false;
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch (error) {
      return false;
    }
  }

  async pathExists(path: string): Promise<boolean> {
    return this.exists(path);
  }

  async fileExists(path: string): Promise<boolean> {
    return this.exists(path);
  }



  // Get all supported extensions
  getSupportedExtensions(): { images: string[]; videos: string[] } {
    return {
      images: [...this.supportedImageExtensions],
      videos: [...this.supportedVideoExtensions],
    };
  }

  // Check if a specific extension is supported
  isExtensionSupported(extension: string): boolean {
    return this.isMediaFile(extension);
  }

  // Clear directory cache (useful for refreshing)
  clearCache(): void {
    this.directoryCache.clear();
  }

  // Get cache statistics
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.directoryCache.size,
      entries: Array.from(this.directoryCache.keys()),
    };
  }

  // Batch file operations
  async batchCopyFiles(operations: Array<{ source: string; destination: string }>): Promise<Array<{ success: boolean; error?: string }>> {
    const results: Array<{ success: boolean; error?: string }> = [];
    
    // Process in batches to avoid overwhelming the system
    const batches = this.createBatches(operations, this.maxConcurrentOperations);
    
    for (const batch of batches) {
      const promises = batch.map(async (op) => {
        try {
          await this.copyFile(op.source, op.destination);
          return { success: true };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      });
      
      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    }
    
    return results;
  }

  async batchMoveFiles(operations: Array<{ source: string; destination: string }>): Promise<Array<{ success: boolean; error?: string }>> {
    const results: Array<{ success: boolean; error?: string }> = [];
    
    // Process in batches to avoid overwhelming the system
    const batches = this.createBatches(operations, this.maxConcurrentOperations);
    
    for (const batch of batches) {
      const promises = batch.map(async (op) => {
        try {
          await this.moveFile(op.source, op.destination);
          return { success: true };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      });
      
      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    }
    
    return results;
  }

  async batchDeleteFiles(filePaths: string[]): Promise<Array<{ success: boolean; error?: string }>> {
    const results: Array<{ success: boolean; error?: string }> = [];
    
    // Process in batches to avoid overwhelming the system
    const batches = this.createBatches(filePaths, this.maxConcurrentOperations);
    
    for (const batch of batches) {
      const promises = batch.map(async (filePath) => {
        try {
          await this.deleteFile(filePath);
          return { success: true };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      });
      
      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    }
    
    return results;
  }
}

