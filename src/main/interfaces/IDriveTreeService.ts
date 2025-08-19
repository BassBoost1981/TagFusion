import { DriveInfo, DirectoryNode } from '../../types/global.d';

export interface IDriveTreeService {
  // Drive operations
  getDrives(): Promise<DriveInfo[]>;
  refreshDrives(): Promise<DriveInfo[]>;
  
  // Tree structure operations
  getDirectoryTree(path: string, maxDepth?: number): Promise<DirectoryNode[]>;
  expandNode(path: string, maxDepth?: number): Promise<DirectoryNode[]>;
  
  // Lazy loading operations
  getChildNodes(path: string): Promise<DirectoryNode[]>;
  hasChildren(path: string): Promise<boolean>;
  
  // Tree navigation
  findNodeByPath(tree: DirectoryNode[], targetPath: string): DirectoryNode | null;
  getNodePath(tree: DirectoryNode[], targetPath: string): DirectoryNode[];
  
  // Performance and caching
  preloadSubtree(path: string, depth?: number): Promise<void>;
  clearTreeCache(): void;
  getTreeCacheStats(): { size: number; entries: string[] };
  
  // Node state management
  isNodeExpanded(path: string): boolean;
  isNodeLoading(path: string): boolean;
  collapseNode(path: string): void;
  toggleNode(path: string): Promise<DirectoryNode[]>;
  
  // Batch operations
  batchExpandNodes(paths: string[]): Promise<Map<string, DirectoryNode[]>>;
  refreshNode(path: string): Promise<DirectoryNode[]>;
  
  // Statistics and analysis
  getNodeStats(path: string): Promise<{
    folderCount: number;
    mediaCount: number;
    totalSize: number;
    lastModified: Date;
  } | null>;
  
  // Advanced tree operations
  findNodesByPattern(tree: DirectoryNode[], pattern: RegExp): DirectoryNode[];
  getLeafNodes(tree: DirectoryNode[]): DirectoryNode[];
  getTreeDepth(tree: DirectoryNode[]): number;
  getTotalNodeCount(tree: DirectoryNode[]): number;
}

export interface TreeNode extends DirectoryNode {
  isExpanded: boolean;
  isLoading: boolean;
  loadError?: string;
  lastLoaded?: Date;
}

export interface DriveTreeState {
  drives: DriveInfo[];
  expandedNodes: Set<string>;
  loadingNodes: Set<string>;
  treeCache: Map<string, TreeNode[]>;
  lastDriveRefresh: Date;
}