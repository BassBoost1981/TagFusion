import { IConfigurationService } from './DIContainer';

export class ConfigurationService implements IConfigurationService {
  async loadSettings(): Promise<any> {
    try {
      // Use Electron IPC to load settings from main process
      const settings = await window.electronAPI?.configuration?.loadSettings();
      return settings || this.getDefaultSettings();
    } catch (error) {
      console.error('Failed to load settings:', error);
      return this.getDefaultSettings();
    }
  }

  async saveSettings(settings: any): Promise<void> {
    try {
      // Use Electron IPC to save settings via main process
      await window.electronAPI?.configuration?.saveSettings(settings);
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  }

  async exportConfiguration(): Promise<string> {
    try {
      const result = await window.electronAPI?.configuration?.exportConfiguration();
      return result?.filePath || '';
    } catch (error) {
      console.error('Failed to export configuration:', error);
      throw error;
    }
  }

  async importConfiguration(filePath: string): Promise<boolean> {
    try {
      const result = await window.electronAPI?.configuration?.importConfiguration(filePath);
      return result?.success || false;
    } catch (error) {
      console.error('Failed to import configuration:', error);
      return false;
    }
  }

  async getFavorites(): Promise<any[]> {
    try {
      const settings = await this.loadSettings();
      return settings.favorites || [];
    } catch (error) {
      console.error('Failed to get favorites:', error);
      return [];
    }
  }

  async addFavorite(name: string, path: string): Promise<void> {
    try {
      const settings = await this.loadSettings();
      if (!settings.favorites) {
        settings.favorites = [];
      }
      
      const favorite = {
        id: Date.now().toString(),
        name,
        path,
        dateAdded: new Date().toISOString(),
        order: settings.favorites.length,
      };
      
      settings.favorites.push(favorite);
      await this.saveSettings(settings);
    } catch (error) {
      console.error('Failed to add favorite:', error);
      throw error;
    }
  }

  async removeFavorite(favoriteId: string): Promise<void> {
    try {
      const settings = await this.loadSettings();
      if (settings.favorites) {
        settings.favorites = settings.favorites.filter((fav: any) => fav.id !== favoriteId);
        await this.saveSettings(settings);
      }
    } catch (error) {
      console.error('Failed to remove favorite:', error);
      throw error;
    }
  }

  async getTagHierarchy(): Promise<any[]> {
    try {
      const settings = await this.loadSettings();
      return settings.tagHierarchy || [];
    } catch (error) {
      console.error('Failed to get tag hierarchy:', error);
      return [];
    }
  }

  async saveTagHierarchy(hierarchy: any[]): Promise<void> {
    try {
      const settings = await this.loadSettings();
      settings.tagHierarchy = hierarchy;
      await this.saveSettings(settings);
    } catch (error) {
      console.error('Failed to save tag hierarchy:', error);
      throw error;
    }
  }

  private getDefaultSettings(): any {
    return {
      language: 'en',
      theme: 'system',
      thumbnailSize: 'medium',
      viewMode: 'grid',
      favorites: [],
      tagHierarchy: [],
      performance: {
        gpuAcceleration: true,
        cacheSize: 1024, // MB
        workerThreads: 4,
      },
      export: {
        defaultQuality: 90,
        defaultSize: 'original',
        preserveMetadata: true,
      },
    };
  }
}