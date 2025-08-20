import { useState, useCallback } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { MediaFile, HierarchicalTag } from '@/types/global';

export interface UseFileOperationsReturn {
  // State
  isLoading: boolean;
  error: string | null;
  progress: number;
  
  // Operations
  loadDirectory: (path: string) => Promise<void>;
  refreshDirectory: () => Promise<void>;
  addTagsToFiles: (files: MediaFile[], tags: HierarchicalTag[]) => Promise<void>;
  removeTagsFromFiles: (files: MediaFile[], tags: HierarchicalTag[]) => Promise<void>;
  setFileRating: (file: MediaFile, rating: number) => Promise<void>;
  deleteFiles: (files: MediaFile[]) => Promise<void>;
  moveFiles: (files: MediaFile[], targetPath: string) => Promise<void>;
  copyFiles: (files: MediaFile[], targetPath: string) => Promise<void>;
  
  // Batch Operations
  batchAddTags: (files: MediaFile[], tags: HierarchicalTag[], onProgress?: (current: number, total: number) => void) => Promise<void>;
  batchRemoveTags: (files: MediaFile[], tags: HierarchicalTag[], onProgress?: (current: number, total: number) => void) => Promise<void>;
  batchSetRating: (files: MediaFile[], rating: number, onProgress?: (current: number, total: number) => void) => Promise<void>;
}

