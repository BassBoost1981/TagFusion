import React, { useState, useEffect } from 'react';
import './DriveTree.css';

interface DriveInfo {
  name: string;
  path: string;
  type: 'fixed' | 'removable' | 'network' | 'cdrom' | 'ram';
  available: boolean;
  label?: string;
  totalSize?: number;
  freeSize?: number;
}

interface FolderInfo {
  name: string;
  path: string;
  dateModified: Date;
  hasSubfolders: boolean;
  mediaCount?: number;
}

interface DriveTreeProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onRefresh?: () => void;
}

interface TreeNode {
  name: string;
  path: string;
  type: 'drive' | 'folder';
  hasChildren: boolean;
  isExpanded: boolean;
  children: TreeNode[];
  driveInfo?: DriveInfo;
}

export const DriveTree: React.FC<DriveTreeProps> = ({
  currentPath,
  onNavigate,
  onRefresh,
}) => {
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  // Load drives on mount
  useEffect(() => {
    loadDrives();
  }, []);

  // Auto-expand path when currentPath changes
  useEffect(() => {
    if (currentPath && treeNodes.length > 0) {
      expandPathToCurrentDirectory(currentPath);
    }
  }, [currentPath, treeNodes]);

  const loadDrives = async () => {
    setLoading(true);
    try {
      const driveList = await window.electronAPI?.fileSystem?.getDrives() || [];
      setDrives(driveList);
      
      // Convert drives to tree nodes
      const nodes: TreeNode[] = driveList.map(drive => ({
        name: drive.name,
        path: drive.path,
        type: 'drive' as const,
        hasChildren: true,
        isExpanded: false,
        children: [],
        driveInfo: drive,
      }));
      
      setTreeNodes(nodes);
    } catch (error) {
      console.error('Failed to load drives:', error);
      setDrives([]);
      setTreeNodes([]);
    } finally {
      setLoading(false);
    }
  };

  const loadFolderContents = async (folderPath: string): Promise<TreeNode[]> => {
    try {
      const contents = await window.electronAPI?.fileSystem?.getDirectoryContents(folderPath);
      if (!contents) return [];
      
      return contents.folders.map((folder: FolderInfo) => ({
        name: folder.name,
        path: folder.path,
        type: 'folder' as const,
        hasChildren: folder.hasSubfolders,
        isExpanded: false,
        children: [],
      }));
    } catch (error) {
      console.error(`Failed to load folder contents for ${folderPath}:`, error);
      return [];
    }
  };

  const toggleExpanded = async (node: TreeNode) => {
    const newExpandedPaths = new Set(expandedPaths);
    
    if (expandedPaths.has(node.path)) {
      // Collapse
      newExpandedPaths.delete(node.path);
      setExpandedPaths(newExpandedPaths);
      
      // Update tree nodes
      setTreeNodes(prevNodes => updateNodeExpansion(prevNodes, node.path, false, []));
    } else {
      // Expand
      newExpandedPaths.add(node.path);
      setExpandedPaths(newExpandedPaths);
      
      // Load children if not already loaded
      if (node.children.length === 0 && node.hasChildren) {
        const children = await loadFolderContents(node.path);
        setTreeNodes(prevNodes => updateNodeExpansion(prevNodes, node.path, true, children));
      } else {
        setTreeNodes(prevNodes => updateNodeExpansion(prevNodes, node.path, true, node.children));
      }
    }
  };

  const updateNodeExpansion = (
    nodes: TreeNode[],
    targetPath: string,
    isExpanded: boolean,
    children: TreeNode[]
  ): TreeNode[] => {
    return nodes.map(node => {
      if (node.path === targetPath) {
        return {
          ...node,
          isExpanded,
          children,
        };
      } else if (node.children.length > 0) {
        return {
          ...node,
          children: updateNodeExpansion(node.children, targetPath, isExpanded, children),
        };
      }
      return node;
    });
  };

  // Function to automatically expand path to current directory
  const expandPathToCurrentDirectory = async (targetPath: string) => {
    // Get all parent paths that need to be expanded
    const pathsToExpand = getParentPaths(targetPath);
    
    // Expand each path in sequence
    for (const pathToExpand of pathsToExpand) {
      if (!expandedPaths.has(pathToExpand)) {
        await expandPath(pathToExpand);
      }
    }
  };

  // Get all parent paths for a given path
  const getParentPaths = (targetPath: string): string[] => {
    const paths: string[] = [];
    const normalizedPath = targetPath.replace(/\\/g, '/');
    const parts = normalizedPath.split('/').filter(part => part.length > 0);
    
    // For Windows paths like "C:\Users\Documents"
    if (parts.length > 0 && parts[0].includes(':')) {
      let currentPath = parts[0] + '/';
      paths.push(currentPath.replace(/\//g, '\\'));
      
      for (let i = 1; i < parts.length; i++) {
        currentPath += parts[i] + '/';
        paths.push(currentPath.replace(/\//g, '\\'));
      }
    }
    
    return paths;
  };

  // Expand a specific path
  const expandPath = async (pathToExpand: string): Promise<void> => {
    return new Promise(async (resolve) => {
      const node = findNodeByPath(treeNodes, pathToExpand);
      if (node && !expandedPaths.has(pathToExpand)) {
        const newExpandedPaths = new Set(expandedPaths);
        newExpandedPaths.add(pathToExpand);
        setExpandedPaths(newExpandedPaths);
        
        // Load children if not already loaded
        if (node.children.length === 0 && node.hasChildren) {
          const children = await loadFolderContents(pathToExpand);
          setTreeNodes(prevNodes => updateNodeExpansion(prevNodes, pathToExpand, true, children));
        } else {
          setTreeNodes(prevNodes => updateNodeExpansion(prevNodes, pathToExpand, true, node.children));
        }
      }
      resolve();
    });
  };

  // Find a node by path in the tree
  const findNodeByPath = (nodes: TreeNode[], targetPath: string): TreeNode | null => {
    for (const node of nodes) {
      if (node.path === targetPath) {
        return node;
      }
      if (node.children.length > 0) {
        const found = findNodeByPath(node.children, targetPath);
        if (found) return found;
      }
    }
    return null;
  };

  const handleNodeClick = (node: TreeNode) => {
    onNavigate(node.path);
  };

  const getDriveIcon = (driveType: string): string => {
    switch (driveType) {
      case 'fixed':
        return '💾';
      case 'removable':
        return '💿';
      case 'network':
        return '🌐';
      case 'cdrom':
        return '💿';
      case 'ram':
        return '⚡';
      default:
        return '💾';
    }
  };

  const formatSize = (bytes?: number): string => {
    if (!bytes) return '';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const renderTreeNode = (node: TreeNode, level: number = 0): React.ReactNode => {
    const isCurrentPath = currentPath === node.path;
    const isInCurrentPath = currentPath.startsWith(node.path) && currentPath !== node.path;
    const hasChildren = node.hasChildren;
    
    return (
      <div key={node.path} className="tree-node-container">
        <div 
          className={`${node.type === 'drive' ? 'drive-node' : 'tree-node'} ${
            isCurrentPath ? 'selected current-path' : isInCurrentPath ? 'current-path' : ''
          }`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
        >
          {hasChildren && (
            <button
              className="expand-button"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(node);
              }}
            >
              {node.isExpanded ? '▼' : '▶'}
            </button>
          )}
          
          {!hasChildren && <div style={{ width: '16px' }} />}
          
          <span className={node.type === 'drive' ? 'drive-icon' : 'node-icon'}>
            {node.type === 'drive' 
              ? getDriveIcon(node.driveInfo?.type || 'fixed')
              : '📁'
            }
          </span>
          <span 
            className={node.type === 'drive' ? 'drive-label' : 'node-name'}
            onClick={() => handleNodeClick(node)}
            title={node.path}
          >
            {node.name}
          </span>
          {node.type === 'drive' && node.driveInfo?.freeSize && (
            <span className="drive-status">
              {formatSize(node.driveInfo.freeSize)} free
            </span>
          )}
        </div>
        
        {node.isExpanded && node.children.length > 0 && (
          <div className={node.type === 'drive' ? 'drive-children' : 'tree-children'}>
            {node.children.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="drive-tree-container">
        <div className="drive-tree-header">
          <h3>Drives</h3>
          <button
            className="refresh-btn"
            onClick={loadDrives}
            disabled={loading}
          >
            🔄
          </button>
        </div>
        <div className="drive-tree-loading">Loading drives...</div>
      </div>
    );
  }

  return (
    <div className="drive-tree-container">
      <div className="drive-tree-header">
        <h3>Drives</h3>
        <button
          className="refresh-button"
          onClick={loadDrives}
          title="Refresh drives"
        >
          🔄
        </button>
      </div>

      <div className="drive-tree">
        {treeNodes.length === 0 ? (
          <div className="no-drives">
            <p>No drives found</p>
            <button onClick={loadDrives}>Retry</button>
          </div>
        ) : (
          treeNodes.map(node => renderTreeNode(node))
        )}
      </div>
    </div>
  );
};