import { useState, useCallback } from 'react';
import { MediaFile } from '../../../types/global';
import { ExportAPI, ExportSettings, ExportProgress, ExportResult, BatchExportResult } from '../api/exportApi';

interface UseExportReturn {
  isExporting: boolean;
  progress: ExportProgress | null;
  showExportDialog: boolean;
  showProgressDialog: boolean;
  exportResult: BatchExportResult | null;
  openExportDialog: (files: MediaFile[]) => void;
  closeExportDialog: () => void;
  startExport: (files: MediaFile[], settings: ExportSettings) => Promise<void>;
  cancelExport: () => Promise<void>;
  closeProgressDialog: () => void;
  selectOutputDirectory: () => Promise<string | null>;
}

export const useExport = (): UseExportReturn => {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [exportResult, setExportResult] = useState<BatchExportResult | null>(null);

  const openExportDialog = useCallback((files: MediaFile[]) => {
    if (files.length === 0) {
      return;
    }
    setShowExportDialog(true);
  }, []);

  const closeExportDialog = useCallback(() => {
    setShowExportDialog(false);
  }, []);

  const startExport = useCallback(async (files: MediaFile[], settings: ExportSettings) => {
    try {
      setIsExporting(true);
      setProgress(null);
      setExportResult(null);
      setShowExportDialog(false);
      setShowProgressDialog(true);

      const result = await ExportAPI.exportMultipleFiles(
        files,
        settings,
        (progressUpdate: ExportProgress) => {
          setProgress(progressUpdate);
        }
      );

      setExportResult(result);
      setIsExporting(false);

      // Keep progress dialog open to show results
      if (result.success) {
        setProgress({
          current: result.successfulFiles,
          total: result.totalFiles,
          currentFile: '',
          completed: true
        });
      } else {
        setProgress({
          current: 0,
          total: result.totalFiles,
          currentFile: '',
          completed: true,
          error: result.errors.length > 0 ? result.errors[0] : 'Export failed'
        });
      }

    } catch (error) {
      console.error('Export error:', error);
      setIsExporting(false);
      setProgress({
        current: 0,
        total: files.length,
        currentFile: '',
        completed: true,
        error: error instanceof Error ? error.message : 'Unknown export error'
      });
    }
  }, []);

  const cancelExport = useCallback(async () => {
    try {
      const cancelled = await ExportAPI.cancelExport();
      if (cancelled) {
        setIsExporting(false);
        setProgress({
          current: 0,
          total: 0,
          currentFile: '',
          completed: true,
          error: 'Export cancelled by user'
        });
      }
    } catch (error) {
      console.error('Cancel export error:', error);
    }
  }, []);

  const closeProgressDialog = useCallback(() => {
    setShowProgressDialog(false);
    setProgress(null);
    setExportResult(null);
  }, []);

  const selectOutputDirectory = useCallback(async (): Promise<string | null> => {
    try {
      return await ExportAPI.selectOutputDirectory();
    } catch (error) {
      console.error('Select directory error:', error);
      return null;
    }
  }, []);

  return {
    isExporting,
    progress,
    showExportDialog,
    showProgressDialog,
    exportResult,
    openExportDialog,
    closeExportDialog,
    startExport,
    cancelExport,
    closeProgressDialog,
    selectOutputDirectory
  };
};