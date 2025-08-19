import { promises as fs } from 'fs';
import path from 'path';
import { app } from 'electron';
import { FavoriteFolder, AppSettings, TagHierarchyNode } from '../../types/global';
import { PortableDataService } from '../services/PortableDataService';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ConfigurationExport {
  version: string;
  exportDate: Date;
  settings: AppSettings;
  tagDefinitions: TagHierarchyNode[];
}

export interface ImportOptions {
  mergeMode: 'merge' | 'overwrite';
  importFavorites: boolean;
  importTagHierarchy: boolean;
  importSettings: boolean;
}

export interface ImportResult {
  success: boolean;
  conflicts: ImportConflict[];
  imported: {
    favorites: number;
    tagNodes: number;
    settingsUpdated: boolean;
  };
}

export interface ImportConflict {
  type: 'favorite' | 'tag' | 'setting';
  item: string;
  existingValue: any;
  newValue: any;
  resolution: 'keep' | 'replace' | 'merge';
}

export interface IConfigurationRepository {
  loadSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<void>;
  getFavorites(): Promise<FavoriteFolder[]>;
  addFavorite(favorite: Omit<FavoriteFolder, 'id' | 'dateAdded' | 'order'>): Promise<FavoriteFolder>;
  removeFavorite(id: string): Promise<void>;
  updateFavorite(id: string, updates: Partial<FavoriteFolder>): Promise<void>;
  reorderFavorites(favoriteIds: string[]): Promise<void>;
  
  // Import/Export functionality
  exportConfiguration(): Promise<ConfigurationExport>;
  exportToFile(filePath: string): Promise<void>;
  importConfiguration(config: ConfigurationExport, options: ImportOptions): Promise<ImportResult>;
  importFromFile(filePath: string, options: ImportOptions): Promise<ImportResult>;
  validateImportFile(filePath: string): Promise<{ valid: boolean; version?: string; error?: string }>;
}

export class ConfigurationRepository implements IConfigurationRepository {
  private portableDataService: PortableDataService;
  private settings: AppSettings | null = null;

  constructor(portableDataService?: PortableDataService) {
    this.portableDataService = portableDataService || new PortableDataService();
  }

  private async ensureConfigExists(): Promise<void> {
    const configPath = this.portableDataService.getConfigPath('config.json');
    try {
      await fs.access(configPath);
    } catch {
      // Create default config if it doesn't exist
      const defaultSettings: AppSettings = {
        language: 'en',
        theme: 'system' as ThemeMode,
        favorites: [],
        tagHierarchy: [],
        thumbnailSize: 150,
        viewMode: 'grid'
      };
      await this.saveSettings(defaultSettings);
    }
  }

  async loadSettings(): Promise<AppSettings> {
    if (this.settings) {
      return this.settings;
    }

    await this.ensureConfigExists();
    
    try {
      const configPath = this.portableDataService.getConfigPath('config.json');
      const data = await fs.readFile(configPath, 'utf-8');
      this.settings = JSON.parse(data);
      
      // Convert date strings back to Date objects
      if (this.settings?.favorites) {
        this.settings.favorites = this.settings.favorites.map(fav => ({
          ...fav,
          dateAdded: new Date(fav.dateAdded)
        }));
      }
      
      return this.settings!;
    } catch (error) {
      console.error('Failed to load settings:', error);
      throw new Error('Failed to load application settings');
    }
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    try {
      const configPath = this.portableDataService.getConfigPath('config.json');
      await fs.writeFile(configPath, JSON.stringify(settings, null, 2), 'utf-8');
      this.settings = settings;
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw new Error('Failed to save application settings');
    }
  }

  async getFavorites(): Promise<FavoriteFolder[]> {
    const settings = await this.loadSettings();
    return settings.favorites.sort((a, b) => a.order - b.order);
  }

