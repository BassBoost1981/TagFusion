import { useState, useCallback } from 'react';
import { configurationApi } from '../api/configurationApi';
import { ImportResult } from '../../main/repositories/ConfigurationRepository';

interface UseConfigurationImportExportReturn {
  // Export state
  isExportDialogOpen: boolean;
  openExportDialog: () => void;
  closeExportDialog: () => void;
  
  // Import state
  isImportDialogOpen: boolean;
  openImportDialog: () => void;
  closeImportDialog: () => void;
  
  // Status
  isLoading: boolean;
  error: string | null;
  successMessage: string | null;
  
  // Actions
  clearMessages: () => void;
  handleExportSuccess: (filePath: string) => void;
  handleImportSuccess: (result: ImportResult) => void;
  handleError: (error: string) => void;
}

export const useConfigurationImportExport = (): UseConfigurationImportExportReturn => {
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const openExportDialog = useCallback(() => {
    setIsExportDialogOpen(true);
    setError(null);
    setSuccessMessage(null);
  }, []);

  const closeExportDialog = useCallback(() => {
    setIsExportDialogOpen(false);
  }, []);

  const openImportDialog = useCallback(() => {
    setIsImportDialogOpen(true);
    setError(null);
    setSuccessMessage(null);
  }, []);

  const closeImportDialog = useCallback(() => {
    setIsImportDialogOpen(false);
  }, []);

  const clearMessages = useCallback(() => {
    setError(null);
    setSuccessMessage(null);
  }, []);

  const handleExportSuccess = useCallback((filePath: string) => {
    const fileName = filePath.split(/[/\\]/).pop() || 'configuration file';
    setSuccessMessage(`Configuration exported successfully to ${fileName}`);
    setError(null);
  }, []);

  const handleImportSuccess = useCallback((result: ImportResult) => {
    const { imported, conflicts } = result;
    let message = 'Configuration imported successfully!';
    
    const importedItems = [];
    if (imported.favorites > 0) {
      importedItems.push(`${imported.favorites} favorite${imported.favorites > 1 ? 's' : ''}`);
    }
    if (imported.tagNodes > 0) {
      importedItems.push(`${imported.tagNodes} tag${imported.tagNodes > 1 ? 's' : ''}`);
    }
    if (imported.settingsUpdated) {
      importedItems.push('application settings');
    }
    
    if (importedItems.length > 0) {
      message += ` Imported: ${importedItems.join(', ')}.`;
    }
    
    if (conflicts.length > 0) {
      message += ` ${conflicts.length} conflict${conflicts.length > 1 ? 's were' : ' was'} resolved.`;
    }
    
    setSuccessMessage(message);
    setError(null);
  }, []);

  const handleError = useCallback((error: string) => {
    setError(error);
    setSuccessMessage(null);
  }, []);

  return {
    isExportDialogOpen,
    openExportDialog,
    closeExportDialog,
    isImportDialogOpen,
    openImportDialog,
    closeImportDialog,
    isLoading,
    error,
    successMessage,
    clearMessages,
    handleExportSuccess,
    handleImportSuccess,
    handleError
  };
};