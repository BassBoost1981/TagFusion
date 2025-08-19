import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface DriveInfo {
  name: string;
  path: string;
  type: 'fixed' | 'removable' | 'network' | 'cdrom' | 'ram';
  available: boolean;
  label?: string;
  totalSize?: number;
  freeSize?: number;
}

export interface DirectoryContent {
  folders: FolderInfo[];
  files: FileInfo[];
  path: string;
}

export interface FolderInfo {
  name: string;
  path: string;
  dateModified: Date;
  hasSubfolders: boolean;
  mediaCount?: number;
}

export interface FileInfo {
  name: string;
  path: string;
  type: 'image' | 'video' | 'other';
  size: number;
  dateModified: Date;
  extension: string;
}

export class FileSystemService {
  private readonly imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp']);
  private readonly videoExtensions = new Set(['.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm']);

  async getDrives(): Promise<DriveInfo[]> {
    const drives: DriveInfo[] = [];
    
    try {
      if (process.platform === 'win32') {
        // Windows: Scan all drive letters
        for (let i = 65; i <= 90; i++) { // A-Z
          const driveLetter = String.fromCharCode(i);
          const drivePath = `${driveLetter}:\\`;
          
          try {
            await fs.promises.access(drivePath);
            const stats = await fs.promises.stat(drivePath);
            
            if (stats.isDirectory()) {
              // Try to get drive label and size
              let label = driveLetter;
              let totalSize: number | undefined;
              let freeSize: number | undefined;
              
              try {
                // Try to read volume label (this is a simplified approach)
                const files = await fs.promises.readdir(drivePath);
                // For now, we'll use the drive letter as label
                label = `${driveLetter}: Drive`;
                
                // Try to get disk space (simplified)
                const stat = await fs.promises.statfs?.(drivePath);
                if (stat) {
                  totalSize = stat.blocks * stat.bsize;
                  freeSize = stat.bavail * stat.bsize;
                }
              } catch (error) {
                // Ignore errors when getting additional info
              }
              
              drives.push({
                name: label,
                path: drivePath,
                type: this.getDriveType(driveLetter),
                available: true,
                label,
                totalSize,
                freeSize,
              });
            }
          } catch (error) {
            // Drive not available, skip
          }
        }
      } else if (process.platform === 'darwin') {
        // macOS: Check /Volumes
        try {
          const volumes = await fs.promises.readdir('/Volumes');
          for (const volume of volumes) {
            const volumePath = `/Volumes/${volume}`;
            try {
              const stats = await fs.promises.stat(volumePath);
              if (stats.isDirectory()) {
                drives.push({
                  name: volume,
                  path: volumePath,
                  type: 'fixed',
                  available: true,
                  label: volume,
                });
              }
            } catch (error) {
              // Skip inaccessible volumes
            }
          }
        } catch (error) {
          // Fallback to root
          drives.push({
            name: 'Root',
            path: '/',
            type: 'fixed',
            available: true,
            label: 'Root',
          });
        }
        
        // Add home directory
        const homeDir = os.homedir();
        drives.push({
          name: 'Home',
          path: homeDir,
          type: 'fixed',
          available: true,
          label: 'Home Directory',
        });
      } else {
        // Linux: Start with root and common mount points
        drives.push({
          name: 'Root',
          path: '/',
          type: 'fixed',
          available: true,
          label: 'Root Directory',
        });
        
        // Add home directory
        const homeDir = os.homedir();
        drives.push({
          name: 'Home',
          path: homeDir,
          type: 'fixed',
          available: true,
          label: 'Home Directory',
        });
        
        // Check common mount points
        const mountPoints = ['/media', '/mnt', '/run/media'];
        for (const mountPoint of mountPoints) {
          try {
            const entries = await fs.promises.readdir(mountPoint);
            for (const entry of entries) {
              const entryPath = path.join(mountPoint, entry);
              try {
                const stats = await fs.promises.stat(entryPath);
                if (stats.isDirectory()) {
                  drives.push({
                    name: entry,
                    path: entryPath,
                    type: 'removable',
                    available: true,
                    label: entry,
                  });
                }
              } catch (error) {
                // Skip inaccessible mounts
              }
            }
          } catch (error) {
            // Mount point doesn't exist, skip
          }
        }
      }
    } catch (error) {
      console.error('Error scanning drives:', error);
    }
    
    return drives;
  }

