import { useState, useCallback } from 'react';
import { MediaFile } from '../../../types/global';

interface UseRatingReturn {
  isLoading: boolean;
  error: string | null;
  setRating: (files: MediaFile[], rating: number) => Promise<void>;
  getRating: (filePath: string) => Promise<number>;
  setBatchRating: (files: MediaFile[], rating: number) => Promise<BatchRatingResult>;
  getAverageRating: (files: MediaFile[]) => Promise<number>;
}

interface BatchRatingResult {
  successful: string[];
  failed: { filePath: string; error: string }[];
  totalProcessed: number;
}

export const useRating = (): UseRatingReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setRating = useCallback(async (files: MediaFile[], rating: number): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      if (files.length === 1) {
        // Single file rating
        await window.electronAPI.rating.setRating(files[0].path, rating);
      } else if (files.length > 1) {
        // Batch rating
        const filePaths = files.map(file => file.path);
        const result = await window.electronAPI.rating.setBatchRating(filePaths, rating);
        
        if (result.failed.length > 0) {
          const failedCount = result.failed.length;
          const totalCount = result.totalProcessed;
          setError(`Failed to rate ${failedCount} out of ${totalCount} files`);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set rating';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getRating = useCallback(async (filePath: string): Promise<number> => {
    setError(null);

    try {
      console.log('Getting rating for:', filePath);
      console.log('electronAPI:', window.electronAPI);
      console.log('electronAPI.rating:', window.electronAPI?.rating);
      
      if (!window.electronAPI?.rating?.getRating) {
        console.error('getRating method not available');
        return 0;
      }
      
      return await window.electronAPI.rating.getRating(filePath);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get rating';
      setError(errorMessage);
      console.error('getRating error:', err);
      return 0;
    }
  }, []);

  const setBatchRating = useCallback(async (files: MediaFile[], rating: number): Promise<BatchRatingResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const filePaths = files.map(file => file.path);
      const result = await window.electronAPI.rating.setBatchRating(filePaths, rating);
      
      if (result.failed.length > 0) {
        const failedCount = result.failed.length;
        const totalCount = result.totalProcessed;
        setError(`Failed to rate ${failedCount} out of ${totalCount} files`);
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set batch rating';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getAverageRating = useCallback(async (files: MediaFile[]): Promise<number> => {
    setError(null);

    try {
      const filePaths = files.map(file => file.path);
      return await window.electronAPI.rating.getAverageRating(filePaths);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get average rating';
      setError(errorMessage);
      return 0;
    }
  }, []);

  return {
    isLoading,
    error,
    setRating,
    getRating,
    setBatchRating,
    getAverageRating,
  };
};