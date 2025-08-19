import React, { useState, useEffect } from 'react';
import { MediaFile, TagHierarchyNode, HierarchicalTag } from '../../../../types/global';
import { PropertiesPanel } from '../properties/PropertiesPanel';
import { TagSystemPanel } from '../tags/TagSystemPanel';
import { useServices } from '../../services/DIContainer';
import { useToast } from '../common/Toast';
import './RightPanel.css';

interface RightPanelProps {
  selectedItems: Set<string>;
  currentPath: string;
  selectedFiles?: MediaFile[];
  onEditClick?: (file: MediaFile) => void;
  onFullscreenClick?: (file: MediaFile) => void;
  onRatingChange?: (files: MediaFile[], rating: number) => void;
  onTagCreate?: (parentId: string | null, name: string) => void;
  onTagEdit?: (tagId: string, newName: string) => void;
  onTagDelete?: (tagId: string) => void;
  onTagAssign?: (files: MediaFile[], tags: HierarchicalTag[]) => void;
  onTagFilter?: (tag: HierarchicalTag) => void;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  selectedItems,
  currentPath,
  selectedFiles = [],
  onEditClick,
  onFullscreenClick,
  onRatingChange,
  onTagCreate,
  onTagEdit,
  onTagDelete,
  onTagAssign,
  onTagFilter,
}) => {
  const [tagHierarchy, setTagHierarchy] = useState<TagHierarchyNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { tagService, metadataService } = useServices();
  const { showSuccess, showError } = useToast();

  // Load tag hierarchy on component mount
  useEffect(() => {
    const loadTagHierarchy = async () => {
      try {
        setLoading(true);
        setError(null);
        const hierarchy = await tagService.getTagHierarchy();
        setTagHierarchy(hierarchy);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to load tag hierarchy');
        console.error('Failed to load tag hierarchy:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTagHierarchy();
  }, [tagService]);

  // Mock tag hierarchy fallback for development
  const mockTagHierarchy: TagHierarchyNode[] = [
    {
      id: 'nature',
      name: 'Nature',
      level: 0,
      parent: undefined,
      children: [
        {
          id: 'landscape',
          name: 'Landscape',
          level: 1,
          parent: 'nature',
          children: [
            { id: 'mountains', name: 'Mountains', level: 2, parent: 'landscape', children: [] },
            { id: 'lakes', name: 'Lakes', level: 2, parent: 'landscape', children: [] },
            { id: 'forests', name: 'Forests', level: 2, parent: 'landscape', children: [] },
          ],
        },
        {
          id: 'wildlife',
          name: 'Wildlife',
          level: 1,
          parent: 'nature',
          children: [
            { id: 'birds', name: 'Birds', level: 2, parent: 'wildlife', children: [] },
            { id: 'mammals', name: 'Mammals', level: 2, parent: 'wildlife', children: [] },
          ],
        },
      ],
    },
    {
      id: 'events',
      name: 'Events',
      level: 0,
      parent: undefined,
      children: [
        {
          id: 'vacation',
          name: 'Vacation',
          level: 1,
          parent: 'events',
          children: [
            { id: 'beach', name: 'Beach', level: 2, parent: 'vacation', children: [] },
            { id: 'city', name: 'City', level: 2, parent: 'vacation', children: [] },
          ],
        },
        {
          id: 'family',
          name: 'Family',
          level: 1,
          parent: 'events',
          children: [
            { id: 'birthday', name: 'Birthday', level: 2, parent: 'family', children: [] },
            { id: 'wedding', name: 'Wedding', level: 2, parent: 'family', children: [] },
          ],
        },
      ],
    },
  ];

  // Use real tag hierarchy if available, otherwise fall back to mock data
  const displayTagHierarchy = tagHierarchy.length > 0 ? tagHierarchy : mockTagHierarchy;

  // Tag operation handlers
  const handleTagCreate = async (parentId: string | null, name: string) => {
    try {
      setLoading(true);
      setError(null);
      await tagService.createTag(parentId, name);
      // Reload tag hierarchy
      const updatedHierarchy = await tagService.getTagHierarchy();
      setTagHierarchy(updatedHierarchy);
      showSuccess('Tag Created', `Successfully created tag "${name}"`);
      onTagCreate?.(parentId, name);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create tag';
      setError(errorMessage);
      showError('Failed to Create Tag', errorMessage);
      console.error('Failed to create tag:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTagEdit = async (tagId: string, newName: string) => {
    try {
      setLoading(true);
      setError(null);
      await tagService.updateTag(tagId, newName);
      // Reload tag hierarchy
      const updatedHierarchy = await tagService.getTagHierarchy();
      setTagHierarchy(updatedHierarchy);
      showSuccess('Tag Updated', `Successfully renamed tag to "${newName}"`);
      onTagEdit?.(tagId, newName);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update tag';
      setError(errorMessage);
      showError('Failed to Update Tag', errorMessage);
      console.error('Failed to update tag:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTagDelete = async (tagId: string) => {
    try {
      setLoading(true);
      setError(null);
      await tagService.deleteTag(tagId);
      // Reload tag hierarchy
      const updatedHierarchy = await tagService.getTagHierarchy();
      setTagHierarchy(updatedHierarchy);
      onTagDelete?.(tagId);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to delete tag');
      console.error('Failed to delete tag:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTagAssign = async (files: MediaFile[], tags: HierarchicalTag[]) => {
    try {
      setLoading(true);
      setError(null);
      const filePaths = files.map(file => file.path);
      const tagIds = tags.map(tag => tag.id);
      await tagService.assignTagsToFiles(filePaths, tagIds);
      const tagNames = tags.map(tag => tag.name).join(', ');
      showSuccess('Tags Assigned', `Successfully assigned tags "${tagNames}" to ${files.length} file${files.length !== 1 ? 's' : ''}`);
      onTagAssign?.(files, tags);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to assign tags';
      setError(errorMessage);
      showError('Failed to Assign Tags', errorMessage);
      console.error('Failed to assign tags:', error);
    } finally {
      setLoading(false);
    }
  };

  // Convert selectedItems to MediaFile array for mock data
  useEffect(() => {
    // In real implementation, this would fetch MediaFile objects based on selectedItems
    // For now, we'll create mock data when items are selected
  }, [selectedItems]);

  return (
    <div className="right-panel">
      {/* Properties Section */}
      <div className="panel-section properties-section">
        <PropertiesPanel
          selectedItems={selectedItems}
          selectedFiles={selectedFiles}
          onEditClick={onEditClick}
          onFullscreenClick={onFullscreenClick}
          onRatingChange={onRatingChange}
        />
      </div>

      {/* Tags Section */}
      <div className="panel-section tags-section">
        <TagSystemPanel
          selectedFiles={selectedFiles}
          tagHierarchy={displayTagHierarchy}
          onTagCreate={handleTagCreate}
          onTagEdit={handleTagEdit}
          onTagDelete={handleTagDelete}
          onTagAssign={handleTagAssign}
          onTagFilter={onTagFilter}
        />
      </div>
    </div>
  );
};