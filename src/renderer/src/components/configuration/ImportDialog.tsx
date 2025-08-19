import React, { useState } from 'react';
import { configurationApi } from '../../api/configurationApi';
import { ImportOptions, ImportResult, ImportConflict } from '../../../main/repositories/ConfigurationRepository';
import './ImportDialog.css';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: ImportResult) => void;
  onError: (error: string) => void;
}

interface FileValidation {
  valid: boolean;
  version?: string;
  error?: string;
}

export const ImportDialog: React.FC<ImportDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onError
}) => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileValidation, setFileValidation] = useState<FileValidation | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importOptions, setImportOptions] = useState<ImportOptions>({
    mergeMode: 'merge',
    importFavorites: true,
    importTagHierarchy: true,
    importSettings: true
  });
  const [showConflicts, setShowConflicts] = useState(false);
  const [conflicts, setConflicts] = useState<ImportConflict[]>([]);

  const handleSelectFile = async () => {
    try {
      const result = await configurationApi.showOpenDialog();
      
      if (result.canceled || result.filePaths.length === 0) {
        return;
      }

      const filePath = result.filePaths[0];
      setSelectedFile(filePath);

      // Validate the selected file
      const validation = await configurationApi.validateImportFile(filePath);
      setFileValidation(validation);
    } catch (error) {
      console.error('Failed to select file:', error);
      onError(error instanceof Error ? error.message : 'Failed to select file');
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !fileValidation?.valid || isImporting) return;

    try {
      setIsImporting(true);

      const result = await configurationApi.importFromFile(selectedFile, importOptions);
      
      if (result.success) {
        if (result.conflicts.length > 0) {
          setConflicts(result.conflicts);
          setShowConflicts(true);
        }
        onSuccess(result);
        if (result.conflicts.length === 0) {
          onClose();
        }
      } else {
        onError('Import failed. Please check the file and try again.');
      }
    } catch (error) {
      console.error('Import failed:', error);
      onError(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const handleCancel = () => {
    if (!isImporting) {
      setSelectedFile(null);
      setFileValidation(null);
      setConflicts([]);
      setShowConflicts(false);
      onClose();
    }
  };

  const handleConflictsClose = () => {
    setShowConflicts(false);
    onClose();
  };

  if (!isOpen) return null;

  if (showConflicts) {
    return (
      <div className="import-dialog-overlay">
        <div className="import-dialog import-conflicts-dialog">
          <div className="import-dialog-header">
            <h2>Import Conflicts Resolved</h2>
            <button 
              className="import-dialog-close"
              onClick={handleConflictsClose}
            >
              ×
            </button>
          </div>

          <div className="import-dialog-content">
            <p className="import-conflicts-description">
              The import was successful, but some conflicts were encountered and resolved:
            </p>

            <div className="import-conflicts-list">
              {conflicts.map((conflict, index) => (
                <div key={index} className="import-conflict-item">
                  <div className="import-conflict-type">
                    {conflict.type === 'favorite' && '📁'}
                    {conflict.type === 'tag' && '🏷️'}
                    {conflict.type === 'setting' && '⚙️'}
                    <span>{conflict.type}</span>
                  </div>
                  <div className="import-conflict-details">
                    <strong>{conflict.item}</strong>
                    <div className="import-conflict-resolution">
                      Resolution: {conflict.resolution === 'keep' ? 'Kept existing' : 'Replaced with imported'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="import-dialog-actions">
            <button
              className="import-dialog-button import-dialog-button-primary"
              onClick={handleConflictsClose}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="import-dialog-overlay">
      <div className="import-dialog">
        <div className="import-dialog-header">
          <h2>Import Configuration</h2>
          <button 
            className="import-dialog-close"
            onClick={handleCancel}
            disabled={isImporting}
          >
            ×
          </button>
        </div>

        <div className="import-dialog-content">
          <p className="import-dialog-description">
            Import a previously exported TagFusion configuration to restore your favorites, 
            tag hierarchy, and settings.
          </p>

          <div className="import-file-section">
            <h3>Select Configuration File</h3>
            
            <div className="import-file-selector">
              <button
                className="import-file-button"
                onClick={handleSelectFile}
                disabled={isImporting}
              >
                {selectedFile ? 'Change File' : 'Select File'}
              </button>
              
              {selectedFile && (
                <div className="import-file-info">
                  <div className="import-file-path">
                    {selectedFile.split(/[/\\]/).pop()}
                  </div>
                  
                  {fileValidation && (
                    <div className={`import-file-validation ${fileValidation.valid ? 'valid' : 'invalid'}`}>
                      {fileValidation.valid ? (
                        <>
                          ✓ Valid configuration file (v{fileValidation.version})
                        </>
                      ) : (
                        <>
                          ✗ {fileValidation.error}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {selectedFile && fileValidation?.valid && (
            <>
              <div className="import-options">
                <h3>Import Options</h3>
                
                <div className="import-merge-mode">
                  <label>
                    <input
                      type="radio"
                      name="mergeMode"
                      value="merge"
                      checked={importOptions.mergeMode === 'merge'}
                      onChange={(e) => setImportOptions(prev => ({
                        ...prev,
                        mergeMode: e.target.value as 'merge' | 'overwrite'
                      }))}
                      disabled={isImporting}
                    />
                    <span>Merge with existing</span>
                    <small>Keep existing items, add new ones</small>
                  </label>
                  
                  <label>
                    <input
                      type="radio"
                      name="mergeMode"
                      value="overwrite"
                      checked={importOptions.mergeMode === 'overwrite'}
                      onChange={(e) => setImportOptions(prev => ({
                        ...prev,
                        mergeMode: e.target.value as 'merge' | 'overwrite'
                      }))}
                      disabled={isImporting}
                    />
                    <span>Overwrite existing</span>
                    <small>Replace existing items with imported ones</small>
                  </label>
                </div>

                <div className="import-content-options">
                  <label className="import-option">
                    <input
                      type="checkbox"
                      checked={importOptions.importFavorites}
                      onChange={(e) => setImportOptions(prev => ({
                        ...prev,
                        importFavorites: e.target.checked
                      }))}
                      disabled={isImporting}
                    />
                    <span>Import Favorites</span>
                    <small>Import saved favorite folders</small>
                  </label>

                  <label className="import-option">
                    <input
                      type="checkbox"
                      checked={importOptions.importTagHierarchy}
                      onChange={(e) => setImportOptions(prev => ({
                        ...prev,
                        importTagHierarchy: e.target.checked
                      }))}
                      disabled={isImporting}
                    />
                    <span>Import Tag Hierarchy</span>
                    <small>Import custom tag categories and structure</small>
                  </label>

                  <label className="import-option">
                    <input
                      type="checkbox"
                      checked={importOptions.importSettings}
                      onChange={(e) => setImportOptions(prev => ({
                        ...prev,
                        importSettings: e.target.checked
                      }))}
                      disabled={isImporting}
                    />
                    <span>Import Application Settings</span>
                    <small>Import theme, language, and other preferences</small>
                  </label>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="import-dialog-actions">
          <button
            className="import-dialog-button import-dialog-button-secondary"
            onClick={handleCancel}
            disabled={isImporting}
          >
            Cancel
          </button>
          <button
            className="import-dialog-button import-dialog-button-primary"
            onClick={handleImport}
            disabled={
              isImporting || 
              !selectedFile || 
              !fileValidation?.valid ||
              (!importOptions.importFavorites && !importOptions.importTagHierarchy && !importOptions.importSettings)
            }
          >
            {isImporting ? (
              <>
                <span className="import-dialog-spinner"></span>
                Importing...
              </>
            ) : (
              'Import Configuration'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};