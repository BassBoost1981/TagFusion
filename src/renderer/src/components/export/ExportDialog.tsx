import React, { useState, useEffect } from 'react';
import { MediaFile } from '../../../../types/global';
import './ExportDialog.css';

export interface ExportSettings {
  size: 'original' | 'web' | 'custom';
  customWidth?: number;
  customHeight?: number;
  quality: number;
  format: 'jpeg' | 'png' | 'webp';
  preserveMetadata: boolean;
  outputDirectory: string;
  filenamePrefix?: string;
  filenameSuffix?: string;
}

interface ExportDialogProps {
  isOpen: boolean;
  files: MediaFile[];
  onClose: () => void;
  onExport: (settings: ExportSettings) => void;
}

const ExportDialog: React.FC<ExportDialogProps> = ({
  isOpen,
  files,
  onClose,
  onExport
}) => {
  const [settings, setSettings] = useState<ExportSettings>({
    size: 'web',
    quality: 85,
    format: 'jpeg',
    preserveMetadata: false,
    outputDirectory: '',
    filenamePrefix: '',
    filenameSuffix: ''
  });

  const [presets] = useState({
    'web-high': {
      size: 'web' as const,
      quality: 85,
      format: 'jpeg' as const,
      preserveMetadata: false
    },
    'web-medium': {
      size: 'web' as const,
      quality: 70,
      format: 'jpeg' as const,
      preserveMetadata: false
    },
    'web-low': {
      size: 'web' as const,
      quality: 50,
      format: 'jpeg' as const,
      preserveMetadata: false
    },
    'original-compressed': {
      size: 'original' as const,
      quality: 85,
      format: 'jpeg' as const,
      preserveMetadata: true
    }
  });

  const imageFiles = files.filter(file => file.type === 'image');

  useEffect(() => {
    if (isOpen && !settings.outputDirectory) {
      // Set default output directory to user's Pictures folder or similar
      setSettings(prev => ({
        ...prev,
        outputDirectory: ''
      }));
    }
  }, [isOpen]);

  const handlePresetChange = (presetName: string) => {
    const preset = presets[presetName as keyof typeof presets];
    if (preset) {
      setSettings(prev => ({
        ...prev,
        ...preset
      }));
    }
  };

  const handleSizeChange = (size: 'original' | 'web' | 'custom') => {
    setSettings(prev => ({
      ...prev,
      size,
      // Reset custom dimensions when switching away from custom
      ...(size !== 'custom' && { customWidth: undefined, customHeight: undefined })
    }));
  };

  const handleSelectDirectory = async () => {
    try {
      const directory = await window.electronAPI.invoke('export:selectDirectory');
      if (directory) {
        setSettings(prev => ({
          ...prev,
          outputDirectory: directory
        }));
      }
    } catch (error) {
      console.error('Error selecting directory:', error);
    }
  };

  const handleExport = () => {
    if (!settings.outputDirectory) {
      alert('Please select an output directory');
      return;
    }

    if (settings.size === 'custom' && (!settings.customWidth || !settings.customHeight)) {
      alert('Please specify custom dimensions');
      return;
    }

    onExport(settings);
  };

  const getEstimatedSize = () => {
    if (settings.size === 'original') {
      return 'Same as original';
    } else if (settings.size === 'web') {
      return 'Max 1920×1080';
    } else if (settings.size === 'custom' && settings.customWidth && settings.customHeight) {
      return `Max ${settings.customWidth}×${settings.customHeight}`;
    }
    return 'Unknown';
  };

  if (!isOpen) return null;

  return (
    <div className="export-dialog-overlay">
      <div className="export-dialog">
        <div className="export-dialog-header">
          <h2>Export Images</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="export-dialog-content">
          <div className="export-info">
            <p>
              <strong>{imageFiles.length}</strong> image{imageFiles.length !== 1 ? 's' : ''} selected for export
              {files.length > imageFiles.length && (
                <span className="video-note">
                  ({files.length - imageFiles.length} video file{files.length - imageFiles.length !== 1 ? 's' : ''} will be skipped)
                </span>
              )}
            </p>
          </div>

          <div className="export-settings">
            {/* Presets */}
            <div className="setting-group">
              <label>Quick Presets:</label>
              <div className="preset-buttons">
                <button 
                  type="button"
                  onClick={() => handlePresetChange('web-high')}
                  className="preset-button"
                >
                  Web High Quality
                </button>
                <button 
                  type="button"
                  onClick={() => handlePresetChange('web-medium')}
                  className="preset-button"
                >
                  Web Medium
                </button>
                <button 
                  type="button"
                  onClick={() => handlePresetChange('web-low')}
                  className="preset-button"
                >
                  Web Low
                </button>
                <button 
                  type="button"
                  onClick={() => handlePresetChange('original-compressed')}
                  className="preset-button"
                >
                  Original Compressed
                </button>
              </div>
            </div>

            {/* Size Settings */}
            <div className="setting-group">
              <label>Size:</label>
              <div className="size-options">
                <label className="radio-option">
                  <input
                    type="radio"
                    name="size"
                    value="original"
                    checked={settings.size === 'original'}
                    onChange={() => handleSizeChange('original')}
                  />
                  Original Size
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    name="size"
                    value="web"
                    checked={settings.size === 'web'}
                    onChange={() => handleSizeChange('web')}
                  />
                  Web Size (1920×1080 max)
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    name="size"
                    value="custom"
                    checked={settings.size === 'custom'}
                    onChange={() => handleSizeChange('custom')}
                  />
                  Custom Size
                </label>
              </div>

              {settings.size === 'custom' && (
                <div className="custom-size-inputs">
                  <input
                    type="number"
                    placeholder="Width"
                    value={settings.customWidth || ''}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      customWidth: parseInt(e.target.value) || undefined
                    }))}
                    min="1"
                    max="10000"
                  />
                  <span>×</span>
                  <input
                    type="number"
                    placeholder="Height"
                    value={settings.customHeight || ''}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      customHeight: parseInt(e.target.value) || undefined
                    }))}
                    min="1"
                    max="10000"
                  />
                  <span>pixels</span>
                </div>
              )}

              <div className="size-info">
                Estimated size: {getEstimatedSize()}
              </div>
            </div>

            {/* Format Settings */}
            <div className="setting-group">
              <label>Format:</label>
              <select
                value={settings.format}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  format: e.target.value as 'jpeg' | 'png' | 'webp'
                }))}
              >
                <option value="jpeg">JPEG</option>
                <option value="png">PNG</option>
                <option value="webp">WebP</option>
              </select>
            </div>

            {/* Quality Settings */}
            <div className="setting-group">
              <label>Quality: {settings.quality}%</label>
              <input
                type="range"
                min="1"
                max="100"
                value={settings.quality}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  quality: parseInt(e.target.value)
                }))}
                className="quality-slider"
              />
              <div className="quality-labels">
                <span>Low</span>
                <span>High</span>
              </div>
            </div>

            {/* Metadata Settings */}
            <div className="setting-group">
              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={settings.preserveMetadata}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    preserveMetadata: e.target.checked
                  }))}
                />
                Preserve metadata (EXIF, tags, etc.)
              </label>
            </div>

            {/* Output Directory */}
            <div className="setting-group">
              <label>Output Directory:</label>
              <div className="directory-selector">
                <input
                  type="text"
                  value={settings.outputDirectory}
                  readOnly
                  placeholder="Select output directory..."
                  className="directory-input"
                />
                <button
                  type="button"
                  onClick={handleSelectDirectory}
                  className="browse-button"
                >
                  Browse...
                </button>
              </div>
            </div>

            {/* Filename Options */}
            <div className="setting-group">
              <label>Filename Options:</label>
              <div className="filename-options">
                <input
                  type="text"
                  placeholder="Prefix (optional)"
                  value={settings.filenamePrefix || ''}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    filenamePrefix: e.target.value
                  }))}
                  className="filename-input"
                />
                <span className="filename-example">filename</span>
                <input
                  type="text"
                  placeholder="Suffix (optional)"
                  value={settings.filenameSuffix || ''}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    filenameSuffix: e.target.value
                  }))}
                  className="filename-input"
                />
                <span className="filename-extension">.{settings.format}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="export-dialog-footer">
          <button className="cancel-button" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="export-button" 
            onClick={handleExport}
            disabled={!settings.outputDirectory}
          >
            Export {imageFiles.length} Image{imageFiles.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportDialog;