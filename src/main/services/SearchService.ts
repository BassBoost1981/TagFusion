import { MediaFile, FolderItem, HierarchicalTag, MediaMetadata, EXIFData } from '../../types/global';
import { IMetadataRepository } from '../repositories/MetadataRepository';
import { IFileSystemRepository } from '../repositories/FileSystemRepository';

export interface SearchCriteria {
  query?: string;
  tags?: HierarchicalTag[];
  dateRange?: { from: Date; to: Date };
  fileTypes?: ('image' | 'video')[];
  rating?: number;
  cameraInfo?: {
    make?: string;
    model?: string;
  };
  sizeRange?: { min: number; max: number };
}

export interface SearchResult {
  files: MediaFile[];
  folders: FolderItem[];
  totalCount: number;
  searchTime: number;
}

export interface ISearchService {
  searchFiles(criteria: SearchCriteria, searchPath?: string): Promise<SearchResult>;
  searchByFilename(query: string, searchPath?: string): Promise<MediaFile[]>;
  searchByTags(tags: HierarchicalTag[], searchPath?: string): Promise<MediaFile[]>;
  searchByMetadata(criteria: Partial<SearchCriteria>, searchPath?: string): Promise<MediaFile[]>;
  fuzzyMatch(query: string, text: string): number;
}

export class SearchService implements ISearchService {
  constructor(
    private metadataRepository: IMetadataRepository,
    private fileSystemRepository: IFileSystemRepository
  ) {}

  /**
   * Main search method that combines all search criteria
   */
  async searchFiles(criteria: SearchCriteria, searchPath?: string): Promise<SearchResult> {
    const startTime = Date.now();
    
    try {
      // Get all files and folders from the search path
      const allContent = await this.getAllContent(searchPath);
      
      let matchingFiles: MediaFile[] = [];
      let matchingFolders: FolderItem[] = [];

      // Apply filename search if query is provided
      if (criteria.query && criteria.query.trim()) {
        const filenameMatches = await this.searchByFilename(criteria.query, searchPath);
        matchingFiles = filenameMatches;
        
        // Also search folder names
        matchingFolders = allContent.folders.filter(folder => 
          this.fuzzyMatch(criteria.query!, folder.name) > 0.3
        );
      } else {
        matchingFiles = allContent.files;
        matchingFolders = allContent.folders;
      }

      // Apply tag-based filtering
      if (criteria.tags && criteria.tags.length > 0) {
        const tagMatches = await this.filterByTags(matchingFiles, criteria.tags);
        matchingFiles = tagMatches;
      }

      // Apply metadata filtering
      if (this.hasMetadataCriteria(criteria)) {
        const metadataMatches = await this.filterByMetadata(matchingFiles, criteria);
        matchingFiles = metadataMatches;
      }

      // Apply file type filtering
      if (criteria.fileTypes && criteria.fileTypes.length > 0) {
        matchingFiles = matchingFiles.filter(file => 
          criteria.fileTypes!.includes(file.type)
        );
      }

      // Apply size filtering
      if (criteria.sizeRange) {
        matchingFiles = matchingFiles.filter(file => 
          file.size >= (criteria.sizeRange!.min || 0) &&
          file.size <= (criteria.sizeRange!.max || Number.MAX_SAFE_INTEGER)
        );
      }

      const searchTime = Date.now() - startTime;

      return {
        files: matchingFiles,
        folders: matchingFolders,
        totalCount: matchingFiles.length + matchingFolders.length,
        searchTime
      };
    } catch (error) {
      console.error('Error during search:', error);
      return {
        files: [],
        folders: [],
        totalCount: 0,
        searchTime: Date.now() - startTime
      };
    }
  }

  /**
   * Search files by filename using fuzzy matching
   */
  async searchByFilename(query: string, searchPath?: string): Promise<MediaFile[]> {
    try {
      const allContent = await this.getAllContent(searchPath);
      const normalizedQuery = query.toLowerCase().trim();
      
      if (!normalizedQuery) {
        return allContent.files;
      }

      // Score each file based on fuzzy matching
      const scoredFiles = allContent.files.map(file => ({
        file,
        score: this.fuzzyMatch(normalizedQuery, file.name.toLowerCase())
      }));

      // Filter files with score > 0.1 and sort by score
      return scoredFiles
        .filter(item => item.score > 0.1)
        .sort((a, b) => b.score - a.score)
        .map(item => item.file);
    } catch (error) {
      console.error('Error searching by filename:', error);
      return [];
    }
  }

  /**
   * Search files by hierarchical tags
   */
  async searchByTags(tags: HierarchicalTag[], searchPath?: string): Promise<MediaFile[]> {
    try {
      const allContent = await this.getAllContent(searchPath);
      return await this.filterByTags(allContent.files, tags);
    } catch (error) {
      console.error('Error searching by tags:', error);
      return [];
    }
  }

