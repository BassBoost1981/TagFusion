import { MediaFile, FolderItem, HierarchicalTag, MediaMetadata } from '../../types/global';
import { IMetadataRepository } from '../repositories/MetadataRepository';

export interface FilterCriteria {
  fileTypes?: ('image' | 'video')[];
  tags?: HierarchicalTag[];
  dateRange?: { from: Date; to: Date };
  rating?: number;
  cameraInfo?: {
    make?: string;
    model?: string;
  };
  sizeRange?: { min: number; max: number };
}

export interface FilterResult {
  files: MediaFile[];
  folders: FolderItem[];
  appliedFilters: FilterCriteria;
  totalCount: number;
  filterTime: number;
}

export interface IFilterService {
  applyFilters(files: MediaFile[], folders: FolderItem[], criteria: FilterCriteria): Promise<FilterResult>;
  filterByFileType(files: MediaFile[], fileTypes: ('image' | 'video')[]): MediaFile[];
  filterByTags(files: MediaFile[], tags: HierarchicalTag[]): Promise<MediaFile[]>;
  filterByDateRange(files: MediaFile[], dateRange: { from: Date; to: Date }): Promise<MediaFile[]>;
  filterByRating(files: MediaFile[], minRating: number): Promise<MediaFile[]>;
  filterBySize(files: MediaFile[], sizeRange: { min: number; max: number }): MediaFile[];
  filterByCameraInfo(files: MediaFile[], cameraInfo: { make?: string; model?: string }): Promise<MediaFile[]>;
  getAvailableTags(files: MediaFile[]): Promise<HierarchicalTag[]>;
  getTagHierarchy(tags: HierarchicalTag[]): TagHierarchyTree;
}

export interface TagHierarchyTree {
  [category: string]: {
    [subcategory: string]: string[];
  };
}

export class FilterService implements IFilterService {
  constructor(private metadataRepository: IMetadataRepository) {}

  /**
   * Apply all filters to the given files and folders
   */
  async applyFilters(files: MediaFile[], folders: FolderItem[], criteria: FilterCriteria): Promise<FilterResult> {
    const startTime = Date.now();
    
    try {
      let filteredFiles = [...files];
      let filteredFolders = [...folders];

      // Apply file type filter
      if (criteria.fileTypes && criteria.fileTypes.length > 0) {
        filteredFiles = this.filterByFileType(filteredFiles, criteria.fileTypes);
      }

      // Apply size filter
      if (criteria.sizeRange) {
        filteredFiles = this.filterBySize(filteredFiles, criteria.sizeRange);
      }

      // Apply metadata-based filters (require async operations)
      if (criteria.tags && criteria.tags.length > 0) {
        filteredFiles = await this.filterByTags(filteredFiles, criteria.tags);
      }

      if (criteria.dateRange) {
        filteredFiles = await this.filterByDateRange(filteredFiles, criteria.dateRange);
      }

      if (criteria.rating !== undefined) {
        filteredFiles = await this.filterByRating(filteredFiles, criteria.rating);
      }

      if (criteria.cameraInfo) {
        filteredFiles = await this.filterByCameraInfo(filteredFiles, criteria.cameraInfo);
      }

      const filterTime = Date.now() - startTime;

      return {
        files: filteredFiles,
        folders: filteredFolders,
        appliedFilters: criteria,
        totalCount: filteredFiles.length + filteredFolders.length,
        filterTime
      };
    } catch (error) {
      console.error('Error applying filters:', error);
      return {
        files: [],
        folders: [],
        appliedFilters: criteria,
        totalCount: 0,
        filterTime: Date.now() - startTime
      };
    }
  }

  /**
   * Filter files by file type
   */
  filterByFileType(files: MediaFile[], fileTypes: ('image' | 'video')[]): MediaFile[] {
    return files.filter(file => fileTypes.includes(file.type));
  }

  /**
   * Filter files by hierarchical tags
   */
  async filterByTags(files: MediaFile[], tags: HierarchicalTag[]): Promise<MediaFile[]> {
    const matchingFiles: MediaFile[] = [];
    
    for (const file of files) {
      try {
        const fileTags = await this.metadataRepository.extractTags(file.path);
        
        // Check if file has any of the required tags (OR logic)
        const hasMatchingTag = tags.some(requiredTag => 
          this.hasMatchingTag(fileTags, requiredTag)
        );
        
        if (hasMatchingTag) {
          matchingFiles.push(file);
        }
      } catch (error) {
        console.warn(`Could not read tags for ${file.path}:`, error);
      }
    }
    
    return matchingFiles;
  }

  /**
   * Filter files by date range
   */
  async filterByDateRange(files: MediaFile[], dateRange: { from: Date; to: Date }): Promise<MediaFile[]> {
    const matchingFiles: MediaFile[] = [];
    
    for (const file of files) {
      try {
        const metadata = await this.metadataRepository.readMetadata(file.path);
        
        if (metadata.dateCreated) {
          const fileDate = metadata.dateCreated;
          if (fileDate >= dateRange.from && fileDate <= dateRange.to) {
            matchingFiles.push(file);
          }
        } else {
          // If no metadata date, use file modification date
          const fileDate = file.dateModified;
          if (fileDate >= dateRange.from && fileDate <= dateRange.to) {
            matchingFiles.push(file);
          }
        }
      } catch (error) {
        console.warn(`Could not read metadata for ${file.path}:`, error);
        // Fallback to file modification date
        const fileDate = file.dateModified;
        if (fileDate >= dateRange.from && fileDate <= dateRange.to) {
          matchingFiles.push(file);
        }
      }
    }
    
    return matchingFiles;
  }

