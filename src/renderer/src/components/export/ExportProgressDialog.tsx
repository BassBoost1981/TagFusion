import React from 'react';
import './ExportProgressDialog.css';

export interface ExportProgress {
  current: number;
  total: number;
  currentFile: string;
  completed: boolean;
  error?: string;
}

interface ExportProgressDialogProps {
  isOpen: boolean;
  progress: ExportProgress;
  onCancel?: () => void;
  onClose?: () => void;
}

const ExportProgressDialog: React.FC<ExportProgressDialogProps> = ({
  isOpen,
  progress,
  onCancel,
  onClose
}) => {
  if (!isOpen) return null;

  const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="export-progress-overlay">
      <div className="export-progress-dialog">
        <div className="export-progress-header">
          <h3>
            {progress.completed ? 'Export Complete' : 'Exporting Images...'}
          </h3>
        </div>

        <div className="export-progress-content">
          {progress.error ? (
            <div className="export-error">
              <div className="error-icon">⚠️</div>
              <div className="error-message">
                <strong>Export Error:</strong>
                <p>{progress.error}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="progress-info">
                <div className="progress-text">
                  {progress.completed ? (
                    <span>Successfully exported {progress.current} of {progress.total} images</span>
                  ) : (
                    <span>Processing {progress.current} of {progress.total} images</span>
                  )}
                </div>
                <div className="progress-percentage">
                  {percentage}%
                </div>
              </div>

              <div className="progress-bar-container">
                <div 
                  className="progress-bar"
                  style={{ width: `${percentage}%` }}
                />
              </div>

              {!progress.completed && progress.currentFile && (
                <div className="current-file">
                  <span className="current-file-label">Current file:</span>
                  <span className="current-file-name">{progress.currentFile}</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="export-progress-footer">
          {progress.completed || progress.error ? (
            <button 
              className="close-button"
              onClick={onClose}
            >
              Close
            </button>
          ) : (
            onCancel && (
              <button 
                className="cancel-button"
                onClick={onCancel}
              >
                Cancel
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default ExportProgressDialog;