import React, { useState } from 'react';
import { FilterCriteria } from './Toolbar';
import { HierarchicalTag } from '../../../types/global';
import { RatingFilter } from '../common/RatingFilter';
import './AdvancedFilters.css';

interface AdvancedFiltersProps {
  filters: FilterCriteria;
  onFiltersChange: (filters: FilterCriteria) => void;
  onClose: () => void;
}

export const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({
  filters,
  onFiltersChange,
  onClose,
}) => {
  const [localFilters, setLocalFilters] = useState<FilterCriteria>(filters);

  const handleFileTypeChange = (type: 'image' | 'video' | 'folder', checked: boolean) => {
    const newFileTypes = checked
      ? [...localFilters.fileTypes, type]
      : localFilters.fileTypes.filter(t => t !== type);
    
    setLocalFilters({
      ...localFilters,
      fileTypes: newFileTypes,
    });
  };

  const handleDateRangeChange = (field: 'from' | 'to', value: string) => {
    const date = value ? new Date(value) : undefined;
    const newDateRange = localFilters.dateRange || { from: new Date(), to: new Date() };
    
    if (field === 'from' && date) {
      newDateRange.from = date;
    } else if (field === 'to' && date) {
      newDateRange.to = date;
    }
    
    setLocalFilters({
      ...localFilters,
      dateRange: date ? newDateRange : undefined,
    });
  };

  const handleSizeRangeChange = (field: 'min' | 'max', value: string) => {
    const size = value ? parseInt(value) * 1024 * 1024 : undefined; // Convert MB to bytes
    const newSizeRange = localFilters.sizeRange || { min: 0, max: 1000 * 1024 * 1024 };
    
    if (field === 'min' && size !== undefined) {
      newSizeRange.min = size;
    } else if (field === 'max' && size !== undefined) {
      newSizeRange.max = size;
    }
    
    setLocalFilters({
      ...localFilters,
      sizeRange: size !== undefined ? newSizeRange : undefined,
    });
  };

  const handleRatingChange = (rating: number) => {
    setLocalFilters({
      ...localFilters,
      rating: localFilters.rating === rating ? undefined : rating,
    });
  };

  const handleTagInput = (value: string) => {
    const tagStrings = value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    const tags: HierarchicalTag[] = tagStrings.map(tagString => {
      const parts = tagString.split('/').map(part => part.trim());
      if (parts.length === 1) {
        return {
          category: parts[0],
          subcategory: undefined,
          tag: parts[0],
          fullPath: parts[0]
        };
      } else if (parts.length === 2) {
        return {
          category: parts[0],
          subcategory: undefined,
          tag: parts[1],
          fullPath: parts.join('/')
        };
      } else {
        return {
          category: parts[0],
          subcategory: parts[1],
          tag: parts[parts.length - 1],
          fullPath: parts.join('/')
        };
      }
    });
    
    setLocalFilters({
      ...localFilters,
      tags,
    });
  };

  const handleCameraInfoChange = (field: 'make' | 'model', value: string) => {
    const newCameraInfo = localFilters.cameraInfo || {};
    
    if (value.trim()) {
      newCameraInfo[field] = value.trim();
    } else {
      delete newCameraInfo[field];
    }
    
    setLocalFilters({
      ...localFilters,
      cameraInfo: Object.keys(newCameraInfo).length > 0 ? newCameraInfo : undefined,
    });
  };

  const applyFilters = () => {
    onFiltersChange(localFilters);
    onClose();
  };

  const resetFilters = () => {
    const emptyFilters: FilterCriteria = {
      fileTypes: [],
      tags: [],
    };
    setLocalFilters(emptyFilters);
    onFiltersChange(emptyFilters);
    onClose();
  };

  const formatDateForInput = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const formatSizeForInput = (bytes: number): string => {
    return Math.round(bytes / (1024 * 1024)).toString();
  };

  return (
    <div className="advanced-filters-dropdown">
      <div className="filters-header">
        <h4>Advanced Filters</h4>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>
      
      <div className="filters-content">
        {/* File Types */}
        <div className="filter-group">
          <label className="group-label">File Types</label>
          <div className="checkbox-group">
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={localFilters.fileTypes.includes('image')}
                onChange={(e) => handleFileTypeChange('image', e.target.checked)}
              />
              <span>Images</span>
            </label>
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={localFilters.fileTypes.includes('video')}
                onChange={(e) => handleFileTypeChange('video', e.target.checked)}
              />
              <span>Videos</span>
            </label>
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={localFilters.fileTypes.includes('folder')}
                onChange={(e) => handleFileTypeChange('folder', e.target.checked)}
              />
              <span>Folders</span>
            </label>
          </div>
        </div>

        {/* Date Range */}
        <div className="filter-group">
          <label className="group-label">Date Range</label>
          <div className="date-range">
            <div className="date-input-group">
              <label>From:</label>
              <input
                type="date"
                value={localFilters.dateRange?.from ? formatDateForInput(localFilters.dateRange.from) : ''}
                onChange={(e) => handleDateRangeChange('from', e.target.value)}
              />
            </div>
            <div className="date-input-group">
              <label>To:</label>
              <input
                type="date"
                value={localFilters.dateRange?.to ? formatDateForInput(localFilters.dateRange.to) : ''}
                onChange={(e) => handleDateRangeChange('to', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* File Size Range */}
        <div className="filter-group">
          <label className="group-label">File Size (MB)</label>
          <div className="size-range">
            <div className="size-input-group">
              <label>Min:</label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={localFilters.sizeRange?.min ? formatSizeForInput(localFilters.sizeRange.min) : ''}
                onChange={(e) => handleSizeRangeChange('min', e.target.value)}
              />
            </div>
            <div className="size-input-group">
              <label>Max:</label>
              <input
                type="number"
                min="0"
                placeholder="1000"
                value={localFilters.sizeRange?.max ? formatSizeForInput(localFilters.sizeRange.max) : ''}
                onChange={(e) => handleSizeRangeChange('max', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Rating */}
        <div className="filter-group">
          <RatingFilter
            selectedRating={localFilters.rating}
            onRatingChange={(rating) => setLocalFilters({ ...localFilters, rating })}
            label="Minimum Rating"
            showClearButton={true}
          />
        </div>

        {/* Tags */}
        <div className="filter-group">
          <label className="group-label">Tags</label>
          <input
            type="text"
            className="tags-input"
            placeholder="Enter hierarchical tags separated by commas"
            value={localFilters.tags.map(tag => tag.fullPath).join(', ')}
            onChange={(e) => handleTagInput(e.target.value)}
          />
          <div className="tags-help">
            Example: Nature/Landscape/Mountains, Travel/Vacation/Beach
          </div>
        </div>

        {/* Camera Info */}
        <div className="filter-group">
          <label className="group-label">Camera Information</label>
          <div className="camera-info">
            <div className="camera-input-group">
              <label>Make:</label>
              <input
                type="text"
                placeholder="Canon, Nikon, Sony..."
                value={localFilters.cameraInfo?.make || ''}
                onChange={(e) => handleCameraInfoChange('make', e.target.value)}
              />
            </div>
            <div className="camera-input-group">
              <label>Model:</label>
              <input
                type="text"
                placeholder="EOS 5D Mark IV, D850..."
                value={localFilters.cameraInfo?.model || ''}
                onChange={(e) => handleCameraInfoChange('model', e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
      
      <div className="filters-actions">
        <button className="btn secondary" onClick={resetFilters}>
          Reset All
        </button>
        <button className="btn primary" onClick={applyFilters}>
          Apply Filters
        </button>
      </div>
    </div>
  );
};