  async addFavorite(favorite: Omit<FavoriteFolder, 'id' | 'dateAdded' | 'order'>): Promise<FavoriteFolder> {
    const settings = await this.loadSettings();
    
    // Check if path already exists
    const existingFavorite = settings.favorites.find(f => f.path === favorite.path);
    if (existingFavorite) {
      throw new Error('Folder is already in favorites');
    }

    const newFavorite: FavoriteFolder = {
      ...favorite,
      id: this.generateId(),
      dateAdded: new Date(),
      order: settings.favorites.length
    };

    settings.favorites.push(newFavorite);
    await this.saveSettings(settings);
    
    return newFavorite;
  }

  async removeFavorite(id: string): Promise<void> {
    const settings = await this.loadSettings();
    const index = settings.favorites.findIndex(f => f.id === id);
    
    if (index === -1) {
      throw new Error('Favorite not found');
    }

    settings.favorites.splice(index, 1);
    
    // Reorder remaining favorites
    settings.favorites.forEach((fav, idx) => {
      fav.order = idx;
    });

    await this.saveSettings(settings);
  }

  async updateFavorite(id: string, updates: Partial<FavoriteFolder>): Promise<void> {
    const settings = await this.loadSettings();
    const favorite = settings.favorites.find(f => f.id === id);
    
    if (!favorite) {
      throw new Error('Favorite not found');
    }

    Object.assign(favorite, updates);
    await this.saveSettings(settings);
  }

  async reorderFavorites(favoriteIds: string[]): Promise<void> {
    const settings = await this.loadSettings();
    
    // Create a map for quick lookup
    const favoriteMap = new Map(settings.favorites.map(f => [f.id, f]));
    
    // Reorder based on the provided array
    const reorderedFavorites: FavoriteFolder[] = [];
    favoriteIds.forEach((id, index) => {
      const favorite = favoriteMap.get(id);
      if (favorite) {
        favorite.order = index;
        reorderedFavorites.push(favorite);
      }
    });

    settings.favorites = reorderedFavorites;
    await this.saveSettings(settings);
  }

  async exportConfiguration(): Promise<ConfigurationExport> {
    const settings = await this.loadSettings();
    
    return {
      version: '1.0.0',
      exportDate: new Date(),
      settings: {
        ...settings,
        // Don't export favorites and tagHierarchy in settings as they're exported separately
        favorites: [],
        tagHierarchy: []
      },
      tagDefinitions: settings.tagHierarchy
    };
  }

