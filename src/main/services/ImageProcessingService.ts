import { ImageOperation, CropArea, RotationAngle } from '../../types/global';
import * as fs from 'fs/promises';
import * as path from 'path';

export class ImageProcessingService {
  private sharp: any;

  constructor() {
    // Lazy load Sharp to avoid issues if it's not available
    try {
      this.sharp = require('sharp');
    } catch (error) {
      console.warn('Sharp not available, image processing will be limited:', error);
    }
  }

  /**
   * Process an image with a series of operations and save to a new file
   */
  public async processAndSaveImage(
    inputPath: string,
    outputPath: string,
    operations: ImageOperation[],
    quality: number = 90
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.sharp) {
        return { success: false, error: 'Image processing library not available' };
      }

      // Check if input file exists
      try {
        await fs.access(inputPath);
      } catch (error) {
        return { success: false, error: 'Input file not found' };
      }

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      // Start with the original image
      let image = this.sharp(inputPath);

      // Apply operations in sequence
      for (const operation of operations) {
        image = await this.applyOperation(image, operation);
      }

      // Determine output format based on file extension
      const ext = path.extname(outputPath).toLowerCase();
      
      switch (ext) {
        case '.jpg':
        case '.jpeg':
          await image.jpeg({ quality }).toFile(outputPath);
          break;
        case '.png':
          await image.png({ quality: Math.round(quality / 10) }).toFile(outputPath);
          break;
        case '.webp':
          await image.webp({ quality }).toFile(outputPath);
          break;
        default:
          // Default to JPEG
          await image.jpeg({ quality }).toFile(outputPath);
          break;
      }

      return { success: true };
    } catch (error) {
      console.error('Error processing image:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Apply a single operation to a Sharp image instance
   */
  private async applyOperation(image: any, operation: ImageOperation): Promise<any> {
    switch (operation.type) {
      case 'brightness':
        return this.applyBrightness(image, operation.value as number);
      
      case 'contrast':
        return this.applyContrast(image, operation.value as number);
      
      case 'saturation':
        return this.applySaturation(image, operation.value as number);
      
      case 'rotate':
        return this.applyRotation(image, (operation.value as RotationAngle).degrees);
      
      case 'crop':
        return this.applyCrop(image, operation.value as CropArea);
      
      case 'resize':
        return this.applyResize(image, operation.value as number);
      
      default:
        console.warn(`Unknown operation type: ${operation.type}`);
        return image;
    }
  }

  /**
   * Apply brightness adjustment
   */
  private applyBrightness(image: any, value: number): any {
    // Convert brightness value (-100 to 100) to multiplier
    const multiplier = 1 + (value / 100);
    return image.modulate({ brightness: Math.max(0.1, multiplier) });
  }

  /**
   * Apply contrast adjustment
   */
  private applyContrast(image: any, value: number): any {
    // Convert contrast value (-100 to 100) to linear multiplier
    const multiplier = 1 + (value / 100);
    return image.linear(Math.max(0.1, multiplier), 0);
  }

  /**
   * Apply saturation adjustment
   */
  private applySaturation(image: any, value: number): any {
    // Convert saturation percentage to multiplier
    const multiplier = value / 100;
    return image.modulate({ saturation: Math.max(0, multiplier) });
  }

  /**
   * Apply rotation
   */
  private applyRotation(image: any, degrees: number): any {
    return image.rotate(degrees);
  }

  /**
   * Apply crop
   */
  private async applyCrop(image: any, cropArea: CropArea): Promise<any> {
    return image.extract({
      left: Math.max(0, Math.round(cropArea.x)),
      top: Math.max(0, Math.round(cropArea.y)),
      width: Math.max(1, Math.round(cropArea.width)),
      height: Math.max(1, Math.round(cropArea.height))
    });
  }

  /**
   * Apply resize
   */
  private async applyResize(image: any, scale: number): Promise<any> {
    const metadata = await image.metadata();
    if (metadata.width && metadata.height) {
      const newWidth = Math.max(1, Math.round(metadata.width * scale));
      const newHeight = Math.max(1, Math.round(metadata.height * scale));
      return image.resize(newWidth, newHeight);
    }
    return image;
  }

  /**
   * Get image metadata
   */
  public async getImageMetadata(filePath: string): Promise<{ width: number; height: number; format: string } | null> {
    try {
      if (!this.sharp) {
        return null;
      }

      const metadata = await this.sharp(filePath).metadata();
      return {
        width: metadata.width || 0,
        height: metadata.height || 0,
        format: metadata.format || 'unknown'
      };
    } catch (error) {
      console.error('Error getting image metadata:', error);
      return null;
    }
  }

  /**
   * Generate a thumbnail from an image
   */
  public async generateThumbnail(
    inputPath: string,
    outputPath: string,
    width: number,
    height: number,
    quality: number = 80
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.sharp) {
        return { success: false, error: 'Image processing library not available' };
      }

      await this.sharp(inputPath)
        .resize(width, height, { fit: 'cover', position: 'center' })
        .jpeg({ quality })
        .toFile(outputPath);

      return { success: true };
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Convert canvas data to image file
   */
  public async saveCanvasToFile(
    canvasDataUrl: string,
    outputPath: string,
    quality: number = 90
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Extract base64 data from data URL
      const base64Data = canvasDataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      if (!this.sharp) {
        // Fallback: save raw buffer
        await fs.writeFile(outputPath, buffer);
        return { success: true };
      }

      // Use Sharp to process and save with quality settings
      const ext = path.extname(outputPath).toLowerCase();
      let image = this.sharp(buffer);

      switch (ext) {
        case '.jpg':
        case '.jpeg':
          await image.jpeg({ quality }).toFile(outputPath);
          break;
        case '.png':
          await image.png({ quality: Math.round(quality / 10) }).toFile(outputPath);
          break;
        case '.webp':
          await image.webp({ quality }).toFile(outputPath);
          break;
        default:
          await image.jpeg({ quality }).toFile(outputPath);
          break;
      }

      return { success: true };
    } catch (error) {
      console.error('Error saving canvas to file:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if Sharp is available
   */
  public isAvailable(): boolean {
    return !!this.sharp;
  }
}