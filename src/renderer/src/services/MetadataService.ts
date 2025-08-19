import { IMetadataService } from './DIContainer';

export class MetadataService implements IMetadataService {
  async readMetadata(filePath: string): Promise<any> {
    try {
      // Use Electron IPC to read metadata from main process
      const metadata = await window.electronAPI?.metadata?.read(filePath);
      return metadata || {};
    } catch (error) {
      console.error('Failed to read metadata:', error);
      return {};
    }
  }

  async writeMetadata(filePath: string, metadata: any): Promise<void> {
    try {
      // Use Electron IPC to write metadata via main process
      const result = await window.electronAPI?.metadata?.write(filePath, metadata);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to write metadata');
      }
    } catch (error) {
      console.error('Failed to write metadata:', error);
      throw error;
    }
  }

  async readTags(filePath: string): Promise<string[]> {
    try {
      const metadata = await this.readMetadata(filePath);
      return metadata.tags || [];
    } catch (error) {
      console.error('Failed to read tags:', error);
      return [];
    }
  }

  async writeTags(filePath: string, tags: string[]): Promise<void> {
    try {
      const metadata = await this.readMetadata(filePath);
      metadata.tags = tags;
      await this.writeMetadata(filePath, metadata);
    } catch (error) {
      console.error('Failed to write tags:', error);
      throw error;
    }
  }

  async readRating(filePath: string): Promise<number | null> {
    try {
      const rating = await window.electronAPI?.rating?.getRating(filePath);
      return rating || null;
    } catch (error) {
      console.error('Failed to read rating:', error);
      return null;
    }
  }

  async writeRating(filePath: string, rating: number): Promise<void> {
    try {
      const result = await window.electronAPI?.rating?.setRating(filePath, rating);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to set rating');
      }
    } catch (error) {
      console.error('Failed to write rating:', error);
      throw error;
    }
  }

  async setBatchRating(filePaths: string[], rating: number): Promise<void> {
    try {
      const result = await window.electronAPI?.rating?.setBatchRating(filePaths, rating);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to set batch rating');
      }
    } catch (error) {
      console.error('Failed to set batch rating:', error);
      throw error;
    }
  }

  async getExifData(filePath: string): Promise<any> {
    try {
      const exifData = await window.electronAPI?.metadata?.readExif(filePath);
      return exifData || {};
    } catch (error) {
      console.error('Failed to get EXIF data:', error);
      return {};
    }
  }

  async getFileInfo(filePath: string): Promise<any> {
    try {
      const metadata = await this.readMetadata(filePath);
      return {
        fileName: metadata.fileName,
        fileSize: metadata.fileSize,
        dateCreated: metadata.dateCreated,
        dateModified: metadata.dateModified,
        dimensions: metadata.dimensions,
        format: metadata.format,
      };
    } catch (error) {
      console.error('Failed to get file info:', error);
      return {};
    }
  }
}