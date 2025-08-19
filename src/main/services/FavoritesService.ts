import { FavoriteFolder } from '../../types/global';
import { IConfigurationRepository } from '../repositories/ConfigurationRepository';
import { IFileSystemRepository } from '../repositories/FileSystemRepository';

export interface IFavoritesService {
  getFavorites(): Promise<FavoriteFolder[]>;
  addFavorite(name: string, path: string): Promise<FavoriteFolder>;
  removeFavorite(id: string): Promise<void>;
  updateFavorite(id: string, updates: { name?: string; path?: string }): Promise<void>;
  reorderFavorites(favoriteIds: string[]): Promise<void>;
  validateFavorites(): Promise<FavoriteFolder[]>;
}

export class FavoritesService implements IFavoritesService {
  constructor(
    private configRepo: IConfigurationRepository,
    private fileSystemRepo: IFileSystemRepository
  ) {}

  async getFavorites(): Promise<FavoriteFolder[]> {
    return await this.configRepo.getFavorites();
  }

  async addFavorite(name: string, path: string): Promise<FavoriteFolder> {
    // Validate that the path exists
    try {
      const exists = await this.fileSystemRepo.pathExists(path);
      if (!exists) {
        throw new Error('Path does not exist');
      }
    } catch (error) {
      throw new Error('Cannot access the specified path');
    }

    return await this.configRepo.addFavorite({ name, path });
  }

  async removeFavorite(id: string): Promise<void> {
    await this.configRepo.removeFavorite(id);
  }

  async updateFavorite(id: string, updates: { name?: string; path?: string }): Promise<void> {
    // If path is being updated, validate it exists
    if (updates.path) {
      try {
        const exists = await this.fileSystemRepo.pathExists(updates.path);
        if (!exists) {
          throw new Error('Path does not exist');
        }
      } catch (error) {
        throw new Error('Cannot access the specified path');
      }
    }

    await this.configRepo.updateFavorite(id, updates);
  }

  async reorderFavorites(favoriteIds: string[]): Promise<void> {
    await this.configRepo.reorderFavorites(favoriteIds);
  }

  async validateFavorites(): Promise<FavoriteFolder[]> {
    const favorites = await this.getFavorites();
    const validFavorites: FavoriteFolder[] = [];

    for (const favorite of favorites) {
      try {
        const exists = await this.fileSystemRepo.pathExists(favorite.path);
        if (exists) {
          validFavorites.push(favorite);
        } else {
          console.warn(`Favorite path no longer exists: ${favorite.path}`);
        }
      } catch (error) {
        console.warn(`Cannot access favorite path: ${favorite.path}`, error);
      }
    }

    return validFavorites;
  }
}