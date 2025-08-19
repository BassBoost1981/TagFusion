import React from 'react';
import { ExportDialog } from '../configuration/ExportDialog';
import { ImportDialog } from '../configuration/ImportDialog';
import { useConfigurationImportExport } from '../../hooks/useConfigurationImportExport';
import './ConfigurationSettings.css';

export const ConfigurationSettings: React.FC = () => {
  const {
    isExportDialogOpen,
    openExportDialog,
    closeExportDialog,
    isImportDialogOpen,
    openImportDialog,
    closeImportDialog,
    error,
    successMessage,
    clearMessages,
    handleExportSuccess,
    handleImportSuccess,
    handleError
  } = useConfigurationImportExport();

  return (
    <div className="configuration-settings">
      <div className="configuration-settings-header">
        <h2>Configuration Management</h2>
        <p>Backup and restore your TagFusion configuration including favorites, tags, and settings.</p>
      </div>

      {(error || successMessage) && (
        <div className="configuration-messages">
          {error && (
            <div className="configuration-message configuration-message-error">
              <span className="configuration-message-icon">⚠️</span>
              <span className="configuration-message-text">{error}</span>
              <button 
                className="configuration-message-close"
                onClick={clearMessages}
              >
                ×
              </button>
            </div>
          )}
          
          {successMessage && (
            <div className="configuration-message configuration-message-success">
              <span className="configuration-message-icon">✅</span>
              <span className="configuration-message-text">{successMessage}</span>
              <button 
                className="configuration-message-close"
                onClick={clearMessages}
              >
                ×
              </button>
            </div>
          )}
        </div>
      )}

      <div className="configuration-actions">
        <div className="configuration-action-group">
          <div className="configuration-action">
            <div className="configuration-action-info">
              <h3>Export Configuration</h3>
              <p>
                Create a backup of your current configuration including favorites, 
                tag hierarchy, and application settings. This file can be used to 
                restore your configuration or transfer it to another installation.
              </p>
            </div>
            <button
              className="configuration-action-button configuration-action-button-primary"
              onClick={openExportDialog}
            >
              Export Configuration
            </button>
          </div>

          <div className="configuration-action">
            <div className="configuration-action-info">
              <h3>Import Configuration</h3>
              <p>
                Restore a previously exported configuration or import settings 
                from another TagFusion installation. You can choose which parts 
                to import and how to handle conflicts.
              </p>
            </div>
            <button
              className="configuration-action-button configuration-action-button-secondary"
              onClick={openImportDialog}
            >
              Import Configuration
            </button>
          </div>
        </div>

        <div className="configuration-info">
          <h3>Configuration Details</h3>
          <div className="configuration-info-grid">
            <div className="configuration-info-item">
              <strong>Favorites:</strong>
              <span>Saved folder shortcuts</span>
            </div>
            <div className="configuration-info-item">
              <strong>Tag Hierarchy:</strong>
              <span>Custom tag categories and structure</span>
            </div>
            <div className="configuration-info-item">
              <strong>Settings:</strong>
              <span>Theme, language, and preferences</span>
            </div>
            <div className="configuration-info-item">
              <strong>File Format:</strong>
              <span>JSON (human-readable)</span>
            </div>
          </div>
        </div>
      </div>

      <ExportDialog
        isOpen={isExportDialogOpen}
        onClose={closeExportDialog}
        onSuccess={handleExportSuccess}
        onError={handleError}
      />

      <ImportDialog
        isOpen={isImportDialogOpen}
        onClose={closeImportDialog}
        onSuccess={handleImportSuccess}
        onError={handleError}
      />
    </div>
  );
};