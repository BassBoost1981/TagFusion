import React, { useState, useEffect, useRef } from 'react';
import './Favorites.css';

interface FavoriteFolder {
  id: string;
  name: string;
  path: string;
  dateAdded: Date;
  order: number;
}

interface FavoritesProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onAddFavorite: (name: string, path: string) => Promise<void>;
  onRemoveFavorite: (id: string) => Promise<void>;
  onUpdateFavorite: (id: string, updates: { name?: string; path?: string }) => Promise<void>;
  onReorderFavorites: (favoriteIds: string[]) => Promise<void>;
}

export const Favorites: React.FC<FavoritesProps> = ({
  currentPath,
  onNavigate,
  onAddFavorite,
  onRemoveFavorite,
  onUpdateFavorite,
  onReorderFavorites,
}) => {
  const [favorites, setFavorites] = useState<FavoriteFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // Load favorites on mount
  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    setLoading(true);
    try {
      const favoritesData = await window.electronAPI?.favorites?.getFavorites() || [];
      setFavorites(favoritesData);
    } catch (error) {
      console.error('Failed to load favorites:', error);
      setFavorites([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCurrentFolder = async () => {
    if (!currentPath) return;
    
    // Extract folder name from path (works for both Windows and Unix paths)
    const pathSeparator = currentPath.includes('\\') ? '\\' : '/';
    const pathParts = currentPath.split(pathSeparator).filter(Boolean);
    const folderName = pathParts.pop() || currentPath;
    
    try {
      console.log('Adding favorite:', { name: folderName, path: currentPath });
      await onAddFavorite(folderName, currentPath);
      await loadFavorites(); // Refresh the list
    } catch (error) {
      console.error('Failed to add favorite:', error);
      // Show user-friendly error message
      alert(`Failed to add favorite: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleNavigateToFavorite = (favorite: FavoriteFolder) => {
    onNavigate(favorite.path);
  };

  const handleStartEdit = (favorite: FavoriteFolder) => {
    setEditingId(favorite.id);
    setEditingName(favorite.name);
    setTimeout(() => {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }, 0);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingName.trim()) return;
    
    try {
      await onUpdateFavorite(editingId, { name: editingName.trim() });
      await loadFavorites(); // Refresh the list
      setEditingId(null);
      setEditingName('');
    } catch (error) {
      console.error('Failed to update favorite:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleRemoveFavorite = async (favorite: FavoriteFolder) => {
    if (window.confirm(`Remove "${favorite.name}" from favorites?`)) {
      try {
        await onRemoveFavorite(favorite.id);
        await loadFavorites(); // Refresh the list
      } catch (error) {
        console.error('Failed to remove favorite:', error);
      }
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSaveEdit();
    } else if (event.key === 'Escape') {
      handleCancelEdit();
    }
  };

  if (loading) {
    return (
      <div className="favorites-container">
        <div className="favorites-header">
          <h3>Favorites</h3>
        </div>
        <div className="favorites-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="favorites-container">
      <div className="favorites-header">
        <h3>Favorites</h3>
        <button
          className="add-favorite-btn"
          onClick={handleAddCurrentFolder}
          title="Add current folder to favorites"
          disabled={!currentPath}
        >
          ➕
        </button>
      </div>

      <div className="favorites-list">
        {favorites.length === 0 ? (
          <div className="favorites-empty">
            <p>No favorites yet</p>
            <p>Click ➕ to add the current folder</p>
          </div>
        ) : (
          favorites.map((favorite) => (
            <div
              key={favorite.id}
              className={`favorite-item ${currentPath === favorite.path ? 'current' : ''}`}
            >
              {editingId === favorite.id ? (
                <input
                  ref={editInputRef}
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleSaveEdit}
                  className="favorite-edit-input"
                />
              ) : (
                <>
                  <div
                    className="favorite-content"
                    onClick={() => handleNavigateToFavorite(favorite)}
                    title={favorite.path}
                  >
                    <span className="favorite-icon">📁</span>
                    <span className="favorite-name">{favorite.name}</span>
                  </div>
                  <div className="favorite-actions">
                    <button
                      className="favorite-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(favorite);
                      }}
                      title="Rename"
                    >
                      ✏️
                    </button>
                    <button
                      className="favorite-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFavorite(favorite);
                      }}
                      title="Remove"
                    >
                      🗑️
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};