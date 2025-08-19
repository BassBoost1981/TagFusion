import { ElectronAPI } from '../types/electron';

// Mock data for development
const mockDrives = [
  { name: 'C:', path: 'C:\\', type: 'fixed', available: true },
  { name: 'D:', path: 'D:\\', type: 'fixed', available: true },
];

const mockFavorites = [
  { id: '1', name: 'Pictures', path: 'C:\\Users\\User\\Pictures\\' },
  { id: '2', name: 'Documents', path: 'C:\\Users\\User\\Documents\\' },
  { id: '3', name: 'Desktop', path: 'C:\\Users\\User\\Desktop\\' },
];

const mockTagHierarchy = [
  {
    id: 'nature',
    name: 'Nature',
    level: 0,
    parent: null,
    children: [
      {
        id: 'landscape',
        name: 'Landscape',
        level: 1,
        parent: 'nature',
        children: [
          { id: 'mountains', name: 'Mountains', level: 2, parent: 'landscape', children: [] },
          { id: 'lakes', name: 'Lakes', level: 2, parent: 'landscape', children: [] },
        ],
      },
    ],
  },
  {
    id: 'events',
    name: 'Events',
    level: 0,
    parent: null,
    children: [
      {
        id: 'vacation',
        name: 'Vacation',
        level: 1,
        parent: 'events',
        children: [],
      },
    ],
  },
];

const mockDirectoryContents = {
  'C:\\': {
    folders: [
      { name: 'Users', path: 'C:\\Users\\', dateModified: new Date('2024-01-15'), hasSubfolders: true },
      { name: 'Program Files', path: 'C:\\Program Files\\', dateModified: new Date('2024-01-14'), hasSubfolders: true },
      { name: 'Windows', path: 'C:\\Windows\\', dateModified: new Date('2024-01-13'), hasSubfolders: true },
    ],
    files: [],
  },
  'C:\\Users\\User\\Pictures\\': {
    folders: [
      { name: 'Vacation 2024', path: 'C:\\Users\\User\\Pictures\\Vacation 2024\\', dateModified: new Date('2024-01-12'), hasSubfolders: false },
      { name: 'Family', path: 'C:\\Users\\User\\Pictures\\Family\\', dateModified: new Date('2024-01-11'), hasSubfolders: true },
    ],
    files: [
      {
        name: 'sunset.jpg',
        path: 'C:\\Users\\User\\Pictures\\sunset.jpg',
        type: 'image',
        size: 2500000,
        dateModified: new Date('2024-01-10'),
        extension: '.jpg',
      },
      {
        name: 'landscape.png',
        path: 'C:\\Users\\User\\Pictures\\landscape.png',
        type: 'image',
        size: 1800000,
        dateModified: new Date('2024-01-09'),
        extension: '.png',
      },
      {
        name: 'video.mp4',
        path: 'C:\\Users\\User\\Pictures\\video.mp4',
        type: 'video',
        size: 15000000,
        dateModified: new Date('2024-01-08'),
        extension: '.mp4',
      },
    ],
  },
};

