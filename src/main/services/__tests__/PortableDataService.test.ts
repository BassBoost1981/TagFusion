import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PortableDataService } from '../PortableDataService';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

// Mock Electron app
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/userdata'),
    on: vi.fn(),
    quit: vi.fn()
  }
}));

// Mock process
const mockProcess = {
  execPath: '/test/app/PortableImageManager-portable.exe',
  platform: 'win32',
  on: vi.fn(),
  exit: vi.fn()
};

Object.defineProperty(global, 'process', {
  value: mockProcess,
  writable: true
});

describe('PortableDataService', () => {
  let service: PortableDataService;
  let testDataDir: string;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create test directory
    testDataDir = join(__dirname, 'test-portable-data');
    if (existsSync(testDataDir)) {
      rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDataDir)) {
      rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  describe('Portable Mode Detection', () => {
    it('should detect portable mode from executable name', () => {
      mockProcess.execPath = '/test/app/PortableImageManager-portable.exe';
      service = new PortableDataService();
      
      expect(service.isPortableMode()).toBe(true);
    });

    it('should detect portable mode from temp directory', () => {
      mockProcess.execPath = '/temp/extracted/app.exe';
      service = new PortableDataService();
      
      expect(service.isPortableMode()).toBe(true);
    });

    it('should not detect portable mode for regular installation', () => {
      mockProcess.execPath = '/Program Files/PortableImageManager/app.exe';
      service = new PortableDataService();
      
      expect(service.isPortableMode()).toBe(false);
    });
  });

  describe('Path Management', () => {
    beforeEach(() => {
      mockProcess.execPath = '/test/app/PortableImageManager-portable.exe';
      service = new PortableDataService();
    });

    it('should provide correct config path', () => {
      const configPath = service.getConfigPath('settings.json');
      expect(configPath).toContain('PortableData');
      expect(configPath).toContain('config');
      expect(configPath).toContain('settings.json');
    });

    it('should provide correct temp path', () => {
      const tempPath = service.getTempPath('thumbnail.jpg');
      expect(tempPath).toContain('PortableData');
      expect(tempPath).toContain('temp');
      expect(tempPath).toContain('thumbnail.jpg');
    });

    it('should provide correct cache path', () => {
      const cachePath = service.getCachePath('cache.dat');
      expect(cachePath).toContain('PortableData');
      expect(cachePath).toContain('cache');
      expect(cachePath).toContain('cache.dat');
    });
  });

  describe('Configuration Management', () => {
    beforeEach(() => {
      mockProcess.execPath = testDataDir + '/PortableImageManager-portable.exe';
      service = new PortableDataService();
    });

    it('should save and load configuration', () => {
      const testConfig = {
        language: 'de',
        theme: 'dark',
        favorites: []
      };

      service.saveConfig('test-settings.json', testConfig);
      const loadedConfig = service.loadConfig('test-settings.json', {});

      expect(loadedConfig).toEqual(testConfig);
    });

    it('should return default value for non-existent config', () => {
      const defaultConfig = { language: 'en' };
      const loadedConfig = service.loadConfig('non-existent.json', defaultConfig);

      expect(loadedConfig).toEqual(defaultConfig);
    });

    it('should handle corrupted config files gracefully', () => {
      // Create a corrupted config file
      const configPath = service.getConfigPath('corrupted.json');
      mkdirSync(join(configPath, '..'), { recursive: true });
      require('fs').writeFileSync(configPath, 'invalid json content');

      const defaultConfig = { language: 'en' };
      const loadedConfig = service.loadConfig('corrupted.json', defaultConfig);

      expect(loadedConfig).toEqual(defaultConfig);
    });
  });

  describe('Temporary Data Management', () => {
    beforeEach(() => {
      mockProcess.execPath = testDataDir + '/PortableImageManager-portable.exe';
      service = new PortableDataService();
    });

    it('should save and load temporary data', () => {
      const testData = Buffer.from('test thumbnail data');

      service.saveTempData('test-thumb.jpg', testData);
      const loadedData = service.loadTempData('test-thumb.jpg');

      expect(loadedData).toEqual(testData);
    });

    it('should return null for non-existent temp data', () => {
      const loadedData = service.loadTempData('non-existent.jpg');
      expect(loadedData).toBeNull();
    });

    it('should clear all temporary data', () => {
      service.saveTempData('temp1.jpg', Buffer.from('data1'));
      service.saveTempData('temp2.jpg', Buffer.from('data2'));

      service.clearTempData();

      expect(service.loadTempData('temp1.jpg')).toBeNull();
      expect(service.loadTempData('temp2.jpg')).toBeNull();
    });
  });

  describe('Cache Data Management', () => {
    beforeEach(() => {
      mockProcess.execPath = testDataDir + '/PortableImageManager-portable.exe';
      service = new PortableDataService();
    });

    it('should save and load cache data', () => {
      const testData = Buffer.from('cached thumbnail');

      service.saveCacheData('cache-thumb.jpg', testData);
      const loadedData = service.loadCacheData('cache-thumb.jpg');

      expect(loadedData).toEqual(testData);
    });

    it('should clear all cache data', () => {
      service.saveCacheData('cache1.jpg', Buffer.from('data1'));
      service.saveCacheData('cache2.jpg', Buffer.from('data2'));

      service.clearCacheData();

      expect(service.loadCacheData('cache1.jpg')).toBeNull();
      expect(service.loadCacheData('cache2.jpg')).toBeNull();
    });
  });

  describe('Storage Statistics', () => {
    beforeEach(() => {
      mockProcess.execPath = testDataDir + '/PortableImageManager-portable.exe';
      service = new PortableDataService();
    });

    it('should provide storage statistics', () => {
      const stats = service.getStorageStats();

      expect(stats).toHaveProperty('isPortable');
      expect(stats).toHaveProperty('appDataPath');
      expect(stats).toHaveProperty('configSize');
      expect(stats).toHaveProperty('tempSize');
      expect(stats).toHaveProperty('cacheSize');
      expect(typeof stats.configSize).toBe('number');
      expect(typeof stats.tempSize).toBe('number');
      expect(typeof stats.cacheSize).toBe('number');
    });
  });

  describe('Cleanup Handlers', () => {
    beforeEach(() => {
      mockProcess.execPath = testDataDir + '/PortableImageManager-portable.exe';
    });

    it('should register cleanup handlers for portable mode', () => {
      service = new PortableDataService();

      // Verify that process event handlers were registered
      expect(mockProcess.on).toHaveBeenCalledWith('exit', expect.any(Function));
      expect(mockProcess.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(mockProcess.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    });

    it('should not register cleanup handlers for non-portable mode', () => {
      mockProcess.execPath = '/Program Files/PortableImageManager/app.exe';
      vi.clearAllMocks();
      
      service = new PortableDataService();

      // Should have fewer event handlers registered
      const exitCalls = (mockProcess.on as any).mock.calls.filter(
        (call: any[]) => call[0] === 'exit'
      );
      expect(exitCalls.length).toBe(0);
    });
  });
});