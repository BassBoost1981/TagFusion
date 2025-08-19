import { DragDropService } from '../DragDropService';
import { FileSystemRepository } from '../../repositories/FileSystemRepository';
import { MetadataRepository } from '../../repositories/MetadataRepository';
import { ConfigurationRepository } from '../../repositories/ConfigurationRepository';
import { MediaFile, FolderItem, HierarchicalTag, AppSettings } from '../../../types/global';

import { vi } from 'vitest';

// Mock the repositories
vi.mock('../../repositories/FileSystemRepository');
vi.mock('../../repositories/MetadataRepository');
vi.mock('../../repositories/ConfigurationRepository');

describe('DragDropService', () => {
  let dragDropService: DragDropService;
  let mockFileSystemRepository: any;
  let mockMetadataRepository: any;
  let mockConfigurationRepository: any;

  const mockMediaFile: MediaFile = {
    path: '/test/image.jpg',
    name: 'image.jpg',
    extension: '.jpg',
    size: 1024,
    dateModified: new Date(),
    type: 'image',
  };

  const mockFolderItem: FolderItem = {
    name: 'Test Folder',
    path: '/test/folder',
    hasSubfolders: false,
    mediaCount: 5,
  };

  const mockTag: HierarchicalTag = {
    category: 'Nature',
    subcategory: 'Landscape',
    tag: 'Mountains',
    fullPath: 'Nature/Landscape/Mountains',
  };

  const mockSettings: AppSettings = {
    language: 'en',
    theme: 'light',
    favorites: [],
    tagHierarchy: [],
    thumbnailSize: 128,
    viewMode: 'grid',
  };

  beforeEach(() => {
    mockFileSystemRepository = {
      fileExists: vi.fn(),
      moveFile: vi.fn(),
      copyFile: vi.fn(),
    };
    
    mockMetadataRepository = {
      readMetadata: vi.fn(),
      writeMetadata: vi.fn(),
    };
    
    mockConfigurationRepository = {
      loadSettings: vi.fn(),
      saveSettings: vi.fn(),
    };

    dragDropService = new DragDropService(
      mockFileSystemRepository,
      mockMetadataRepository,
      mockConfigurationRepository
    );

    // Reset all mocks
    vi.clearAllMocks();
  });

  describe('moveFilesToFolder', () => {
    it('should move files to target folder successfully', async () => {
      mockFileSystemRepository.fileExists.mockResolvedValue(false);
      mockFileSystemRepository.moveFile.mockResolvedValue();

      await dragDropService.moveFilesToFolder([mockMediaFile], mockFolderItem);

      expect(mockFileSystemRepository.moveFile).toHaveBeenCalledWith(
        mockMediaFile.path,
        `${mockFolderItem.path}/${mockMediaFile.name}`
      );
    });

    it('should generate unique filename when target exists', async () => {
      mockFileSystemRepository.fileExists
        .mockResolvedValueOnce(true) // First check - file exists
        .mockResolvedValueOnce(false); // Second check - unique name doesn't exist
      mockFileSystemRepository.moveFile.mockResolvedValue();

      await dragDropService.moveFilesToFolder([mockMediaFile], mockFolderItem);

      expect(mockFileSystemRepository.fileExists).toHaveBeenCalledTimes(2);
      expect(mockFileSystemRepository.moveFile).toHaveBeenCalledWith(
        mockMediaFile.path,
        expect.stringContaining('(1)')
      );
    });

    it('should throw error when move operation fails', async () => {
      mockFileSystemRepository.fileExists.mockResolvedValue(false);
      mockFileSystemRepository.moveFile.mockRejectedValue(new Error('Move failed'));

      await expect(
        dragDropService.moveFilesToFolder([mockMediaFile], mockFolderItem)
      ).rejects.toThrow('Failed to move files: Move failed');
    });
  });

  describe('copyFilesToFolder', () => {
    it('should copy files to target folder successfully', async () => {
      mockFileSystemRepository.fileExists.mockResolvedValue(false);
      mockFileSystemRepository.copyFile.mockResolvedValue();

      await dragDropService.copyFilesToFolder([mockMediaFile], mockFolderItem);

      expect(mockFileSystemRepository.copyFile).toHaveBeenCalledWith(
        mockMediaFile.path,
        `${mockFolderItem.path}/${mockMediaFile.name}`
      );
    });
  });

  describe('addFolderToFavorites', () => {
    it('should add folder to favorites successfully', async () => {
      mockConfigurationRepository.loadSettings.mockResolvedValue(mockSettings);
      mockConfigurationRepository.saveSettings.mockResolvedValue();

      await dragDropService.addFolderToFavorites('Test Folder', '/test/path');

      expect(mockConfigurationRepository.saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          favorites: expect.arrayContaining([
            expect.objectContaining({
              name: 'Test Folder',
              path: '/test/path',
            })
          ])
        })
      );
    });

    it('should throw error when folder already exists in favorites', async () => {
      const settingsWithFavorite = {
        ...mockSettings,
        favorites: [{
          id: '1',
          name: 'Test Folder',
          path: '/test/path',
          dateAdded: new Date(),
          order: 0,
        }]
      };

      mockConfigurationRepository.loadSettings.mockResolvedValue(settingsWithFavorite);

      await expect(
        dragDropService.addFolderToFavorites('Test Folder', '/test/path')
      ).rejects.toThrow('Folder is already in favorites');
    });
  });

  describe('assignTagsToFiles', () => {
    it('should assign tags to files successfully', async () => {
      const mockMetadata = {
        tags: [],
        rating: 0,
        dateCreated: new Date(),
      };

      mockMetadataRepository.readMetadata.mockResolvedValue(mockMetadata);
      mockMetadataRepository.writeMetadata.mockResolvedValue();

      await dragDropService.assignTagsToFiles([mockMediaFile], [mockTag]);

      expect(mockMetadataRepository.writeMetadata).toHaveBeenCalledWith(
        mockMediaFile.path,
        expect.objectContaining({
          tags: expect.arrayContaining([mockTag])
        })
      );
    });

    it('should not add duplicate tags', async () => {
      const mockMetadata = {
        tags: [mockTag], // Tag already exists
        rating: 0,
        dateCreated: new Date(),
      };

      mockMetadataRepository.readMetadata.mockResolvedValue(mockMetadata);
      mockMetadataRepository.writeMetadata.mockResolvedValue();

      await dragDropService.assignTagsToFiles([mockMediaFile], [mockTag]);

      // writeMetadata should not be called since no new tags were added
      expect(mockMetadataRepository.writeMetadata).not.toHaveBeenCalled();
    });
  });

  describe('reorderFavorites', () => {
    it('should reorder favorites successfully', async () => {
      const settingsWithFavorites = {
        ...mockSettings,
        favorites: [
          { id: '1', name: 'Folder A', path: '/a', dateAdded: new Date(), order: 0 },
          { id: '2', name: 'Folder B', path: '/b', dateAdded: new Date(), order: 1 },
          { id: '3', name: 'Folder C', path: '/c', dateAdded: new Date(), order: 2 },
        ]
      };

      mockConfigurationRepository.loadSettings.mockResolvedValue(settingsWithFavorites);
      mockConfigurationRepository.saveSettings.mockResolvedValue();

      // Reorder: move '3' to first position
      await dragDropService.reorderFavorites(['3', '1', '2']);

      expect(mockConfigurationRepository.saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          favorites: [
            expect.objectContaining({ id: '3', order: 0 }),
            expect.objectContaining({ id: '1', order: 1 }),
            expect.objectContaining({ id: '2', order: 2 }),
          ]
        })
      );
    });
  });

  describe('reorganizeTag', () => {
    it('should reorganize tag to new parent successfully', async () => {
      const mockTagHierarchy = [
        {
          id: 'parent1',
          name: 'Parent 1',
          level: 0,
          children: [
            {
              id: 'child1',
              name: 'Child 1',
              level: 1,
              parent: 'parent1',
              children: []
            }
          ]
        },
        {
          id: 'parent2',
          name: 'Parent 2',
          level: 0,
          children: []
        }
      ];

      const settingsWithTags = {
        ...mockSettings,
        tagHierarchy: mockTagHierarchy
      };

      mockConfigurationRepository.loadSettings.mockResolvedValue(settingsWithTags);
      mockConfigurationRepository.saveSettings.mockResolvedValue();

      // Move child1 from parent1 to parent2
      await dragDropService.reorganizeTag('child1', 'parent2');

      expect(mockConfigurationRepository.saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          tagHierarchy: expect.arrayContaining([
            expect.objectContaining({
              id: 'parent1',
              children: [] // child1 should be removed
            }),
            expect.objectContaining({
              id: 'parent2',
              children: expect.arrayContaining([
                expect.objectContaining({
                  id: 'child1',
                  parent: 'parent2',
                  level: 1
                })
              ])
            })
          ])
        })
      );
    });

    it('should throw error when tag not found', async () => {
      mockConfigurationRepository.loadSettings.mockResolvedValue(mockSettings);

      await expect(
        dragDropService.reorganizeTag('nonexistent', 'parent1')
      ).rejects.toThrow('Tag not found');
    });
  });

  describe('removeFavorite', () => {
    it('should remove favorite successfully', async () => {
      const settingsWithFavorites = {
        ...mockSettings,
        favorites: [
          { id: '1', name: 'Folder A', path: '/a', dateAdded: new Date(), order: 0 },
          { id: '2', name: 'Folder B', path: '/b', dateAdded: new Date(), order: 1 },
        ]
      };

      mockConfigurationRepository.loadSettings.mockResolvedValue(settingsWithFavorites);
      mockConfigurationRepository.saveSettings.mockResolvedValue();

      await dragDropService.removeFavorite('1');

      expect(mockConfigurationRepository.saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          favorites: [
            expect.objectContaining({ id: '2', order: 0 }) // Reordered
          ]
        })
      );
    });
  });
});