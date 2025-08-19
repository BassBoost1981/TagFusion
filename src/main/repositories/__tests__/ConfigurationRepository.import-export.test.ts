import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigurationRepository, ConfigurationExport, ImportOptions } from '../ConfigurationRepository';
import { promises as fs } from 'fs';
import path from 'path';
import { app } from 'electron';
import { AppSettings, FavoriteFolder, TagHierarchyNode } from '../../../types/global';

// Mock electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/userdata')
  }
}));

// Mock fs
vi.mock('fs', () => ({
  promises: {
    access: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn()
  }
}));

describe('ConfigurationRepository Import/Export', () => {
  let repository: ConfigurationRepository;
  const mockFs = fs as any;

  beforeEach(() => {
    repository = new ConfigurationRepository();
    vi.clearAllMocks();
  });

  describe('exportConfiguration', () => {
    it('should export configuration with correct structure', async () => {
      const mockSettings: AppSettings = {
        language: 'en',
        theme: 'dark',
        favorites: [
          {
            id: 'fav1',
            name: 'Pictures',
            path: '/home/user/Pictures',
            dateAdded: new Date('2024-01-01'),
            order: 0
          }
        ],
        tagHierarchy: [
          {
            id: 'tag1',
            name: 'Nature',
            children: [],
            level: 0
          }
        ],
        thumbnailSize: 150,
        viewMode: 'grid'
      };

      mockFs.access.mockRejectedValueOnce(new Error('File not found'));
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(mockSettings));

      const exported = await repository.exportConfiguration();

      expect(exported).toMatchObject({
        version: '1.0.0',
        exportDate: expect.any(Date),
        settings: {
          language: 'en',
          theme: 'dark',
          thumbnailSize: 150,
          viewMode: 'grid',
          favorites: [],
          tagHierarchy: []
        },
        tagDefinitions: [
          {
            id: 'tag1',
            name: 'Nature',
            children: [],
            level: 0
          }
        ]
      });
    });
  });

  describe('exportToFile', () => {
    it('should export configuration to file including favorites', async () => {
      const mockSettings: AppSettings = {
        language: 'en',
        theme: 'dark',
        favorites: [
          {
            id: 'fav1',
            name: 'Pictures',
            path: '/home/user/Pictures',
            dateAdded: new Date('2024-01-01'),
            order: 0
          }
        ],
        tagHierarchy: [],
        thumbnailSize: 150,
        viewMode: 'grid'
      };

      mockFs.access.mockRejectedValueOnce(new Error('File not found'));
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(mockSettings));
      mockFs.writeFile.mockResolvedValueOnce(undefined);

      const filePath = '/path/to/export.json';
      await repository.exportToFile(filePath);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        filePath,
        expect.stringContaining('"favorites"'),
        'utf-8'
      );

      const writtenData = JSON.parse((mockFs.writeFile as jest.Mock).mock.calls[0][1]);
      expect(writtenData.favorites).toHaveLength(1);
      expect(writtenData.favorites[0].name).toBe('Pictures');
    });

    it('should handle export errors', async () => {
      mockFs.access.mockRejectedValueOnce(new Error('File not found'));
      mockFs.readFile.mockRejectedValueOnce(new Error('Read error'));

      await expect(repository.exportToFile('/path/to/export.json'))
        .rejects.toThrow('Failed to export configuration to file');
    });
  });

  describe('importConfiguration', () => {
    it('should import favorites without conflicts', async () => {
      const currentSettings: AppSettings = {
        language: 'en',
        theme: 'light',
        favorites: [],
        tagHierarchy: [],
        thumbnailSize: 150,
        viewMode: 'grid'
      };

      const importConfig: ConfigurationExport & { favorites: FavoriteFolder[] } = {
        version: '1.0.0',
        exportDate: new Date(),
        settings: {
          language: 'de',
          theme: 'dark',
          favorites: [],
          tagHierarchy: [],
          thumbnailSize: 200,
          viewMode: 'list'
        },
        tagDefinitions: [],
        favorites: [
          {
            id: 'fav1',
            name: 'Documents',
            path: '/home/user/Documents',
            dateAdded: new Date('2024-01-01'),
            order: 0
          }
        ]
      };

      const options: ImportOptions = {
        mergeMode: 'merge',
        importFavorites: true,
        importTagHierarchy: true,
        importSettings: true
      };

      mockFs.access.mockRejectedValueOnce(new Error('File not found'));
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(currentSettings));
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await repository.importConfiguration(importConfig, options);

      expect(result.success).toBe(true);
      expect(result.imported.favorites).toBe(1);
      expect(result.imported.settingsUpdated).toBe(true);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should handle favorite conflicts in merge mode', async () => {
      const currentSettings: AppSettings = {
        language: 'en',
        theme: 'light',
        favorites: [
          {
            id: 'existing1',
            name: 'My Pictures',
            path: '/home/user/Pictures',
            dateAdded: new Date('2024-01-01'),
            order: 0
          }
        ],
        tagHierarchy: [],
        thumbnailSize: 150,
        viewMode: 'grid'
      };

      const importConfig: ConfigurationExport & { favorites: FavoriteFolder[] } = {
        version: '1.0.0',
        exportDate: new Date(),
        settings: {
          language: 'en',
          theme: 'light',
          favorites: [],
          tagHierarchy: [],
          thumbnailSize: 150,
          viewMode: 'grid'
        },
        tagDefinitions: [],
        favorites: [
          {
            id: 'import1',
            name: 'Pictures Folder',
            path: '/home/user/Pictures', // Same path, different name
            dateAdded: new Date('2024-01-02'),
            order: 0
          }
        ]
      };

      const options: ImportOptions = {
        mergeMode: 'merge',
        importFavorites: true,
        importTagHierarchy: false,
        importSettings: false
      };

      mockFs.access.mockRejectedValueOnce(new Error('File not found'));
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(currentSettings));
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await repository.importConfiguration(importConfig, options);

      expect(result.success).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].type).toBe('favorite');
      expect(result.conflicts[0].resolution).toBe('keep');
    });

    it('should merge tag hierarchies correctly', async () => {
      const currentSettings: AppSettings = {
        language: 'en',
        theme: 'light',
        favorites: [],
        tagHierarchy: [
          {
            id: 'existing1',
            name: 'Nature',
            children: [],
            level: 0
          }
        ],
        thumbnailSize: 150,
        viewMode: 'grid'
      };

      const importConfig: ConfigurationExport = {
        version: '1.0.0',
        exportDate: new Date(),
        settings: {
          language: 'en',
          theme: 'light',
          favorites: [],
          tagHierarchy: [],
          thumbnailSize: 150,
          viewMode: 'grid'
        },
        tagDefinitions: [
          {
            id: 'import1',
            name: 'Architecture',
            children: [],
            level: 0
          },
          {
            id: 'import2',
            name: 'Nature', // Conflict
            children: [
              {
                id: 'import3',
                name: 'Mountains',
                children: [],
                level: 1,
                parent: 'import2'
              }
            ],
            level: 0
          }
        ]
      };

      const options: ImportOptions = {
        mergeMode: 'merge',
        importFavorites: false,
        importTagHierarchy: true,
        importSettings: false
      };

      mockFs.access.mockRejectedValueOnce(new Error('File not found'));
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(currentSettings));
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await repository.importConfiguration(importConfig, options);

      expect(result.success).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].type).toBe('tag');
      expect(result.conflicts[0].item).toBe('Nature');
    });
  });

  describe('importFromFile', () => {
    it('should import configuration from file', async () => {
      const fileContent = {
        version: '1.0.0',
        exportDate: '2024-01-01T00:00:00.000Z',
        settings: {
          language: 'de',
          theme: 'dark',
          favorites: [],
          tagHierarchy: [],
          thumbnailSize: 200,
          viewMode: 'list'
        },
        tagDefinitions: [],
        favorites: [
          {
            id: 'fav1',
            name: 'Documents',
            path: '/home/user/Documents',
            dateAdded: '2024-01-01T00:00:00.000Z',
            order: 0
          }
        ]
      };

      const currentSettings: AppSettings = {
        language: 'en',
        theme: 'light',
        favorites: [],
        tagHierarchy: [],
        thumbnailSize: 150,
        viewMode: 'grid'
      };

      const options: ImportOptions = {
        mergeMode: 'merge',
        importFavorites: true,
        importTagHierarchy: true,
        importSettings: true
      };

      mockFs.readFile
        .mockResolvedValueOnce(JSON.stringify(fileContent)) // For import
        .mockRejectedValueOnce(new Error('File not found')) // For loadSettings
        .mockResolvedValueOnce(JSON.stringify(currentSettings)); // For loadSettings
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await repository.importFromFile('/path/to/import.json', options);

      expect(result.success).toBe(true);
      expect(result.imported.favorites).toBe(1);
    });

    it('should handle file read errors', async () => {
      mockFs.readFile.mockRejectedValueOnce(new Error('File not found'));

      const options: ImportOptions = {
        mergeMode: 'merge',
        importFavorites: true,
        importTagHierarchy: true,
        importSettings: true
      };

      await expect(repository.importFromFile('/nonexistent.json', options))
        .rejects.toThrow('Failed to import configuration from file');
    });
  });

  describe('validateImportFile', () => {
    it('should validate correct import file', async () => {
      const validConfig = {
        version: '1.0.0',
        exportDate: '2024-01-01T00:00:00.000Z',
        settings: { language: 'en' },
        tagDefinitions: []
      };

      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(validConfig));

      const result = await repository.validateImportFile('/path/to/valid.json');

      expect(result.valid).toBe(true);
      expect(result.version).toBe('1.0.0');
      expect(result.error).toBeUndefined();
    });

    it('should reject file without version', async () => {
      const invalidConfig = {
        exportDate: '2024-01-01T00:00:00.000Z',
        settings: { language: 'en' }
      };

      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(invalidConfig));

      const result = await repository.validateImportFile('/path/to/invalid.json');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing version information');
    });

    it('should reject file without exportDate', async () => {
      const invalidConfig = {
        version: '1.0.0',
        settings: { language: 'en' }
      };

      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(invalidConfig));

      const result = await repository.validateImportFile('/path/to/invalid.json');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing export date');
    });

    it('should reject file without importable data', async () => {
      const invalidConfig = {
        version: '1.0.0',
        exportDate: '2024-01-01T00:00:00.000Z'
      };

      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(invalidConfig));

      const result = await repository.validateImportFile('/path/to/invalid.json');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('No importable data found');
    });

    it('should handle invalid JSON', async () => {
      mockFs.readFile.mockResolvedValueOnce('invalid json content');

      const result = await repository.validateImportFile('/path/to/invalid.json');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid JSON format or file not readable');
    });

    it('should handle file read errors', async () => {
      mockFs.readFile.mockRejectedValueOnce(new Error('Permission denied'));

      const result = await repository.validateImportFile('/path/to/unreadable.json');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid JSON format or file not readable');
    });
  });
});