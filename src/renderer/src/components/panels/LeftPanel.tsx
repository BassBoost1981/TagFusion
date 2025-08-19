import React from 'react';
import { Favorites } from '../navigation/Favorites';
import { DriveTree } from '../navigation/DriveTree';
import { useServices } from '../../services/DIContainer';
import './LeftPanel.css';

interface LeftPanelProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const LeftPanel: React.FC<LeftPanelProps> = ({
  currentPath,
  onNavigate,
}) => {
  const { fileSystemService } = useServices();

  const handleAddFavorite = async (name: string, path: string) => {
    try {
      const result = await window.electronAPI?.favorites?.addFavorite(name, path);
      if (result?.success) {
        console.log('Successfully added favorite');
      } else {
        console.error('Failed to add favorite:', result?.error);
      }
    } catch (error) {
      console.error('Error adding favorite:', error);
    }
  };

  const handleRemoveFavorite = async (id: string) => {
    try {
      const result = await window.electronAPI?.favorites?.removeFavorite(id);
      if (result?.success) {
        console.log('Successfully removed favorite');
      } else {
        console.error('Failed to remove favorite:', result?.error);
      }
    } catch (error) {
      console.error('Error removing favorite:', error);
    }
  };

  const handleUpdateFavorite = async (id: string, updates: { name?: string; path?: string }) => {
    try {
      const result = await window.electronAPI?.favorites?.updateFavorite(id, updates);
      if (result?.success) {
        console.log('Successfully updated favorite');
      } else {
        console.error('Failed to update favorite:', result?.error);
      }
    } catch (error) {
      console.error('Error updating favorite:', error);
    }
  };

  const handleReorderFavorites = async (favoriteIds: string[]) => {
    try {
      const result = await window.electronAPI?.favorites?.reorderFavorites(favoriteIds);
      if (result?.success) {
        console.log('Successfully reordered favorites');
      } else {
        console.error('Failed to reorder favorites:', result?.error);
      }
    } catch (error) {
      console.error('Error reordering favorites:', error);
    }
  };

  const handleRefreshDrives = async () => {
    try {
      // This will trigger a re-render of the DriveTree component
      console.log('Refreshing drives...');
    } catch (error) {
      console.error('Error refreshing drives:', error);
    }
  };

  return (
    <div className="left-panel">
      {/* Favorites Section */}
      <div className="panel-section favorites-section">
        <Favorites
          currentPath={currentPath}
          onNavigate={onNavigate}
          onAddFavorite={handleAddFavorite}
          onRemoveFavorite={handleRemoveFavorite}
          onUpdateFavorite={handleUpdateFavorite}
          onReorderFavorites={handleReorderFavorites}
        />
      </div>

      {/* Drive Tree Section */}
      <div className="panel-section drive-tree-section">
        <DriveTree
          currentPath={currentPath}
          onNavigate={onNavigate}
          onRefresh={handleRefreshDrives}
        />
      </div>
    </div>
  );
};