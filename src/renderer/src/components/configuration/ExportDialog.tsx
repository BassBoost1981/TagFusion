import React, { useState } from 'react';
import { configurationApi } from '../../api/configurationApi';
import './ExportDialog.css';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (filePath: string) => void;
  onError: (error: string) => void;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onError
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    includeFavorites: true,
    includeTagHierarchy: true,
    includeSettings: true
  });

  const handleExport = async () => {
    if (isExporting) return;

    try {
      setIsExporting(true);

      // Show save dialog
      const result = await configurationApi.showSaveDialog();
      
      if (result.canceled || !result.filePath) {
        setIsExporting(false);
        return;
      }

      // Export configuration to file
      await configurationApi.exportToFile(result.filePath);
      
      onSuccess(result.filePath);
      onClose();
    } catch (error) {
      console.error('Export failed:', error);
      onError(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCancel = () => {
    if (!isExporting) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="export-dialog-overlay">
      <div className="export-dialog">
        <div className="export-dialog-header">
          <h2>Export Configuration</h2>
          <button 
            className="export-dialog-close"
            onClick={handleCancel}
            disabled={isExporting}
          >
            ×
          </button>
        </div>

        <div className="export-dialog-content">
          <p className="export-dialog-description">
            Export your TagFusion configuration including favorites, tag hierarchy, and settings.
            This allows you to backup your configuration or transfer it to another installation.
          </p>

          <div className="export-options">
            <h3>Export Options</h3>
            
            <label className="export-option">
              <input
                type="checkbox"
                checked={exportOptions.includeFavorites}
                onChange={(e) => setExportOptions(prev => ({
                  ...prev,
                  includeFavorites: e.target.checked
                }))}
                disabled={isExporting}
              />
              <span>Include Favorites</span>
              <small>Export your saved favorite folders</small>
            </label>

            <label className="export-option">
              <input
                type="checkbox"
                checked={exportOptions.includeTagHierarchy}
                onChange={(e) => setExportOptions(prev => ({
                  ...prev,
                  includeTagHierarchy: e.target.checked
                }))}
                disabled={isExporting}
              />
              <span>Include Tag Hierarchy</span>
              <small>Export your custom tag categories and structure</small>
            </label>

            <label className="export-option">
              <input
                type="checkbox"
                checked={exportOptions.includeSettings}
                onChange={(e) => setExportOptions(prev => ({
                  ...prev,
                  includeSettings: e.target.checked
                }))}
                disabled={isExporting}
              />
              <span>Include Application Settings</span>
              <small>Export theme, language, and other preferences</small>
            </label>
          </div>

          <div className="export-info">
            <div className="export-info-item">
              <strong>Export Format:</strong> JSON
            </div>
            <div className="export-info-item">
              <strong>File Size:</strong> Typically less than 1MB
            </div>
            <div className="export-info-item">
              <strong>Compatibility:</strong> TagFusion v1.0.0+
            </div>
          </div>
        </div>

        <div className="export-dialog-actions">
          <button
            className="export-dialog-button export-dialog-button-secondary"
            onClick={handleCancel}
            disabled={isExporting}
          >
            Cancel
          </button>
          <button
            className="export-dialog-button export-dialog-button-primary"
            onClick={handleExport}
            disabled={isExporting || (!exportOptions.includeFavorites && !exportOptions.includeTagHierarchy && !exportOptions.includeSettings)}
          >
            {isExporting ? (
              <>
                <span className="export-dialog-spinner"></span>
                Exporting...
              </>
            ) : (
              'Export Configuration'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};