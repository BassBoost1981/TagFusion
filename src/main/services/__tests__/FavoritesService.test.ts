import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FavoritesService } from '../FavoritesService';
import type { IConfigurationRepository } from '../../repositories/ConfigurationRepository';
import type { FavoriteFolder } from '../../../types/global';

// Mock the configuration repository
const mockConfigurationRepository: IConfigurationRepository = {
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
  exportConfiguration: vi.fn(),
  importConfiguration: vi.fn(),
  getConfigPath: vi.fn(),
  ensureConfigDirectory: vi.fn(),
  backupConfiguration: vi.fn(),
  restoreConfiguration: vi.fn(),
  validateConfiguration: vi.fn(),
  migrateConfiguration: vi.fn()
};

describe('FavoritesService', () => {
  let favoritesService: FavoritesService;
  let mockFavorites: FavoriteFolder[];

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockFavorites = [
      {
        id: '1',
        name: 'Pictures',
        path: '/home/user/Pictures',
        dateAdded: new Date('2024-01-01'),
        order: 0
      },
      {
        id: '2',
        name: 'Documents',
        path: '/home/user/Documents',
        dateAdded: new Date('2024-01-02'),
        order: 1
      }
    ];

    // Setup default mock behavior
    vi.mocked(mockConfigurationRepository.loadSettings).mockResolvedValue({
      language: 'en',
      theme: 'system' as const,
      favorites: mockFavorites,
      tagHierarchy: []
    });

    favoritesService = new FavoritesService(mockConfigurationRepository);
  });

  describe('getFavorites', () => {
    it('should return all favorites sorted by order', async () => {
      const favorites = await favoritesService.getFavorites();
      
      expect(favorites).toEqual(mockFavorites);
      expect(mockConfigurationRepository.loadSettings).toHaveBeenCalledOnce();
    });

    it('should return empty array when no favorites exist', async () => {
      vi.mocked(mockConfigurationRepository.loadSettings).mockResolvedValue({
        language: 'en',
        theme: 'system' as const,
        favorites: [],
        tagHierarchy: []
      });

      const favorites = await favoritesService.getFavorites();
      
      expect(favorites).toEqual([]);
    });

    it('should handle configuration loading errors', async () => {
      vi.mocked(mockConfigurationRepository.loadSettings).mockRejectedValue(new Error('Config error'));

      const favorites = await favoritesService.getFavorites();
      
      expect(favorites).toEqual([]);
    });
  });

  describe('addFavorite', () => {
    it('should add a new favorite', async () => {
      const newFavorite: Omit<FavoriteFolder, 'id' | 'dateAdded' | 'order'> = {
        name: 'Downloads',
        path: '/home/user/Downloads'
      };

      vi.mocked(mockConfigurationRepository.saveSettings).mockResolvedValue();

      const result = await favoritesService.addFavorite(newFavorite);

      expect(result.name).toBe(newFavorite.name);
      expect(result.path).toBe(newFavorite.path);
      expect(result.id).toBeDefined();
      expect(result.dateAdded).toBeInstanceOf(Date);
      expect(result.order).toBe(2); // Should be after existing favorites

      expect(mockConfigurationRepository.saveSettings).toHaveBeenCalledWith({
        language: 'en',
        theme: 'system',
        favorites: [...mockFavorites, result],
        tagHierarchy: []
      });
    });

    it('should throw error when favorite with same path already exists', async () => {
      const duplicateFavorite: Omit<FavoriteFolder, 'id' | 'dateAdded' | 'order'> = {
        name: 'Pictures Copy',
        path: '/home/user/Pictures' // Same path as existing favorite
      };

      await expect(favoritesService.addFavorite(duplicateFavorite))
        .rejects.toThrow('Favorite with this path already exists');
    });

    it('should handle save errors', async () => {
      const newFavorite: Omit<FavoriteFolder, 'id' | 'dateAdded' | 'order'> = {
        name: 'Downloads',
        path: '/home/user/Downloads'
      };

      vi.mocked(mockConfigurationRepository.saveSettings).mockRejectedValue(new Error('Save failed'));

      await expect(favoritesService.addFavorite(newFavorite))
        .rejects.toThrow('Save failed');
    });
  });

  describe('removeFavorite', () => {
    it('should remove an existing favorite', async () => {
      vi.mocked(mockConfigurationRepository.saveSettings).mockResolvedValue();

      await favoritesService.removeFavorite('1');

      expect(mockConfigurationRepository.saveSettings).toHaveBeenCalledWith({
        language: 'en',
        theme: 'system',
        favorites: [mockFavorites[1]], // Only second favorite should remain
        tagHierarchy: []
      });
    });

    it('should throw error when favorite does not exist', async () => {
      await expect(favoritesService.removeFavorite('nonexistent'))
        .rejects.toThrow('Favorite not found');
    });

    it('should handle save errors', async () => {
      vi.mocked(mockConfigurationRepository.saveSettings).mockRejectedValue(new Error('Save failed'));

      await expect(favoritesService.removeFavorite('1'))
        .rejects.toThrow('Save failed');
    });
  });

  describe('updateFavorite', () => {
    it('should update an existing favorite', async () => {
      const updates: Partial<FavoriteFolder> = {
        name: 'Updated Pictures',
        path: '/home/user/UpdatedPictures'
      };

      vi.mocked(mockConfigurationRepository.saveSettings).mockResolvedValue();

      const result = await favoritesService.updateFavorite('1', updates);

      expect(result.name).toBe(updates.name);
      expect(result.path).toBe(updates.path);
      expect(result.id).toBe('1');
      expect(result.dateAdded).toEqual(mockFavorites[0].dateAdded);
      expect(result.order).toBe(mockFavorites[0].order);

      expect(mockConfigurationRepository.saveSettings).toHaveBeenCalledWith({
        language: 'en',
        theme: 'system',
        favorites: [result, mockFavorites[1]],
        tagHierarchy: []
      });
    });

    it('should throw error when favorite does not exist', async () => {
      const updates: Partial<FavoriteFolder> = {
        name: 'Updated Name'
      };

      await expect(favoritesService.updateFavorite('nonexistent', updates))
        .rejects.toThrow('Favorite not found');
    });

    it('should throw error when updating path to existing path', async () => {
      const updates: Partial<FavoriteFolder> = {
        path: '/home/user/Documents' // Same as second favorite
      };

      await expect(favoritesService.updateFavorite('1', updates))
        .rejects.toThrow('Favorite with this path already exists');
    });

    it('should handle save errors', async () => {
      const updates: Partial<FavoriteFolder> = {
        name: 'Updated Name'
      };

      vi.mocked(mockConfigurationRepository.saveSettings).mockRejectedValue(new Error('Save failed'));

      await expect(favoritesService.updateFavorite('1', updates))
        .rejects.toThrow('Save failed');
    });
  });

  describe('reorderFavorites', () => {
    it('should reorder favorites', async () => {
      const newOrder = ['2', '1']; // Reverse order
      vi.mocked(mockConfigurationRepository.saveSettings).mockResolvedValue();

      await favoritesService.reorderFavorites(newOrder);

      const expectedFavorites = [
        { ...mockFavorites[1], order: 0 },
        { ...mockFavorites[0], order: 1 }
      ];

      expect(mockConfigurationRepository.saveSettings).toHaveBeenCalledWith({
        language: 'en',
        theme: 'system',
        favorites: expectedFavorites,
        tagHierarchy: []
      });
    });

    it('should throw error when order array length does not match favorites count', async () => {
      const newOrder = ['1']; // Missing one ID

      await expect(favoritesService.reorderFavorites(newOrder))
        .rejects.toThrow('Order array must contain all favorite IDs');
    });

    it('should throw error when order contains invalid IDs', async () => {
      const newOrder = ['1', 'nonexistent'];

      await expect(favoritesService.reorderFavorites(newOrder))
        .rejects.toThrow('Order array must contain all favorite IDs');
    });

    it('should handle save errors', async () => {
      const newOrder = ['2', '1'];
      vi.mocked(mockConfigurationRepository.saveSettings).mockRejectedValue(new Error('Save failed'));

      await expect(favoritesService.reorderFavorites(newOrder))
        .rejects.toThrow('Save failed');
    });
  });

  describe('isFavorite', () => {
    it('should return true for existing favorite path', async () => {
      const result = await favoritesService.isFavorite('/home/user/Pictures');
      
      expect(result).toBe(true);
    });

    it('should return false for non-favorite path', async () => {
      const result = await favoritesService.isFavorite('/home/user/Downloads');
      
      expect(result).toBe(false);
    });

    it('should handle configuration loading errors', async () => {
      vi.mocked(mockConfigurationRepository.loadSettings).mockRejectedValue(new Error('Config error'));

      const result = await favoritesService.isFavorite('/home/user/Pictures');
      
      expect(result).toBe(false);
    });
  });

  describe('getFavoriteByPath', () => {
    it('should return favorite for existing path', async () => {
      const result = await favoritesService.getFavoriteByPath('/home/user/Pictures');
      
      expect(result).toEqual(mockFavorites[0]);
    });

    it('should return undefined for non-favorite path', async () => {
      const result = await favoritesService.getFavoriteByPath('/home/user/Downloads');
      
      expect(result).toBeUndefined();
    });

    it('should handle configuration loading errors', async () => {
      vi.mocked(mockConfigurationRepository.loadSettings).mockRejectedValue(new Error('Config error'));

      const result = await favoritesService.getFavoriteByPath('/home/user/Pictures');
      
      expect(result).toBeUndefined();
    });
  });

  describe('clearFavorites', () => {
    it('should remove all favorites', async () => {
      vi.mocked(mockConfigurationRepository.saveSettings).mockResolvedValue();

      await favoritesService.clearFavorites();

      expect(mockConfigurationRepository.saveSettings).toHaveBeenCalledWith({
        language: 'en',
        theme: 'system',
        favorites: [],
        tagHierarchy: []
      });
    });

    it('should handle save errors', async () => {
      vi.mocked(mockConfigurationRepository.saveSettings).mockRejectedValue(new Error('Save failed'));

      await expect(favoritesService.clearFavorites())
        .rejects.toThrow('Save failed');
    });
  });
});