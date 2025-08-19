import { IImageProcessorService } from './DIContainer';

export class ImageProcessorService implements IImageProcessorService {
  async generateThumbnail(filePath: string, size: number): Promise<string> {
    try {
      // Use Electron IPC to generate thumbnail via main process
      const result = await window.electronAPI?.imageProcessor?.generateThumbnail(filePath, { size });
      return result?.dataUrl || '';
    } catch (error) {
      console.error('Failed to generate thumbnail:', error);
      return '';
    }
  }

  async processImage(filePath: string, operations: any[]): Promise<string> {
    try {
      const result = await window.electronAPI?.imageProcessor?.processImage(filePath, operations);
      return result?.outputPath || '';
    } catch (error) {
      console.error('Failed to process image:', error);
      throw error;
    }
  }

  async resizeImage(filePath: string, width: number, height: number): Promise<string> {
    try {
      const result = await window.electronAPI?.imageProcessor?.resizeImage(filePath, { width, height });
      return result?.outputPath || '';
    } catch (error) {
      console.error('Failed to resize image:', error);
      throw error;
    }
  }

  async rotateImage(filePath: string, degrees: number): Promise<string> {
    try {
      const result = await window.electronAPI?.imageProcessor?.rotateImage(filePath, degrees);
      return result?.outputPath || '';
    } catch (error) {
      console.error('Failed to rotate image:', error);
      throw error;
    }
  }

  async cropImage(filePath: string, x: number, y: number, width: number, height: number): Promise<string> {
    try {
      const result = await window.electronAPI?.imageProcessor?.cropImage(filePath, { x, y, width, height });
      return result?.outputPath || '';
    } catch (error) {
      console.error('Failed to crop image:', error);
      throw error;
    }
  }

  async adjustBrightness(filePath: string, brightness: number): Promise<string> {
    try {
      const result = await window.electronAPI?.imageProcessor?.adjustBrightness(filePath, brightness);
      return result?.outputPath || '';
    } catch (error) {
      console.error('Failed to adjust brightness:', error);
      throw error;
    }
  }

  async adjustContrast(filePath: string, contrast: number): Promise<string> {
    try {
      const result = await window.electronAPI?.imageProcessor?.adjustContrast(filePath, contrast);
      return result?.outputPath || '';
    } catch (error) {
      console.error('Failed to adjust contrast:', error);
      throw error;
    }
  }

  async adjustSaturation(filePath: string, saturation: number): Promise<string> {
    try {
      const result = await window.electronAPI?.imageProcessor?.adjustSaturation(filePath, saturation);
      return result?.outputPath || '';
    } catch (error) {
      console.error('Failed to adjust saturation:', error);
      throw error;
    }
  }

  async getImageInfo(filePath: string): Promise<any> {
    try {
      const result = await window.electronAPI?.imageProcessor?.getImageInfo(filePath);
      return result || {};
    } catch (error) {
      console.error('Failed to get image info:', error);
      return {};
    }
  }

  async convertFormat(filePath: string, targetFormat: string, quality?: number): Promise<string> {
    try {
      const result = await window.electronAPI?.imageProcessor?.convertFormat(filePath, targetFormat, quality);
      return result?.outputPath || '';
    } catch (error) {
      console.error('Failed to convert format:', error);
      throw error;
    }
  }
}