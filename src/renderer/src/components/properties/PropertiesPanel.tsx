import React, { useState, useEffect } from 'react';
import { MediaFile, EXIFData, MediaMetadata } from '../../../../types/global';
import { StarRating } from '../common/StarRating';
import { useRating } from '../../hooks/useRating';
import { useServices } from '../../services/DIContainer';
import './PropertiesPanel.css';

interface PropertiesPanelProps {
  selectedItems: Set<string>;
  selectedFiles: MediaFile[];
  onEditClick?: (file: MediaFile) => void;
  onFullscreenClick?: (file: MediaFile) => void;
  onRatingChange?: (files: MediaFile[], rating: number) => void;
}

interface PropertyInfo {
  name: string;
  size?: number;
  dateModified: Date;
  dateCreated?: Date;
  type: string;
  dimensions?: string;
  rating?: number;
  metadata?: MediaMetadata;
  exifData?: EXIFData;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedItems,
  selectedFiles,
  onEditClick,
  onFullscreenClick,
  onRatingChange,
}) => {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [propertyInfo, setPropertyInfo] = useState<PropertyInfo | null>(null);
  const [batchInfo, setBatchInfo] = useState<{
    totalSize: number;
    fileTypes: Set<string>;
    averageRating: number;
  } | null>(null);

  const { setRating, getRating, getAverageRating, isLoading, error } = useRating();
  const { metadataService } = useServices();

  useEffect(() => {
    const loadFileInfo = async () => {
      if (selectedFiles.length === 1) {
        const file = selectedFiles[0];
        
        console.log('📋 Loading metadata for:', file.path);
        
        // Get rating from metadata
        let rating = 0;
        let metadata: MediaMetadata | undefined;
        try {
          rating = await getRating(file.path);
          // Load real metadata from the API
          metadata = await window.electronAPI?.metadata?.readMetadata(file.path);
          console.log('✅ Metadata loaded:', metadata);
        } catch (error) {
          console.warn('⚠️ Could not load metadata for file:', error);
        }
        
        setPropertyInfo({
          name: file.name,
          size: file.size,
          dateModified: file.dateModified,
          dateCreated: metadata?.dateCreated || file.dateCreated,
          type: getFileTypeDisplay(file),
          dimensions: metadata?.dimensions ? `${metadata.dimensions.width} × ${metadata.dimensions.height}` : undefined,
          rating: metadata?.rating || rating,
          metadata,
          // Use real EXIF data if available
          exifData: metadata?.cameraInfo ? {
            camera: {
              make: metadata.cameraInfo.make,
              model: metadata.cameraInfo.model,
              lens: metadata.cameraInfo.lens,
            },
            settings: {
              aperture: metadata.cameraInfo.aperture,
              shutterSpeed: metadata.cameraInfo.shutterSpeed,
              iso: metadata.cameraInfo.iso,
              focalLength: metadata.cameraInfo.focalLength,
              flash: metadata.cameraInfo.flash,
            },
            location: {
              dateTime: metadata.dateCreated,
            },
            technical: {
              colorSpace: metadata.format || 'Unknown',
              whiteBalance: 'Auto',
              meteringMode: 'Matrix',
            },
          } : undefined,
        });
        setBatchInfo(null);
      } else if (selectedFiles.length > 1) {
        // Calculate batch information
        const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
        const fileTypes = new Set(selectedFiles.map(file => getFileTypeDisplay(file)));
        
        // Get average rating from metadata
        let averageRating = 0;
        try {
          averageRating = await getAverageRating(selectedFiles);
        } catch (error) {
          console.warn('Could not calculate average rating:', error);
        }
        
        setBatchInfo({
          totalSize,
          fileTypes,
          averageRating,
        });
        setPropertyInfo(null);
      } else {
        setPropertyInfo(null);
        setBatchInfo(null);
      }
    };

    loadFileInfo();
  }, [selectedFiles, getRating, getAverageRating]);

  const getFileTypeDisplay = (file: MediaFile): string => {
    const ext = file.extension.toUpperCase();
    if (file.type === 'image') {
      return `${ext} Image`;
    } else if (file.type === 'video') {
      return `${ext} Video`;
    }
    return ext;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };



  const handleRatingChange = async (rating: number) => {
    try {
      await setRating(selectedFiles, rating);
      
      // Update local state to reflect the change immediately
      if (selectedFiles.length === 1 && propertyInfo) {
        setPropertyInfo({
          ...propertyInfo,
          rating,
        });
      } else if (selectedFiles.length > 1 && batchInfo) {
        setBatchInfo({
          ...batchInfo,
          averageRating: rating,
        });
      }
      
      // Also call the parent callback if provided
      if (onRatingChange) {
        onRatingChange(selectedFiles, rating);
      }
    } catch (error) {
      console.error('Failed to set rating:', error);
    }
  };

  const handleEditClick = async () => {
    if (propertyInfo && selectedFiles.length === 1) {
      try {
        const file = selectedFiles[0];
        if (file.type === 'image') {
          // Open image editor via IPC
          const result = await window.electronAPI?.editor?.open(file);
          if (result?.success) {
            console.log('Image editor opened successfully');
          } else {
            console.error('Failed to open image editor:', result?.error);
          }
        }

        // Also call the callback if provided
        if (onEditClick) {
          onEditClick(file);
        }
      } catch (error) {
        console.error('Failed to open image editor:', error);
      }
    }
  };

  const handleFullscreenClick = async () => {
    if (propertyInfo && selectedFiles.length === 1) {
      try {
        const file = selectedFiles[0];
        // Open fullscreen viewer via IPC
        const result = await window.electronAPI?.viewer?.openFullscreen(file.path, selectedFiles.map(f => f.path));
        if (result?.success) {
          console.log('Fullscreen viewer opened successfully');
        } else {
          console.error('Failed to open fullscreen viewer:', result?.error);
        }

        // Also call the callback if provided
        if (onFullscreenClick) {
          onFullscreenClick(file);
        }
      } catch (error) {
        console.error('Failed to open fullscreen viewer:', error);
      }
    }
  };

  return (
    <div className="properties-panel">
      <div className="section-header">
        <h3>Properties</h3>
        {propertyInfo && (
          <button
            className="details-toggle"
            onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
            title="Toggle technical details"
          >
            {showTechnicalDetails ? '📋' : '🔧'}
          </button>
        )}
      </div>

      <div className="properties-content">
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        {selectedItems.size === 0 && (
          <div className="no-selection">
            No items selected
          </div>
        )}

        {batchInfo && (
          <div className="multi-selection">
            <div className="property-item">
              <span className="label">Selected:</span>
              <span className="value">{selectedFiles.length} items</span>
            </div>
            <div className="property-item">
              <span className="label">Total Size:</span>
              <span className="value">{formatFileSize(batchInfo.totalSize)}</span>
            </div>
            <div className="property-item">
              <span className="label">Types:</span>
              <span className="value">{Array.from(batchInfo.fileTypes).join(', ')}</span>
            </div>
            <div className="property-item rating-item">
              <span className="label">Avg. Rating:</span>
              <div className="rating-stars">
                <StarRating 
                  rating={Math.round(batchInfo.averageRating)} 
                  interactive={false}
                  size="small"
                />
              </div>
            </div>
            <div className="batch-actions">
              <button 
                className="action-btn"
                onClick={() => handleRatingChange(5)}
                disabled={isLoading}
                title="Rate all selected items 5 stars"
              >
                {isLoading ? 'Rating...' : 'Rate All ⭐⭐⭐⭐⭐'}
              </button>
            </div>
          </div>
        )}

        {propertyInfo && (
          <div className="single-selection">
            <div className="property-item">
              <span className="label">Name:</span>
              <span className="value" title={propertyInfo.name}>
                {propertyInfo.name}
              </span>
            </div>
            
            {propertyInfo.size && (
              <div className="property-item">
                <span className="label">Size:</span>
                <span className="value">{formatFileSize(propertyInfo.size)}</span>
              </div>
            )}
            
            <div className="property-item">
              <span className="label">Type:</span>
              <span className="value">{propertyInfo.type}</span>
            </div>
            
            {propertyInfo.dimensions && (
              <div className="property-item">
                <span className="label">Dimensions:</span>
                <span className="value">{propertyInfo.dimensions}</span>
              </div>
            )}
            
            <div className="property-item">
              <span className="label">Modified:</span>
              <span className="value" title={formatDate(propertyInfo.dateModified)}>
                {propertyInfo.dateModified.toLocaleDateString()}
              </span>
            </div>

            {propertyInfo.dateCreated && (
              <div className="property-item">
                <span className="label">Created:</span>
                <span className="value" title={formatDate(propertyInfo.dateCreated)}>
                  {propertyInfo.dateCreated.toLocaleDateString()}
                </span>
              </div>
            )}

            {propertyInfo.rating !== undefined && (
              <div className="property-item rating-item">
                <span className="label">Rating:</span>
                <div className="rating-stars">
                  <StarRating 
                    rating={propertyInfo.rating} 
                    interactive={true}
                    size="medium"
                    onRatingChange={handleRatingChange}
                  />
                </div>
              </div>
            )}

            {showTechnicalDetails && propertyInfo.exifData && (
              <div className="technical-details">
                <div className="details-section">
                  <h4>Camera Information</h4>
                  {propertyInfo.exifData.camera.make && (
                    <div className="property-item">
                      <span className="label">Make:</span>
                      <span className="value">{propertyInfo.exifData.camera.make}</span>
                    </div>
                  )}
                  {propertyInfo.exifData.camera.model && (
                    <div className="property-item">
                      <span className="label">Model:</span>
                      <span className="value">{propertyInfo.exifData.camera.model}</span>
                    </div>
                  )}
                  {propertyInfo.exifData.camera.lens && (
                    <div className="property-item">
                      <span className="label">Lens:</span>
                      <span className="value">{propertyInfo.exifData.camera.lens}</span>
                    </div>
                  )}
                </div>

                <div className="details-section">
                  <h4>Camera Settings</h4>
                  {propertyInfo.exifData.settings.aperture && (
                    <div className="property-item">
                      <span className="label">Aperture:</span>
                      <span className="value">{propertyInfo.exifData.settings.aperture}</span>
                    </div>
                  )}
                  {propertyInfo.exifData.settings.shutterSpeed && (
                    <div className="property-item">
                      <span className="label">Shutter:</span>
                      <span className="value">{propertyInfo.exifData.settings.shutterSpeed}</span>
                    </div>
                  )}
                  {propertyInfo.exifData.settings.iso && (
                    <div className="property-item">
                      <span className="label">ISO:</span>
                      <span className="value">{propertyInfo.exifData.settings.iso}</span>
                    </div>
                  )}
                  {propertyInfo.exifData.settings.focalLength && (
                    <div className="property-item">
                      <span className="label">Focal Length:</span>
                      <span className="value">{propertyInfo.exifData.settings.focalLength}</span>
                    </div>
                  )}
                  <div className="property-item">
                    <span className="label">Flash:</span>
                    <span className="value">
                      {propertyInfo.exifData.settings.flash ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>

                {propertyInfo.exifData.technical && (
                  <div className="details-section">
                    <h4>Technical Details</h4>
                    {propertyInfo.exifData.technical.colorSpace && (
                      <div className="property-item">
                        <span className="label">Color Space:</span>
                        <span className="value">{propertyInfo.exifData.technical.colorSpace}</span>
                      </div>
                    )}
                    {propertyInfo.exifData.technical.whiteBalance && (
                      <div className="property-item">
                        <span className="label">White Balance:</span>
                        <span className="value">{propertyInfo.exifData.technical.whiteBalance}</span>
                      </div>
                    )}
                    {propertyInfo.exifData.technical.meteringMode && (
                      <div className="property-item">
                        <span className="label">Metering:</span>
                        <span className="value">{propertyInfo.exifData.technical.meteringMode}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="action-buttons">
              <button 
                className="action-btn primary"
                onClick={handleEditClick}
                disabled={selectedFiles[0]?.type !== 'image'}
                title={selectedFiles[0]?.type !== 'image' ? 'Editing only available for images' : 'Edit image'}
              >
                Edit
              </button>
              <button 
                className="action-btn"
                onClick={handleFullscreenClick}
                title="View in fullscreen"
              >
                Fullscreen
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};