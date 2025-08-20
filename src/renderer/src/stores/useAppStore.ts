import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { MediaFile, TagHierarchyNode, HierarchicalTag } from '@/types/global';

interface AppState {
  // UI State
  currentDirectory: string | null;
  selectedFiles: MediaFile[];
  isLoading: boolean;
  error: string | null;
  
  // Data State
  files: MediaFile[];
  filteredFiles: MediaFile[];
  tagHierarchy: TagHierarchyNode[];
  favorites: Array<{ name: string; path: string }>;
  
  // Settings
  theme: 'light' | 'dark' | 'system';
  language: 'de' | 'en' | 'fr' | 'es';
  gridSize: number;
  showTags: boolean;
  showRatings: boolean;
  
  // Actions
  setCurrentDirectory: (path: string | null) => void;
  setSelectedFiles: (files: MediaFile[]) => void;
  addSelectedFile: (file: MediaFile) => void;
  removeSelectedFile: (file: MediaFile) => void;
  clearSelection: () => void;
  
  setFiles: (files: MediaFile[]) => void;
  setFilteredFiles: (files: MediaFile[]) => void;
  setTagHierarchy: (hierarchy: TagHierarchyNode[]) => void;
  setFavorites: (favorites: Array<{ name: string; path: string }>) => void;
  
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Settings Actions
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setLanguage: (language: 'de' | 'en' | 'fr' | 'es') => void;
  setGridSize: (size: number) => void;
  setShowTags: (show: boolean) => void;
  setShowRatings: (show: boolean) => void;
  
  // Complex Actions
  filterFilesByTags: (tags: HierarchicalTag[]) => void;
  searchFiles: (query: string) => void;
  addTagToFiles: (files: MediaFile[], tag: HierarchicalTag) => Promise<void>;
  removeTagFromFiles: (files: MediaFile[], tag: HierarchicalTag) => Promise<void>;
}

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial State
        currentDirectory: null,
        selectedFiles: [],
        isLoading: false,
        error: null,
        
        files: [],
        filteredFiles: [],
        tagHierarchy: [],
        favorites: [],
        
        theme: 'system',
        language: 'de',
        gridSize: 150,
        showTags: true,
        showRatings: true,
        
        // Basic Actions
        setCurrentDirectory: (path) => set({ currentDirectory: path }),
        setSelectedFiles: (files) => set({ selectedFiles: files }),
        addSelectedFile: (file) => set((state) => ({
          selectedFiles: [...state.selectedFiles, file]
        })),
        removeSelectedFile: (file) => set((state) => ({
          selectedFiles: state.selectedFiles.filter(f => f.path !== file.path)
        })),
        clearSelection: () => set({ selectedFiles: [] }),
        
        setFiles: (files) => set({ files, filteredFiles: files }),
        setFilteredFiles: (files) => set({ filteredFiles: files }),
        setTagHierarchy: (hierarchy) => set({ tagHierarchy: hierarchy }),
        setFavorites: (favorites) => set({ favorites }),
        
        setLoading: (loading) => set({ isLoading: loading }),
        setError: (error) => set({ error }),
        
        // Settings Actions
        setTheme: (theme) => set({ theme }),
        setLanguage: (language) => set({ language }),
        setGridSize: (size) => set({ gridSize: size }),
        setShowTags: (show) => set({ showTags: show }),
        setShowRatings: (show) => set({ showRatings: show }),
        
        // Complex Actions
        filterFilesByTags: (tags) => {
          const { files } = get();
          const tagPaths = tags.map(tag => tag.fullPath);
          
          const filtered = files.filter(file => 
            file.tags?.some(fileTag => 
              tagPaths.some(tagPath => fileTag.fullPath === tagPath)
            )
          );
          
          set({ filteredFiles: filtered });
        },
        
        searchFiles: (query) => {
          const { files } = get();
          const lowerQuery = query.toLowerCase();
          
          const filtered = files.filter(file => 
            file.name.toLowerCase().includes(lowerQuery) ||
            file.tags?.some(tag => 
              tag.name.toLowerCase().includes(lowerQuery) ||
              tag.fullPath.toLowerCase().includes(lowerQuery)
            )
          );
          
          set({ filteredFiles: filtered });
        },
        
        addTagToFiles: async (files, tag) => {
          set({ isLoading: true, error: null });
          
          try {
            // Use Electron API to add tags
            for (const file of files) {
              await window.electronAPI?.metadata?.addTag(file.path, tag);
            }
            
            // Update local state
            const { files: allFiles } = get();
            const updatedFiles = allFiles.map(file => {
              if (files.some(f => f.path === file.path)) {
                return {
                  ...file,
                  tags: [...(file.tags || []), tag]
                };
              }
              return file;
            });
            
            set({ files: updatedFiles, filteredFiles: updatedFiles });
          } catch (error) {
            set({ error: `Failed to add tag: ${error}` });
          } finally {
            set({ isLoading: false });
          }
        },
        
        removeTagFromFiles: async (files, tag) => {
          set({ isLoading: true, error: null });
          
          try {
            // Use Electron API to remove tags
            for (const file of files) {
              await window.electronAPI?.metadata?.removeTag(file.path, tag);
            }
            
            // Update local state
            const { files: allFiles } = get();
            const updatedFiles = allFiles.map(file => {
              if (files.some(f => f.path === file.path)) {
                return {
                  ...file,
                  tags: file.tags?.filter(t => t.fullPath !== tag.fullPath) || []
                };
              }
              return file;
            });
            
            set({ files: updatedFiles, filteredFiles: updatedFiles });
          } catch (error) {
            set({ error: `Failed to remove tag: ${error}` });
          } finally {
            set({ isLoading: false });
          }
        }
      }),
      {
        name: 'tagfusion-app-store',
        partialize: (state) => ({
          theme: state.theme,
          language: state.language,
          gridSize: state.gridSize,
          showTags: state.showTags,
          showRatings: state.showRatings,
          favorites: state.favorites
        })
      }
    ),
    { name: 'TagFusion App Store' }
  )
);
