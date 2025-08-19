import { ConfigurationExport, ImportOptions, ImportResult } from '../../../main/repositories/ConfigurationRepository';

export interface ConfigurationApi {
  exportConfiguration(): Promise<ConfigurationExport>;
  exportToFile(filePath: string): Promise<void>;
  importConfiguration(config: ConfigurationExport, options: ImportOptions): Promise<ImportResult>;
  importFromFile(filePath: string, options: ImportOptions): Promise<ImportResult>;
  validateImportFile(filePath: string): Promise<{ valid: boolean; version?: string; error?: string }>;
  showSaveDialog(defaultPath?: string): Promise<{ canceled: boolean; filePath?: string }>;
  showOpenDialog(): Promise<{ canceled: boolean; filePaths: string[] }>;
}

class ConfigurationApiImpl implements ConfigurationApi {
  async exportConfiguration(): Promise<ConfigurationExport> {
    return window.electronAPI.invoke('configuration:export');
  }

  async exportToFile(filePath: string): Promise<void> {
    return window.electronAPI.invoke('configuration:exportToFile', filePath);
  }

  async importConfiguration(config: ConfigurationExport, options: ImportOptions): Promise<ImportResult> {
    return window.electronAPI.invoke('configuration:import', config, options);
  }

  async importFromFile(filePath: string, options: ImportOptions): Promise<ImportResult> {
    return window.electronAPI.invoke('configuration:importFromFile', filePath, options);
  }

  async validateImportFile(filePath: string): Promise<{ valid: boolean; version?: string; error?: string }> {
    return window.electronAPI.invoke('configuration:validateImportFile', filePath);
  }

  async showSaveDialog(defaultPath?: string): Promise<{ canceled: boolean; filePath?: string }> {
    return window.electronAPI.invoke('dialog:showSaveDialog', {
      title: 'Export Configuration',
      defaultPath: defaultPath || 'tagfusion-config.json',
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
  }

  async showOpenDialog(): Promise<{ canceled: boolean; filePaths: string[] }> {
    return window.electronAPI.invoke('dialog:showOpenDialog', {
      title: 'Import Configuration',
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });
  }
}

export const configurationApi = new ConfigurationApiImpl();