  /**
   * Search files by metadata criteria
   */
  async searchByMetadata(criteria: Partial<SearchCriteria>, searchPath?: string): Promise<MediaFile[]> {
    try {
      const allContent = await this.getAllContent(searchPath);
      return await this.filterByMetadata(allContent.files, criteria);
    } catch (error) {
      console.error('Error searching by metadata:', error);
      return [];
    }
  }

  /**
   * Fuzzy matching algorithm using Levenshtein distance
   */
  fuzzyMatch(query: string, text: string): number {
    if (!query || !text) return 0;
    
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();
    
    // Exact match gets highest score
    if (textLower === queryLower) return 1.0;
    
    // Contains match gets high score
    if (textLower.includes(queryLower)) {
      return 0.8 - (Math.abs(textLower.length - queryLower.length) / textLower.length) * 0.3;
    }
    
    // Starts with match gets good score
    if (textLower.startsWith(queryLower)) {
      return 0.7;
    }
    
    // Calculate Levenshtein distance for fuzzy matching
    const distance = this.levenshteinDistance(queryLower, textLower);
    const maxLength = Math.max(queryLower.length, textLower.length);
    
    if (maxLength === 0) return 0;
    
    const similarity = 1 - (distance / maxLength);
    
    // Only return meaningful similarities
    return similarity > 0.4 ? similarity : 0;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }
    
    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Get all content from a path (or all drives if no path specified)
   */
  private async getAllContent(searchPath?: string): Promise<{ files: MediaFile[]; folders: FolderItem[] }> {
    try {
      if (searchPath) {
        const content = await this.fileSystemRepository.getDirectoryContents(searchPath);
        return {
          files: content.mediaFiles,
          folders: content.folders
        };
      } else {
        // Search across all drives
        const drives = await this.fileSystemRepository.getDrives();
        const allFiles: MediaFile[] = [];
        const allFolders: FolderItem[] = [];
        
        for (const drive of drives) {
          if (drive.available) {
            try {
              const content = await this.fileSystemRepository.getDirectoryContents(drive.path);
              allFiles.push(...content.mediaFiles);
              allFolders.push(...content.folders);
            } catch (error) {
              console.warn(`Could not access drive ${drive.path}:`, error);
            }
          }
        }
        
        return { files: allFiles, folders: allFolders };
      }
    } catch (error) {
      console.error('Error getting all content:', error);
      return { files: [], folders: [] };
    }
  }

  /**
   * Filter files by hierarchical tags
   */
  private async filterByTags(files: MediaFile[], tags: HierarchicalTag[]): Promise<MediaFile[]> {
    const matchingFiles: MediaFile[] = [];
    
    for (const file of files) {
      try {
        const fileTags = await this.metadataRepository.extractTags(file.path);
        
        // Check if file has any of the required tags (OR logic)
        // Also support hierarchical matching (parent tags match child tags)
        const hasMatchingTag = tags.some(requiredTag => 
          fileTags.some(fileTag => 
            this.isTagMatch(requiredTag, fileTag)
          )
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
    
    // Category match
    if (requiredTag.category === fileTag.category && !requiredTag.subcategory && !requiredTag.tag) {
      return true;
    }
    
    // Subcategory match
    if (requiredTag.category === fileTag.category && 
        requiredTag.subcategory === fileTag.subcategory && 
        !requiredTag.tag) {
      return true;
    }
    
    return false;
  }

  /**
   * Filter files by metadata criteria
   */
  private async filterByMetadata(files: MediaFile[], criteria: Partial<SearchCriteria>): Promise<MediaFile[]> {
    const matchingFiles: MediaFile[] = [];
    
    for (const file of files) {
      try {
        const metadata = await this.metadataRepository.readMetadata(file.path);
        const exifData = await this.metadataRepository.readEXIFData(file.path);
        
        let matches = true;
        
        // Check rating
        if (criteria.rating !== undefined && metadata.rating !== criteria.rating) {
          matches = false;
        }
        
        // Check date range
        if (criteria.dateRange && metadata.dateCreated) {
          const fileDate = metadata.dateCreated;
          if (fileDate < criteria.dateRange.from || fileDate > criteria.dateRange.to) {
            matches = false;
          }
        }
        
        // Check camera info
        if (criteria.cameraInfo) {
          if (criteria.cameraInfo.make && 
              (!exifData.camera.make || !exifData.camera.make.toLowerCase().includes(criteria.cameraInfo.make.toLowerCase()))) {
            matches = false;
          }
          
          if (criteria.cameraInfo.model && 
              (!exifData.camera.model || !exifData.camera.model.toLowerCase().includes(criteria.cameraInfo.model.toLowerCase()))) {
            matches = false;
          }
        }
        
        if (matches) {
          matchingFiles.push(file);
        }
      } catch (error) {
        console.warn(`Could not read metadata for ${file.path}:`, error);
      }
    }
    
    return matchingFiles;
  }

  /**
   * Check if search criteria contains metadata-related filters
   */
  private hasMetadataCriteria(criteria: SearchCriteria): boolean {
    return !!(
      criteria.rating !== undefined ||
      criteria.dateRange ||
      criteria.cameraInfo
    );
  }
}