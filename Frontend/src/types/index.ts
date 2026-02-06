// Image file model
export interface ImageFile {
  path: string;
  fileName: string;
  extension: string;
  fileSize: number;
  dateModified: string;
  dateCreated: string;
  width?: number;
  height?: number;
  tags: string[];
  rating?: number;  // 0-5 star rating
  thumbnailBase64?: string;
  thumbnailUrl?: string;
  isSelected?: boolean;
}

// Grid item model (Folder or Image)
export interface GridItem {
  path: string;
  name: string;
  isFolder: boolean;

  // Folder stats
  subfolderCount?: number;
  imageCount?: number;
  videoCount?: number;

  // Image data (if !isFolder)
  imageData?: ImageFile;
}

// Tag model
export interface Tag {
  name: string;
  usageCount: number;
  lastUsed?: string;
  isFavorite: boolean;
}

// Tag Management System (TMS) Types
export interface TagSubcategory {
  id: string;
  name: string;
  tags: string[];
}

export interface TagCategory {
  id: string;
  name: string;
  subcategories: TagSubcategory[];
  isExpanded?: boolean;
}

export interface TagLibrary {
  version: string;
  exportDate: string;
  categories: TagCategory[];
}

// Types for raw import data (where IDs might be missing)
export interface RawImportSubcategory {
  id?: string;
  name: string;
  tags?: string[];
}

export interface RawImportCategory {
  id?: string;
  name: string;
  subcategories?: RawImportSubcategory[];
}

// Folder item model
export type FolderItemType = 'Drive' | 'Folder' | 'NetworkShare';

export interface FolderItem {
  name: string;
  path: string;
  type: FolderItemType;
  hasSubfolders: boolean;
  isExpanded?: boolean;
  // Drive-specific properties
  totalSize?: number;
  freeSpace?: number;
  driveFormat?: string;
  driveType?: string;
}

// Settings model
export interface Settings {
  windowWidth: number;
  windowHeight: number;
  theme: 'dark' | 'light';
  lastOpenedFolder?: string;
  recentFolders: string[];
  thumbnailSize: number;
  startBehavior: 'empty' | 'lastFolder';
}

// Bridge message types
export interface BridgeMessage {
  id: string;
  action: string;
  payload?: Record<string, unknown>;
}

export interface BridgeResponse {
  id: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface BridgeEvent {
  event: string;
  data?: unknown;
}

// App state
export interface AppState {
  currentFolder?: string;
  images: ImageFile[];
  selectedImages: string[];
  tags: Tag[];
  isLoading: boolean;
  error?: string;
}
