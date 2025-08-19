import { DriveInfo, DirectoryNode, FolderItem } from '../../types/global.d';
import { IFileSystemRepository } from '../interfaces/IFileSystemRepository';

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

export class DriveTreeService implements IDriveTreeService {
  private readonly fileSystemRepository: IFileSystemRepository;
  private readonly treeCache = new Map<string, TreeNode[]>();
  private readonly expandedNodes = new Set<string>();
  private readonly loadingNodes = new Set<string>();
  private drives: DriveInfo[] = [];
  private lastDriveRefresh: Date = new Date(0);
  
  // Configuration
  private readonly cacheTimeout = 60000; // 1 minute cache timeout for tree nodes
  private readonly driveRefreshInterval = 300000; // 5 minutes for drive refresh
  private readonly maxTreeDepth = 10;
  private readonly maxConcurrentLoads = 5;
  
  constructor(fileSystemRepository: IFileSystemRepository) {
    this.fileSystemRepository = fileSystemRepository;
  }

  async getDrives(): Promise<DriveInfo[]> {
    const now = new Date();
    
    // Check if we need to refresh drives
    if (this.drives.length === 0 || 
        (now.getTime() - this.lastDriveRefresh.getTime()) > this.driveRefreshInterval) {
      return this.refreshDrives();
    }
    
    return this.drives;
  }

  async refreshDrives(): Promise<DriveInfo[]> {
    try {
      this.drives = await this.fileSystemRepository.getDrives();
      this.lastDriveRefresh = new Date();
      
      // Clean up cache for drives that no longer exist
      this.cleanupStaleCache();
      
      return this.drives;
    } catch (error) {
      console.error('Error refreshing drives:', error);
      return this.drives; // Return cached drives on error
    }
  }