  /**
   * Filter files by minimum rating
   */
  async filterByRating(files: MediaFile[], minRating: number): Promise<MediaFile[]> {
    const matchingFiles: MediaFile[] = [];
    
    for (const file of files) {
      try {
        const metadata = await this.metadataRepository.readMetadata(file.path);
        
        if (metadata.rating >= minRating) {
          matchingFiles.push(file);
        }
      } catch (error) {
        console.warn(`Could not read metadata for ${file.path}:`, error);
      }
    }
    
    return matchingFiles;
  }

  /**
   * Filter files by size range
   */
  filterBySize(files: MediaFile[], sizeRange: { min: number; max: number }): MediaFile[] {
    return files.filter(file => 
      file.size >= (sizeRange.min || 0) &&
      file.size <= (sizeRange.max || Number.MAX_SAFE_INTEGER)
    );
  }

  /**
   * Filter files by camera information
   */
  async filterByCameraInfo(files: MediaFile[], cameraInfo: { make?: string; model?: string }): Promise<MediaFile[]> {
    const matchingFiles: MediaFile[] = [];
    
    for (const file of files) {
      try {
        const exifData = await this.metadataRepository.readEXIFData(file.path);
        
        let matches = true;
        
        if (cameraInfo.make) {
          const fileMake = exifData.camera.make?.toLowerCase() || '';
          const searchMake = cameraInfo.make.toLowerCase();
          if (!fileMake.includes(searchMake)) {
            matches = false;
          }
        }
        
        if (cameraInfo.model && matches) {
          const fileModel = exifData.camera.model?.toLowerCase() || '';
          const searchModel = cameraInfo.model.toLowerCase();
          if (!fileModel.includes(searchModel)) {
            matches = false;
          }
        }
        
        if (matches) {
          matchingFiles.push(file);
        }
      } catch (error) {
        console.warn(`Could not read EXIF data for ${file.path}:`, error);
      }
    }
    
    return matchingFiles;
  }

  /**
   * Get all available tags from a set of files
   */
  async getAvailableTags(files: MediaFile[]): Promise<HierarchicalTag[]> {
    const allTags: HierarchicalTag[] = [];
    const seenTags = new Set<string>();
    
    for (const file of files) {
      try {
        const fileTags = await this.metadataRepository.extractTags(file.path);
        
        for (const tag of fileTags) {
          if (!seenTags.has(tag.fullPath)) {
            allTags.push(tag);
            seenTags.add(tag.fullPath);
          }
        }
      } catch (error) {
        console.warn(`Could not read tags for ${file.path}:`, error);
      }
    }
    
    return allTags.sort((a, b) => a.fullPath.localeCompare(b.fullPath));
  }

  /**
   * Build a hierarchical tree structure from tags
   */
  getTagHierarchy(tags: HierarchicalTag[]): TagHierarchyTree {
    const hierarchy: TagHierarchyTree = {};
    
    for (const tag of tags) {
      if (!hierarchy[tag.category]) {
        hierarchy[tag.category] = {};
      }
      
      const subcategory = tag.subcategory || '_root';
      if (!hierarchy[tag.category][subcategory]) {
        hierarchy[tag.category][subcategory] = [];
      }
      
      if (!hierarchy[tag.category][subcategory].includes(tag.tag)) {
        hierarchy[tag.category][subcategory].push(tag.tag);
      }
    }
    
    // Sort tags within each subcategory
    for (const category in hierarchy) {
      for (const subcategory in hierarchy[category]) {
        hierarchy[category][subcategory].sort();
      }
    }
    
    return hierarchy;
  }

  /**
   * Check if a file has a matching tag (including hierarchical matching)
   */
  private hasMatchingTag(fileTags: HierarchicalTag[], requiredTag: HierarchicalTag): boolean {
    return fileTags.some(fileTag => this.isTagMatch(requiredTag, fileTag));
  }

  /**
   * Check if a file tag matches a required tag (including hierarchical matching)
   */
  private isTagMatch(requiredTag: HierarchicalTag, fileTag: HierarchicalTag): boolean {
    // Exact match
    if (requiredTag.fullPath === fileTag.fullPath) {
      return true;
    }
    
    // Hierarchical match - if searching for "Nature", match "Nature/Landscape/Mountains"
    if (fileTag.fullPath.startsWith(requiredTag.fullPath + '/')) {
      return true;
    }
    
    // Category match - if searching for category only, match any tag in that category
    if (requiredTag.fullPath === requiredTag.category && 
        fileTag.category === requiredTag.category) {
      return true;
    }
    
    // Subcategory match - if searching for category/subcategory, match any tag in that subcategory
    if (requiredTag.subcategory && 
        requiredTag.fullPath === `${requiredTag.category}/${requiredTag.subcategory}` &&
        fileTag.category === requiredTag.category &&
        fileTag.subcategory === requiredTag.subcategory) {
      return true;
    }
    
    return false;
  }
}