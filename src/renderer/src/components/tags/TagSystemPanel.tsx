import React, { useState, useEffect, useRef } from 'react';
import { TagHierarchyNode, HierarchicalTag, MediaFile } from '../../../../types/global';
import { useContextMenuContext } from '../../contexts/ContextMenuContext';
import { useServices } from '../../services/DIContainer';
import './TagSystemPanel.css';

interface TagSystemPanelProps {
  selectedFiles: MediaFile[];
  tagHierarchy: TagHierarchyNode[];
  onTagCreate?: (parentId: string | null, name: string) => void;
  onTagEdit?: (tagId: string, newName: string) => void;
  onTagDelete?: (tagId: string) => void;
  onTagAssign?: (files: MediaFile[], tags: HierarchicalTag[]) => void;
  onTagFilter?: (tag: HierarchicalTag) => void;
}

export const TagSystemPanel: React.FC<TagSystemPanelProps> = ({
  selectedFiles,
  tagHierarchy,
  onTagCreate,
  onTagEdit,
  onTagDelete,
  onTagAssign,
  onTagFilter,
}) => {
  const { showContextMenu } = useContextMenuContext();
  const { tagService } = useServices();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [newTagParent, setNewTagParent] = useState<string | null>(null);
  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const newTagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingNodeId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingNodeId]);

  useEffect(() => {
    if (showNewTagInput && newTagInputRef.current) {
      newTagInputRef.current.focus();
    }
  }, [showNewTagInput]);

  const toggleExpanded = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const handleStartEdit = (node: TagHierarchyNode) => {
    setEditingNodeId(node.id);
    setEditingName(node.name);
  };

  const handleSaveEdit = () => {
    if (editingNodeId && editingName.trim() && onTagEdit) {
      onTagEdit(editingNodeId, editingName.trim());
    }
    setEditingNodeId(null);
    setEditingName('');
  };

  const handleCancelEdit = () => {
    setEditingNodeId(null);
    setEditingName('');
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSaveEdit();
    } else if (event.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleStartNewTag = (parentId: string | null = null) => {
    setNewTagParent(parentId);
    setShowNewTagInput(true);
    setNewTagName('');
  };

  const handleSaveNewTag = async () => {
    if (newTagName.trim()) {
      const validation = tagService.validateTagName(newTagName.trim());
      if (!validation.valid) {
        setError(validation.error || 'Invalid tag name');
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const result = await tagService.createTag(newTagParent, newTagName.trim());
        if (onTagCreate) {
          onTagCreate(newTagParent, newTagName.trim());
        }
        setShowNewTagInput(false);
        setNewTagName('');
        setNewTagParent(null);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to create tag');
        console.error('Failed to create tag:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCancelNewTag = () => {
    setShowNewTagInput(false);
    setNewTagName('');
    setNewTagParent(null);
    setError(null);
  };

  const handleNewTagKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSaveNewTag();
    } else if (event.key === 'Escape') {
      handleCancelNewTag();
    }
  };

  const handleTagClick = (node: TagHierarchyNode) => {
    if (onTagFilter) {
      onTagFilter(node as HierarchicalTag);
    }
  };

  const handleTagAssign = async (node: TagHierarchyNode) => {
    if (selectedFiles.length > 0) {
      try {
        setLoading(true);
        setError(null);
        const filePaths = selectedFiles.map(file => file.path);
        await tagService.assignTagsToFiles(filePaths, [node.id]);
        if (onTagAssign) {
          onTagAssign(selectedFiles, [node as HierarchicalTag]);
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to assign tag');
        console.error('Failed to assign tag:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleContextMenu = (node: TagHierarchyNode, event: React.MouseEvent) => {
    showContextMenu(event, node, 'tag');
  };

  const renderTagNode = (node: TagHierarchyNode, level: number = 0): React.ReactNode => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isEditing = editingNodeId === node.id;

    return (
      <div key={node.id} className="tag-node">
        <div 
          className={`tag-item level-${level}`}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
        >
          {hasChildren && (
            <button
              className={`expand-button ${isExpanded ? 'expanded' : ''}`}
              onClick={() => toggleExpanded(node.id)}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}
          
          {!hasChildren && <div className="expand-spacer" />}
          
          <div className="tag-content">
            {isEditing ? (
              <input
                ref={editInputRef}
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleSaveEdit}
                className="tag-edit-input"
              />
            ) : (
              <>
                <span 
                  className="tag-name"
                  onClick={() => handleTagClick(node)}
                  title={`Click to filter by ${node.name}`}
                >
                  🏷️ {node.name}
                </span>
                <div className="tag-actions">
                  {selectedFiles.length > 0 && (
                    <button
                      className="tag-action-btn assign-btn"
                      onClick={() => handleTagAssign(node)}
                      title={`Assign to ${selectedFiles.length} selected file(s)`}
                    >
                      ➕
                    </button>
                  )}
                  <button
                    className="tag-action-btn"
                    onClick={() => handleStartEdit(node)}
                    title="Edit tag"
                  >
                    ✏️
                  </button>
                  <button
                    className="tag-action-btn"
                    onClick={() => handleStartNewTag(node.id)}
                    title="Add subtag"
                  >
                    ➕
                  </button>
                  <button
                    className="tag-action-btn"
                    onClick={(e) => handleContextMenu(node, e)}
                    title="More options"
                  >
                    ⋮
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        
        {isExpanded && hasChildren && (
          <div className="tag-children">
            {node.children!.map(child => renderTagNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`tag-system-panel ${loading ? 'loading' : ''}`}>
      <div className="tag-panel-header">
        <h3>Tags</h3>
        <button
          className="add-tag-btn"
          onClick={() => handleStartNewTag()}
          title="Add new tag category"
          disabled={loading}
        >
          ➕
        </button>
      </div>

      {error && (
        <div className="error-message">
          <span className="error-text">{error}</span>
          <button
            className="error-dismiss"
            onClick={() => setError(null)}
            title="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {selectedFiles.length > 0 && (
        <div className="selected-files-info">
          <span className="selected-count">
            {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
          </span>
          <span className="assign-hint">
            Click ➕ next to tags to assign them
          </span>
        </div>
      )}

      <div className="tag-tree">
        {tagHierarchy.length === 0 ? (
          <div className="no-tags">
            <p>No tags yet</p>
            <button
              className="create-first-tag-btn"
              onClick={() => handleStartNewTag()}
            >
              Create your first tag
            </button>
          </div>
        ) : (
          tagHierarchy.map(node => renderTagNode(node))
        )}
      </div>

      {showNewTagInput && (
        <div className="new-tag-input-container">
          <input
            ref={newTagInputRef}
            type="text"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={handleNewTagKeyDown}
            placeholder="Enter tag name..."
            className="new-tag-input"
          />
          <div className="new-tag-actions">
            <button onClick={handleSaveNewTag} className="save-btn">
              ✓
            </button>
            <button onClick={handleCancelNewTag} className="cancel-btn">
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};