  private getDriveType(driveLetter: string): DriveInfo['type'] {
    // Simple heuristic for Windows drive types
    if (driveLetter === 'A' || driveLetter === 'B') return 'removable';
    if (driveLetter === 'C' || driveLetter === 'D') return 'fixed';
    return 'removable'; // Assume removable for other drives
  }

  async getDirectoryContents(dirPath: string): Promise<DirectoryContent> {
    const folders: FolderInfo[] = [];
    const files: FileInfo[] = [];
    
    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        try {
          const stats = await fs.promises.stat(fullPath);
          
          if (entry.isDirectory()) {
            // Check if folder has subfolders
            let hasSubfolders = false;
            let mediaCount = 0;
            
            try {
              const subEntries = await fs.promises.readdir(fullPath, { withFileTypes: true });
              hasSubfolders = subEntries.some(subEntry => subEntry.isDirectory());
              mediaCount = subEntries.filter(subEntry => 
                subEntry.isFile() && this.isMediaFile(subEntry.name)
              ).length;
            } catch (error) {
              // Can't read subdirectory, assume no subfolders
            }
            
            folders.push({
              name: entry.name,
              path: fullPath,
              dateModified: stats.mtime,
              hasSubfolders,
              mediaCount,
            });
          } else if (entry.isFile()) {
            const extension = path.extname(entry.name).toLowerCase();
            const fileType = this.getFileType(extension);
            
            // Only include media files and some common file types
            if (fileType !== 'other' || this.isCommonFileType(extension)) {
              files.push({
                name: entry.name,
                path: fullPath,
                type: fileType,
                size: stats.size,
                dateModified: stats.mtime,
                extension,
              });
            }
          }
        } catch (error) {
          // Skip files/folders we can't access
          console.warn(`Cannot access ${fullPath}:`, error instanceof Error ? error.message : String(error));
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dirPath}:`, error);
      throw new Error(`Cannot read directory: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Sort folders and files alphabetically
    folders.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => a.name.localeCompare(b.name));
    
    return {
      folders,
      files,
      path: dirPath,
    };
  }

  private isMediaFile(filename: string): boolean {
    const extension = path.extname(filename).toLowerCase();
    return this.imageExtensions.has(extension) || this.videoExtensions.has(extension);
  }

  private getFileType(extension: string): 'image' | 'video' | 'other' {
    if (this.imageExtensions.has(extension)) return 'image';
    if (this.videoExtensions.has(extension)) return 'video';
    return 'other';
  }

  private isCommonFileType(extension: string): boolean {
    const commonExtensions = new Set([
      '.txt', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.zip', '.rar', '.7z', '.exe', '.msi'
    ]);
    return commonExtensions.has(extension);
  }

  async createDirectory(dirPath: string): Promise<void> {
    await fs.promises.mkdir(dirPath, { recursive: true });
  }

  async deleteFile(filePath: string): Promise<void> {
    await fs.promises.unlink(filePath);
  }

  async deleteDirectory(dirPath: string): Promise<void> {
    await fs.promises.rmdir(dirPath, { recursive: true });
  }

  async copyFile(sourcePath: string, destinationPath: string): Promise<void> {
    await fs.promises.copyFile(sourcePath, destinationPath);
  }

  async moveFile(sourcePath: string, destinationPath: string): Promise<void> {
    await fs.promises.rename(sourcePath, destinationPath);
  }

  async getFileStats(filePath: string): Promise<fs.Stats> {
    return await fs.promises.stat(filePath);
  }

  async pathExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}