  async getDirectoryTree(path: string, maxDepth: number = 2): Promise<DirectoryNode[]> {
    const safeMaxDepth = Math.min(maxDepth, this.maxTreeDepth);
    
    // Check cache first
    const cacheKey = `${path}:${safeMaxDepth}`;
    const cached = this.treeCache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached)) {
      return this.convertTreeNodesToDirectoryNodes(cached);
    }
    
    // Load tree structure
    try {
      this.loadingNodes.add(path);
      const nodes = await this.buildTreeStructure(path, 0, safeMaxDepth);
      
      // Cache the result
      this.treeCache.set(cacheKey, nodes);
      
      return this.convertTreeNodesToDirectoryNodes(nodes);
    } catch (error) {
      console.error(`Error building directory tree for ${path}:`, error);
      return [];
    } finally {
      this.loadingNodes.delete(path);
    }
  }

  async expandNode(path: string, maxDepth: number = 1): Promise<DirectoryNode[]> {
    this.expandedNodes.add(path);
    return this.getChildNodes(path);
  }

  async getChildNodes(path: string): Promise<DirectoryNode[]> {
    // Check if already loading
    if (this.loadingNodes.has(path)) {
      // Wait for existing load to complete
      return this.waitForLoad(path);
    }
    
    // Check cache first
    const cached = this.treeCache.get(path);
    if (cached && this.isCacheValid(cached)) {
      return this.convertTreeNodesToDirectoryNodes(cached);
    }
    
    try {
      this.loadingNodes.add(path);
      const nodes = await this.buildTreeStructure(path, 0, 1);
      
      // Cache the result
      this.treeCache.set(path, nodes);
      
      return this.convertTreeNodesToDirectoryNodes(nodes);
    } catch (error) {
      console.error(`Error loading child nodes for ${path}:`, error);
      return [];
    } finally {
      this.loadingNodes.delete(path);
    }
  }

  async hasChildren(path: string): Promise<boolean> {
    try {
      // Use the file system repository's optimized method
      const content = await this.fileSystemRepository.getDirectoryContents(path, true);
      return content.folders.length > 0;
    } catch (error) {
      console.error(`Error checking children for ${path}:`, error);
      return false;
    }
  }

  private async buildTreeStructure(
    path: string, 
    currentDepth: number, 
    maxDepth: number
  ): Promise<TreeNode[]> {
    if (currentDepth >= maxDepth) {
      return [];
    }
    
    try {
      const content = await this.fileSystemRepository.getDirectoryContents(path, true);
      const nodes: TreeNode[] = [];
      
      // Process folders in batches for performance
      const batches = this.createBatches(content.folders, this.maxConcurrentLoads);
      
      for (const batch of batches) {
        const promises = batch.map(async (folder: FolderItem) => {
          try {
            const [children, hasChildren] = await Promise.all([
              currentDepth + 1 < maxDepth ? 
                this.buildTreeStructure(folder.path, currentDepth + 1, maxDepth) : 
                Promise.resolve([]),
              this.hasChildren(folder.path)
            ]);
            
            const node: TreeNode = {
              name: folder.name,
              path: folder.path,
              children: this.convertTreeNodesToDirectoryNodes(children),
              hasChildren: hasChildren,
              isExpanded: this.expandedNodes.has(folder.path),
              isLoading: false,
              lastLoaded: new Date(),
            };
            
            return node;
          } catch (error) {
            console.warn(`Error processing folder ${folder.path}:`, error);
            
            // Return a node with error state
            const errorNode: TreeNode = {
              name: folder.name,
              path: folder.path,
              children: [],
              hasChildren: false,
              isExpanded: false,
              isLoading: false,
              loadError: error instanceof Error ? error.message : 'Unknown error',
              lastLoaded: new Date(),
            };
            
            return errorNode;
          }
        });
        
        const batchResults = await Promise.all(promises);
        nodes.push(...batchResults);
      }
      
      // Sort nodes alphabetically
      return nodes.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      
    } catch (error) {
      console.error(`Error building tree structure for ${path}:`, error);
      return [];
    }
  }

  findNodeByPath(tree: DirectoryNode[], targetPath: string): DirectoryNode | null {
    for (const node of tree) {
      if (node.path === targetPath) {
        return node;
      }
      
      if (targetPath.startsWith(node.path)) {
        const found = this.findNodeByPath(node.children, targetPath);
        if (found) {
          return found;
        }
      }
    }
    
    return null;
  }

  getNodePath(tree: DirectoryNode[], targetPath: string): DirectoryNode[] {
    const path: DirectoryNode[] = [];
    
    const findPath = (nodes: DirectoryNode[], target: string, currentPath: DirectoryNode[]): boolean => {
      for (const node of nodes) {
        const newPath = [...currentPath, node];
        
        if (node.path === target) {
          path.push(...newPath);
          return true;
        }
        
        if (target.startsWith(node.path)) {
          if (findPath(node.children, target, newPath)) {
            return true;
          }
        }
      }
      
      return false;
    };
    
    findPath(tree, targetPath, []);
    return path;
  }

  async preloadSubtree(path: string, depth: number = 2): Promise<void> {
    const safeDepth = Math.min(depth, this.maxTreeDepth);
    
    try {
      // Preload the subtree in the background
      await this.buildTreeStructure(path, 0, safeDepth);
    } catch (error) {
      console.warn(`Error preloading subtree for ${path}:`, error);
    }
  }

  clearTreeCache(): void {
    this.treeCache.clear();
    this.expandedNodes.clear();
    this.loadingNodes.clear();
  }

  getTreeCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.treeCache.size,
      entries: Array.from(this.treeCache.keys()),
    };
  }

  // Get current tree state for UI components
  getTreeState(): DriveTreeState {
    return {
      drives: [...this.drives],
      expandedNodes: new Set(this.expandedNodes),
      loadingNodes: new Set(this.loadingNodes),
      treeCache: new Map(this.treeCache),
      lastDriveRefresh: this.lastDriveRefresh,
    };
  }

  // Check if a node is currently expanded
  isNodeExpanded(path: string): boolean {
    return this.expandedNodes.has(path);
  }

  // Check if a node is currently loading
  isNodeLoading(path: string): boolean {
    return this.loadingNodes.has(path);
  }

  // Collapse a node
  collapseNode(path: string): void {
    this.expandedNodes.delete(path);
  }

  // Toggle node expansion
  async toggleNode(path: string): Promise<DirectoryNode[]> {
    if (this.expandedNodes.has(path)) {
      this.collapseNode(path);
      return [];
    } else {
      return this.expandNode(path);
    }
  }

  // Batch expand multiple nodes
  async batchExpandNodes(paths: string[]): Promise<Map<string, DirectoryNode[]>> {
    const results = new Map<string, DirectoryNode[]>();
    
    // Process in batches to avoid overwhelming the system
    const batches = this.createBatches(paths, this.maxConcurrentLoads);
    
    for (const batch of batches) {
      const promises = batch.map(async (path) => {
        try {
          const nodes = await this.expandNode(path);
          return { path, nodes };
        } catch (error) {
          console.warn(`Error expanding node ${path}:`, error);
          return { path, nodes: [] };
        }
      });
      
      const batchResults = await Promise.all(promises);
      
      for (const result of batchResults) {
        results.set(result.path, result.nodes);
      }
    }
    
    return results;
  }

  // Refresh a specific node
  async refreshNode(path: string): Promise<DirectoryNode[]> {
    // Remove from cache to force reload
    this.treeCache.delete(path);
    
    return this.getChildNodes(path);
  }

  // Get node statistics
  async getNodeStats(path: string): Promise<{
    folderCount: number;
    mediaCount: number;
    totalSize: number;
    lastModified: Date;
  } | null> {
    try {
      const content = await this.fileSystemRepository.getDirectoryContents(path, false);
      
      let totalSize = 0;
      let lastModified = new Date(0);
      
      for (const file of content.mediaFiles) {
        totalSize += file.size;
        if (file.dateModified > lastModified) {
          lastModified = file.dateModified;
        }
      }
      
      return {
        folderCount: content.folders.length,
        mediaCount: content.mediaFiles.length,
        totalSize,
        lastModified,
      };
    } catch (error) {
      console.error(`Error getting node stats for ${path}:`, error);
      return null;
    }
  }

  // Private helper methods

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private isCacheValid(nodes: TreeNode[]): boolean {
    if (nodes.length === 0) return false;
    
    const now = new Date();
    return nodes.every(node => 
      node.lastLoaded && 
      (now.getTime() - node.lastLoaded.getTime()) < this.cacheTimeout
    );
  }

  private convertTreeNodesToDirectoryNodes(treeNodes: TreeNode[]): DirectoryNode[] {
    return treeNodes.map(node => ({
      name: node.name,
      path: node.path,
      children: node.children,
      hasChildren: node.hasChildren,
    }));
  }

  private async waitForLoad(path: string): Promise<DirectoryNode[]> {
    // Simple polling mechanism to wait for load completion
    const maxWaitTime = 10000; // 10 seconds
    const pollInterval = 100; // 100ms
    let waitTime = 0;
    
    while (this.loadingNodes.has(path) && waitTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      waitTime += pollInterval;
    }
    
    // Return cached result if available
    const cached = this.treeCache.get(path);
    if (cached) {
      return this.convertTreeNodesToDirectoryNodes(cached);
    }
    
    return [];
  }

  private cleanupStaleCache(): void {
    const validPaths = new Set(this.drives.map(drive => drive.path));
    const keysToDelete: string[] = [];
    
    for (const key of this.treeCache.keys()) {
      const path = key.split(':')[0]; // Remove depth suffix
      const isValid = Array.from(validPaths).some(validPath => 
        path.startsWith(validPath)
      );
      
      if (!isValid) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.treeCache.delete(key);
    }
    
    // Also clean up expanded nodes
    for (const expandedPath of this.expandedNodes) {
      const isValid = Array.from(validPaths).some(validPath => 
        expandedPath.startsWith(validPath)
      );
      
      if (!isValid) {
        this.expandedNodes.delete(expandedPath);
      }
    }
  }

  // Advanced tree operations

  // Find all nodes matching a pattern
  findNodesByPattern(tree: DirectoryNode[], pattern: RegExp): DirectoryNode[] {
    const matches: DirectoryNode[] = [];
    
    const searchNodes = (nodes: DirectoryNode[]) => {
      for (const node of nodes) {
        if (pattern.test(node.name) || pattern.test(node.path)) {
          matches.push(node);
        }
        
        if (node.children.length > 0) {
          searchNodes(node.children);
        }
      }
    };
    
    searchNodes(tree);
    return matches;
  }

  // Get all leaf nodes (folders with no subfolders)
  getLeafNodes(tree: DirectoryNode[]): DirectoryNode[] {
    const leafNodes: DirectoryNode[] = [];
    
    const findLeaves = (nodes: DirectoryNode[]) => {
      for (const node of nodes) {
        if (!node.hasChildren) {
          leafNodes.push(node);
        } else if (node.children.length > 0) {
          findLeaves(node.children);
        }
      }
    };
    
    findLeaves(tree);
    return leafNodes;
  }

  // Get tree depth
  getTreeDepth(tree: DirectoryNode[]): number {
    let maxDepth = 0;
    
    const calculateDepth = (nodes: DirectoryNode[], currentDepth: number) => {
      for (const node of nodes) {
        maxDepth = Math.max(maxDepth, currentDepth);
        if (node.children.length > 0) {
          calculateDepth(node.children, currentDepth + 1);
        }
      }
    };
    
    calculateDepth(tree, 1);
    return maxDepth;
  }

  // Get total node count
  getTotalNodeCount(tree: DirectoryNode[]): number {
    let count = 0;
    
    const countNodes = (nodes: DirectoryNode[]) => {
      count += nodes.length;
      for (const node of nodes) {
        if (node.children.length > 0) {
          countNodes(node.children);
        }
      }
    };
    
    countNodes(tree);
    return count;
  }
}