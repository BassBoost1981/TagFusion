// Global type definitions for the application

export interface MediaFile {
  path: string;
  name: string;
  extension: string;
  size: number;
  dateModified: Date;
  dateCreated?: Date;
  type: 'image' | 'video';
  thumbnailPath?: string;
}

export interface FolderItem {
  name: string;
  path: string;
  hasSubfolders: boolean;
  mediaCount: number;
}

export interface DirectoryContent {
  folders: FolderItem[];
  mediaFiles: MediaFile[];
  path: string;
}

export interface DirectoryNode {
  name: string;
  path: string;
  children: DirectoryNode[];
  hasChildren: boolean;
}

export interface DriveInfo {
  letter: string;
  label: string;
  path: string;
  type: 'local' | 'removable' | 'network';
  available: boolean;
  totalSpace: number;
  freeSpace: number;
}

export interface HierarchicalTag {
  category: string;
  subcategory?: string;
  tag: string;
  fullPath: string; // "Nature/Landscape/Mountains"
}

export interface MediaMetadata {
  tags: HierarchicalTag[];
  rating: number; // 1-5 stars
  dateCreated: Date;
  cameraInfo?: CameraInfo;
}

export interface CameraInfo {
  make?: string;
  model?: string;
  lens?: string;
  aperture?: string;
  shutterSpeed?: string;
  iso?: number;
  focalLength?: string;
}

export interface EXIFData {
  camera: {
    make?: string;
    model?: string;
    lens?: string;
  };
  settings: {
    aperture?: string;
    shutterSpeed?: string;
    iso?: number;
    focalLength?: string;
    flash?: boolean;
  };
  location: {
    dateTime?: Date;
    gps?: {
      latitude: number;
      longitude: number;
      altitude?: number;
    };
  };
  technical: {
    colorSpace?: string;
    whiteBalance?: string;
    meteringMode?: string;
  };
}

export interface FavoriteFolder {
  id: string;
  name: string;
  path: string;
  dateAdded: Date;
  order: number;
}

export interface AppSettings {
  language: string;
  theme: 'light' | 'dark' | 'system';
  favorites: FavoriteFolder[];
  tagHierarchy: TagHierarchyNode[];
  thumbnailSize: number;
  viewMode: 'grid' | 'list';
}

export interface TagHierarchyNode {
  id: string;
  name: string;
  parent?: string;
  children: TagHierarchyNode[];
  level: number; // 0=Category, 1=Subcategory, 2=Tag
}

export interface ImageOperation {
  type: 'brightness' | 'contrast' | 'saturation' | 'rotate' | 'crop' | 'resize';
  value: number | CropArea | RotationAngle;
  timestamp: Date;
}

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RotationAngle {
  degrees: 90 | 180 | 270;
}

export interface ThumbnailCache {
  filePath: string;
  thumbnailData: string; // Base64
  fileSize: number;
  dateModified: Date;
  cacheDate: Date;
}

export interface ThumbnailOptions {
  width: number;
  height: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

export interface VideoThumbnailOptions extends ThumbnailOptions {
  timeOffset?: number; // seconds from start
}

// Context Menu Types
export interface ContextMenuItem {
  id: string;
  label: string;
  action: string;
  shortcut?: string;
  icon?: string;
  disabled?: boolean;
  separator?: boolean;
  submenu?: ContextMenuItem[];
  value?: any;
}

export interface ContextMenuConfig {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  target?: MediaFile | FolderItem | HierarchicalTag | FavoriteFolder;
  targetType: 'file' | 'folder' | 'tag' | 'multiple' | 'favorite';
  selectedItems?: (MediaFile | FolderItem)[];
}

export interface ContextMenuAction {
  type: string;
  payload?: any;
  target?: MediaFile | FolderItem | HierarchicalTag | FavoriteFolder;
  selectedItems?: (MediaFile | FolderItem)[];
}