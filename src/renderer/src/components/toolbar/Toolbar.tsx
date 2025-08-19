import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AdvancedFilters } from './AdvancedFilters';
import { useThemeContext } from '../../contexts/ThemeContext';
import { useServices } from '../../services/DIContainer';
import './Toolbar.css';

export interface FilterCriteria {
  fileTypes: ('image' | 'video' | 'folder')[];
  dateRange?: { from: Date; to: Date };
  sizeRange?: { min: number; max: number };
  rating?: number;
  tags: HierarchicalTag[];
  cameraInfo?: {
    make?: string;
    model?: string;
  };
}

// Import HierarchicalTag type
import { HierarchicalTag } from '../../../types/global';

interface NavigationHistory {
  canGoBack: boolean;
  canGoForward: boolean;
}

interface ToolbarProps {
  currentPath: string;
  searchQuery: string;
  navigationHistory: NavigationHistory;
  activeFilters: FilterCriteria;
  selectedItemsCount?: number;
  onSearchChange: (query: string) => void;
  onNavigateHome: () => void;
  onNavigateBack: () => void;
  onNavigateForward: () => void;
  onNavigateUp: () => void;
  onThemeToggle: () => void;
  onFiltersChange: (filters: FilterCriteria) => void;
  onSettingsOpen: () => void;
  onExport?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  currentPath,
  searchQuery,
  navigationHistory,
  activeFilters,
  selectedItemsCount = 0,
  onSearchChange,
  onNavigateHome,
  onNavigateBack,
  onNavigateForward,
  onNavigateUp,
  onThemeToggle,
  onFiltersChange,
  onSettingsOpen,
  onExport,
}) => {
  const { effectiveTheme, toggleTheme } = useThemeContext();
  const { tagService, fileSystemService } = useServices();
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);

  // Handle Ctrl+F to focus search (specific to toolbar)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+F to focus search
      if (event.ctrlKey && event.key === 'f') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close advanced filters when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filtersRef.current && !filtersRef.current.contains(event.target as Node)) {
        setShowAdvancedFilters(false);
      }
    };

    if (showAdvancedFilters) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAdvancedFilters]);

  // Search functionality
  const handleSearchChange = useCallback(async (value: string) => {
    onSearchChange(value);

    if (value.length > 2) {
      try {
        // Generate search suggestions based on tags and file names
        const tagHierarchy = await tagService.getTagHierarchy();
        const tagSuggestions = tagHierarchy
          .filter(tag => tag.name.toLowerCase().includes(value.toLowerCase()))
          .map(tag => `tag:${tag.name}`)
          .slice(0, 5);

        // Add common search patterns
        const commonSuggestions = [
          `filename:${value}`,
          `extension:${value}`,
          `date:${value}`,
        ];

        setSearchSuggestions([...tagSuggestions, ...commonSuggestions]);
        setShowSuggestions(true);
      } catch (error) {
        console.error('Failed to generate search suggestions:', error);
      }
    } else {
      setShowSuggestions(false);
    }
  }, [onSearchChange, tagService]);

  const handleSearchFocus = () => {
    setSearchFocused(true);
    if (searchQuery.length > 2) {
      setShowSuggestions(true);
    }
  };

  const handleSearchBlur = () => {
    setSearchFocused(false);
    // Delay hiding suggestions to allow clicking on them
    setTimeout(() => setShowSuggestions(false), 200);
  };

  const handleSuggestionClick = (suggestion: string) => {
    onSearchChange(suggestion);
    setShowSuggestions(false);
    searchInputRef.current?.focus();
  };

  const formatPath = (path: string): string => {
    // Shorten very long paths for display
    if (path.length > 50) {
      const parts = path.split('\\');
      if (parts.length > 3) {
        return `${parts[0]}\\...\\${parts[parts.length - 2]}\\${parts[parts.length - 1]}`;
      }
    }
    return path;
  };

  const getActiveFilterCount = (): number => {
    let count = 0;
    if (activeFilters.fileTypes.length > 0 && activeFilters.fileTypes.length < 3) count++;
    if (activeFilters.dateRange) count++;
    if (activeFilters.sizeRange) count++;
    if (activeFilters.rating) count++;
    if (activeFilters.tags.length > 0) count++;
    return count;
  };

  const handleQuickFilter = (filterType: string) => {
    let newFilters = { ...activeFilters };
    
    switch (filterType) {
      case 'all':
        newFilters.fileTypes = [];
        break;
      case 'images':
        newFilters.fileTypes = ['image'];
        break;
      case 'videos':
        newFilters.fileTypes = ['video'];
        break;
      case 'folders':
        newFilters.fileTypes = ['folder'];
        break;
    }
    
    onFiltersChange(newFilters);
  };

  const clearAllFilters = () => {
    onFiltersChange({
      fileTypes: [],
      tags: [],
    });
  };

  const activeFilterCount = getActiveFilterCount();

  return (
    <div className="toolbar">
      <div className="toolbar-section navigation">
        <button 
          className={`toolbar-btn ${!navigationHistory.canGoBack ? 'disabled' : ''}`}
          onClick={onNavigateBack}
          disabled={!navigationHistory.canGoBack}
          title="Back (Alt+Left)"
        >
          ⬅️
        </button>
        <button 
          className={`toolbar-btn ${!navigationHistory.canGoForward ? 'disabled' : ''}`}
          onClick={onNavigateForward}
          disabled={!navigationHistory.canGoForward}
          title="Forward (Alt+Right)"
        >
          ➡️
        </button>
        <button 
          className="toolbar-btn" 
          onClick={onNavigateUp}
          title="Up (Alt+Up)"
        >
          ⬆️
        </button>
        <button 
          className="toolbar-btn" 
          onClick={onNavigateHome}
          title="Home (Alt+Home)"
        >
          🏠
        </button>
        
        <div className="path-breadcrumb">
          <input 
            type="text" 
            className="path-input"
            value={currentPath}
            readOnly
            title={currentPath}
            placeholder="Current path"
          />
        </div>
      </div>

      <div className="toolbar-section search">
        <div className={`search-container ${searchFocused ? 'focused' : ''}`}>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search files, folders, and tags... (Ctrl+F)"
            className="search-input"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
          />
          {searchQuery && (
            <button
              className="clear-search-btn"
              onClick={() => onSearchChange('')}
              title="Clear search"
            >
              ✕
            </button>
          )}

          {/* Search Suggestions */}
          {showSuggestions && searchSuggestions.length > 0 && (
            <div className="search-suggestions">
              {searchSuggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="search-suggestion"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion}
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="quick-filters">
          <select 
            className="filter-select"
            value={activeFilters.fileTypes.length === 1 ? activeFilters.fileTypes[0] : 'all'}
            onChange={(e) => handleQuickFilter(e.target.value)}
          >
            <option value="all">All Items</option>
            <option value="images">Images Only</option>
            <option value="videos">Videos Only</option>
            <option value="folders">Folders Only</option>
          </select>
        </div>
        
        <div className="filter-controls" ref={filtersRef}>
          <button 
            className={`toolbar-btn filter-btn ${activeFilterCount > 0 ? 'active' : ''}`}
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            title="Advanced Filters"
          >
            🔍
            {activeFilterCount > 0 && (
              <span className="filter-badge">{activeFilterCount}</span>
            )}
          </button>
          
          {activeFilterCount > 0 && (
            <button 
              className="toolbar-btn clear-filters-btn"
              onClick={clearAllFilters}
              title="Clear all filters"
            >
              🗑️
            </button>
          )}
          
          {showAdvancedFilters && (
            <AdvancedFilters
              filters={activeFilters}
              onFiltersChange={onFiltersChange}
              onClose={() => setShowAdvancedFilters(false)}
            />
          )}
        </div>
      </div>

      <div className="toolbar-section actions">
        {onExport && selectedItemsCount > 0 && (
          <button 
            className="toolbar-btn export-btn" 
            onClick={onExport}
            title={`Export ${selectedItemsCount} selected item${selectedItemsCount !== 1 ? 's' : ''} (Ctrl+E)`}
          >
            📤
            <span className="export-count">{selectedItemsCount}</span>
          </button>
        )}
        <button 
          className="toolbar-btn" 
          onClick={onSettingsOpen}
          title="Settings"
        >
          ⚙️
        </button>
        <button 
          className="toolbar-btn theme-toggle" 
          onClick={toggleTheme}
          title={`Switch to ${effectiveTheme === 'light' ? 'dark' : 'light'} theme`}
        >
          {effectiveTheme === 'light' ? '🌙' : '☀️'}
        </button>
      </div>
    </div>
  );
};