// Create mock Electron API
export const createMockElectronAPI = (): ElectronAPI => ({
  fileSystem: {
    async getDrives() {
      await new Promise(resolve => setTimeout(resolve, 100)); // Simulate async
      return mockDrives;
    },

    async getDirectoryContents(path: string) {
      await new Promise(resolve => setTimeout(resolve, 200)); // Simulate async
      return mockDirectoryContents[path] || { folders: [], files: [] };
    },

    async createDirectory(path: string) {
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('Mock: Create directory', path);
      return { success: true };
    },

    async deleteFile(path: string) {
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('Mock: Delete file', path);
      return { success: true };
    },

    async moveFile(sourcePath: string, targetPath: string) {
      await new Promise(resolve => setTimeout(resolve, 200));
      console.log('Mock: Move file', sourcePath, 'to', targetPath);
      return { success: true };
    },

    async copyFile(sourcePath: string, targetPath: string) {
      await new Promise(resolve => setTimeout(resolve, 200));
      console.log('Mock: Copy file', sourcePath, 'to', targetPath);
      return { success: true };
    },

    async renameFile(oldPath: string, newPath: string) {
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('Mock: Rename file', oldPath, 'to', newPath);
      return { success: true };
    },

    async getFileStats(path: string) {
      await new Promise(resolve => setTimeout(resolve, 50));
      return {
        size: 1024000,
        dateCreated: new Date('2024-01-01'),
        dateModified: new Date('2024-01-15'),
        isDirectory: path.endsWith('\\'),
        isFile: !path.endsWith('\\'),
      };
    },

    async watchDirectory(path: string, callback: (event: string, filename: string) => void) {
      console.log('Mock: Watch directory', path);
      // In real implementation, this would set up file system watching
    },

    async unwatchDirectory(path: string) {
      console.log('Mock: Unwatch directory', path);
    },
  },

  metadata: {
    async readMetadata(filePath: string) {
      await new Promise(resolve => setTimeout(resolve, 100));
      return {
        fileName: filePath.split('\\').pop(),
        fileSize: 2500000,
        dateCreated: new Date('2024-01-01'),
        dateModified: new Date('2024-01-15'),
        dimensions: { width: 1920, height: 1080 },
        format: 'JPEG',
        tags: ['nature', 'landscape'],
        rating: 4,
        exif: {
          camera: 'Canon EOS R5',
          lens: 'RF 24-70mm f/2.8L IS USM',
          focalLength: '50mm',
          aperture: 'f/5.6',
          shutterSpeed: '1/125s',
          iso: 200,
        },
      };
    },

    async writeMetadata(filePath: string, metadata: any) {
      await new Promise(resolve => setTimeout(resolve, 150));
      console.log('Mock: Write metadata to', filePath, metadata);
    },

    async writeRating(filePath: string, rating: number) {
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('Mock: Write rating to', filePath, rating);
      return { success: true };
    },

    async writeTags(filePath: string, tags: any[]) {
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('Mock: Write tags to', filePath, tags);
      return { success: true };
    },
  },

  rating: {
    async getRating(filePath: string) {
      await new Promise(resolve => setTimeout(resolve, 50));
      console.log('Mock: Get rating for', filePath);
      return Math.floor(Math.random() * 5) + 1; // Random rating 1-5
    },

    async setRating(filePath: string, rating: number) {
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('Mock: Set rating for', filePath, 'to', rating);
      return { success: true };
    },

    async setBatchRating(filePaths: string[], rating: number) {
      await new Promise(resolve => setTimeout(resolve, 200));
      console.log('Mock: Set batch rating for', filePaths.length, 'files to', rating);
      return { success: true };
    },

    async getAverageRating(filePaths: string[]) {
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('Mock: Get average rating for', filePaths.length, 'files');
      return Math.floor(Math.random() * 5) + 1;
    },
  },

  tags: {
    async getHierarchy() {
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('Mock: Get tag hierarchy');
      return [
        {
          id: '1',
          name: 'Nature',
          parent: null,
          children: [
            { id: '2', name: 'Landscape', parent: '1', children: [], level: 1 },
            { id: '3', name: 'Animals', parent: '1', children: [], level: 1 },
          ],
          level: 0,
        },
        {
          id: '4',
          name: 'People',
          parent: null,
          children: [],
          level: 0,
        },
      ];
    },

    async createTag(parentId: string | null, name: string) {
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('Mock: Create tag:', parentId, name);
      return { success: true, id: Math.random().toString(36) };
    },

    async updateTag(tagId: string, name: string) {
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('Mock: Update tag:', tagId, name);
      return { success: true };
    },

    async deleteTag(tagId: string) {
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('Mock: Delete tag:', tagId);
      return { success: true };
    },

    async assignToFiles(filePaths: string[], tagIds: string[]) {
      await new Promise(resolve => setTimeout(resolve, 150));
      console.log('Mock: Assign tags to files:', filePaths, tagIds);
      return { success: true };
    },

    async removeFromFiles(filePaths: string[], tagIds: string[]) {
      await new Promise(resolve => setTimeout(resolve, 150));
      console.log('Mock: Remove tags from files:', filePaths, tagIds);
      return { success: true };
    },
  },

  thumbnails: {
    async generateThumbnail(filePath: string, size: number) {
      await new Promise(resolve => setTimeout(resolve, 300));
      // Return a placeholder data URL for development
      return `data:image/svg+xml;base64,${btoa(`
        <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#f0f0f0"/>
          <text x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="Arial" font-size="12" fill="#666">
            ${filePath.split('\\').pop()?.substring(0, 10)}...
          </text>
        </svg>
      `)}`;
    },

    async getThumbnail(filePath: string) {
      await new Promise(resolve => setTimeout(resolve, 50));
      return null; // No cached thumbnail
    },
  },

  viewer: {
    async openFullscreen(filePath: string, fileList?: string[]) {
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('Mock: Opening fullscreen viewer for', filePath);
      console.log('Mock: File list contains', fileList?.length || 0, 'files');
      return { success: true };
    },

    async close() {
      await new Promise(resolve => setTimeout(resolve, 50));
      console.log('Mock: Closing fullscreen viewer');
      return { success: true };
    },
  },

  editor: {
    async openImage(filePath: string) {
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('Mock: Opening image editor for', filePath);
      return { success: true };
    },
  },

  favorites: {
    async getFavorites() {
      await new Promise(resolve => setTimeout(resolve, 50));
      return [...mockFavorites];
    },

    async addFavorite(name: string, path: string) {
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('Mock: Add favorite', { name, path });
      mockFavorites.push({
        id: Date.now().toString(),
        name,
        path,
      });
      return { success: true };
    },

    async removeFavorite(id: string) {
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('Mock: Remove favorite', id);
      const index = mockFavorites.findIndex(f => f.id === id);
      if (index >= 0) {
        mockFavorites.splice(index, 1);
      }
      return { success: true };
    },

    async updateFavorite(id: string, updates: any) {
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('Mock: Update favorite', id, updates);
      const favorite = mockFavorites.find(f => f.id === id);
      if (favorite) {
        Object.assign(favorite, updates);
      }
      return { success: true };
    },

    async reorderFavorites(favoriteIds: string[]) {
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('Mock: Reorder favorites', favoriteIds);
      return { success: true };
    },
  },

  export: {
    async exportFiles(files: any[], settings: any) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('Mock: Export files', { files, settings });
      return { success: true };
    },
  },

  configuration: {
    async getSettings() {
      await new Promise(resolve => setTimeout(resolve, 100));
      return {
        theme: 'auto',
        language: 'en',
        thumbnailSize: 80,
        cacheSize: 512,
        gpuAcceleration: true,
      };
    },

    async saveSettings(settings: any) {
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('Mock: Save settings', settings);
      return { success: true };
    },

    async exportConfiguration() {
      await new Promise(resolve => setTimeout(resolve, 200));
      return {
        success: true,
        data: {
          favorites: mockFavorites,
          tags: mockTagHierarchy,
          settings: {
            theme: 'auto',
            language: 'en',
          },
        },
      };
    },

    async importConfiguration(data: any) {
      await new Promise(resolve => setTimeout(resolve, 200));
      console.log('Mock: Import configuration', data);
      return { success: true };
    },
  },
});

// Initialize mock API if not in production
export const initializeMockAPI = () => {
  console.log('🔧 Checking Mock API initialization...');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('window.electronAPI exists:', !!window.electronAPI);
  
  if (process.env.NODE_ENV === 'development' && !window.electronAPI) {
    console.log('🔧 Initializing Mock Electron API for development');
    const mockAPI = createMockElectronAPI();
    console.log('🔧 Mock API created:', mockAPI);
    console.log('🔧 Mock API has rating:', !!mockAPI.rating);
    window.electronAPI = mockAPI;
    console.log('🔧 Mock API assigned to window.electronAPI');
  } else if (window.electronAPI) {
    console.log('🔧 Real electronAPI already exists');
    console.log('🔧 Real API has rating:', !!window.electronAPI.rating);
  }
};