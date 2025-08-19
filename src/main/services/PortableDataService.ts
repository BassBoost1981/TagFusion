import { app } from 'electron';
import { join, dirname } from 'path';
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { promisify } from 'util';

/**
 * Service for managing portable data storage
 * Ensures all configuration and temporary files are stored relative to the executable
 * and no traces are left on the host system
 */
export class PortableDataService {
  private readonly isPortable: boolean;
  private readonly appDataPath: string;
  private readonly configPath: string;
  private readonly tempPath: string;
  private readonly cachePath: string;

  constructor() {
    // Detect if running as portable app
    this.isPortable = this.detectPortableMode();
    
    // Set up data paths based on portable mode
    if (this.isPortable) {
      // Store data relative to executable
      const executablePath = process.execPath;
      const executableDir = dirname(executablePath);
      this.appDataPath = join(executableDir, 'PortableData');
    } else {
      // Use standard Electron userData directory for installed version
      this.appDataPath = app.getPath('userData');
    }

    this.configPath = join(this.appDataPath, 'config');
    this.tempPath = join(this.appDataPath, 'temp');
    this.cachePath = join(this.appDataPath, 'cache');

    this.initializeDirectories();
    this.setupCleanupHandlers();
  }

  /**
   * Detect if the application is running in portable mode
   */
  private detectPortableMode(): boolean {
    // Check if running from a portable executable
    const executablePath = process.execPath;
    const executableName = executablePath.toLowerCase();
    
    // Portable apps typically have 'portable' in the name or are in a temp directory
    if (executableName.includes('portable')) {
      return true;
    }

    // Check if running from a temporary directory (common for portable apps)
    const tempDirs = ['temp', 'tmp', 'appdata\\local\\temp'];
    const isInTempDir = tempDirs.some(tempDir => 
      executablePath.toLowerCase().includes(tempDir)
    );

    // Check for portable indicator file
    const portableIndicator = join(dirname(executablePath), '.portable');
    const hasPortableIndicator = existsSync(portableIndicator);

    return isInTempDir || hasPortableIndicator;
  }

  /**
   * Initialize required directories
   */
  private initializeDirectories(): void {
    const directories = [
      this.appDataPath,
      this.configPath,
      this.tempPath,
      this.cachePath
    ];

    directories.forEach(dir => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Setup cleanup handlers to remove traces when app exits
   */
  private setupCleanupHandlers(): void {
    if (!this.isPortable) {
      return; // No cleanup needed for installed version
    }

    const cleanup = () => {
      try {
        // Clean up temporary files
        if (existsSync(this.tempPath)) {
          rmSync(this.tempPath, { recursive: true, force: true });
        }

        // Clean up cache files (but keep config)
        if (existsSync(this.cachePath)) {
          rmSync(this.cachePath, { recursive: true, force: true });
        }

        console.log('Portable app cleanup completed');
      } catch (error) {
        console.error('Error during portable app cleanup:', error);
      }
    };

    // Handle various exit scenarios
    process.on('exit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('SIGUSR1', cleanup);
    process.on('SIGUSR2', cleanup);
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
      cleanup();
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled rejection at:', promise, 'reason:', reason);
      cleanup();
      process.exit(1);
    });

    // Handle app quit
    app.on('before-quit', cleanup);
    app.on('will-quit', cleanup);
  }

  /**
   * Get the configuration file path
   */
  getConfigPath(filename: string): string {
    return join(this.configPath, filename);
  }

  /**
   * Get the temporary file path
   */
  getTempPath(filename: string): string {
    return join(this.tempPath, filename);
  }

  /**
   * Get the cache file path
   */
  getCachePath(filename: string): string {
    return join(this.cachePath, filename);
  }

  /**
   * Check if running in portable mode
   */
  isPortableMode(): boolean {
    return this.isPortable;
  }

  /**
   * Get the app data directory path
   */
  getAppDataPath(): string {
    return this.appDataPath;
  }

  /**
   * Save configuration data
   */
  saveConfig(filename: string, data: any): void {
    const filePath = this.getConfigPath(filename);
    const jsonData = JSON.stringify(data, null, 2);
    writeFileSync(filePath, jsonData, 'utf8');
  }

  /**
   * Load configuration data
   */
  loadConfig<T>(filename: string, defaultValue: T): T {
    const filePath = this.getConfigPath(filename);
    
    if (!existsSync(filePath)) {
      return defaultValue;
    }

    try {
      const jsonData = readFileSync(filePath, 'utf8');
      return JSON.parse(jsonData) as T;
    } catch (error) {
      console.error(`Error loading config ${filename}:`, error);
      return defaultValue;
    }
  }

  /**
   * Save temporary data
   */
  saveTempData(filename: string, data: Buffer | string): void {
    const filePath = this.getTempPath(filename);
    writeFileSync(filePath, data);
  }

  /**
   * Load temporary data
   */
  loadTempData(filename: string): Buffer | null {
    const filePath = this.getTempPath(filename);
    
    if (!existsSync(filePath)) {
      return null;
    }

    try {
      return readFileSync(filePath);
    } catch (error) {
      console.error(`Error loading temp data ${filename}:`, error);
      return null;
    }
  }

  /**
   * Save cache data
   */
  saveCacheData(filename: string, data: Buffer | string): void {
    const filePath = this.getCachePath(filename);
    writeFileSync(filePath, data);
  }

  /**
   * Load cache data
   */
  loadCacheData(filename: string): Buffer | null {
    const filePath = this.getCachePath(filename);
    
    if (!existsSync(filePath)) {
      return null;
    }

    try {
      return readFileSync(filePath);
    } catch (error) {
      console.error(`Error loading cache data ${filename}:`, error);
      return null;
    }
  }

  /**
   * Clear all temporary data
   */
  clearTempData(): void {
    if (existsSync(this.tempPath)) {
      rmSync(this.tempPath, { recursive: true, force: true });
      mkdirSync(this.tempPath, { recursive: true });
    }
  }

  /**
   * Clear all cache data
   */
  clearCacheData(): void {
    if (existsSync(this.cachePath)) {
      rmSync(this.cachePath, { recursive: true, force: true });
      mkdirSync(this.cachePath, { recursive: true });
    }
  }

  /**
   * Get storage statistics
   */
  getStorageStats(): {
    isPortable: boolean;
    appDataPath: string;
    configSize: number;
    tempSize: number;
    cacheSize: number;
  } {
    const getDirectorySize = (dirPath: string): number => {
      if (!existsSync(dirPath)) return 0;
      
      try {
        const { execSync } = require('child_process');
        if (process.platform === 'win32') {
          const output = execSync(`powershell -command "(Get-ChildItem -Path '${dirPath}' -Recurse | Measure-Object -Property Length -Sum).Sum"`, { encoding: 'utf8' });
          return parseInt(output.trim()) || 0;
        } else {
          const output = execSync(`du -sb "${dirPath}" | cut -f1`, { encoding: 'utf8' });
          return parseInt(output.trim()) || 0;
        }
      } catch {
        return 0;
      }
    };

    return {
      isPortable: this.isPortable,
      appDataPath: this.appDataPath,
      configSize: getDirectorySize(this.configPath),
      tempSize: getDirectorySize(this.tempPath),
      cacheSize: getDirectorySize(this.cachePath)
    };
  }
}