export const useFileOperations = (): UseFileOperationsReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  
  const { 
    currentDirectory, 
    setFiles, 
    setFilteredFiles, 
    setLoading: setGlobalLoading,
    setError: setGlobalError 
  } = useAppStore();

  const loadDirectory = useCallback(async (path: string) => {
    setIsLoading(true);
    setGlobalLoading(true);
    setError(null);
    setGlobalError(null);
    
    try {
      console.log(`📁 Loading directory: ${path}`);
      
      // Use Electron API to get directory contents
      const result = await window.electronAPI?.fileSystem?.getDirectoryContents(path);
      
      if (!result) {
        throw new Error('Failed to load directory contents');
      }
      
      const files: MediaFile[] = result.files.map((file: any) => ({
        name: file.name,
        path: file.path,
        size: file.size,
        type: file.type,
        dateModified: new Date(file.dateModified),
        dateCreated: new Date(file.dateCreated),
        tags: file.tags || [],
        rating: file.rating || 0,
        thumbnail: file.thumbnail
      }));
      
      setFiles(files);
      setFilteredFiles(files);
      
      console.log(`✅ Loaded ${files.length} files from ${path}`);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      setGlobalError(errorMessage);
      console.error('❌ Failed to load directory:', err);
    } finally {
      setIsLoading(false);
      setGlobalLoading(false);
    }
  }, [setFiles, setFilteredFiles, setGlobalLoading, setGlobalError]);

  const refreshDirectory = useCallback(async () => {
    if (currentDirectory) {
      await loadDirectory(currentDirectory);
    }
  }, [currentDirectory, loadDirectory]);

  const addTagsToFiles = useCallback(async (files: MediaFile[], tags: HierarchicalTag[]) => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`🏷️ Adding ${tags.length} tags to ${files.length} files`);
      
      for (const file of files) {
        for (const tag of tags) {
          await window.electronAPI?.metadata?.addTag(file.path, tag);
        }
      }
      
      // Refresh to get updated metadata
      await refreshDirectory();
      
      console.log('✅ Tags added successfully');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add tags';
      setError(errorMessage);
      console.error('❌ Failed to add tags:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [refreshDirectory]);

  const removeTagsFromFiles = useCallback(async (files: MediaFile[], tags: HierarchicalTag[]) => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`🗑️ Removing ${tags.length} tags from ${files.length} files`);
      
      for (const file of files) {
        for (const tag of tags) {
          await window.electronAPI?.metadata?.removeTag(file.path, tag);
        }
      }
      
      // Refresh to get updated metadata
      await refreshDirectory();
      
      console.log('✅ Tags removed successfully');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove tags';
      setError(errorMessage);
      console.error('❌ Failed to remove tags:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [refreshDirectory]);

  const setFileRating = useCallback(async (file: MediaFile, rating: number) => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`⭐ Setting rating ${rating} for ${file.name}`);
      
      await window.electronAPI?.metadata?.setRating(file.path, rating);
      
      // Refresh to get updated metadata
      await refreshDirectory();
      
      console.log('✅ Rating set successfully');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set rating';
      setError(errorMessage);
      console.error('❌ Failed to set rating:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [refreshDirectory]);

  const deleteFiles = useCallback(async (files: MediaFile[]) => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`🗑️ Deleting ${files.length} files`);
      
      for (const file of files) {
        await window.electronAPI?.fileSystem?.deleteFile(file.path);
      }
      
      // Refresh directory
      await refreshDirectory();
      
      console.log('✅ Files deleted successfully');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete files';
      setError(errorMessage);
      console.error('❌ Failed to delete files:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [refreshDirectory]);

  const moveFiles = useCallback(async (files: MediaFile[], targetPath: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`📁 Moving ${files.length} files to ${targetPath}`);
      
      for (const file of files) {
        const newPath = `${targetPath}/${file.name}`;
        await window.electronAPI?.fileSystem?.moveFile(file.path, newPath);
      }
      
      // Refresh directory
      await refreshDirectory();
      
      console.log('✅ Files moved successfully');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to move files';
      setError(errorMessage);
      console.error('❌ Failed to move files:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [refreshDirectory]);

  const copyFiles = useCallback(async (files: MediaFile[], targetPath: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`📋 Copying ${files.length} files to ${targetPath}`);
      
      for (const file of files) {
        const newPath = `${targetPath}/${file.name}`;
        await window.electronAPI?.fileSystem?.copyFile(file.path, newPath);
      }
      
      console.log('✅ Files copied successfully');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to copy files';
      setError(errorMessage);
      console.error('❌ Failed to copy files:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Batch Operations with Progress
  const batchAddTags = useCallback(async (
    files: MediaFile[], 
    tags: HierarchicalTag[], 
    onProgress?: (current: number, total: number) => void
  ) => {
    setIsLoading(true);
    setError(null);
    setProgress(0);
    
    try {
      console.log(`🏷️ Batch adding ${tags.length} tags to ${files.length} files`);
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        for (const tag of tags) {
          await window.electronAPI?.metadata?.addTag(file.path, tag);
        }
        
        const currentProgress = ((i + 1) / files.length) * 100;
        setProgress(currentProgress);
        onProgress?.(i + 1, files.length);
      }
      
      // Refresh to get updated metadata
      await refreshDirectory();
      
      console.log('✅ Batch tag addition completed');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add tags';
      setError(errorMessage);
      console.error('❌ Failed to batch add tags:', err);
      throw err;
    } finally {
      setIsLoading(false);
      setProgress(0);
    }
  }, [refreshDirectory]);

  const batchRemoveTags = useCallback(async (
    files: MediaFile[], 
    tags: HierarchicalTag[], 
    onProgress?: (current: number, total: number) => void
  ) => {
    setIsLoading(true);
    setError(null);
    setProgress(0);
    
    try {
      console.log(`🗑️ Batch removing ${tags.length} tags from ${files.length} files`);
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        for (const tag of tags) {
          await window.electronAPI?.metadata?.removeTag(file.path, tag);
        }
        
        const currentProgress = ((i + 1) / files.length) * 100;
        setProgress(currentProgress);
        onProgress?.(i + 1, files.length);
      }
      
      // Refresh to get updated metadata
      await refreshDirectory();
      
      console.log('✅ Batch tag removal completed');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove tags';
      setError(errorMessage);
      console.error('❌ Failed to batch remove tags:', err);
      throw err;
    } finally {
      setIsLoading(false);
      setProgress(0);
    }
  }, [refreshDirectory]);

  const batchSetRating = useCallback(async (
    files: MediaFile[], 
    rating: number, 
    onProgress?: (current: number, total: number) => void
  ) => {
    setIsLoading(true);
    setError(null);
    setProgress(0);
    
    try {
      console.log(`⭐ Batch setting rating ${rating} for ${files.length} files`);
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        await window.electronAPI?.metadata?.setRating(file.path, rating);
        
        const currentProgress = ((i + 1) / files.length) * 100;
        setProgress(currentProgress);
        onProgress?.(i + 1, files.length);
      }
      
      // Refresh to get updated metadata
      await refreshDirectory();
      
      console.log('✅ Batch rating completed');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set ratings';
      setError(errorMessage);
      console.error('❌ Failed to batch set rating:', err);
      throw err;
    } finally {
      setIsLoading(false);
      setProgress(0);
    }
  }, [refreshDirectory]);

  return {
    isLoading,
    error,
    progress,
    loadDirectory,
    refreshDirectory,
    addTagsToFiles,
    removeTagsFromFiles,
    setFileRating,
    deleteFiles,
    moveFiles,
    copyFiles,
    batchAddTags,
    batchRemoveTags,
    batchSetRating
  };
};
