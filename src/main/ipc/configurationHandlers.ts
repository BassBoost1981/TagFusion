import { ipcMain, dialog } from 'electron';
import { ConfigurationRepository, ConfigurationExport, ImportOptions } from '../repositories/ConfigurationRepository';

export function setupConfigurationHandlers() {
  const configRepo = new ConfigurationRepository();

  ipcMain.handle('configuration:export', async () => {
    try {
      return await configRepo.exportConfiguration();
    } catch (error) {
      console.error('Failed to export configuration:', error);
      throw error;
    }
  });

  ipcMain.handle('configuration:exportToFile', async (_, filePath: string) => {
    try {
      return await configRepo.exportToFile(filePath);
    } catch (error) {
      console.error('Failed to export configuration to file:', error);
      throw error;
    }
  });

  ipcMain.handle('configuration:import', async (_, config: ConfigurationExport, options: ImportOptions) => {
    try {
      return await configRepo.importConfiguration(config, options);
    } catch (error) {
      console.error('Failed to import configuration:', error);
      throw error;
    }
  });

  ipcMain.handle('configuration:importFromFile', async (_, filePath: string, options: ImportOptions) => {
    try {
      return await configRepo.importFromFile(filePath, options);
    } catch (error) {
      console.error('Failed to import configuration from file:', error);
      throw error;
    }
  });

  ipcMain.handle('configuration:validateImportFile', async (_, filePath: string) => {
    try {
      return await configRepo.validateImportFile(filePath);
    } catch (error) {
      console.error('Failed to validate import file:', error);
      throw error;
    }
  });

  ipcMain.handle('dialog:showSaveDialog', async (_, options) => {
    try {
      return await dialog.showSaveDialog(options);
    } catch (error) {
      console.error('Failed to show save dialog:', error);
      throw error;
    }
  });

  ipcMain.handle('dialog:showOpenDialog', async (_, options) => {
    try {
      return await dialog.showOpenDialog(options);
    } catch (error) {
      console.error('Failed to show open dialog:', error);
      throw error;
    }
  });
}