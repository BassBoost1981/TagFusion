import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron
vi.mock('electron', () => ({
  app: {
    isPackaged: false
  }
}));

describe('environment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear the module cache to ensure fresh imports
    vi.resetModules();
  });

  describe('isDev', () => {
    it('should return true when NODE_ENV is development', async () => {
      process.env.NODE_ENV = 'development';
      
      const { isDev } = await import('../environment');
      
      expect(isDev).toBe(true);
    });

    it('should return true when app is not packaged', async () => {
      process.env.NODE_ENV = 'production';
      
      const { app } = await import('electron');
      vi.mocked(app.isPackaged) = false;
      
      const { isDev } = await import('../environment');
      
      expect(isDev).toBe(true);
    });

    it('should return false when NODE_ENV is production and app is packaged', async () => {
      process.env.NODE_ENV = 'production';
      
      const { app } = await import('electron');
      vi.mocked(app.isPackaged) = true;
      
      const { isDev } = await import('../environment');
      
      expect(isDev).toBe(false);
    });

    it('should return true when NODE_ENV is undefined and app is not packaged', async () => {
      delete process.env.NODE_ENV;
      
      const { app } = await import('electron');
      vi.mocked(app.isPackaged) = false;
      
      const { isDev } = await import('../environment');
      
      expect(isDev).toBe(true);
    });
  });
});