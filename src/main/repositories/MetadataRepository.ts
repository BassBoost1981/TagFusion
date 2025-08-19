import * as ExifReader from 'exifreader';
import * as piexif from 'piexifjs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { MediaMetadata, HierarchicalTag, EXIFData, CameraInfo } from '../../types/global';

export interface IMetadataRepository {
  readMetadata(filePath: string): Promise<MediaMetadata>;
  writeMetadata(filePath: string, metadata: MediaMetadata): Promise<void>;
  extractTags(filePath: string): Promise<HierarchicalTag[]>;
  writeTags(filePath: string, tags: HierarchicalTag[]): Promise<void>;
  readEXIFData(filePath: string): Promise<EXIFData>;
  writeRating(filePath: string, rating: number): Promise<void>;
}

export class MetadataRepository implements IMetadataRepository {
  private readonly supportedImageFormats = ['.jpg', '.jpeg', '.tiff', '.tif'];
  
  /**
   * Read complete metadata from a media file
   */
  async readMetadata(filePath: string): Promise<MediaMetadata> {
    try {
      const fileExtension = path.extname(filePath).toLowerCase();
      
      if (!this.supportedImageFormats.includes(fileExtension)) {
        // Return default metadata for unsupported formats
        return {
          tags: [],
          rating: 0,
          dateCreated: new Date(),
          cameraInfo: undefined
        };
      }

      const fileBuffer = await fs.readFile(filePath);
      const exifData = ExifReader.load(fileBuffer);
      
      // Extract tags from XMP data
      const tags = await this.extractTagsFromXMP(exifData);
      
      // Extract rating from XMP or EXIF
      const rating = this.extractRating(exifData);
      
      // Extract date created
      const dateCreated = this.extractDateCreated(exifData);
      
      // Extract camera info
      const cameraInfo = this.extractCameraInfo(exifData);

      return {
        tags,
        rating,
        dateCreated,
        cameraInfo
      };
    } catch (error) {
      console.error(`Error reading metadata from ${filePath}:`, error);
      // Return default metadata on error
      return {
        tags: [],
        rating: 0,
        dateCreated: new Date(),
        cameraInfo: undefined
      };
    }
  }