  async exportToFile(filePath: string): Promise<void> {
    try {
      const config = await this.exportConfiguration();
      const settings = await this.loadSettings();
      
      // Include favorites in the export
      const exportData = {
        ...config,
        favorites: settings.favorites
      };
      
      await fs.writeFile(filePath, JSON.stringify(exportData, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to export configuration:', error);
      throw new Error('Failed to export configuration to file');
    }
  }

  async importConfiguration(config: ConfigurationExport, options: ImportOptions): Promise<ImportResult> {
    const currentSettings = await this.loadSettings();
    const conflicts: ImportConflict[] = [];
    let imported = {
      favorites: 0,
      tagNodes: 0,
      settingsUpdated: false
    };

    try {
      // Handle favorites import
      if (options.importFavorites && (config as any).favorites) {
        const importedFavorites = (config as any).favorites as FavoriteFolder[];
        
        for (const importedFav of importedFavorites) {
          const existingFav = currentSettings.favorites.find(f => f.path === importedFav.path);
          
          if (existingFav) {
            conflicts.push({
              type: 'favorite',
              item: importedFav.path,
              existingValue: existingFav.name,
              newValue: importedFav.name,
              resolution: options.mergeMode === 'overwrite' ? 'replace' : 'keep'
            });
            
            if (options.mergeMode === 'overwrite') {
              await this.updateFavorite(existingFav.id, {
                name: importedFav.name
              });
            }
          } else {
            await this.addFavorite({
              name: importedFav.name,
              path: importedFav.path
            });
            imported.favorites++;
          }
        }
      }

      // Handle tag hierarchy import
      if (options.importTagHierarchy && config.tagDefinitions) {
        const mergedTagHierarchy = this.mergeTagHierarchy(
          currentSettings.tagHierarchy,
          config.tagDefinitions,
          options.mergeMode,
          conflicts
        );
        
        currentSettings.tagHierarchy = mergedTagHierarchy;
        imported.tagNodes = config.tagDefinitions.length;
      }

      // Handle settings import
      if (options.importSettings) {
        const settingsToImport = { ...config.settings };
        delete (settingsToImport as any).favorites;
        delete (settingsToImport as any).tagHierarchy;
        
        Object.assign(currentSettings, settingsToImport);
        imported.settingsUpdated = true;
      }

      await this.saveSettings(currentSettings);

      return {
        success: true,
        conflicts,
        imported
      };
    } catch (error) {
      console.error('Failed to import configuration:', error);
      return {
        success: false,
        conflicts,
        imported
      };
    }
  }

  async importFromFile(filePath: string, options: ImportOptions): Promise<ImportResult> {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const config = JSON.parse(data);
      
      // Convert date strings back to Date objects
      if (config.exportDate) {
        config.exportDate = new Date(config.exportDate);
      }
      
      if (config.favorites) {
        config.favorites = config.favorites.map((fav: any) => ({
          ...fav,
          dateAdded: new Date(fav.dateAdded)
        }));
      }
      
      return await this.importConfiguration(config, options);
    } catch (error) {
      console.error('Failed to import configuration from file:', error);
      throw new Error('Failed to import configuration from file');
    }
  }

  async validateImportFile(filePath: string): Promise<{ valid: boolean; version?: string; error?: string }> {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const config = JSON.parse(data);
      
      // Check required fields
      if (!config.version) {
        return { valid: false, error: 'Missing version information' };
      }
      
      if (!config.exportDate) {
        return { valid: false, error: 'Missing export date' };
      }
      
      if (!config.settings && !config.tagDefinitions && !config.favorites) {
        return { valid: false, error: 'No importable data found' };
      }
      
      return { valid: true, version: config.version };
    } catch (error) {
      return { valid: false, error: 'Invalid JSON format or file not readable' };
    }
  }

  private mergeTagHierarchy(
    current: TagHierarchyNode[],
    imported: TagHierarchyNode[],
    mergeMode: 'merge' | 'overwrite',
    conflicts: ImportConflict[]
  ): TagHierarchyNode[] {
    if (mergeMode === 'overwrite') {
      return imported;
    }

    // Create a map of existing tags by name for quick lookup
    const currentMap = new Map<string, TagHierarchyNode>();
    const addToMap = (nodes: TagHierarchyNode[]) => {
      nodes.forEach(node => {
        currentMap.set(node.name, node);
        if (node.children) {
          addToMap(node.children);
        }
      });
    };
    addToMap(current);

    // Merge imported tags
    const merged = [...current];
    
    const mergeNodes = (importedNodes: TagHierarchyNode[], parentArray: TagHierarchyNode[]) => {
      importedNodes.forEach(importedNode => {
        const existing = currentMap.get(importedNode.name);
        
        if (existing) {
          conflicts.push({
            type: 'tag',
            item: importedNode.name,
            existingValue: existing,
            newValue: importedNode,
            resolution: 'keep'
          });
          
          // Merge children if they exist
          if (importedNode.children && importedNode.children.length > 0) {
            mergeNodes(importedNode.children, existing.children);
          }
        } else {
          // Add new tag with new ID to avoid conflicts
          const newNode = {
            ...importedNode,
            id: this.generateId()
          };
          parentArray.push(newNode);
          currentMap.set(newNode.name, newNode);
        }
      });
    };

    mergeNodes(imported, merged);
    return merged;
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}