  /**
   * Write complete metadata to a media file
   */
  async writeMetadata(filePath: string, metadata: MediaMetadata): Promise<void> {
    try {
      const fileExtension = path.extname(filePath).toLowerCase();
      
      if (!this.supportedImageFormats.includes(fileExtension)) {
        throw new Error(`Metadata writing not supported for ${fileExtension} files`);
      }

      // Read existing EXIF data
      const fileBuffer = await fs.readFile(filePath);
      let exifDict: any = {};
      
      try {
        exifDict = piexif.load(fileBuffer.toString('binary'));
      } catch (error) {
        // If no EXIF data exists, create new structure
        exifDict = {
          '0th': {},
          'Exif': {},
          'GPS': {},
          '1st': {},
          'thumbnail': null
        };
      }

      // Write tags to XMP
      await this.writeTagsToXMP(exifDict, metadata.tags);
      
      // Write rating
      this.writeRatingToEXIF(exifDict, metadata.rating);
      
      // Convert back to binary and write to file
      const exifBytes = piexif.dump(exifDict);
      const newImageData = piexif.insert(exifBytes, fileBuffer.toString('binary'));
      
      // Write back to file
      await fs.writeFile(filePath, Buffer.from(newImageData, 'binary'));
      
    } catch (error) {
      console.error(`Error writing metadata to ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Extract only tags from a media file
   */
  async extractTags(filePath: string): Promise<HierarchicalTag[]> {
    try {
      const metadata = await this.readMetadata(filePath);
      return metadata.tags;
    } catch (error) {
      console.error(`Error extracting tags from ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Write only tags to a media file
   */
  async writeTags(filePath: string, tags: HierarchicalTag[]): Promise<void> {
    try {
      // Read existing metadata
      const existingMetadata = await this.readMetadata(filePath);
      
      // Update only tags
      const updatedMetadata: MediaMetadata = {
        ...existingMetadata,
        tags
      };
      
      // Write back complete metadata
      await this.writeMetadata(filePath, updatedMetadata);
    } catch (error) {
      console.error(`Error writing tags to ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Read detailed EXIF data for display purposes
   */
  async readEXIFData(filePath: string): Promise<EXIFData> {
    try {
      const fileExtension = path.extname(filePath).toLowerCase();
      
      if (!this.supportedImageFormats.includes(fileExtension)) {
        return this.getEmptyEXIFData();
      }

      const fileBuffer = await fs.readFile(filePath);
      const exifData = ExifReader.load(fileBuffer);
      
      return {
        camera: {
          make: exifData.Make?.description,
          model: exifData.Model?.description,
          lens: exifData.LensModel?.description || exifData.LensSpecification?.description
        },
        settings: {
          aperture: exifData.FNumber?.description,
          shutterSpeed: exifData.ExposureTime?.description,
          iso: exifData.ISOSpeedRatings?.value,
          focalLength: exifData.FocalLength?.description,
          flash: exifData.Flash?.value === 1
        },
        location: {
          dateTime: this.parseDateTime(exifData.DateTime?.description || exifData.DateTimeOriginal?.description),
          gps: this.extractGPSData(exifData)
        },
        technical: {
          colorSpace: exifData.ColorSpace?.description,
          whiteBalance: exifData.WhiteBalance?.description,
          meteringMode: exifData.MeteringMode?.description
        }
      };
    } catch (error) {
      console.error(`Error reading EXIF data from ${filePath}:`, error);
      return this.getEmptyEXIFData();
    }
  }

  /**
   * Write only rating to a media file
   */
  async writeRating(filePath: string, rating: number): Promise<void> {
    try {
      // Validate rating
      if (rating < 0 || rating > 5) {
        throw new Error('Rating must be between 0 and 5');
      }

      // Read existing metadata
      const existingMetadata = await this.readMetadata(filePath);
      
      // Update only rating
      const updatedMetadata: MediaMetadata = {
        ...existingMetadata,
        rating
      };
      
      // Write back complete metadata
      await this.writeMetadata(filePath, updatedMetadata);
    } catch (error) {
      console.error(`Error writing rating to ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Extract hierarchical tags from XMP data
   */
  private async extractTagsFromXMP(exifData: any): Promise<HierarchicalTag[]> {
    const tags: HierarchicalTag[] = [];
    
    try {
      // Look for XMP subject tags (standard location for keywords)
      const xmpSubject = exifData['dc:subject'] || exifData.Subject;
      
      if (xmpSubject && Array.isArray(xmpSubject)) {
        for (const tagString of xmpSubject) {
          const hierarchicalTag = this.parseHierarchicalTag(tagString);
          if (hierarchicalTag) {
            tags.push(hierarchicalTag);
          }
        }
      }
      
      // Also check for hierarchical keywords in XMP
      const xmpHierarchicalKeywords = exifData['lr:hierarchicalSubject'];
      if (xmpHierarchicalKeywords && Array.isArray(xmpHierarchicalKeywords)) {
        for (const tagString of xmpHierarchicalKeywords) {
          const hierarchicalTag = this.parseHierarchicalTag(tagString);
          if (hierarchicalTag) {
            tags.push(hierarchicalTag);
          }
        }
      }
      
    } catch (error) {
      console.error('Error extracting tags from XMP:', error);
    }
    
    return tags;
  }

  /**
   * Parse a hierarchical tag string like "Nature|Landscape|Mountains"
   */
  private parseHierarchicalTag(tagString: string): HierarchicalTag | null {
    try {
      // Support both | and / as separators
      const parts = tagString.split(/[|\/]/).map(part => part.trim()).filter(part => part.length > 0);
      
      if (parts.length === 0) {
        return null;
      }
      
      if (parts.length === 1) {
        // Single tag without hierarchy
        return {
          category: parts[0],
          subcategory: undefined,
          tag: parts[0],
          fullPath: parts[0]
        };
      } else if (parts.length === 2) {
        // Category/Tag
        return {
          category: parts[0],
          subcategory: undefined,
          tag: parts[1],
          fullPath: parts.join('/')
        };
      } else {
        // Category/Subcategory/Tag (or deeper)
        return {
          category: parts[0],
          subcategory: parts[1],
          tag: parts[parts.length - 1],
          fullPath: parts.join('/')
        };
      }
    } catch (error) {
      console.error(`Error parsing hierarchical tag: ${tagString}`, error);
      return null;
    }
  }

  /**
   * Write hierarchical tags to XMP format
   */
  private async writeTagsToXMP(exifDict: any, tags: HierarchicalTag[]): Promise<void> {
    try {
      // Ensure exifDict exists and has proper structure
      if (!exifDict) {
        throw new Error('EXIF dictionary is undefined');
      }
      
      // Ensure XMP structure exists
      if (!exifDict['0th']) {
        exifDict['0th'] = {};
      }
      
      // Convert hierarchical tags to XMP format
      const xmpSubjects: string[] = [];
      const hierarchicalSubjects: string[] = [];
      
      for (const tag of tags) {
        // Add to standard subject field
        xmpSubjects.push(tag.tag);
        
        // Add to hierarchical subject field with full path
        hierarchicalSubjects.push(tag.fullPath.replace(/\//g, '|'));
      }
      
      // Write to EXIF dictionary
      // Note: piexifjs has limited XMP support, so we store in available fields
      if (xmpSubjects.length > 0) {
        // Store as comma-separated string in ImageDescription for now
        // In a full implementation, proper XMP handling would be needed
        const tagString = hierarchicalSubjects.join(';');
        exifDict['0th'][piexif.ImageIFD.ImageDescription] = tagString;
      }
      
    } catch (error) {
      console.error('Error writing tags to XMP:', error);
      throw error;
    }
  }

  /**
   * Extract rating from EXIF/XMP data
   */
  private extractRating(exifData: any): number {
    try {
      // Look for rating in various possible locations
      const rating = exifData.Rating?.value || 
                    exifData['xmp:Rating']?.value || 
                    exifData['exif:Rating']?.value ||
                    0;
      
      return Math.max(0, Math.min(5, parseInt(rating) || 0));
    } catch (error) {
      console.error('Error extracting rating:', error);
      return 0;
    }
  }

  /**
   * Write rating to EXIF data
   */
  private writeRatingToEXIF(exifDict: any, rating: number): void {
    try {
      // Ensure exifDict exists and has proper structure
      if (!exifDict) {
        throw new Error('EXIF dictionary is undefined');
      }
      
      // Ensure structure exists
      if (!exifDict['0th']) {
        exifDict['0th'] = {};
      }
      
      // Store rating in a custom field (since piexifjs has limited XMP support)
      // In a full implementation, this would go to XMP rating field
      exifDict['0th'][piexif.ImageIFD.Software] = `Rating:${rating}`;
      
    } catch (error) {
      console.error('Error writing rating to EXIF:', error);
      throw error;
    }
  }

  /**
   * Extract date created from EXIF data
   */
  private extractDateCreated(exifData: any): Date {
    try {
      const dateString = exifData.DateTimeOriginal?.description || 
                        exifData.DateTime?.description ||
                        exifData.DateTimeDigitized?.description;
      
      if (dateString) {
        return this.parseDateTime(dateString) || new Date();
      }
      
      return new Date();
    } catch (error) {
      console.error('Error extracting date created:', error);
      return new Date();
    }
  }

  /**
   * Extract camera information from EXIF data
   */
  private extractCameraInfo(exifData: any): CameraInfo | undefined {
    try {
      const make = exifData.Make?.description;
      const model = exifData.Model?.description;
      const lens = exifData.LensModel?.description || exifData.LensSpecification?.description;
      const aperture = exifData.FNumber?.description;
      const shutterSpeed = exifData.ExposureTime?.description;
      const iso = exifData.ISOSpeedRatings?.value;
      const focalLength = exifData.FocalLength?.description;
      
      if (!make && !model && !lens && !aperture && !shutterSpeed && !iso && !focalLength) {
        return undefined;
      }
      
      return {
        make,
        model,
        lens,
        aperture,
        shutterSpeed,
        iso,
        focalLength
      };
    } catch (error) {
      console.error('Error extracting camera info:', error);
      return undefined;
    }
  }

  /**
   * Parse date time string from EXIF format
   */
  private parseDateTime(dateString?: string): Date | undefined {
    if (!dateString) {
      return undefined;
    }
    
    try {
      // EXIF date format: "YYYY:MM:DD HH:MM:SS"
      const cleanDateString = dateString.replace(/:/g, '-', 2).replace(/-/g, ':', 2);
      const date = new Date(cleanDateString);
      
      if (isNaN(date.getTime())) {
        return undefined;
      }
      
      return date;
    } catch (error) {
      console.error(`Error parsing date: ${dateString}`, error);
      return undefined;
    }
  }

  /**
   * Extract GPS data from EXIF
   */
  private extractGPSData(exifData: any): { latitude: number; longitude: number; altitude?: number } | undefined {
    try {
      const gpsLat = exifData.GPSLatitude?.value;
      const gpsLatRef = exifData.GPSLatitudeRef?.value;
      const gpsLon = exifData.GPSLongitude?.value;
      const gpsLonRef = exifData.GPSLongitudeRef?.value;
      const gpsAlt = exifData.GPSAltitude?.value;
      
      if (!gpsLat || !gpsLon) {
        return undefined;
      }
      
      // Convert GPS coordinates from degrees/minutes/seconds to decimal
      const latitude = this.convertGPSCoordinate(gpsLat, gpsLatRef);
      const longitude = this.convertGPSCoordinate(gpsLon, gpsLonRef);
      
      if (latitude === null || longitude === null) {
        return undefined;
      }
      
      const result: { latitude: number; longitude: number; altitude?: number } = {
        latitude,
        longitude
      };
      
      if (gpsAlt) {
        result.altitude = parseFloat(gpsAlt);
      }
      
      return result;
    } catch (error) {
      console.error('Error extracting GPS data:', error);
      return undefined;
    }
  }

  /**
   * Convert GPS coordinate from DMS to decimal degrees
   */
  private convertGPSCoordinate(coordinate: any, reference: string): number | null {
    try {
      if (!Array.isArray(coordinate) || coordinate.length !== 3) {
        return null;
      }
      
      const degrees = parseFloat(coordinate[0]);
      const minutes = parseFloat(coordinate[1]);
      const seconds = parseFloat(coordinate[2]);
      
      let decimal = degrees + (minutes / 60) + (seconds / 3600);
      
      // Apply reference (N/S for latitude, E/W for longitude)
      if (reference === 'S' || reference === 'W') {
        decimal = -decimal;
      }
      
      return decimal;
    } catch (error) {
      console.error('Error converting GPS coordinate:', error);
      return null;
    }
  }

  /**
   * Get empty EXIF data structure
   */
  private getEmptyEXIFData(): EXIFData {
    return {
      camera: {
        make: undefined,
        model: undefined,
        lens: undefined
      },
      settings: {
        aperture: undefined,
        shutterSpeed: undefined,
        iso: undefined,
        focalLength: undefined,
        flash: undefined
      },
      location: {
        dateTime: undefined,
        gps: undefined
      },
      technical: {
        colorSpace: undefined,
        whiteBalance: undefined,
        meteringMode: undefined
      }
    };
  }
}